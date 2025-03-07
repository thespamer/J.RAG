# Q-RAG3

Q-RAG3 é um poderoso sistema de Perguntas e Respostas construído sobre o modelo DeepSeek LLM 7B com capacidades RAG (Retrieval-Augmented Generation).

## Visão Geral do Dashboard

![Q-RAG3 Dashboard](./dashboard.png)

A plataforma Q-RAG3 fornece uma interface intuitiva com quatro componentes principais:

- **Pipeline RAG**: Construa e gerencie seu pipeline de processamento de documentos
- **Prompt Studio**: Projete e teste prompts para suas aplicações LLM
- **Workflows**: Crie fluxos de trabalho automatizados para processamento de documentos
- **Agentes**: Configure e implante agentes de IA

A plataforma é otimizada para operação eficiente com suporte a offloading em disco para o modelo DeepSeek LLM.

## Arquitetura do Sistema

### Diagrama de Componentes
```mermaid
graph TB
    subgraph Backend
        API[Camada API<br/>FastAPI]:::apiStyle
        Core[Serviços Core<br/>Python]:::coreStyle
        LLM[Serviço LLM<br/>DeepSeek 7B]:::llmStyle
        RAG[Pipeline RAG<br/>Python]:::ragStyle
        DB[(Armazenamento<br/>JSON/Arquivos)]:::dbStyle
    end

    subgraph Frontend
        UI[Interface Web<br/>React]:::uiStyle
        State[Gerenciamento Estado<br/>React Context]:::stateStyle
    end

    UI -->|HTTP/REST| API
    API --> Core
    Core --> LLM
    Core --> RAG
    Core -->|Leitura/Escrita| DB
    UI --> State

    classDef apiStyle fill:#f9f,stroke:#333,stroke-width:2px
    classDef coreStyle fill:#bbf,stroke:#333,stroke-width:2px
    classDef llmStyle fill:#bfb,stroke:#333,stroke-width:2px
    classDef ragStyle fill:#fbf,stroke:#333,stroke-width:2px
    classDef dbStyle fill:#fbb,stroke:#333,stroke-width:2px
    classDef uiStyle fill:#fff,stroke:#333,stroke-width:2px
    classDef stateStyle fill:#ddd,stroke:#333,stroke-width:2px
```

### Diagrama de Classes
```mermaid
classDiagram
    class SystemManager {
        -status_modelo: dict
        -diretorios_limpeza: dict
        +atualizar_status_modelo(status: str, progresso: float)
        +obter_espaco_disco(caminho: str): dict
        +limpar_cache_corrompido()
    }

    class LLMManager {
        -modelo: AutoModelForCausalLM
        -tokenizer: AutoTokenizer
        +inicializar_modelo()
        +gerar_resposta(mensagem: str): str
    }

    class RAGPipeline {
        +processar_documentos(arquivos: List)
        +consultar_documentos(consulta: str): str
    }

    class MemoryManager {
        -diretorio_cache: str
        +limpar_cache()
        +obter_tamanho_cache(): int
    }

    class WorkflowManager {
        +criar_workflow(config: dict)
        +executar_workflow(id: str)
    }

    class AgentManager {
        +criar_agente(config: dict)
        +executar_agente(id: str, tarefa: str)
    }

    SystemManager --> LLMManager
    SystemManager --> MemoryManager
    LLMManager --> RAGPipeline
    WorkflowManager --> RAGPipeline
    AgentManager --> LLMManager
```

### Diagrama de Fluxo de Dados
```mermaid
graph TD
    A[Entrada do Usuário] --> B[Camada API]
    B --> C{Serviços Core}
    C -->|Documentos| D[Pipeline RAG]
    C -->|Consultas| E[Serviço LLM]
    D --> F[(Armazenamento<br/>Documentos)]
    D --> E
    E --> G[Geração de<br/>Resposta]
    G --> H[Interface do<br/>Usuário]

    classDef default fill:#f9f,stroke:#333,stroke-width:2px;
```

