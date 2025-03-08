import os
# Desabilitar hf_transfer antes de qualquer importação
os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '0'
os.environ['HF_TRANSFER_DISABLE'] = '1'

import torch
import time
import glob
import sys
import importlib

# Forçar desativação do hf_transfer em sys.modules
for module_name in list(sys.modules.keys()):
    if any(name in module_name.lower() for name in ['huggingface', 'transformers']):
        sys.modules.pop(module_name, None)

# Agora importar os módulos
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig, GenerationConfig
from huggingface_hub import hf_hub_download, snapshot_download
from huggingface_hub.utils import DownloadConfiguration
from accelerate import init_empty_weights, load_checkpoint_and_dispatch
from tqdm import tqdm
import logging
from typing import Optional, Dict, List

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
        
        # Garantir que os diretórios existam e tenham permissões corretas
        self._ensure_directories()
        
        # Limpar cache antes de inicializar
        if self.memory_manager:
            self.memory_manager.clean_corrupted_cache()
        
        self.initialize_model()
        
    def _ensure_directories(self):
        """Ensure all required directories exist and have correct permissions"""
        try:
            # Definir diretórios base
            base_dirs = [
                '/app/models_cache',
                '/app/models_cache/transformers',
                '/app/models_cache/huggingface',
                '/app/models_cache/offload'
            ]
            
            # Criar e verificar permissões
            for dir_path in base_dirs:
                os.makedirs(dir_path, mode=0o755, exist_ok=True)
                
                # Verificar permissões
                if not os.access(dir_path, os.W_OK):
                    os.chmod(dir_path, 0o755)
                
                # Limpar diretório agressivamente
                self._clean_directory(dir_path)
                logger.info(f"Ensured directory exists and is writable: {dir_path}")
                
        except Exception as e:
            logger.error(f"Error ensuring directories: {e}")
            raise RuntimeError(f"Failed to setup required directories: {e}")

    def _clean_directory(self, directory: str, min_free_space_gb: float = 10.0):
        """Clean directory aggressively to ensure enough free space"""
        try:
            import shutil
            from pathlib import Path

            # Se o diretório não existe, nada a fazer
            if not os.path.exists(directory):
                return

            # Verificar espaço disponível
            total, used, free = shutil.disk_usage(directory)
            free_gb = free / (1024 * 1024 * 1024)

            # Se já temos espaço suficiente, limpar apenas arquivos temporários
            if free_gb >= min_free_space_gb:
                patterns_to_clean = ['*.temp', '*.tmp', '*.lock', '*.log']
                for pattern in patterns_to_clean:
                    for file in Path(directory).rglob(pattern):
                        try:
                            os.remove(file)
                        except:
                            pass
                return

            # Limpar todos os arquivos e subdiretórios
            for item in os.listdir(directory):
                item_path = os.path.join(directory, item)
                try:
                    if os.path.isfile(item_path):
                        os.remove(item_path)
                    elif os.path.isdir(item_path):
                        shutil.rmtree(item_path, ignore_errors=True)
                except Exception as e:
                    logger.warning(f"Error removing {item_path}: {e}")

            # Verificar se conseguimos liberar espaço suficiente
            _, _, free = shutil.disk_usage(directory)
            free_gb = free / (1024 * 1024 * 1024)
            if free_gb < min_free_space_gb:
                logger.warning(
                    f"Even after aggressive cleanup, only {free_gb:.1f}GB free. "
                    f"This might cause issues during model download."
                )

        except Exception as e:
            logger.error(f"Error cleaning directory {directory}: {e}")

    def initialize_model(self):
        """Initialize the DeepSeek LLM model with memory optimizations"""
        try:
            # 1. Preparar ambiente e recursos
            if self.memory_manager:
                # Limpar cache antes de qualquer operação
                self.memory_manager.clean_corrupted_cache()
                self.memory_manager.prepare_for_model_loading()
                
                # Verificar recursos após limpeza
                has_resources, available_gb = self.memory_manager.check_available_memory()
                if not has_resources:
                    raise RuntimeError(f"Insufficient memory. Available: {available_gb:.1f}GB")

            if self.system_manager:
                self.system_manager.update_model_status('preparing', 0)

            # 2. Configurar diretórios e variáveis de ambiente
            model_dir = os.path.join(self.memory_manager.cache_dir if self.memory_manager else '/tmp', 'models')
            offload_dir = os.path.join(self.memory_manager.offload_dir if self.memory_manager else '/tmp', 'offload')
            
            os.makedirs(model_dir, exist_ok=True)
            os.makedirs(offload_dir, exist_ok=True)
            
            # Desabilitar hf_transfer em runtime
            import sys
            import importlib
            import huggingface_hub
            import huggingface_hub.constants
            import huggingface_hub.file_download
            import transformers.utils.hub
            import transformers.utils.hub_utils
            
            # Monkey patch huggingface_hub
            def disable_hf_transfer():
                # Desabilitar em huggingface_hub
                huggingface_hub.constants.HF_HUB_ENABLE_HF_TRANSFER = False
                if hasattr(huggingface_hub.file_download, 'USE_HF_TRANSFER'):
                    huggingface_hub.file_download.USE_HF_TRANSFER = False
                
                # Desabilitar em transformers
                modules_to_patch = [
                    'transformers.utils.hub',
                    'transformers.file_utils',
                    'transformers.utils.hub_utils',
                    'transformers.models.auto.configuration_auto',
                    'transformers.models.auto.modeling_auto',
                    'transformers.models.auto.tokenization_auto'
                ]
                
                for module_name in modules_to_patch:
                    if module_name in sys.modules:
                        module = sys.modules[module_name]
                        if hasattr(module, 'HF_HUB_ENABLE_HF_TRANSFER'):
                            setattr(module, 'HF_HUB_ENABLE_HF_TRANSFER', False)
                        if hasattr(module, 'USE_HF_TRANSFER'):
                            setattr(module, 'USE_HF_TRANSFER', False)
                
                # Patch todos os métodos de download
                methods_to_patch = [
                    (huggingface_hub.file_download, 'http_get'),
                    (huggingface_hub.file_download, '_download_with_hf_transfer'),
                    (transformers.utils.hub_utils, 'cached_file'),
                    (transformers.utils.hub_utils, 'get_file_from_repo')
                ]
                
                for module, method_name in methods_to_patch:
                    if hasattr(module, method_name):
                        original_method = getattr(module, method_name)
                        def make_patched_method(orig):
                            def patched_method(*args, **kwargs):
                                kwargs['use_hf_transfer'] = False
                                if 'download_config' in kwargs:
                                    if hasattr(kwargs['download_config'], '_attrs'):
                                        kwargs['download_config']._attrs = {k: v for k, v in kwargs['download_config']._attrs.items()
                                                                           if 'hf_transfer' not in str(k).lower()}
                                return orig(*args, **kwargs)
                            return patched_method
                        setattr(module, method_name, make_patched_method(original_method))
                
                # Recarregar módulos para garantir que as alterações sejam aplicadas
                modules_to_reload = [
                    huggingface_hub.constants,
                    huggingface_hub.file_download,
                    transformers.utils.hub_utils
                ]
                
                for module in modules_to_reload:
                    try:
                        importlib.reload(module)
                    except:
                        pass
                
                # Verificar se o hf_transfer está realmente desabilitado
                def verify_hf_transfer_disabled():
                    checks = [
                        (huggingface_hub.constants, 'HF_HUB_ENABLE_HF_TRANSFER'),
                        (huggingface_hub.file_download, 'USE_HF_TRANSFER')
                    ]
                    
                    for module, attr in checks:
                        if hasattr(module, attr) and getattr(module, attr):
                            logger.warning(f"Found {attr} still enabled in {module.__name__}")
                            setattr(module, attr, False)
                
                verify_hf_transfer_disabled()
            
            # Aplicar patches
            disable_hf_transfer()
            
            # Limpar TODAS as variáveis de ambiente relacionadas
            env_prefixes = ['HF_', 'TRANSFORMERS_', 'TORCH_', 'SAFETENSORS_']
            for key in list(os.environ.keys()):
                if any(key.startswith(prefix) for prefix in env_prefixes):
                    os.environ.pop(key)
            
            # Configurar variáveis de ambiente
            os.environ.update({
                'HF_HUB_ENABLE_HF_TRANSFER': '0',  # Desabilitar hf_transfer
                'HF_TRANSFER_DISABLE': '1',  # Desabilitar hf_transfer (alternativo)
                'TRANSFORMERS_OFFLINE': '0',  # Permitir download
                'HF_HUB_OFFLINE': '0',  # Garantir modo online
                'HF_HOME': model_dir,  # Cache dir
                'HF_HUB_CACHE': model_dir,  # Cache dir (alternativo)
                'TRANSFORMERS_CACHE': model_dir,  # Cache dir (legacy)
                'HF_HUB_DOWNLOAD_TIMEOUT': '600',  # Timeout maior
                'USE_TORCH': '1',  # Forçar PyTorch
                'TOKENIZERS_PARALLELISM': 'false'  # Evitar warnings
            })

            # 4. Configurar argumentos do modelo
            model_args = {
                # Parâmetros de download
                'cache_dir': model_dir,
                'local_files_only': False,
                'resume_download': True,
                'force_download': False,
                'use_hf_transfer': False,
                'use_auth_token': None,
                'token': None,
                'revision': 'main',
                'mirror': None,
                'local_dir': model_dir,
                'local_dir_use_symlinks': False,
                
                # Parâmetros de otimização de memória
                'low_cpu_mem_usage': True,
                'offload_folder': offload_dir,
                'offload_state_dict': True,
                'torch_dtype': torch.float16,
                'max_memory': {'cpu': '4GB'},
                'device_map': 'auto',
                
                # Parâmetros de segurança e compatibilidade
                'trust_remote_code': True,
                'use_safetensors': True,
                'ignore_mismatched_sizes': True,
                'use_fast': True,
                'use_flash_attention': False,
                'use_flash_attention_2': False,
                'use_better_transformer': False
            }

            # 4. Download e verificação do modelo
            logger.info("Starting model download...")
            if self.system_manager:
                self.system_manager.update_model_status('downloading', 0)

            try:
                # Configurar download com retry e progresso
                download_config = DownloadConfiguration(
                    resume_download=True,
                    force_download=False,
                    max_retries=5,  # Aumentar número de retentativas
                    use_auth_token=None,
                    token=None,
                    local_files_only=False,
                    use_hf_transfer=False,  # Desabilitar explicitamente hf_transfer
                    local_dir=model_dir,
                    local_dir_use_symlinks=False
                )
                
                # Garantir que hf_transfer esteja desabilitado
                if hasattr(download_config, 'use_hf_transfer'):
                    download_config.use_hf_transfer = False
                
                # Monkey patch o método de download se necessário
                if hasattr(huggingface_hub.file_download, '_download_with_hf_transfer'):
                    def disabled_hf_transfer(*args, **kwargs):
                        raise NotImplementedError("hf_transfer está desabilitado")
                    huggingface_hub.file_download._download_with_hf_transfer = disabled_hf_transfer

                # Arquivos essenciais para download
                files_to_download = [
                    'config.json',
                    'tokenizer.json',
                    'tokenizer_config.json',
                    'generation_config.json',
                    'special_tokens_map.json',
                    'model.safetensors'
                ]

                # Baixar arquivos essenciais com retry e backoff exponencial
                config_path = None
                for filename in files_to_download:
                    max_retries = 5
                    retry_delay = 1  # Delay inicial de 1 segundo
                    
                    for attempt in range(max_retries):
                        try:
                            if self.system_manager:
                                progress = (files_to_download.index(filename) / len(files_to_download)) * 30
                                self.system_manager.update_model_status('downloading', progress)
                            
                            # Verificar arquivo existente
                            local_path = os.path.join(model_dir, filename)
                            if os.path.exists(local_path):
                                file_size = os.path.getsize(local_path)
                                if file_size > 0:
                                    logger.info(f"File {filename} already exists with size {file_size/1024/1024:.1f}MB")
                                    if filename == 'config.json':
                                        config_path = local_path
                                    break
                                else:
                                    logger.warning(f"Found empty file {filename}, removing...")
                                    os.remove(local_path)
                            
                            # Baixar arquivo
                            downloaded_path = hf_hub_download(
                                repo_id='deepseek-ai/deepseek-coder-7b-base',
                                filename=filename,
                                cache_dir=model_dir,
                                local_files_only=False,
                                resume_download=True,
                                use_auth_token=None,
                                local_dir=model_dir,
                                use_hf_transfer=False
                            )
                            
                            # Verificar download
                            if not os.path.exists(downloaded_path) or os.path.getsize(downloaded_path) == 0:
                                raise RuntimeError(f"Download failed: {filename} is missing or empty")
                            
                            if filename == 'config.json':
                                config_path = downloaded_path
                            
                            logger.info(f"Successfully downloaded {filename}")
                            break
                            
                        except Exception as e:
                            if attempt == max_retries - 1:
                                error_msg = f"Failed to download {filename} after {max_retries} attempts: {e}"
                                logger.error(error_msg)
                                if self.system_manager:
                                    self.system_manager.update_model_status('error', 0, error=error_msg)
                                raise RuntimeError(error_msg)
                            
                            logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {retry_delay}s...")
                            if self.memory_manager:
                                self.memory_manager.clean_corrupted_cache()
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Backoff exponencial

                if not config_path:
                    raise RuntimeError("Failed to download or locate config.json")
                
                # Determinar caminho do modelo
                model_path = os.path.dirname(os.path.dirname(config_path))
                
                # Se faltarem arquivos, fazer download completo
                if not self.verify_model_files(model_path):
                    logger.info("Missing or corrupted files detected, downloading full model...")
                    if self.memory_manager:
                        self.memory_manager.clean_corrupted_cache()
                    
                    # Tentar download completo com retry e backoff
                    max_retries = 5
                    retry_delay = 1  # Delay inicial de 1 segundo
                    
                    for attempt in range(max_retries):
                        try:
                            if self.system_manager:
                                self.system_manager.update_model_status(
                                    'downloading',
                                    30 + ((attempt + 1) / max_retries) * 40
                                )

                            # Configurar download com retry e progresso
                            download_config = DownloadConfiguration(
                                resume_download=True,
                                force_download=(attempt > 0),  # Forçar download apenas em retentativas
                                max_retries=3,
                                use_auth_token=None,
                                local_files_only=False,
                                use_hf_transfer=False  # Desabilitar explicitamente hf_transfer
                            )

                            # Reforçar desativação do hf_transfer antes do download
                            disable_hf_transfer()
                            
                            # Configurar download manualmente para evitar hf_transfer
                            download_kwargs = {
                                'repo_id': 'deepseek-ai/deepseek-coder-7b-base',
                                'cache_dir': model_dir,
                                'local_files_only': False,
                                'resume_download': True,
                                'max_retries': 3,
                                'force_download': (attempt > 0),
                                'use_auth_token': None,
                                'local_dir': model_dir,
                                'use_hf_transfer': False,
                                'download_config': download_config,
                                'token': None,
                                'local_dir_use_symlinks': False
                            }
                            
                            # Remover qualquer referência ao hf_transfer do download_config
                            if hasattr(download_config, '_attrs'):
                                download_config._attrs = {k: v for k, v in download_config._attrs.items()
                                                        if 'hf_transfer' not in str(k).lower()}
                            
                            # Tentar download completo com verificações adicionais
                            model_path = snapshot_download(**download_kwargs)
                            
                            # Verificar download
                            if not os.path.exists(model_path):
                                raise RuntimeError("Model path does not exist after download")
                                
                            # Verificar arquivos essenciais
                            missing_files = []
                            for filename in files_to_download:
                                file_path = os.path.join(model_path, filename)
                                if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
                                    missing_files.append(filename)
                            
                            if missing_files:
                                raise RuntimeError(f"Missing or empty files after download: {', '.join(missing_files)}")
                            
                            logger.info("Successfully downloaded full model")
                            break
                            
                        except Exception as e:
                            if attempt == max_retries - 1:
                                error_msg = f"Failed to download model after {max_retries} attempts: {e}"
                                logger.error(error_msg)
                                if self.system_manager:
                                    self.system_manager.update_model_status('error', 0, error=error_msg)
                                raise RuntimeError(error_msg)
                            
                            logger.warning(f"Download attempt {attempt + 1} failed: {e}. Retrying in {retry_delay}s...")
                            if self.memory_manager:
                                self.memory_manager.clean_corrupted_cache()
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Backoff exponencial
                logger.info(f"Model files downloaded to {model_path}")
                
                # Verificar integridade dos arquivos
                if not self.verify_model_files(model_path):
                    raise RuntimeError("Model files verification failed")
                
                # 5. Carregar o modelo em duas etapas
                logger.info("Starting model loading...")
                if self.system_manager:
                    self.system_manager.update_model_status('loading', 0)

                # Etapa 1: Tentar carregar com device_map="cpu"
                try:
                    logger.info("Stage 1: Loading model with CPU device map...")
                    
                    # Reforçar desativação do hf_transfer
                    os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '0'
                    os.environ['HF_TRANSFER_DISABLE'] = '1'
                    disable_hf_transfer()
                    
                    # Patch AutoModelForCausalLM.from_pretrained
                    original_from_pretrained = AutoModelForCausalLM.from_pretrained
                    def patched_from_pretrained(*args, **kwargs):
                        kwargs['use_hf_transfer'] = False
                        if 'download_config' in kwargs:
                            if hasattr(kwargs['download_config'], '_attrs'):
                                kwargs['download_config']._attrs = {k: v for k, v in kwargs['download_config']._attrs.items()
                                                                   if 'hf_transfer' not in str(k).lower()}
                        return original_from_pretrained(*args, **kwargs)
                    AutoModelForCausalLM.from_pretrained = patched_from_pretrained
                    
                    # Configurar argumentos do modelo
                    model_args.update({
                        'device_map': 'cpu',
                        'torch_dtype': torch.float16,
                        'max_memory': {'cpu': '4GB'},
                        'offload_folder': offload_dir,
                        'use_hf_transfer': False,
                        'local_files_only': True,  # Forçar uso de arquivos locais
                        'use_auth_token': None,
                        'token': None
                    })
                    
                    # Carregar modelo
                    self.model = AutoModelForCausalLM.from_pretrained(
                        model_path,
                        **model_args
                    )
                    
                    # Restaurar método original
                    AutoModelForCausalLM.from_pretrained = original_from_pretrained
                    
                    logger.info("Successfully loaded model with CPU device map")
                    
                except Exception as cpu_error:
                    logger.warning(f"CPU loading failed: {cpu_error}")
                    
                    # Etapa 2: Usar abordagem manual com offload
                    logger.info("Stage 2: Loading with manual offload...")
                    if self.memory_manager:
                        self.memory_manager.clean_corrupted_cache()
                    
                    try:
                        # Reforçar desativação do hf_transfer
                        os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '0'
                        os.environ['HF_TRANSFER_DISABLE'] = '1'
                        disable_hf_transfer()
                        
                        # Patch AutoConfig.from_pretrained
                        original_config_from_pretrained = AutoConfig.from_pretrained
                        def patched_config_from_pretrained(*args, **kwargs):
                            kwargs['use_hf_transfer'] = False
                            kwargs['local_files_only'] = True
                            return original_config_from_pretrained(*args, **kwargs)
                        AutoConfig.from_pretrained = patched_config_from_pretrained
                        
                        try:
                            # Inicializar com pesos vazios
                            with init_empty_weights():
                                config = AutoConfig.from_pretrained(
                                    model_path,
                                    trust_remote_code=True,
                                    use_safetensors=True,
                                    use_hf_transfer=False,
                                    local_files_only=True
                                )
                                self.model = AutoModelForCausalLM.from_config(config)
                            
                            # Carregar e distribuir os pesos
                            self.model = load_checkpoint_and_dispatch(
                                self.model,
                                model_path,
                                device_map='disk',  # Forçar offload para disco
                                offload_folder=offload_dir,
                                no_split_module_classes=["DeepseekDecoderLayer"],
                                offload_state_dict=True,
                                dtype=torch.float16,  # Usar precisão reduzida
                                use_hf_transfer=False,
                                local_files_only=True
                            )
                        finally:
                            # Restaurar método original
                            AutoConfig.from_pretrained = original_config_from_pretrained
                        logger.info("Successfully loaded model with manual offload")
                        
                    except Exception as offload_error:
                        error_msg = f"Failed to load model with offload: {offload_error}"
                        logger.error(error_msg)
                        if self.system_manager:
                            self.system_manager.update_model_status('error', 0, error=error_msg)
                        raise RuntimeError(error_msg)

                # 6. Carregar o tokenizer
                logger.info("Loading tokenizer...")
                if self.system_manager:
                    self.system_manager.update_model_status('loading_tokenizer', 90)
                
                try:
                    # Reforçar desativação do hf_transfer
                    os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '0'
                    os.environ['HF_TRANSFER_DISABLE'] = '1'
                    disable_hf_transfer()
                    
                    # Patch AutoTokenizer.from_pretrained
                    original_tokenizer_from_pretrained = AutoTokenizer.from_pretrained
                    def patched_tokenizer_from_pretrained(*args, **kwargs):
                        kwargs['use_hf_transfer'] = False
                        kwargs['local_files_only'] = True
                        if 'download_config' in kwargs:
                            if hasattr(kwargs['download_config'], '_attrs'):
                                kwargs['download_config']._attrs = {k: v for k, v in kwargs['download_config']._attrs.items()
                                                                   if 'hf_transfer' not in str(k).lower()}
                        return original_tokenizer_from_pretrained(*args, **kwargs)
                    AutoTokenizer.from_pretrained = patched_tokenizer_from_pretrained
                    
                    try:
                        tokenizer_args = {
                            'use_fast': True,
                            'padding_side': 'left',
                            'truncation_side': 'left',
                            'model_max_length': 2048,
                            'cache_dir': model_dir,
                            'use_hf_transfer': False,
                            'local_files_only': True,
                            'use_auth_token': None,
                            'token': None
                        }
                        
                        self.tokenizer = AutoTokenizer.from_pretrained(
                            model_path,
                            **tokenizer_args
                        )
                    finally:
                        # Restaurar método original
                        AutoTokenizer.from_pretrained = original_tokenizer_from_pretrained
                    
                    # Verificar se o tokenizer está funcional
                    test_input = "Test input for tokenizer verification."
                    tokens = self.tokenizer.encode(test_input)
                    decoded = self.tokenizer.decode(tokens)
                    if not decoded.strip():
                        raise RuntimeError("Tokenizer validation failed")
                    
                    logger.info("Model and tokenizer loaded successfully")
                    if self.system_manager:
                        self.system_manager.update_model_status('ready', 100)
                    
                    return True
                    
                except Exception as tokenizer_error:
                    error_msg = f"Failed to load tokenizer: {tokenizer_error}"
                    logger.error(error_msg)
                    if self.system_manager:
                        self.system_manager.update_model_status('error', 0, error=error_msg)
                    raise RuntimeError(error_msg)
                    
            except Exception as e:
                error_msg = f"Error during model initialization: {str(e)}"
                logger.error(error_msg)
                if self.system_manager:
                    self.system_manager.update_model_status('error', 0, error=error_msg)
                
                # Limpar cache em caso de erro
                if self.memory_manager:
                    self.memory_manager.clean_corrupted_cache()
                
                raise RuntimeError(error_msg)
            
            logger.info("Model loaded successfully, initializing tokenizer...")
            if self.system_manager:
                self.system_manager.update_model_status('loading_tokenizer', 100)
            
            # Prepare tokenizer arguments with optimizations
            tokenizer_args = {
                "use_fast": True,  # Use fast tokenizer implementation
                "padding_side": "left",  # Consistent with model expectations
                "truncation_side": "left",
                "model_max_length": 2048  # DeepSeek context window
            }
            
            # Add memory manager specific arguments
            if self.memory_manager:
                tokenizer_args.update({
                    "cache_dir": self.memory_manager.cache_dir,
                    "local_files_only": True  # Use cached files
                })
            
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(
                    "deepseek-ai/deepseek-llm-7b-base",
                    **tokenizer_args
                )
                logger.info("Tokenizer loaded successfully")
                
                if self.system_manager:
                    self.system_manager.update_model_status('ready', 100)
            except Exception as e:
                error_msg = f"Error loading tokenizer: {e}"
                logger.error(error_msg)
                if self.system_manager:
                    self.system_manager.update_model_status('error', 0, error_msg)
                raise
            
        except Exception as e:
            error_msg = f"Error in model initialization: {e}"
            logger.error(error_msg)
            if self.system_manager:
                self.system_manager.update_model_status('error', 0, error_msg)
            
            # Clean cache and try manual loading as last resort
            logger.info("Attempting manual loading as fallback...")
            if self.memory_manager:
                self.memory_manager.clean_corrupted_cache()
            return self.load_model_manually()

    def verify_model_files(self, model_path: str) -> bool:
        """Verify the integrity and completeness of model files"""
        try:
            # 1. Verificar espaço em disco disponível (mínimo 10GB)
            if self.system_manager:
                disk_space = self.system_manager.get_disk_space()
                available_gb = disk_space['available'] / (1024 * 1024 * 1024)
                if available_gb < 10:
                    logger.error(f"Insufficient disk space: {available_gb:.1f}GB available, need at least 10GB")
                    return False

            # 2. Configurar arquivos essenciais e tamanhos mínimos
            required_files = {
                'config.json': 1024,  # 1KB
                'tokenizer_config.json': 512,  # 0.5KB
                'tokenizer.json': 1024 * 1024,  # 1MB
                'special_tokens_map.json': 512,  # 0.5KB
                'generation_config.json': 512,  # 0.5KB
            }

            # 3. Verificar arquivos de pesos (safetensors tem prioridade)
            weight_files = {
                'model.safetensors': 13 * 1024 * 1024 * 1024,  # 13GB
                'pytorch_model.bin': 13 * 1024 * 1024 * 1024  # 13GB
            }

            # 4. Verificar todos os arquivos necessários
            all_files = {**required_files, **weight_files}
            total_size = 0
            found_weight_file = False
            corrupted_files = []

            # 4.1 Primeiro verificar e limpar arquivos corrompidos
            for file, min_size in all_files.items():
                file_path = os.path.join(model_path, file)
                if os.path.exists(file_path):
                    try:
                        size = os.path.getsize(file_path)
                        if size < min_size:
                            corrupted_files.append(file_path)
                        else:
                            # Tentar ler o início do arquivo
                            with open(file_path, 'rb') as f:
                                try:
                                    f.read(1024)
                                except:
                                    corrupted_files.append(file_path)
                    except:
                        corrupted_files.append(file_path)

            # 4.2 Remover arquivos corrompidos
            for file_path in corrupted_files:
                try:
                    os.remove(file_path)
                    logger.warning(f"Removed corrupted file: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to remove corrupted file {file_path}: {e}")

            # 5. Verificar arquivos necessários
            for file, min_size in all_files.items():
                file_path = os.path.join(model_path, file)
                
                # Pular arquivos .bin se encontrou .safetensors
                if found_weight_file and file == 'pytorch_model.bin':
                    continue

                if not os.path.exists(file_path):
                    # Arquivos de peso são alternativos
                    if file in weight_files and os.path.exists(
                        os.path.join(model_path, 'model.safetensors')):
                        continue
                    logger.error(f"Missing required file: {file}")
                    return False

                # Verificar permissões e integridade
                try:
                    if not os.access(file_path, os.R_OK):
                        logger.error(f"File not readable: {file}")
                        return False

                    size = os.path.getsize(file_path)
                    if size < min_size:
                        logger.error(
                            f"File {file} is too small: {size/1024/1024:.1f}MB "
                            f"(expected >= {min_size/1024/1024:.1f}MB)"
                        )
                        return False

                    total_size += size
                    if file in weight_files:
                        found_weight_file = True
                        logger.info(f"Found valid weight file: {file} ({size/1024/1024/1024:.1f}GB)")

                except Exception as e:
                    logger.error(f"Error accessing file {file}: {e}")
                    return False

            # 6. Verificar se encontrou arquivo de pesos
            if not found_weight_file:
                logger.error("No valid weight files found")
                return False

            # 7. Verificar tamanho total (deve ser ~14GB para o modelo 7B)
            total_gb = total_size / (1024 * 1024 * 1024)
            if not (13 <= total_gb <= 15):
                logger.error(
                    f"Total model size {total_gb:.1f}GB is outside expected "
                    f"range (13-15GB)"
                )
                return False

            logger.info(f"Model files verification passed. Total size: {total_gb:.1f}GB")
            return True

        except Exception as e:
            logger.error(f"Error verifying model files: {e}")
            return False

    def load_model_manually(self):
        """Manual loading approach with memory optimization using accelerate"""
        try:
            logger.info("Attempting manual model loading with accelerate...")
            
            # Clean cache and prepare system
            if self.memory_manager:
                self.memory_manager.prepare_for_model_loading()
                _, available_gb = self.memory_manager.check_available_memory()
                logger.info(f"Available memory for manual loading: {available_gb:.1f}GB")
            
            if self.system_manager:
                self.system_manager.update_model_status('downloading', 0)
            
            # Prepare download arguments
            download_args = {
                "repo_id": "deepseek-ai/deepseek-llm-7b-base",
                "local_files_only": False,
                "resume_download": True,
                "use_auth_token": False
            }
            
            if self.memory_manager:
                download_args["cache_dir"] = self.memory_manager.cache_dir
            
            try:
                logger.info("Downloading model files for manual loading...")

                model_path = snapshot_download(**download_args)
                logger.info(f"Model files downloaded to {model_path}")

                # Verify model files integrity
                if not self.verify_model_files(model_path):
                    if self.memory_manager:
                        logger.warning("Model verification failed, cleaning cache and retrying...")
                        self.memory_manager.clean_corrupted_cache()
                        # Ensure hf_transfer is disabled for retry
                        os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '0'
                        model_path = snapshot_download(**{**download_args, "force_download": True})
                        if not self.verify_model_files(model_path):
                            raise RuntimeError("Model files verification failed after retry")
                    else:
                        raise RuntimeError("Model files verification failed")
                
                if self.system_manager:
                    self.system_manager.update_model_status('loading', 50)
                
                # Load configuration with memory optimizations
                logger.info("Loading model configuration...")
                config = AutoConfig.from_pretrained(
                    model_path,
                    use_auth_token=False,
                    trust_remote_code=True
                )
                
                # Stage 1: Try optimized disk offload
                logger.info("Stage 1: Attempting optimized disk offload...")
                try:
                    # Prepare fallback arguments based on official DeepSeek documentation
                    offload_args = {
                        "device_map": "disk",
                        "torch_dtype": torch.bfloat16,  # Official example uses bfloat16
                        "trust_remote_code": True,  # Required for DeepSeek model
                        "low_cpu_mem_usage": True
                    }
                    
                    if self.memory_manager:
                        offload_args.update({
                            "offload_folder": self.memory_manager.offload_dir,
                            "max_memory": {"cpu": "2GB"}  # Conservative CPU limit
                        })
                    
                    self.model = AutoModelForCausalLM.from_pretrained(
                        model_path,
                        config=config,
                        **offload_args
                    )
                    logger.info("Successfully loaded model with disk offload")
                    return True
                except Exception as disk_error:
                    logger.warning(f"Disk offload failed: {disk_error}")
                    logger.info("Stage 2: Falling back to accelerate manual loading...")
                
                # Stage 2: Manual loading with accelerate and aggressive memory optimization
                logger.info("Stage 2: Initializing empty model...")
                with init_empty_weights():
                    self.model = AutoModelForCausalLM.from_config(config)
                
                # Load checkpoint with optimized disk offload
                logger.info("Loading checkpoint with optimized disk offload...")
                offload_folder = self.memory_manager.offload_dir if self.memory_manager else None
                
                # Ensure clean offload directory
                if self.memory_manager and offload_folder:
                    self.memory_manager.clean_corrupted_cache()
                    os.makedirs(offload_folder, exist_ok=True)
                
                # Load with optimized dispatch settings
                dispatch_args = {
                    "device_map": "disk",  # Force disk offload
                    "offload_folder": offload_folder,
                    "no_split_module_classes": ["DeepSeekBlock"],  # Prevent splitting attention blocks
                    "dtype": torch.bfloat16  # Match model dtype
                }
                
                self.model = load_checkpoint_and_dispatch(
                    self.model,
                    model_path,
                    **dispatch_args
                )
                logger.info("Successfully loaded model with optimized disk offload")
                
            except Exception as e:
                logger.error(f"Error in manual loading process: {e}")
                if self.memory_manager:
                    self.memory_manager.clean_corrupted_cache()
                raise
            
            if self.system_manager:
                self.system_manager.update_model_status('loading_tokenizer', 100)
            
            # Load tokenizer with optimizations
            tokenizer_args = {
                "use_fast": True,
                "padding_side": "left",
                "truncation_side": "left",
                "model_max_length": 2048
            }
            
            if self.memory_manager:
                tokenizer_args.update({
                    "cache_dir": self.memory_manager.cache_dir,
                    "local_files_only": True
                })
            
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(
                    model_path,
                    **tokenizer_args
                )
                logger.info("Tokenizer loaded successfully")
            except Exception as e:
                logger.error(f"Error loading tokenizer: {e}")
                raise
            
            logger.info("Manual model loading completed successfully")
            if self.system_manager:
                self.system_manager.update_model_status('ready', 100)
            return True
                
        except Exception as e:
            error_msg = f"Error in manual model loading: {str(e)}"
            logger.error(error_msg)
            if self.system_manager:
                self.system_manager.update_model_status('error', 0, error_msg)
            if self.memory_manager:
                self.memory_manager.clean_corrupted_cache()
            raise

    def generate_response(self, message: str, context: dict = None) -> str:
        """Generate response using the LLM with optimized settings"""
        try:
            # Verify model and tokenizer are loaded
            if not self.model or not self.tokenizer:
                raise RuntimeError("Model or tokenizer not initialized")
            
            # Prepare input with context
            input_text = self._prepare_input(message, context)
            
            # Tokenize with padding and truncation
            inputs = self.tokenizer(
                input_text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=2048
            )
            
            # Generate with DeepSeek's recommended configuration
            try:
                # Set up generation config as per DeepSeek's example
                if not hasattr(self.model, 'generation_config') or self.model.generation_config is None:
                    self.model.generation_config = GenerationConfig.from_pretrained("deepseek-ai/deepseek-llm-7b-base")
                    self.model.generation_config.pad_token_id = self.model.generation_config.eos_token_id
                
                outputs = self.model.generate(
                    inputs["input_ids"].to(self.model.device),
                    max_new_tokens=100,  # Default from DeepSeek example
                    temperature=0.7,      # Balance creativity and coherence
                    top_p=0.95,          # Nucleus sampling
                    do_sample=True        # Enable sampling
                )
                
                # Decode and clean response
                response = self.tokenizer.decode(
                    outputs[0],
                    skip_special_tokens=True,
                    clean_up_tokenization_spaces=True
                )
                return response.strip()
                
            except torch.cuda.OutOfMemoryError:
                logger.error("GPU out of memory during generation")
                if self.memory_manager:
                    self.memory_manager.clean_corrupted_cache()
                raise RuntimeError("Insufficient GPU memory for generation")
                
        except Exception as e:
            error_msg = f"Error generating response: {e}"
            logger.error(error_msg)
            return f"Error: {str(e)}"

    def _download_progress_callback(self, progress: float):
        """Callback para atualizar o progresso do download"""
        if progress > 0:
            logger.info(f"Download progress: {progress:.1f}%")
            if self.system_manager:
                self.system_manager.update_model_status('downloading', progress)
    
    def get_model_status(self) -> dict:
        """Get current model status with detailed information"""
        try:
            base_status = {
                "model_loaded": self.model is not None,
                "tokenizer_loaded": self.tokenizer is not None,
                "device": str(next(self.model.parameters()).device) if self.model else "none",
                "status": "unknown",
                "downloadProgress": 0,
                "loadProgress": 0,
                "error": None
            }
            
            # Obter status atual do SystemManager
            if self.system_manager:
                sys_status = self.system_manager.get_model_status()
                base_status["status"] = sys_status.get("status", "unknown")
                base_status["error"] = sys_status.get("error")
                
                # Atualizar progresso baseado no status
                if base_status["status"] == "downloading":
                    base_status["downloadProgress"] = sys_status.get("progress", 0)
                elif base_status["status"] == "loading":
                    base_status["downloadProgress"] = 100
                    base_status["loadProgress"] = sys_status.get("progress", 0)
                elif base_status["status"] == "ready":
                    base_status["downloadProgress"] = 100
                    base_status["loadProgress"] = 100
            
            # Adicionar informações de memória e recursos
            if self.memory_manager:
                memory_info = self.memory_manager.get_memory_usage()
                has_resources, available_gb = self.memory_manager.check_available_memory()
                
                base_status.update({
                    "memory_usage": memory_info,
                    "has_resources": has_resources,
                    "available_gb": available_gb
                })
            
            return base_status
            
        except Exception as e:
            logger.error(f"Error getting model status: {e}")
            return {
                "status": "error",
                "error": str(e),
                "downloadProgress": 0,
                "loadProgress": 0,
                "has_resources": False,
                "available_gb": 0,
                "model_loaded": False,
                "tokenizer_loaded": False,
                "device": "none"
            }
            status.update(self.system_manager.get_model_status())
        
        return status

    def _prepare_input(self, message: str, context: dict = None) -> str:
        """Prepare input text with context"""
        if not context:
            return message
            
        # Add context to the prompt
        context_str = "\n".join([f"{k}: {v}" for k, v in context.items()])
        return f"Context:\n{context_str}\n\nUser: {message}"
