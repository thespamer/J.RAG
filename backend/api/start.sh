#!/bin/bash

# Verificar ambiente Python
echo "Python environment:"
python --version
echo "PYTHONPATH=$PYTHONPATH"
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

# Tentar importar os módulos necessários
echo "Testing imports..."
python -c "
try:
    from flask import Flask
    print('Flask imported successfully')
    from core.llm_manager import LLMManager
    print('LLMManager imported successfully')
    from core.memory_manager import MemoryManager
    print('MemoryManager imported successfully')
    from core.system_manager import SystemManager
    print('SystemManager imported successfully')
except ImportError as e:
    print(f'Import error: {e}')
    exit(1)
"

# Iniciar a aplicação
echo "Starting application..."
exec python -m flask run --host=0.0.0.0 --port=8000