### Diagrama de Sequência da Aplicação
```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend
    participant A as API
    participant LM as LLMManager
    participant RM as RAGPipeline
    participant SM as SystemManager
    
    U->>F: Envia Consulta
    F->>A: POST /api/rag/query
    A->>SM: Verifica Status Sistema
    SM-->>A: Status OK
    A->>RM: Processa Consulta
    RM->>LM: Gera Resposta
    LM-->>RM: Resposta Gerada
    RM-->>A: Resultado
    A-->>F: Resposta JSON
    F-->>U: Exibe Resultado
```

### Diagrama de Rotas da API
```mermaid
graph TB
    subgraph Endpoints
        H[/health/]:::health
        
        subgraph Dashboard
            D[/dashboard/stats/]:::dashboard
        end
        
        subgraph RAG
            R1[/rag/validate/]:::rag
            R2[/rag/upload/]:::rag
            R3[/rag/query/]:::rag
        end
        
        subgraph Sistema
            S1[/system/status/]:::system
            S2[/system/config/]:::system
            S3[/system/cache/cleanup/]:::system
        end
        
        subgraph Workflows
            W1[/workflows/]:::workflow
            W2[/workflows/{id}/]:::workflow
        end
        
        subgraph Prompts
            P1[/prompts/]:::prompt
            P2[/prompts/execute/]:::prompt
        end
        
        subgraph Agentes
            AG1[/agents/]:::agent
            AG2[/agents/{id}/]:::agent
            AG3[/agents/{id}/execute/]:::agent
        end
        
        subgraph Analytics
            AN1[/analytics/usage/]:::analytics
            AN2[/analytics/performance/]:::analytics
        end
    end
    
    classDef health fill:#97E49C,stroke:#333
    classDef dashboard fill:#FFB366,stroke:#333
    classDef rag fill:#FF99CC,stroke:#333
    classDef system fill:#99CCFF,stroke:#333
    classDef workflow fill:#CC99FF,stroke:#333
    classDef prompt fill:#FF99FF,stroke:#333
    classDef agent fill:#FFFF99,stroke:#333
    classDef analytics fill:#99FFCC,stroke:#333
```

### Diagrama de Otimização de Memória e Disco
```mermaid
graph TB
    subgraph Gerenciamento de Recursos
        subgraph Memória
            M1[Carregamento em CPU]:::cpu
            M2[Offload para Disco]:::disk
            M3[Otimização de Cache]:::cache
        end

        subgraph Disco
            D1[Verificação de Espaço<br/>Mínimo 10GB]:::check
            D2[Limpeza de Cache<br/>Corrompido]:::cleanup
            D3[Diretório de Offload<br/>/app/models_cache/offload]:::dir
        end

        subgraph Parâmetros
            P1[low_cpu_mem_usage=True]:::param
            P2[use_safetensors=True]:::param
            P3[device_map=auto]:::param
        end
    end

    M1 -->|Falha| M2
    D1 -->|OK| M1
    D1 -->|Insuficiente| D2
    M2 --> D3
    P1 & P2 & P3 --> M1

    classDef cpu fill:#bbf,stroke:#333,stroke-width:2px
    classDef disk fill:#fbf,stroke:#333,stroke-width:2px
    classDef cache fill:#bfb,stroke:#333,stroke-width:2px
    classDef check fill:#ff9,stroke:#333,stroke-width:2px
    classDef cleanup fill:#f99,stroke:#333,stroke-width:2px
    classDef dir fill:#9ff,stroke:#333,stroke-width:2px
    classDef param fill:#f9f,stroke:#333,stroke-width:2px
```

