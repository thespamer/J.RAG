from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig
from transformers.utils.hub import init_empty_weights
from accelerate import load_checkpoint_and_dispatch
from huggingface_hub import snapshot_download, hf_hub_download
from tqdm import tqdm
import logging
import os
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)
from utils.config import Config
from .memory_manager import MemoryManager
from .system_manager import SystemManager

class LLMManager:
    def __init__(self, memory_manager: Optional[MemoryManager] = None, system_manager: Optional[SystemManager] = None):
        self.config = Config()
        self.memory_manager = memory_manager
        self.system_manager = system_manager
        self.model = None
        self.tokenizer = None
        self.initialize_model()

    def initialize_model(self) -> None:
        """Initialize the DeepSeek LLM model with memory optimizations"""
        try:
            if self.system_manager:
                self.system_manager.update_model_status('downloading', 0)
            logger.info("Starting DeepSeek LLM model download...")
            
            # Primeiro baixar o modelo usando snapshot_download para evitar OOM
            if not self._check_model_downloaded():
                self._download_model()
            
            # Preparar argumentos para o modelo
            model_args = {
                "device_map": "auto",
                "low_cpu_mem_usage": True,
                "use_safetensors": True  # Otimizar uso de memória durante carregamento
            }
            
            # Adicionar argumentos opcionais se memory_manager estiver disponível
            if self.memory_manager:
                model_args.update({
                    "offload_folder": self.memory_manager.offload_dir,
                    "cache_dir": self.memory_manager.cache_dir
                })
            
            # Adicionar callback se system_manager estiver disponível
            if self.system_manager:
                model_args["callbacks"] = [self._download_progress_callback]
            
            # First try loading with CPU offload
            self.model = AutoModelForCausalLM.from_pretrained(
                "deepseek-ai/deepseek-llm-7b-base",
                **model_args
            )
            
            logger.info("Model downloaded successfully, loading tokenizer...")
            if self.system_manager:
                self.system_manager.update_model_status('loading_tokenizer', 100)
            
            # Preparar argumentos para o tokenizer
            tokenizer_args = {}
            if self.memory_manager:
                tokenizer_args["cache_dir"] = self.memory_manager.cache_dir
            
            self.tokenizer = AutoTokenizer.from_pretrained(
                "deepseek-ai/deepseek-llm-7b-base",
                **tokenizer_args
            )
            
            logger.info("Model and tokenizer loaded successfully")
            if self.system_manager:
                self.system_manager.update_model_status('ready', 100)
            
        except Exception as e:
            error_msg = f"Error loading model: {e}"
            logger.error(error_msg)
            if self.system_manager:
                self.system_manager.update_model_status('error', 0, error_msg)
            
            logger.info("Falling back to manual loading...")
            if self.memory_manager:
                self.memory_manager.clean_corrupted_cache()
            self.load_model_manually()

    def load_model_manually(self) -> None:
        """Manual loading approach with memory optimization"""
        config = AutoConfig.from_pretrained("deepseek-ai/deepseek-llm-7b-base")
        
        # Initialize empty model
        with init_empty_weights():
            self.model = AutoModelForCausalLM.from_config(config)
        
        # Preparar argumentos para o carregamento
        load_args = {
            "device_map": "auto"
        }
        
        if self.memory_manager:
            load_args["offload_folder"] = self.memory_manager.offload_dir
        
        # Load checkpoint with device mapping
        self.model = load_checkpoint_and_dispatch(
            self.model,
            "deepseek-ai/deepseek-llm-7b-base",
            **load_args
        )

    def generate_response(self, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Generate response using the LLM"""
        try:
            # Prepare input with context
            input_text = self._prepare_input(message, context)
            
            # Tokenize
            inputs = self.tokenizer(input_text, return_tensors="pt")
            
            # Generate
            outputs = self.model.generate(
                inputs["input_ids"],
                max_length=2048,
                temperature=0.7,
                top_p=0.95,
                do_sample=True
            )
            
            # Decode and return
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            return response.strip()
            
        except Exception as e:
            error_msg = f"Error generating response: {e}"
            logger.error(error_msg)
            return error_msg

    def _download_progress_callback(self, progress: float) -> None:
        """Callback para atualizar o progresso do download"""
        if progress > 0:
            logger.info(f"Download progress: {progress:.1f}%")
            if self.system_manager:
                self.system_manager.update_model_status('downloading', progress)
    
    def get_model_status(self) -> Dict[str, Any]:
        """Get current model status"""
        status = {
            "model_loaded": self.model is not None,
            "tokenizer_loaded": self.tokenizer is not None,
            "device": str(next(self.model.parameters()).device) if self.model else "none"
        }
        
        # Adicionar informações de memória se disponível
        if self.memory_manager:
            status["memory_usage"] = self.memory_manager.get_memory_usage()
        
        # Adicionar informações de status do modelo do SystemManager se disponível
        if self.system_manager:
            status.update(self.system_manager.get_model_status())
        
        return status

    def _check_model_downloaded(self) -> bool:
        """Verifica se o modelo já está baixado corretamente"""
        try:
            # Verificar cache do transformers
            if self.memory_manager:
                model_path = os.path.join(self.memory_manager.cache_dir, "models--deepseek-ai--deepseek-llm-7b-base")
                if not os.path.exists(model_path):
                    logger.info("Model not found in transformers cache")
                    return False
                
                # Verificar arquivos essenciais
                required_files = [
                    "config.json",
                    "model.safetensors",
                    "tokenizer.json",
                    "tokenizer_config.json"
                ]
                
                for file in required_files:
                    if not os.path.exists(os.path.join(model_path, "snapshots", file)):
                        logger.info(f"Missing required file: {file}")
                        return False
                
                logger.info("All model files found in cache")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking model files: {e}")
            return False
    
    def _download_model(self) -> None:
        """Download do modelo usando snapshot_download para otimizar memória"""
        try:
            if self.memory_manager:
                # Usar snapshot_download para baixar apenas os arquivos sem carregar o modelo
                snapshot_download(
                    "deepseek-ai/deepseek-llm-7b-base",
                    cache_dir=self.memory_manager.cache_dir,
                    local_files_only=False,
                    resume_download=True,
                    use_safetensors=True
                )
                logger.info("Model downloaded successfully using snapshot_download")
            else:
                logger.warning("No memory manager available for model download")
                
        except Exception as e:
            error_msg = f"Error downloading model: {e}"
            logger.error(error_msg)
            if self.system_manager:
                self.system_manager.update_model_status('error', 0, error_msg)
            raise
    
    def _prepare_input(self, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Prepare input text with context"""
        if not context:
            return message
            
        # Add context to the prompt
        context_str = "\n".join([f"{k}: {v}" for k, v in context.items()])
        return f"Context:\n{context_str}\n\nUser: {message}"
