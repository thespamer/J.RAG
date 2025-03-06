from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig
from huggingface_hub import hf_hub_download, snapshot_download
from accelerate import init_empty_weights, load_checkpoint_and_dispatch
from tqdm import tqdm
import logging
from typing import Optional
import os

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

    def initialize_model(self):
        """Initialize the DeepSeek LLM model with memory optimizations"""
        try:
            # Verificar se temos system_manager antes de usar
            if self.system_manager:
                self.system_manager.update_model_status('downloading', 0)
            logger.info("Starting DeepSeek LLM model download...")
            
            # Preparar argumentos para o modelo
            model_args = {
                "device_map": "auto",
                "low_cpu_mem_usage": True
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

    def load_model_manually(self):
        """Manual loading approach with memory optimization using accelerate"""
        try:
            logger.info("Attempting manual model loading with accelerate...")
            
            # Download model files first
            if self.system_manager:
                self.system_manager.update_model_status('downloading', 0)
            
            # Use snapshot_download for efficient downloading
            cache_dir = self.memory_manager.cache_dir if self.memory_manager else None
            model_path = snapshot_download(
                "deepseek-ai/deepseek-llm-7b-base",
                cache_dir=cache_dir,
                local_files_only=False
            )
            
            if self.system_manager:
                self.system_manager.update_model_status('downloading', 50)
            
            # Load config
            config = AutoConfig.from_pretrained(model_path)
            
            # Initialize empty model with accelerate
            with init_empty_weights():
                self.model = AutoModelForCausalLM.from_config(config)
            
            # Load checkpoint with device mapping
            offload_folder = self.memory_manager.offload_dir if self.memory_manager else None
            self.model = load_checkpoint_and_dispatch(
                self.model,
                model_path,
                device_map="auto",
                offload_folder=offload_folder,
                no_split_module_classes=["DeepSeekBlock"]
            )
            
            if self.system_manager:
                self.system_manager.update_model_status('loading_tokenizer', 100)
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                cache_dir=cache_dir
            )
            
            logger.info("Manual model loading completed successfully")
            if self.system_manager:
                self.system_manager.update_model_status('ready', 100)
                
        except Exception as e:
            error_msg = f"Error in manual model loading: {str(e)}"
            logger.error(error_msg)
            if self.system_manager:
                self.system_manager.update_model_status('error', 0, error_msg)
            raise

    def generate_response(self, message: str, context: dict = None) -> str:
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
            print(f"Error generating response: {e}")
            return f"Error generating response: {str(e)}"

    def _download_progress_callback(self, progress: float):
        """Callback para atualizar o progresso do download"""
        if progress > 0:
            logger.info(f"Download progress: {progress:.1f}%")
            if self.system_manager:
                self.system_manager.update_model_status('downloading', progress)
    
    def get_model_status(self) -> dict:
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

    def _prepare_input(self, message: str, context: dict = None) -> str:
        """Prepare input text with context"""
        if not context:
            return message
            
        # Add context to the prompt
        context_str = "\n".join([f"{k}: {v}" for k, v in context.items()])
        return f"Context:\n{context_str}\n\nUser: {message}"