### Estrutura do app.py
```mermaid
graph TB
    subgraph Inicialização
        A[Flask App] --> B[CORS]
        A --> C[Logging]
    end
    
    subgraph Gerenciadores
        D[Config] --> E[MemoryManager]
        D --> F[SystemManager]
        E -->|cache_dir<br/>offload_dir| G[LLMManager]
        F -->|status<br/>cleanup| G
        G -->|modelo| H[WorkflowManager]
        G -->|modelo| I[AgentManager]
        J[AnalyticsManager]
        K[RAGPipeline]
    end
    
    subgraph Rotas
        L[Blueprint API] --> M[Health Check]
        L --> N[System Cleanup]
    end
    
    A --> D
    A --> L
```

### Estratégia de Carregamento do Modelo
```mermaid
stateDiagram-v2
    state "Verificação Inicial" as VI
    state "Carregamento em CPU" as CC
    state "Offload para Disco" as OD
    state "Validação do Modelo" as VM
    state "Limpeza de Cache" as LC

    [*] --> VI
    
    state VI {
        [*] --> CheckDisk
        CheckDisk --> CheckMem
        CheckMem --> [*]
    }
    
    VI --> CC: Memória OK
    VI --> LC: Espaço Insuficiente
    LC --> VI
    
    state CC {
        [*] --> LoadCPU
        LoadCPU --> Config
        state Config {
            low_cpu_mem: true
            use_safetensors: true
            device_map: cpu
        }
    }
    
    CC --> OD: Falha
    
    state OD {
        [*] --> PrepararOffload
        PrepararOffload --> OffloadConfig
        state OffloadConfig {
            offload_folder: /app/models_cache/offload
            device_map: auto
        }
    }
    
    CC --> VM: Sucesso
    OD --> VM: Sucesso
    
    VM --> [*]: Modelo Pronto
```

### Fluxo de Processamento RAG
```mermaid
stateDiagram-v2
    [*] --> ValidarDocumentos: Upload de Documentos
    ValidarDocumentos --> ProcessarDocumentos: Validação OK
    ValidarDocumentos --> [*]: Erro

    state ProcessarDocumentos {
        [*] --> Chunks: Dividir em Chunks
        Chunks --> Embeddings: Gerar Embeddings
        Embeddings --> Indexar: Indexar Vetores
        Indexar --> [*]
    }

    ProcessarDocumentos --> ProntoParaConsulta: Indexação Completa
    
    state ConsultaRAG {
        [*] --> AnalisarConsulta
        AnalisarConsulta --> BuscarContexto: Gerar Embedding
        BuscarContexto --> GerarResposta: Top K Documentos
        GerarResposta --> [*]: Resposta Final
    }

    ProntoParaConsulta --> ConsultaRAG: Nova Consulta
    ConsultaRAG --> ProntoParaConsulta: Consulta Concluída
```

### Estrutura Docker e Volumes
```mermaid
graph TB
    subgraph Host
        subgraph Docker Container
            subgraph App[/app]
                MC[models_cache]:::cache
                UP[uploads]:::upload
                subgraph Cache[models_cache]
                    TR[transformers]:::transformers
                    HF[huggingface]:::huggingface
                    OF[offload]:::offload
                end
            end
        end

        subgraph Volumes Persistentes
            V1[models_cache]:::volume
            V2[uploads]:::volume
        end
    end

    V1 -.->|mount| MC
    V2 -.->|mount| UP
    
    classDef cache fill:#bbf,stroke:#333,stroke-width:2px
    classDef upload fill:#fbf,stroke:#333,stroke-width:2px
    classDef transformers fill:#bfb,stroke:#333,stroke-width:2px
    classDef huggingface fill:#ff9,stroke:#333,stroke-width:2px
    classDef offload fill:#f99,stroke:#333,stroke-width:2px
    classDef volume fill:#ddd,stroke:#333,stroke-width:2px

    %% Anotações
    style App fill:#fff,stroke:#333,stroke-width:2px
    style Docker Container fill:#f5f5f5,stroke:#666,stroke-width:2px
    style Host fill:#e9e9e9,stroke:#999,stroke-width:2px
```

