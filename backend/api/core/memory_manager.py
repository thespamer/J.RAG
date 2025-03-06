import os
import shutil
import psutil
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self, cache_dir: str, offload_dir: str):
        """Initialize MemoryManager with cache and offload directories"""
        self.cache_dir = cache_dir
        self.offload_dir = offload_dir
        os.makedirs(cache_dir, exist_ok=True)
        os.makedirs(offload_dir, exist_ok=True)

    def get_cache_info(self) -> Dict[str, Any]:
        """Get information about the cache directory"""
        cache_size = 0
        file_count = 0
        
        for dirpath, dirnames, filenames in os.walk(self.cache_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    cache_size += os.path.getsize(fp)
                    file_count += 1
                except (OSError, IOError) as e:
                    logger.warning(f"Error getting size of {fp}: {e}")

        return {
            'size': cache_size,
            'files': file_count,
            'lastCleanup': self._get_last_cleanup()
        }

    def clean_corrupted_cache(self) -> None:
        """Clean potentially corrupted cache files"""
        try:
            # Limpar cache do transformers
            if os.path.exists(self.cache_dir):
                logger.info(f"Cleaning transformers cache: {self.cache_dir}")
                shutil.rmtree(self.cache_dir, ignore_errors=True)
                os.makedirs(self.cache_dir, exist_ok=True)
            
            # Limpar diretório de offload
            if os.path.exists(self.offload_dir):
                logger.info(f"Cleaning offload directory: {self.offload_dir}")
                shutil.rmtree(self.offload_dir, ignore_errors=True)
                os.makedirs(self.offload_dir, exist_ok=True)
            
            self._update_last_cleanup()
            logger.info("Cache cleanup completed successfully")
            
        except Exception as e:
            logger.error(f"Error cleaning cache: {e}")
            raise

    def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage information"""
        try:
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            
            # Calcular uso de memória
            total_memory = psutil.virtual_memory().total
            used_memory = memory_info.rss
            available_memory = psutil.virtual_memory().available
            
            return {
                'total': total_memory,
                'used': used_memory,
                'available': available_memory,
                'percent_used': (used_memory / total_memory) * 100 if total_memory > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting memory usage: {e}")
            return {
                'total': 0,
                'used': 0,
                'available': 0,
                'percent_used': 0,
                'error': str(e)
            }

    def _get_last_cleanup(self) -> Optional[str]:
        """Get timestamp of last cache cleanup"""
        cleanup_marker = os.path.join(self.cache_dir, '.last_cleanup')
        try:
            if os.path.exists(cleanup_marker):
                with open(cleanup_marker, 'r') as f:
                    return f.read().strip()
        except Exception as e:
            logger.warning(f"Error reading last cleanup timestamp: {e}")
        return None

    def _update_last_cleanup(self) -> None:
        """Update the last cleanup timestamp"""
        cleanup_marker = os.path.join(self.cache_dir, '.last_cleanup')
        try:
            with open(cleanup_marker, 'w') as f:
                f.write(datetime.now().isoformat())
        except Exception as e:
            logger.warning(f"Error updating cleanup timestamp: {e}")
