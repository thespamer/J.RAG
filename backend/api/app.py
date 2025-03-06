import os
from flask import Flask, jsonify
from flask_cors import CORS
from routes import api as api_bp
from api.core.llm_manager import LLMManager
from api.core.memory_manager import MemoryManager
from api.core.system_manager import SystemManager
from api.core.workflow_manager import WorkflowManager
from api.core.agent_manager import AgentManager
from api.core.analytics_manager import AnalyticsManager
from api.core.rag_pipeline import RAGPipeline
from utils.config import Config
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize managers
config = Config()
memory_manager = MemoryManager(
    cache_dir=config.MODEL_CACHE_DIR,
    offload_dir=config.MODEL_WEIGHTS_OFFLOAD_DIR
)
system_manager = SystemManager()
llm_manager = LLMManager(memory_manager=memory_manager, system_manager=system_manager)
workflow_manager = WorkflowManager(llm_manager)
agent_manager = AgentManager(llm_manager)
analytics_manager = AnalyticsManager()
rag_pipeline = RAGPipeline()

# Register blueprints
app.register_blueprint(api_bp)

# Health check
@app.route('/health', methods=['GET'])
def health_check():
    try:
        system_status = system_manager.get_system_status()
        return jsonify({
            "status": "healthy",
            "system": system_status
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# System cleanup
@app.route('/system/cleanup', methods=['POST'])
def system_cleanup():
    try:
        # Tentar limpar o sistema
        cleanup_result = system_manager.cleanup_system()
        
        # Obter o status atualizado do sistema
        system_status = system_manager.get_system_status()
        
        return jsonify({
            "status": "success",
            "message": "System cleanup completed successfully",
            "details": cleanup_result,
            "system": system_status
        }), 200
    except Exception as e:
        logger.error(f"System cleanup failed: {str(e)}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # Usar configurações do .env
    port = int(os.environ.get('API_PORT', 3000))
    host = os.environ.get('API_HOST', '0.0.0.0')
    app.run(host=host, port=port)