### Tratamento de Erros e Recuperação
```mermaid
flowchart TB
    subgraph Erros[Tratamento de Erros]
        E1[No space left on device]:::error
        E2[Out of Memory - Killed]:::error
        E3[Permission Denied - Locks]:::error
        E4[Device Map Error]:::error
    end

    subgraph Soluções[Estratégias de Recuperação]
        S1[Limpeza Agressiva<br/>de Cache]:::solution
        S2[Download em<br/>Duas Etapas]:::solution
        S3[Desativar Locks e<br/>Symlinks]:::solution
        S4[Offload para<br/>Disco]:::solution
    end

    E1 --> S1
    E2 --> S2
    E3 --> S3
    E4 --> S4

    S1 & S2 & S3 & S4 --> R[Retry]:::retry
    R -->|Sucesso| OK[Modelo Carregado]:::success
    R -->|Falha| Erros

    classDef error fill:#ffcccc,stroke:#ff0000,stroke-width:2px
    classDef solution fill:#ccffcc,stroke:#00aa00,stroke-width:2px
    classDef retry fill:#ccccff,stroke:#0000aa,stroke-width:2px
    classDef success fill:#99ff99,stroke:#006600,stroke-width:2px
```

### Hierarquia de Componentes Frontend
```mermaid
graph TB
    subgraph App[App.jsx]
        Nav[Navbar]:::nav
        Main[Main Content]:::main
    end

    subgraph Components[Componentes Principais]
        RP[RAGPipeline]:::rag
        PS[PromptStudio]:::prompt
        WF[Workflows]:::workflow
        AG[Agents]:::agent
        SS[SystemStatus]:::system
    end

    subgraph Common[Componentes Comuns]
        UL[FileUploader]:::common
        MD[ModelStatus]:::common
        ER[ErrorDisplay]:::common
        PG[ProgressBar]:::common
    end

    Main --> Components
    RP --> Common
    PS --> Common
    WF --> Common
    AG --> Common

    classDef nav fill:#bbf,stroke:#333,stroke-width:2px
    classDef main fill:#fbf,stroke:#333,stroke-width:2px
    classDef rag fill:#bfb,stroke:#333,stroke-width:2px
    classDef prompt fill:#ff9,stroke:#333,stroke-width:2px
    classDef workflow fill:#f99,stroke:#333,stroke-width:2px
    classDef agent fill:#9ff,stroke:#333,stroke-width:2px
    classDef system fill:#f9f,stroke:#333,stroke-width:2px
    classDef common fill:#ddd,stroke:#333,stroke-width:2px
```

### Gerenciamento de Estado Frontend
```mermaid
graph TB
    subgraph Estado Global
        MS[ModelStatus]:::model
        SS[SystemStatus]:::system
        UR[UserPreferences]:::user
    end

    subgraph Estados Locais
        subgraph RAG[RAGPipeline]
            RD[Documents]:::docs
            RI[Index]:::index
            RQ[Queries]:::query
        end

        subgraph PS[PromptStudio]
            PT[Templates]:::template
            PH[History]:::history
        end

        subgraph WF[Workflows]
            WC[Config]:::config
            WS[Steps]:::steps
        end
    end

    MS --> RAG
    MS --> PS
    SS --> RAG
    SS --> WF
    UR --> RAG
    UR --> PS
    UR --> WF

    classDef model fill:#bbf,stroke:#333,stroke-width:2px
    classDef system fill:#fbf,stroke:#333,stroke-width:2px
    classDef user fill:#bfb,stroke:#333,stroke-width:2px
    classDef docs fill:#ff9,stroke:#333,stroke-width:2px
    classDef index fill:#f99,stroke:#333,stroke-width:2px
    classDef query fill:#9ff,stroke:#333,stroke-width:2px
    classDef template fill:#f9f,stroke:#333,stroke-width:2px
    classDef history fill:#ddd,stroke:#333,stroke-width:2px
    classDef config fill:#fbb,stroke:#333,stroke-width:2px
    classDef steps fill:#bfb,stroke:#333,stroke-width:2px
```

