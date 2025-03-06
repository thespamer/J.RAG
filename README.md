# Q-RAG3

Q-RAG3 is a powerful Question-Answering system built on top of the DeepSeek LLM 7B model with RAG (Retrieval-Augmented Generation) capabilities.

## System Requirements

- Memory: Minimum 512MB RAM (optimized for low-memory environments)
- Disk Space: Minimum 1GB free space
- Python 3.8+
- Node.js 14+

## Features

- **RAG Pipeline**: Process and query documents using state-of-the-art RAG techniques
- **Prompt Studio**: Create, test, and manage prompts for various use cases
- **Workflow Management**: Build and automate complex document processing workflows
- **Agent System**: Create specialized agents for different tasks
- **Analytics**: Track system usage and performance
- **Optimized for Low Resources**: Works efficiently in environments with limited memory

## API Documentation

### Dashboard
- `GET /api/dashboard/stats`
  - Returns overall system statistics
  - Response includes: system status, model status, workflow count, agent count

### Workflows
- `GET /api/workflows`
  - List all workflows
- `POST /api/workflows`
  - Create a new workflow
- `GET /api/workflows/<id>`
  - Get workflow details
- `PUT /api/workflows/<id>`
  - Update workflow
- `DELETE /api/workflows/<id>`
  - Delete workflow

### Prompt Studio
- `GET /api/prompts`
  - List saved prompts
- `POST /api/prompts`
  - Save a new prompt
- `POST /api/prompts/execute`
  - Execute a prompt

### RAG Pipeline
- `POST /api/rag/upload`
  - Upload documents for processing
- `POST /api/rag/query`
  - Query processed documents

### Agents
- `GET /api/agents`
  - List all agents
- `POST /api/agents`
  - Create a new agent
- `GET /api/agents/<id>`
  - Get agent details
- `PUT /api/agents/<id>`
  - Update agent
- `DELETE /api/agents/<id>`
  - Delete agent
- `POST /api/agents/<id>/execute`
  - Execute an agent

### Analytics
- `GET /api/analytics/usage`
  - Get usage statistics
  - Query params: start_date, end_date
- `GET /api/analytics/performance`
  - Get performance metrics
  - Query params: start_date, end_date

### Settings
- `GET /api/system/config`
  - Get system configuration
- `POST /api/system/config`
  - Update system configuration

### System Status
- `GET /api/system/status`
  - Get current system status
- `GET /api/models/status`
  - Get model status
- `POST /api/system/cache/cleanup`
  - Clean system cache

## Memory Management

The system includes several optimizations for running in low-memory environments:

1. **Model Loading**:
   - Two-stage loading approach
   - First attempts CPU loading
   - Falls back to disk offload if needed

2. **Model Download**:
   - Uses optimized snapshot download
   - Downloads only necessary files
   - Validates model files integrity

3. **Weight Offloading**:
   - Supports model weight offloading to disk
   - Configurable offload directory
   - Automatic cleanup of offload cache

## Development

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python app.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Docker Support

Build and run with Docker:

```bash
docker-compose up --build
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
