import os
import shutil
import psutil
from pathlib import Path

class MemoryManager:
    def __init__(self, cache_dir: str, offload_dir: str):
        self.cache_dir = cache_dir
        self.offload_dir = offload_dir
        self.ensure_directories()

    def ensure_directories(self):
        """Ensure all necessary directories exist with correct permissions"""
        for directory in [self.cache_dir, self.offload_dir]:
            Path(directory).mkdir(parents=True, exist_ok=True)
            os.chmod(directory, 0o777)

    def clean_corrupted_cache(self):
        """Clean potentially corrupted cache files"""
        try:
            # Clean transformers cache
            if os.path.exists(self.cache_dir):
                for item in os.listdir(self.cache_dir):
                    if item.endswith('.lock'):
                        os.remove(os.path.join(self.cache_dir, item))

            # Clean offload directory
            if os.path.exists(self.offload_dir):
                shutil.rmtree(self.offload_dir)
                os.makedirs(self.offload_dir)
                os.chmod(self.offload_dir, 0o777)

        except Exception as e:
            print(f"Error cleaning cache: {e}")

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

    def check_available_memory(self) -> bool:
        """Check if there's enough available memory"""
        system_memory = psutil.virtual_memory()
        available_gb = system_memory.available / (1024 * 1024 * 1024)
        return available_gb >= 2  # Require at least 2GB available

    def _get_directory_size(self, directory: str) -> float:
        """Get directory size in MB"""
        total_size = 0
        if os.path.exists(directory):
            for dirpath, _, filenames in os.walk(directory):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    total_size += os.path.getsize(filepath)
        return total_size / (1024 * 1024)  # Convert to MB
