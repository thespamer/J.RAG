import os
import psutil
import shutil
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SystemManager:
    # Requisitos do DeepSeek LLM 7B (10GB para arquivos do modelo, cache e offload)
    MODEL_DISK_SPACE = 10 * 1024 * 1024 * 1024  # 10GB
    
    def __init__(self):
        self.last_cleanup = None
        # Sempre usar /app no Docker
        self.base_path = '/app'
        # Diretórios que podem ser limpos
        self.cleanup_dirs = {
            'uploads': os.path.join(self.base_path, 'uploads'),
            'models_cache': os.path.join(self.base_path, 'models_cache'),
            'transformers_cache': os.path.join(self.base_path, 'models_cache', 'transformers'),
            'huggingface_cache': os.path.join(self.base_path, 'models_cache', 'huggingface'),
            'offload': os.path.join(self.base_path, 'models_cache', 'offload')  # Diretório para offload de pesos do modelo
        }
        # Status do modelo
        self.model_status = {
            'status': 'unknown',  # unknown, downloading, loading_tokenizer, ready, error
            'download_progress': 0,
            'error': None
        }
        self.ensure_directories()
    
    def ensure_directories(self):
        """Ensure required directories exist with correct permissions"""
        try:
            # Verificar se o diretório base existe e é acessível
            if not os.path.exists(self.base_path):
                logger.error(f"Base path {self.base_path} does not exist")
                return False
            
            if not os.access(self.base_path, os.W_OK):
                logger.error(f"Base path {self.base_path} is not writable")
                return False
            
            directories = [
                os.path.join(self.base_path, 'uploads'),
                os.path.join(self.base_path, 'models_cache'),
                os.path.join(self.base_path, 'models_cache', 'transformers'),
                os.path.join(self.base_path, 'models_cache', 'huggingface'),
                os.path.join(self.base_path, 'models_cache', 'offload')
            ]
            
            for directory in directories:
                try:
                    # Criar diretório se não existir
                    os.makedirs(directory, mode=0o755, exist_ok=True)
                    
                    # Verificar se o diretório foi criado e é acessível
                    if not os.path.exists(directory):
                        logger.error(f"Failed to create directory: {directory}")
                        return False
                    
                    if not os.access(directory, os.W_OK):
                        logger.error(f"Directory is not writable: {directory}")
                        return False
                    
                    logger.info(f"Ensured directory exists and is writable: {directory}")
                    
                except Exception as e:
                    logger.error(f"Error creating directory {directory}: {str(e)}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error ensuring directories: {str(e)}")
            return False
    
    def update_model_status(self, status: str, progress: float = None, error: str = None):
        """Atualiza o status do modelo"""
        self.model_status.update({
            'status': status,
            'download_progress': progress if progress is not None else self.model_status['download_progress'],
            'error': error
        })
        logger.info(f"Model status updated: {self.model_status}")
    
    def get_model_status(self):
        """Retorna o status atual do modelo"""
        return self.model_status
    
    def get_disk_space(self, path=None):
        """Get disk space information for a given path"""
        try:
            if path is None:
                # Verificar espaço no diretório models_cache que contém o modelo, cache e offload
                path = os.path.join(self.base_path, 'models_cache')
            
            # Obter informações do disco do volume montado
            try:
                # Primeiro tentar o caminho do container
                if os.path.exists(path) and os.access(path, os.R_OK):
                    total, used, free = shutil.disk_usage(path)
                else:
                    # Se falhar, tentar o caminho do host que está mapeado no volume
                    host_path = os.path.join(os.environ.get('PWD', ''), 'models_cache')
                    if os.path.exists(host_path) and os.access(host_path, os.R_OK):
                        total, used, free = shutil.disk_usage(host_path)
                    else:
                        logger.error(f"Cannot access disk space info for {path} or {host_path}")
                        return {
                            'total': 0,
                            'used': 0,
                            'free': 0,
                            'percent_used': 0,
                            'available': 0,
                            'warnings': [f"Cannot access disk space info"]
                        }
                
                # Verificar se os valores são válidos
                if total <= 0 or used < 0 or free < 0:
                    logger.error(f"Invalid disk space values for {path}: total={total}, used={used}, free={free}")
                    return {
                        'total': 0,
                        'used': 0,
                        'free': 0,
                        'percent_used': 0,
                        'available': 0,
                        'percent_available': 0,
                        'warnings': [f"Invalid disk space values"]
                    }
                
                # Verificar se há espaço suficiente para o modelo DeepSeek LLM 7B
                warnings = []
                if free < self.MODEL_DISK_SPACE:
                    msg = f"Critical: Insufficient disk space for DeepSeek LLM. Need {(self.MODEL_DISK_SPACE - free) / (1024*1024*1024):.1f}GB more"
                    logger.warning(msg)
                    warnings.append(msg)
                
                return {
                    'total': total,
                    'used': used,
                    'free': free,
                    'available': free,  # Usar o espaço livre como disponível
                    'percent_used': (used / total) * 100 if total > 0 else 0,
                    'percent_available': (free / total) * 100 if total > 0 else 0,
                    'warnings': warnings
                }
            
            except OSError as e:
                # OSError pode ocorrer quando o disco está muito cheio
                error_msg = str(e)
                if 'No space left on device' in error_msg:
                    logger.error(f"No space left on device {path}")
                    return {
                        'total': 0,
                        'used': 0,
                        'free': 0,
                        'available': 0,
                        'percent_used': 100,
                        'percent_available': 0,
                        'warnings': ['Critical: Disk is full']
                    }
                else:
                    logger.error(f"OS error accessing disk space on {path}: {error_msg}")
                    return {
                        'total': 0,
                        'used': 0,
                        'free': 0,
                        'available': 0,
                        'percent_used': 0,
                        'percent_available': 0,
                        'warnings': [f"OS error: {error_msg}"]
                    }
            
        except Exception as e:
            logger.error(f"Error getting disk space info: {e}")
            return {
                'total': 0,
                'used': 0,
                'free': 0,
                'available': 0,
                'percent_used': 0,
                'percent_available': 0,
                'warnings': [f"Error getting disk space info: {e}"]
            }    
    def get_memory_usage(self):
        """Get memory usage information"""
        try:
            # Tentar obter informações de memória
            mem = psutil.virtual_memory()
            
            # Verificar se os valores são válidos
            if mem.total == 0:
                logger.error("Invalid memory values: total memory is 0")
                return {
                    'total': 0,
                    'available': 0,
                    'used': 0,
                    'percent_used': 0,
                    'free': 0,
                    'error': 'Invalid memory values'
                }
            
            return {
                'total': mem.total,
                'available': mem.available,
                'used': mem.used,
                'percent_used': mem.percent,
                'free': mem.free
            }
            
        except psutil.Error as e:
            logger.error(f"PSUtil error getting memory usage: {str(e)}")
            return {
                'total': 0,
                'available': 0,
                'used': 0,
                'percent_used': 0,
                'free': 0,
                'error': f"PSUtil error: {str(e)}"
            }
            
        except Exception as e:
            logger.error(f"Error getting memory usage: {str(e)}")
            return {
                'total': 0,
                'available': 0,
                'used': 0,
                'percent_used': 0,
                'free': 0,
                'error': str(e)
            }
    
    def get_cpu_usage(self):
        """Get CPU usage information"""
        try:
            # Tentar obter informações da CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)  # Reduzido para 0.1s para evitar espera longa
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            
            # Verificar se os valores são válidos
            if cpu_count is None or cpu_count == 0:
                logger.error("Invalid CPU count")
                return {
                    'percent': 0,
                    'count': 0,
                    'frequency': {
                        'current': 0,
                        'min': 0,
                        'max': 0
                    },
                    'error': 'Invalid CPU count'
                }
            
            # Construir resposta com valores default em caso de falha
            return {
                'percent': cpu_percent if cpu_percent is not None else 0,
                'count': cpu_count,
                'frequency': {
                    'current': cpu_freq.current if cpu_freq else 0,
                    'min': cpu_freq.min if cpu_freq else 0,
                    'max': cpu_freq.max if cpu_freq else 0
                }
            }
            
        except psutil.Error as e:
            logger.error(f"PSUtil error getting CPU usage: {str(e)}")
            return {
                'percent': 0,
                'count': 0,
                'frequency': {
                    'current': 0,
                    'min': 0,
                    'max': 0
                },
                'error': f"PSUtil error: {str(e)}"
            }
            
        except Exception as e:
            logger.error(f"Error getting CPU usage: {str(e)}")
            return {
                'percent': 0,
                'count': 0,
                'frequency': {
                    'current': 0,
                    'min': 0,
                    'max': 0
                },
                'error': str(e)
            }
    
    def get_system_status(self):
        """Get complete system status with detailed resource information"""
        try:
            disk_space = self.get_disk_space()
            memory_usage = self.get_memory_usage()
            cpu_usage = self.get_cpu_usage()
            
            # Verificar se houve erros ao obter as informações
            if not isinstance(disk_space, dict) or 'error' in disk_space:
                disk_space = {'total': 0, 'free': 0, 'used': 0, 'error': disk_space.get('error', 'Invalid disk space data')}
            if not isinstance(memory_usage, dict) or 'error' in memory_usage:
                memory_usage = {'total': 0, 'available': 0, 'used': 0, 'error': memory_usage.get('error', 'Invalid memory data')}
            if not isinstance(cpu_usage, dict) or 'error' in cpu_usage:
                cpu_usage = {'percent': 0, 'error': cpu_usage.get('error', 'Invalid CPU data')}
            
            # Formatar os dados no formato esperado pelo frontend
            status = {
                'disk_space': {
                    'total': disk_space['total'],
                    'available': disk_space['free'],
                    'used': disk_space['used'],
                    'percent_used': (disk_space['used'] / disk_space['total'] * 100) if disk_space['total'] > 0 else 0,
                    'warnings': []
                },
                'memory': {
                    'total': memory_usage['total'],
                    'available': memory_usage['available'],
                    'used': memory_usage['used'],
                    'percent_used': (memory_usage['used'] / memory_usage['total'] * 100) if memory_usage['total'] > 0 else 0,
                    'warnings': []
                },
                'cpu': {
                    'usage': cpu_usage['percent'],
                    'count': cpu_usage.get('count', 0),
                    'frequency': cpu_usage.get('frequency', {'current': 0, 'min': 0, 'max': 0})
                },
                'warnings': [],
                'errors': [],
                'model': {
                    'status': self.model_status['status'],
                    'downloadProgress': self.model_status['download_progress'],
                    'error': self.model_status['error']
                }
            }
            
            # Verificar erros e adicionar mensagens
            if 'error' in disk_space:
                status['errors'].append(f"Disk space error: {disk_space['error']}")
            if 'error' in memory_usage:
                status['errors'].append(f"Memory error: {memory_usage['error']}")
            if 'error' in cpu_usage:
                status['errors'].append(f"CPU error: {cpu_usage['error']}")
            
            # Verificar limites e adicionar avisos para o DeepSeek LLM
            # Verificar espaço em disco para o modelo
            if disk_space['free'] < self.MODEL_DISK_SPACE:
                warning_msg = f"Insufficient disk space for DeepSeek LLM. Need {(self.MODEL_DISK_SPACE - disk_space['free']) / (1024*1024*1024):.1f}GB more"
                status['disk_space']['warnings'].append(warning_msg)
                status['warnings'].append({
                    'type': 'disk_space',
                    'message': warning_msg,
                    'threshold': '10GB',
                    'currentValue': disk_space['free'],
                    'requiredValue': self.MODEL_DISK_SPACE
                })
            
            # Verificar uso de CPU
            if cpu_usage.get('percent', 0) > 90:
                warning_msg = f"High CPU usage: {cpu_usage['percent']}%. This may impact model performance."
                status['warnings'].append({
                    'type': 'cpu',
                    'message': warning_msg,
                    'threshold': '90%',
                    'currentValue': cpu_usage['percent'],
                    'limitValue': 90
                })
            
            # Adicionar informações extras
            status.update({
                'timestamp': datetime.now().isoformat(),
                'lastCleanup': self.last_cleanup,
                'directories': {
                    'uploads': {
                        'exists': os.path.exists(self.cleanup_dirs['uploads']),
                        'writable': os.access(self.cleanup_dirs['uploads'], os.W_OK) if os.path.exists(self.cleanup_dirs['uploads']) else False,
                        'path': self.cleanup_dirs['uploads']
                    },
                    'modelsCache': {
                        'exists': os.path.exists(self.cleanup_dirs['models_cache']),
                        'writable': os.access(self.cleanup_dirs['models_cache'], os.W_OK) if os.path.exists(self.cleanup_dirs['models_cache']) else False,
                        'path': self.cleanup_dirs['models_cache']
                    },
                    'transformersCache': {
                        'exists': os.path.exists(self.cleanup_dirs['transformers_cache']),
                        'writable': os.access(self.cleanup_dirs['transformers_cache'], os.W_OK) if os.path.exists(self.cleanup_dirs['transformers_cache']) else False,
                        'path': self.cleanup_dirs['transformers_cache']
                    },
                    'huggingfaceCache': {
                        'exists': os.path.exists(self.cleanup_dirs['huggingface_cache']),
                        'writable': os.access(self.cleanup_dirs['huggingface_cache'], os.W_OK) if os.path.exists(self.cleanup_dirs['huggingface_cache']) else False,
                        'path': self.cleanup_dirs['huggingface_cache']
                    },
                    'offload': {
                        'exists': os.path.exists(self.cleanup_dirs['offload']),
                        'writable': os.access(self.cleanup_dirs['offload'], os.W_OK) if os.path.exists(self.cleanup_dirs['offload']) else False,
                        'path': self.cleanup_dirs['offload']
                    }
                }
            })
            
            # Verificar problemas com diretórios
            for dir_name, dir_info in status['directories'].items():
                if not dir_info['exists']:
                    status['errors'].append(f"Directory '{dir_name}' does not exist: {dir_info['path']}")
                elif not dir_info['writable']:
                    status['errors'].append(f"Directory '{dir_name}' is not writable: {dir_info['path']}")
            
            return status
            
        except Exception as e:
            logger.error(f"Error getting system status: {str(e)}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'warnings': [],
                'errors': [str(e)]
            }
    
    def cleanup_system(self):
        """Clean up system resources by removing temporary files and caches"""
        try:
            cleanup_results = {
                'cleanedDirectories': [],
                'errors': [],
                'spaceFreed': 0,
                'status': 'running'
            }
            
            # Verificar se faz muito pouco tempo desde a última limpeza
            if self.last_cleanup:
                last_cleanup_dt = datetime.fromisoformat(self.last_cleanup)
                if (datetime.now() - last_cleanup_dt).total_seconds() < 60:
                    return {
                        'status': 'error',
                        'error': 'System cleanup was performed less than 1 minute ago. Please wait before trying again.',
                        'lastCleanup': self.last_cleanup
                    }
            
            # Obter espaço em disco antes da limpeza
            initial_space = self.get_disk_space()
            if 'error' in initial_space:
                return {
                    'status': 'error',
                    'error': f"Could not get initial disk space: {initial_space['error']}",
                    'systemStatus': self.get_system_status()
                }
            
            # Limpar cada diretório
            for dir_name, dir_path in self.cleanup_dirs.items():
                try:
                    if not os.path.exists(dir_path):
                        continue
                    
                    # Calcular espaço usado pelo diretório
                    dir_size = sum(os.path.getsize(os.path.join(dirpath, filename))
                        for dirpath, _, filenames in os.walk(dir_path)
                        for filename in filenames)
                    
                    removed_files = []
                    skipped_files = []
                    
                    # Remover arquivos temporários e caches
                    for root, dirs, files in os.walk(dir_path, topdown=False):
                        for name in files:
                            try:
                                file_path = os.path.join(root, name)
                                # Não remover arquivos essenciais
                                if any(name.endswith(ext) for ext in ['.py', '.json', '.yaml', '.yml']):
                                    skipped_files.append({
                                        'path': file_path,
                                        'reason': 'Essential file type'
                                    })
                                    continue
                                os.remove(file_path)
                                removed_files.append(file_path)
                            except Exception as e:
                                cleanup_results['errors'].append({
                                    'type': 'fileRemoval',
                                    'path': file_path,
                                    'error': str(e)
                                })
                        
                        # Tentar remover diretórios vazios
                        for name in dirs:
                            try:
                                dir_to_remove = os.path.join(root, name)
                                if not os.listdir(dir_to_remove):  # Se estiver vazio
                                    os.rmdir(dir_to_remove)
                            except Exception as e:
                                cleanup_results['errors'].append({
                                    'type': 'directoryRemoval',
                                    'path': dir_to_remove,
                                    'error': str(e)
                                })
                    
                    # Recriar diretório se foi completamente removido
                    if not os.path.exists(dir_path):
                        os.makedirs(dir_path, mode=0o755)
                    
                    # Converter nome do diretório para camelCase
                    camel_name = ''.join(word.title() for word in dir_name.split('_'))
                    camel_name = camel_name[0].lower() + camel_name[1:]
                    
                    cleanup_results['cleanedDirectories'].append({
                        'name': camel_name,
                        'path': dir_path,
                        'spaceFreed': dir_size,
                        'filesRemoved': len(removed_files),
                        'filesSkipped': len(skipped_files),
                        'details': {
                            'removedFiles': removed_files[:10],  # Limitar para evitar resposta muito grande
                            'skippedFiles': skipped_files[:10]
                        }
                    })
                    cleanup_results['spaceFreed'] += dir_size
                    
                except Exception as e:
                    cleanup_results['errors'].append({
                        'type': 'directoryCleanup',
                        'directory': dir_name,
                        'error': str(e)
                    })
            
            # Atualizar timestamp da última limpeza
            self.last_cleanup = datetime.now().isoformat()
            
            # Obter espaço em disco e status do sistema após a limpeza
            final_space = self.get_disk_space()
            cleanup_results.update({
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'lastCleanup': self.last_cleanup,
                'systemStatus': self.get_system_status(),
                'spaceDetails': {
                    'before': initial_space,
                    'after': final_space,
                    'freed': cleanup_results['spaceFreed']
                }
            })
            
            # Verificar se houve erros críticos que impediram a limpeza
            if not cleanup_results['cleanedDirectories'] and cleanup_results['errors']:
                return {
                    'status': 'error',
                    'error': "Failed to clean any directories",
                    'details': cleanup_results,
                    'systemStatus': self.get_system_status()
                }
            
            return cleanup_results
            
        except Exception as e:
            logger.error(f"System cleanup failed: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'systemStatus': self.get_system_status()
            }
