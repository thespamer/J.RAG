# Testes do Backend Q-RAG3

Este diretório contém os testes automatizados para o backend do Q-RAG3, configurados para execução em ambiente Docker.

## Estrutura

```
tests/
├── __init__.py           # Inicialização do pacote de testes
├── conftest.py           # Configurações e fixtures do pytest
├── test_memory_manager.py # Testes do MemoryManager
├── test_llm_manager.py    # Testes do LLMManager
├── requirements-test.txt  # Dependências para testes
└── Dockerfile.test       # Dockerfile para ambiente de teste
```

## Executando os Testes com Docker

### 1. Construir e Executar os Testes

```bash
# Na raiz do projeto
docker-compose -f docker-compose.test.yml up --build
```

### 2. Executar Testes Específicos

```bash
# Executar apenas os testes do MemoryManager
docker-compose -f docker-compose.test.yml run --rm test pytest -v backend/tests/test_memory_manager.py

# Executar apenas os testes do LLMManager
docker-compose -f docker-compose.test.yml run --rm test pytest -v backend/tests/test_llm_manager.py
```

### 3. Executar com Cobertura de Código

```bash
docker-compose -f docker-compose.test.yml run --rm test pytest -v --cov=backend backend/tests/
```

### 4. Modo Watch (Desenvolvimento)

```bash
# Executar testes automaticamente quando arquivos são modificados
docker-compose -f docker-compose.test.yml run --rm test pytest -f backend/tests/
```

## Ambiente Docker

### Configuração do Ambiente

O ambiente de teste é configurado usando:

- `Dockerfile.test`: Imagem base Python com todas as dependências
- `docker-compose.test.yml`: Configuração do serviço de teste com:
  - Volume para cache de modelos
  - Memória tmpfs para offload
  - Limites de recursos (CPU/RAM)
  - Variáveis de ambiente necessárias

### Recursos Alocados

- Memória: 2-4GB RAM
- CPU: 1-2 cores
- Disco: Volume dedicado para cache
- tmpfs: 10GB para offload de modelo

## Fixtures Disponíveis

- `test_data_dir`: Diretório temporário para dados de teste
- `test_cache_dir`: Diretório temporário para cache
- `test_offload_dir`: Diretório temporário para offload do modelo
- `mock_model_files`: Arquivos simulados do modelo para testes
- `clean_test_env`: Ambiente limpo com diretórios temporários

## Adicionando Novos Testes

1. Crie um novo arquivo `test_*.py` no diretório `tests/`
2. Importe as fixtures necessárias do `conftest.py`
3. Use classes TestXXX para organizar os testes relacionados
4. Execute os testes no container usando os comandos acima

## Boas Práticas

- Mantenha os testes isolados e independentes
- Use fixtures para reutilizar código
- Limpe recursos após os testes
- Considere os limites de recursos do container
- Evite dependências desnecessárias do sistema
- Use mocks para recursos externos quando possível
- Documente requisitos específicos de ambiente
