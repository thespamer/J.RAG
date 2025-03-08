import os
import shutil
import psutil
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self, cache_dir: str, offload_dir: str):
        self.cache_dir = cache_dir
        self.offload_dir = offload_dir
        self.ensure_directories()

    def ensure_directories(self):
        """Ensure all necessary directories exist with correct permissions"""
        try:
            # Lista de diretórios principais
            main_dirs = [
                self.cache_dir,
                self.offload_dir,
                os.path.join(self.cache_dir, 'transformers'),
                os.path.join(self.cache_dir, 'huggingface')
            ]
            
            # Criar e configurar diretórios principais
            for directory in main_dirs:
                # Remover se existir e estiver corrompido
                if os.path.exists(directory):
                    try:
                        os.listdir(directory)
                    except Exception:
                        logger.warning(f"Diretório corrompido, recriando: {directory}")
                        shutil.rmtree(directory, ignore_errors=True)
                
                # Criar diretório com permissões corretas
                Path(directory).mkdir(parents=True, exist_ok=True)
                os.chmod(directory, 0o777)
                logger.info(f"Diretório configurado: {directory}")
            
            # Criar diretórios específicos para o modelo DeepSeek
            model_base = os.path.join(self.cache_dir, 'models--deepseek-ai--deepseek-llm-7b-base')
            model_dirs = [
                model_base,
                os.path.join(model_base, 'refs'),
                os.path.join(model_base, 'blobs'),
                os.path.join(model_base, 'snapshots')
            ]
            
            # Criar e configurar diretórios do modelo
            for directory in model_dirs:
                # Remover se existir e estiver corrompido
                if os.path.exists(directory):
                    try:
                        os.listdir(directory)
                    except Exception:
                        logger.warning(f"Diretório do modelo corrompido, recriando: {directory}")
                        shutil.rmtree(directory, ignore_errors=True)
                
                # Criar diretório com permissões corretas
                Path(directory).mkdir(parents=True, exist_ok=True)
                os.chmod(directory, 0o777)
                logger.info(f"Diretório do modelo configurado: {directory}")
            
            # Verificar permissões recursivamente
            for root, dirs, files in os.walk(self.cache_dir):
                for d in dirs:
                    os.chmod(os.path.join(root, d), 0o777)
                for f in files:
                    os.chmod(os.path.join(root, f), 0o666)
            
            logger.info("Todos os diretórios configurados com sucesso")

        except Exception as e:
            logger.error(f"Error ensuring directories: {e}")
            raise

    def clean_corrupted_cache(self):
        """Limpa arquivos temporários, corrompidos e caches antigos"""
        try:
            # Diretórios para limpar
            dirs_to_clean = [
                self.cache_dir,
                self.offload_dir,
                os.path.join(self.cache_dir, 'transformers'),
                os.path.join(self.cache_dir, 'huggingface')
            ]
            
            for directory in dirs_to_clean:
                if os.path.exists(directory):
                    logger.info(f"Limpando diretório: {directory}")
                    try:
                        # Primeiro, remover todo o conteúdo do diretório de offload
                        if directory == self.offload_dir:
                            shutil.rmtree(directory)
                            os.makedirs(directory, exist_ok=True)
                            os.chmod(directory, 0o777)
                            logger.info(f"Recriado diretório de offload: {directory}")
                            continue

                        for item in os.listdir(directory):
                            item_path = os.path.join(directory, item)
                            try:
                                if os.path.isfile(item_path):
                                    # Remover arquivos temporários ou corrompidos
                                    is_temp = any(item.endswith(ext) for ext in [
                                        '.tmp', '.temp', '.part', '.incomplete',
                                        '.lock', '.json.bak', '.bin.bak'
                                    ])
                                    
                                    # Verificar se o arquivo está corrompido
                                    try:
                                        is_corrupt = os.path.getsize(item_path) == 0
                                    except OSError:
                                        is_corrupt = True
                                    
                                    if is_temp or is_corrupt:
                                        os.remove(item_path)
                                        logger.info(f"Removido arquivo inválido: {item_path}")
                                        
                                elif os.path.isdir(item_path):
                                    # Remover diretórios vazios ou corrompidos
                                    try:
                                        if not os.listdir(item_path):
                                            shutil.rmtree(item_path)
                                            logger.info(f"Removido diretório vazio: {item_path}")
                                    except Exception:
                                        shutil.rmtree(item_path)
                                        logger.info(f"Removido diretório corrompido: {item_path}")
                                        
                            except Exception as e:
                                logger.warning(f"Erro ao processar {item_path}: {e}")
                                try:
                                    if os.path.exists(item_path):
                                        os.remove(item_path) if os.path.isfile(item_path) else shutil.rmtree(item_path)
                                        logger.info(f"Removido item com erro: {item_path}")
                                except:
                                    pass
                    except Exception as e:
                        logger.warning(f"Erro ao limpar diretório {directory}: {e}")

            logger.info("Limpeza de cache concluída com sucesso")

        except Exception as e:
            logger.error(f"Erro ao limpar cache: {e}")
            raise

    def get_memory_usage(self) -> dict:
        """Get current memory usage statistics"""
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()

        return {
            "rss": memory_info.rss / (1024 * 1024),  # RSS in MB
            "vms": memory_info.vms / (1024 * 1024),  # VMS in MB
            "cache_size": self._get_directory_size(self.cache_dir),
            "offload_size": self._get_directory_size(self.offload_dir)
        }

    def check_available_memory(self) -> tuple[bool, float]:
        """Verifica a memória e espaço em disco disponíveis"""
        try:
            # Verificar espaço em disco
            disk_usage = shutil.disk_usage(self.cache_dir)
            available_gb = disk_usage.free / (1024 * 1024 * 1024)
            
            # Verificar memória RAM
            memory = psutil.virtual_memory()
            available_ram_gb = memory.available / (1024 * 1024 * 1024)
            
            # Requisitos mínimos
            MIN_DISK_SPACE = 10  # GB
            MIN_RAM = 4  # GB
            
            has_space = available_gb >= MIN_DISK_SPACE
            has_ram = available_ram_gb >= MIN_RAM
            
            if not has_space:
                logger.warning(f"Espaço em disco insuficiente: {available_gb:.1f}GB disponível, mínimo {MIN_DISK_SPACE}GB")
            if not has_ram:
                logger.warning(f"Memória RAM insuficiente: {available_ram_gb:.1f}GB disponível, mínimo {MIN_RAM}GB")
            
            return has_space and has_ram, min(available_gb, available_ram_gb)
            
        except Exception as e:
            logger.error(f"Erro ao verificar recursos: {e}")
            return False, 0.0

    def prepare_for_model_loading(self) -> None:
        """Prepara o sistema para carregar o modelo, garantindo espaço e recursos"""
        try:
            logger.info("Preparando sistema para carregamento do modelo...")
            
            # Verificar recursos disponíveis
            has_resources, available = self.check_available_memory()
            if not has_resources:
                # Tentar liberar espaço
                logger.info("Recursos insuficientes, tentando liberar espaço...")
                self.clean_corrupted_cache()
                
                # Verificar novamente
                has_resources, available = self.check_available_memory()
                if not has_resources:
                    raise RuntimeError(f"Recursos insuficientes após limpeza. Disponível: {available:.1f}GB")
            
            # Garantir que os diretórios existam
            logger.info("Verificando diretórios...")
            self.ensure_directories()
            
            # Criar diretórios do modelo com permissões corretas
            model_dir = os.path.join(self.cache_dir, 'models--deepseek-ai--deepseek-llm-7b-base')
            for subdir in ['snapshots', 'refs', 'blobs']:
                Path(os.path.join(model_dir, subdir)).mkdir(parents=True, exist_ok=True)
            
            logger.info("System prepared for model loading")
            
        except Exception as e:
            logger.error(f"Error preparing system for model loading: {e}")
            raise

    def check_available_disk_space(self) -> float:
        """Check available disk space without restrictions"""
        try:
            # Apenas garantir que o diretório existe
            if not os.path.exists(self.cache_dir):
                logger.info(f"Cache directory does not exist: {self.cache_dir}")
                self.ensure_directories()
            
            # Try to get disk information
            try:
                # Get disk usage for the cache directory
                total, used, free = shutil.disk_usage(self.cache_dir)
                
                # Calculate available space in GB
                free_gb = free / (1024 * 1024 * 1024)
                
                # Log disk space information
                logger.info(f"Disk space: total={total/(1024**3):.1f}GB, used={used/(1024**3):.1f}GB, free={free_gb:.1f}GB")
                
                # If space is low, try to clean up
                if free_gb < 10:
                    logger.warning(f"Low disk space detected: {free_gb:.1f}GB free")
                    
                    # Try cleaning system temp files first
                    tmp_dir = '/tmp'
                    if os.path.exists(tmp_dir):
                        for item in os.listdir(tmp_dir):
                            try:
                                item_path = os.path.join(tmp_dir, item)
                                if os.path.isfile(item_path):
                                    os.remove(item_path)
                                elif os.path.isdir(item_path):
                                    shutil.rmtree(item_path)
                            except Exception as e:
                                logger.warning(f"Error cleaning temp file {item_path}: {e}")
                    
                    # Clean model cache
                    self.clean_corrupted_cache()
                    
                    # Check space again after cleanup
                    total, used, free = shutil.disk_usage(self.cache_dir)
                    free_gb = free / (1024 * 1024 * 1024)
                    logger.info(f"Disk space after cleanup: total={total/(1024**3):.1f}GB, used={used/(1024**3):.1f}GB, free={free_gb:.1f}GB")
                    
                    if free_gb < 10:
                        logger.error(f"Still insufficient space after cleanup: {free_gb:.1f}GB free")
                        raise RuntimeError(f"Insufficient disk space even after cleanup. Need at least 10GB, but only {free_gb:.1f}GB available")
                    return free_gb
                
                # If not enough space, try cleaning cache
                logger.warning(f"Insufficient space ({free_gb:.1f}GB). Cleaning cache...")
                self.clean_corrupted_cache()
                
                # Check space again after cleaning
                total, used, free = shutil.disk_usage(self.cache_dir)
                free_gb = free / (1024 * 1024 * 1024)
                logger.info(f"Space after cleanup: {free_gb:.1f}GB")
                
                return free_gb
                
            except OSError as e:
                logger.error(f"Error checking disk space: {e}")
                return 0
                
        except Exception as e:
            logger.error(f"Error in check_available_disk_space: {e}")
            return 0
                logger.warning(f"Warning: Only {free_gb:.2f}GB free space available")
            else:
                logger.info(f"Available disk space: {free_gb:.2f}GB")
            
            return free_gb
            
        except Exception as e:
            logger.error(f"Error checking disk space: {e}")
            return 0

    def _get_directory_size(self, directory: str) -> float:
        """Get directory size in MB"""
        total_size = 0
        try:
            # Skip if directory doesn't exist
            if not os.path.exists(directory):
                return 0
                
            for dirpath, dirnames, filenames in os.walk(directory):
                try:
                    # Skip hidden directories
                    dirnames[:] = [d for d in dirnames if not d.startswith('.')]
                    
                    for f in filenames:
                        # Skip hidden and temporary files
                        if f.startswith('.') or f.endswith(('.tmp', '.temp', '.part')):
                            continue
                            
                        fp = os.path.join(dirpath, f)
                        if not os.path.islink(fp):
                            try:
                                size = os.path.getsize(fp)
                                if size > 0:  # Skip empty files
                                    total_size += size
                            except Exception as e:
                                logger.warning(f"Error getting size for {fp}: {e}")
                except Exception as e:
                    logger.warning(f"Error processing directory {dirpath}: {e}")
                    continue
        except Exception as e:
            logger.warning(f"Error getting directory size for {directory}: {e}")
        return total_size / (1024 * 1024)  # Convert to MB