## Requisitos do Sistema

- Memória: Mínimo 512MB RAM (otimizado para ambientes com recursos limitados)
- Espaço em Disco: Mínimo 10GB de espaço livre
- Python 3.8+
- Node.js 14+

## Funcionalidades

- **Pipeline RAG**: Processe e consulte documentos usando técnicas RAG de última geração
- **Prompt Studio**: Crie, teste e gerencie prompts para diversos casos de uso
- **Gerenciamento de Workflows**: Construa e automatize fluxos complexos de processamento de documentos
- **Sistema de Agentes**: Crie agentes especializados para diferentes tarefas
- **Analytics**: Acompanhe o uso e desempenho do sistema
- **Otimizado para Baixos Recursos**: Funciona eficientemente em ambientes com memória limitada

## Documentação da API

### Dashboard
- `GET /api/dashboard/stats`
  - Retorna estatísticas gerais do sistema
  - Resposta inclui: status do sistema, status do modelo, contagem de workflows, contagem de agentes

### Workflows
- `GET /api/workflows`
  - Lista todos os workflows
- `POST /api/workflows`
  - Cria um novo workflow
- `GET /api/workflows/<id>`
  - Obtém detalhes do workflow
- `PUT /api/workflows/<id>`
  - Atualiza workflow
- `DELETE /api/workflows/<id>`
  - Remove workflow

### Prompt Studio
- `GET /api/prompts`
  - Lista prompts salvos
- `POST /api/prompts`
  - Salva um novo prompt
- `POST /api/prompts/execute`
  - Executa um prompt

### Pipeline RAG
- `POST /api/rag/upload`
  - Faz upload de documentos para processamento
- `POST /api/rag/query`
  - Consulta documentos processados

### Agentes
- `GET /api/agents`
  - Lista todos os agentes
- `POST /api/agents`
  - Cria um novo agente
- `GET /api/agents/<id>`
  - Obtém detalhes do agente
- `PUT /api/agents/<id>`
  - Atualiza agente
- `DELETE /api/agents/<id>`
  - Remove agente
- `POST /api/agents/<id>/execute`
  - Executa um agente

### Analytics
- `GET /api/analytics/usage`
  - Obtém estatísticas de uso
  - Parâmetros: start_date, end_date
- `GET /api/analytics/performance`
  - Obtém métricas de desempenho
  - Parâmetros: start_date, end_date

### Configurações
- `GET /api/system/config`
  - Obtém configurações do sistema
- `POST /api/system/config`
  - Atualiza configurações do sistema

### Status do Sistema
- `GET /api/system/status`
  - Obtém status atual do sistema
- `GET /api/models/status`
  - Obtém status do modelo
- `POST /api/system/cache/cleanup`
  - Limpa cache do sistema

## Gerenciamento de Memória

O sistema inclui várias otimizações para execução em ambientes com memória limitada:

1. **Carregamento do Modelo**:
   - Abordagem de carregamento em duas etapas
   - Primeira tentativa em CPU
   - Fallback para offload em disco se necessário

2. **Download do Modelo**:
   - Usa download otimizado via snapshot
   - Baixa apenas arquivos necessários
   - Valida integridade dos arquivos do modelo

3. **Offload de Pesos**:
   - Suporta offload de pesos do modelo para disco
   - Diretório de offload configurável
   - Limpeza automática do cache de offload

## Desenvolvimento

### Configuração do Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # ou `venv\Scripts\activate` no Windows
pip install -r requirements.txt
python app.py
```

### Configuração do Frontend
```bash
cd frontend
npm install
npm start
```

## Suporte Docker

Construa e execute com Docker:

```bash
docker-compose up --build
```

## Contribuindo

1. Faça um fork do repositório
2. Crie sua branch de feature
3. Faça commit das suas alterações
4. Faça push para a branch
5. Crie um novo Pull Request

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.
