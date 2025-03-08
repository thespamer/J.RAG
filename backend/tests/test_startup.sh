#!/bin/bash

# Configurações de cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

error() {
    echo -e "${RED}[ERRO]${NC} $1"
    exit 1
}

# Configurar diretórios de cache e offload
setup_directories() {
    log "Configurando diretórios..."
    mkdir -p /app/models_cache/{offload,transformers,huggingface,temp}
    chmod -R 777 /app/models_cache
    
    # Verificar permissões
    if [ ! -w "/app/models_cache/offload" ]; then
        error "Diretório de offload sem permissão de escrita"
    fi
}

# Verificar espaço em disco com requisitos específicos
check_disk_space() {
    log "Verificando espaço em disco..."
    
    # Verificar espaço total (mínimo 10GB para modelo)
    total_space=$(df -BG /app/models_cache | awk 'NR==2 {print $2}' | sed 's/G//')
    available_space=$(df -BG /app/models_cache | awk 'NR==2 {print $4}' | sed 's/G//')
    
    if [ "$available_space" -lt 10 ]; then
        error "Espaço em disco insuficiente. Necessário: 10GB, Disponível: ${available_space}GB"
    fi
    
    # Verificar espaço em tmpfs para offload
    tmpfs_space=$(df -BM /app/models_cache/offload | awk 'NR==2 {print $4}' | sed 's/M//')
    if [ "$tmpfs_space" -lt 10240 ]; then # 10GB em MB
        error "Espaço em tmpfs insuficiente. Necessário: 10GB, Disponível: ${tmpfs_space}MB"
    fi
    
    log "Espaço em disco OK (Disponível: ${available_space}GB, tmpfs: ${tmpfs_space}MB)"
}

# Limpar cache corrompido e arquivos temporários
clean_cache() {
    log "Limpando cache e arquivos temporários..."
    
    # Lista de padrões para limpar
    patterns=(
        "*.tmp"
        "*.temp"
        "*.lock"
        "*.part"
        "tmp_*"
        ".DS_Store"
    )
    
    for pattern in "${patterns[@]}"; do
        find /app/models_cache -type f -name "$pattern" -delete
    done
    
    # Remover arquivos vazios
    find /app/models_cache -type f -size 0 -delete
    
    # Remover diretórios vazios
    find /app/models_cache -type d -empty -delete
    
    log "Cache limpo com sucesso"
}

# Configurar ambiente Python e otimizações
setup_python_env() {
    log "Configurando ambiente Python e otimizações..."
    
    # Otimizações de memória
    export MALLOC_ARENA_MAX=2
    export OMP_NUM_THREADS=1
    export MKL_NUM_THREADS=1
    export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128
    
    # Otimizações HuggingFace
    export USE_SAFETENSORS=1
    export TOKENIZERS_PARALLELISM=false
    export HF_HUB_DISABLE_TELEMETRY=1
    export TRANSFORMERS_VERBOSITY=error
    
    # Verificar se Python e pip estão funcionando
    python -c "import torch; print('PyTorch version:', torch.__version__)" || \
        error "Erro ao importar PyTorch"
    
    log "Ambiente Python configurado com sucesso"
}

# Verificar memória disponível
check_memory() {
    log "Verificando memória disponível..."
    
    # Obter memória total e disponível em MB
    total_mem=$(free -m | awk '/^Mem:/{print $2}')
    available_mem=$(free -m | awk '/^Mem:/{print $7}')
    
    # Necessário pelo menos 2GB disponível
    if [ "$available_mem" -lt 2048 ]; then
        error "Memória RAM insuficiente. Necessário: 2GB, Disponível: ${available_mem}MB"
    fi
    
    log "Memória OK (Disponível: ${available_mem}MB de ${total_mem}MB)"
}

main() {
    log "Iniciando configuração do ambiente de teste..."
    
    # Configurar diretórios básicos
    mkdir -p /app/models_cache/{offload,transformers,huggingface,temp}
    chmod -R 777 /app/models_cache
    
    # Configurar ambiente Python
    setup_python_env
    
    log "Ambiente configurado com sucesso!"
    log "Iniciando execução dos testes..."
    
    # Executar testes
    exec pytest -v \
        --cov=backend \
        --cov-report=term-missing \
        backend/tests/
}

main
