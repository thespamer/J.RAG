import os

class Config:
    def __init__(self):
        # Base directories
        self.BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.DATA_DIR = os.path.join(self.BASE_DIR, 'data')
        
        # Model configuration
        self.MODEL_NAME = "deepseek-ai/deepseek-llm-7b-base"
        self.MODEL_CACHE_DIR = os.path.join(self.DATA_DIR, 'models_cache')
        self.MODEL_WEIGHTS_OFFLOAD_DIR = os.path.join(self.MODEL_CACHE_DIR, 'offload')
        
        # Create necessary directories
        os.makedirs(self.DATA_DIR, exist_ok=True)
        os.makedirs(self.MODEL_CACHE_DIR, exist_ok=True)
        os.makedirs(self.MODEL_WEIGHTS_OFFLOAD_DIR, exist_ok=True)
        
        # Memory configuration
        self.MIN_MEMORY_MB = 512  # Minimum memory required in MB
        self.MIN_DISK_SPACE_GB = 1  # Minimum disk space required in GB
        
        # Model loading configuration
        self.MODEL_CONFIG = {
            'low_cpu_mem_usage': True,
            'use_safetensors': True,
            'offload_folder': self.MODEL_WEIGHTS_OFFLOAD_DIR,
            'device_map': 'auto'
        }
        
        # RAG configuration
        self.DOCUMENTS_DIR = os.path.join(self.DATA_DIR, 'documents')
        self.EMBEDDINGS_DIR = os.path.join(self.DATA_DIR, 'embeddings')
        os.makedirs(self.DOCUMENTS_DIR, exist_ok=True)
        os.makedirs(self.EMBEDDINGS_DIR, exist_ok=True)
        
        # Analytics configuration
        self.ANALYTICS_DIR = os.path.join(self.DATA_DIR, 'analytics')
        os.makedirs(self.ANALYTICS_DIR, exist_ok=True)
