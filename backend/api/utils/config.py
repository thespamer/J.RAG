import os

class Config:
    def __init__(self):
        self.MODEL_CACHE_DIR = os.getenv('MODEL_CACHE_DIR', '/app/models_cache')
        self.MODEL_WEIGHTS_OFFLOAD_DIR = os.getenv('MODEL_WEIGHTS_OFFLOAD_DIR', '/app/models_cache/offload')
        self.HUGGINGFACE_CACHE = os.getenv('HUGGINGFACE_CACHE', '/app/models_cache/huggingface')
        self.TRANSFORMERS_CACHE = os.getenv('TRANSFORMERS_CACHE', '/app/models_cache/transformers')
