from flask import Blueprint, request, jsonify
from core.llm_manager import LLMManager
from core.memory_manager import MemoryManager
from core.system_manager import SystemManager
from core.workflow_manager import WorkflowManager
from core.agent_manager import AgentManager
from core.analytics_manager import AnalyticsManager
from core.rag_pipeline import RAGPipeline
from utils.config import Config
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Blueprint
api = Blueprint('api', __name__, url_prefix='/api')

# Initialize managers
config = Config()
memory_manager = MemoryManager(
    cache_dir=config.MODEL_CACHE_DIR,
    offload_dir=config.MODEL_WEIGHTS_OFFLOAD_DIR
)
system_manager = SystemManager()
llm_manager = LLMManager(memory_manager)
workflow_manager = WorkflowManager(llm_manager)
agent_manager = AgentManager(llm_manager)
analytics_manager = AnalyticsManager()
rag_pipeline = RAGPipeline()

# Health check endpoint
@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

# Dashboard routes
@api.route('/dashboard/stats', methods=['GET'])
def dashboard_stats():
    try:
        stats = {
            'system': system_manager.get_system_status(),
            'model': llm_manager.get_model_status(),
            'workflows': len(workflow_manager.list_workflows()),
            'agents': len(agent_manager.list_agents())
        }
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Chat routes
@api.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message')
        context = data.get('context', {})
        
        response = llm_manager.generate_response(message, context)
        return jsonify({"response": response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Model routes
@api.route('/models/status', methods=['GET'])
def model_status():
    try:
        status = llm_manager.get_model_status()
        return jsonify(status), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# System status endpoint
@api.route('/system/status', methods=['GET'])
def get_system_status():
    try:
        # Obter status do sistema
        system_status = system_manager.get_system_status()
        
        # Obter status do modelo
        model_status = llm_manager.get_model_status()
        
        # Obter informações de memória e cache
        if memory_manager:
            memory_info = memory_manager.get_memory_usage()
            has_resources, available_gb = memory_manager.check_available_memory()
        else:
            memory_info = {}
            has_resources, available_gb = False, 0
        
        # Combinar todas as informações
        status = {
            **system_status,
            'model': {
                **model_status,
                'has_resources': has_resources,
                'available_gb': available_gb
            },
            'memory': memory_info
        }
        
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        return jsonify({
            'error': str(e),
            'status': 'error',
            'model': {
                'status': 'error',
                'error': str(e)
            }
        }), 500

@api.route('/system/config', methods=['GET', 'POST'])
def system_config():
    try:
        if request.method == 'GET':
            config = system_manager.get_config()
            return jsonify(config), 200
        else:
            new_config = request.json
            updated_config = system_manager.update_config(new_config)
            return jsonify(updated_config), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/system/cache/cleanup', methods=['POST'])
def clean_cache():
    try:
        result = system_manager.clean_cache()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Workflow routes
@api.route('/workflows', methods=['GET', 'POST'])
def workflows():
    try:
        if request.method == 'GET':
            workflows = workflow_manager.list_workflows()
            return jsonify(workflows), 200
        else:
            data = request.json
            workflow = workflow_manager.create_workflow(
                name=data.get('name'),
                description=data.get('description'),
                steps=data.get('steps', [])
            )
            return jsonify(workflow.to_dict()), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/workflows/<workflow_id>', methods=['GET', 'PUT', 'DELETE'])
def workflow(workflow_id):
    try:
        if request.method == 'GET':
            workflow = workflow_manager.get_workflow(workflow_id)
            if not workflow:
                return jsonify({"error": "Workflow not found"}), 404
            return jsonify(workflow.to_dict()), 200
        elif request.method == 'PUT':
            data = request.json
            workflow = workflow_manager.get_workflow(workflow_id)
            if not workflow:
                return jsonify({"error": "Workflow not found"}), 404
            workflow.name = data.get('name', workflow.name)
            workflow.description = data.get('description', workflow.description)
            workflow.steps = data.get('steps', workflow.steps)
            workflow_manager.save_workflows()
            return jsonify(workflow.to_dict()), 200
        else:
            if not workflow_manager.delete_workflow(workflow_id):
                return jsonify({"error": "Workflow not found"}), 404
            return '', 204
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/workflows/<workflow_id>/execute', methods=['POST'])
def execute_workflow(workflow_id):
    try:
        workflow = workflow_manager.get_workflow(workflow_id)
        if not workflow:
            return jsonify({"error": "Workflow not found"}), 404
            
        data = request.json
        result = workflow_manager.execute_workflow(
            workflow_id=workflow_id,
            input_data=data.get('input', {}),
            context=data.get('context', {})
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error executing workflow {workflow_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Prompt Studio routes
@api.route('/prompts', methods=['GET', 'POST'])
def prompts():
    try:
        if request.method == 'GET':
            prompts = llm_manager.list_prompts()
            return jsonify(prompts), 200
        else:
            data = request.json
            prompt = llm_manager.save_prompt(data)
            return jsonify(prompt), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/prompt/generate', methods=['POST'])
def generate_prompt():
    try:
        data = request.json
        result = llm_manager.generate_response(
            message=data.get('prompt'),
            context=data.get('context', {}),
            max_length=data.get('max_length', 1000),
            temperature=data.get('temperature', 0.7)
        )
        return jsonify({"response": result}), 200
    except Exception as e:
        logger.error(f"Error generating prompt: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api.route('/prompts/execute', methods=['POST'])
def execute_prompt():
    try:
        data = request.json
        result = llm_manager.execute_prompt(data)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# RAG Pipeline routes
@api.route('/rag/validate', methods=['POST'])
def validate_documents():
    """Validate documents before processing"""
    try:
        # Verificar se há arquivos no request
        if 'file' not in request.files and 'files' not in request.files:
            logger.error("No files found in request")
            return jsonify({
                'error': 'No files provided',
                'details': 'Request must include file or files field'
            }), 400
        
        # Pegar os arquivos do request
        if 'files' in request.files:
            files = request.files.getlist('files')
            logger.info(f"Processing {len(files)} files from 'files' field")
        else:
            files = [request.files['file']]
            logger.info("Processing single file from 'file' field")
        
        # Validar se há arquivos e se têm nomes válidos
        if not files or files[0].filename == '':
            logger.error("Empty file list or no filename")
            return jsonify({
                'error': 'No files selected',
                'details': 'Files must have valid filenames'
            }), 400
        
        # Inicializar resultados
        validation_results = []
        total_size = 0
        logger.info(f"Starting validation of {len(files)} files")
        
        for file in files:
            # Validar extensão
            filename = file.filename
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ['.pdf', '.txt', '.doc', '.docx']:
                logger.warning(f"Invalid file type: {filename} (extension: {ext})")
                validation_results.append({
                    'filename': filename,
                    'valid': False,
                    'error': 'Invalid file type'
                })
                continue
            
            # Validar tamanho
            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)
            total_size += size
            
            if size > 10 * 1024 * 1024:  # 10MB
                validation_results.append({
                    'filename': filename,
                    'valid': False,
                    'error': 'File too large (max 10MB)'
                })
                continue
            
            # Arquivo válido
            validation_results.append({
                'filename': filename,
                'valid': True,
                'size': size
            })
        
        # Validar tamanho total
        if total_size > 50 * 1024 * 1024:  # 50MB
            return jsonify({
                'error': 'Total size exceeds 50MB limit',
                'results': validation_results
            }), 400
        
        return jsonify({
            'message': 'All files validated successfully',
            'results': validation_results
        })
        
    except Exception as e:
        logger.error(f"Error validating documents: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api.route('/rag/upload', methods=['POST'])
def upload_document():
    try:
        # Verificar se há arquivos no request
        if 'file' not in request.files and 'files' not in request.files:
            logger.error("No files found in request")
            return jsonify({
                'error': 'No files provided',
                'details': 'Request must include file or files field'
            }), 400
        
        # Pegar os arquivos do request
        if 'files' in request.files:
            files = request.files.getlist('files')
            logger.info(f"Processing {len(files)} files from 'files' field")
        else:
            files = [request.files['file']]
            logger.info("Processing single file from 'file' field")
        
        # Validar se há arquivos e se têm nomes válidos
        if not files or files[0].filename == '':
            logger.error("Empty file list or no filename")
            return jsonify({
                'error': 'No files selected',
                'details': 'Files must have valid filenames'
            }), 400
        
        # Verificar recursos do sistema
        system_status = system_manager.get_system_status()
        disk_space = system_status.get('diskSpace', {})
        memory_info = system_status.get('memory', {})
        
        # Verificar espaço em disco (mínimo 10GB)
        if disk_space.get('available', 0) < 10 * 1024 * 1024 * 1024:
            logger.error("Insufficient disk space")
            memory_manager.clean_corrupted_cache()  # Tentar liberar espaço
            
            # Verificar novamente após limpeza
            system_status = system_manager.get_system_status()
            disk_space = system_status.get('diskSpace', {})
            
            if disk_space.get('available', 0) < 10 * 1024 * 1024 * 1024:
                return jsonify({
                    'error': 'Insufficient disk space',
                    'details': 'Need at least 10GB of free space. Please clean up disk space and try again.',
                    'available': disk_space.get('available', 0),
                    'required': 10 * 1024 * 1024 * 1024
                }), 507
        
        # Verificar memória disponível (mínimo 4GB)
        if memory_info.get('available', 0) < 4 * 1024 * 1024 * 1024:
            logger.warning("Low memory available")
            memory_manager.clean_corrupted_cache()  # Tentar liberar memória
            
            # Verificar novamente após limpeza
            system_status = system_manager.get_system_status()
            memory_info = system_status.get('memory', {})
            
            if memory_info.get('available', 0) < 4 * 1024 * 1024 * 1024:
                return jsonify({
                    'error': 'Insufficient memory',
                    'details': 'System is low on memory. Processing may be affected.',
                    'available': memory_info.get('available', 0),
                    'recommended': 4 * 1024 * 1024 * 1024
                }), 507
        
        # Processar documentos
        logger.info(f"Starting document processing for {len(files)} files")
        results = rag_pipeline.process_documents(files)
        logger.info("Documents processed successfully")
        
        return jsonify({
            'message': 'Documents processed successfully',
            'results': results
        })
        
    except ValueError as e:
        logger.error(f"Validation error in document upload: {str(e)}")
        return jsonify({
            'error': 'Invalid document data',
            'details': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error processing documents: {str(e)}")
        return jsonify({
            'error': 'Failed to process documents',
            'details': str(e)
        }), 500

@api.route('/rag/query', methods=['POST'])
def query_documents():
    try:
        # Validar request
        if not request.is_json:
            logger.error("Request must be JSON")
            return jsonify({
                "error": "Invalid request format",
                "details": "Content-Type must be application/json"
            }), 400
        
        data = request.json
        
        # Validar campos obrigatórios
        if not data or 'query' not in data:
            logger.error("Missing required field: query")
            return jsonify({
                "error": "Missing required field",
                "details": "Field 'query' is required"
            }), 400
            
        # Verificar status do modelo
        model_status = llm_manager.get_model_status()
        if model_status.get('status') != 'ready':
            return jsonify({
                "error": "Model not ready",
                "details": f"Model is currently {model_status.get('status')}. Please wait until the model is ready.",
                "model_status": model_status
            }), 503
            
        # Verificar recursos do sistema
        system_status = system_manager.get_system_status()
        memory_info = system_status.get('memory', {})
        
        # Verificar memória disponível (mínimo 2GB para queries)
        if memory_info.get('available', 0) < 2 * 1024 * 1024 * 1024:
            logger.warning("Low memory for query processing")
            memory_manager.clean_corrupted_cache()  # Tentar liberar memória
            
            # Verificar novamente após limpeza
            system_status = system_manager.get_system_status()
            memory_info = system_status.get('memory', {})
            
            if memory_info.get('available', 0) < 2 * 1024 * 1024 * 1024:
                return jsonify({
                    'error': 'Insufficient memory',
                    'details': 'System is low on memory. Please try again later.',
                    'available': memory_info.get('available', 0),
                    'recommended': 2 * 1024 * 1024 * 1024
                }), 507
        
        # Executar query
        logger.info("Executing RAG query")
        results = rag_pipeline.query(data['query'])
        logger.info("Query executed successfully")
        
        return jsonify(results)
        
    except ValueError as e:
        logger.error(f"Validation error in RAG query: {str(e)}")
        return jsonify({
            "error": "Invalid query data",
            "details": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error executing RAG query: {str(e)}")
        return jsonify({
            "error": "Failed to execute query",
            "details": str(e)
        }), 500

# Agent routes
@api.route('/agents', methods=['GET', 'POST'])
def agents():
    try:
        if request.method == 'GET':
            agents = agent_manager.list_agents()
            return jsonify(agents), 200
        else:
            data = request.json
            agent = agent_manager.create_agent(data)
            return jsonify(agent), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/agents/<agent_id>', methods=['GET', 'PUT', 'DELETE'])
def agent(agent_id):
    try:
        if request.method == 'GET':
            agent = agent_manager.get_agent(agent_id)
            if not agent:
                return jsonify({"error": "Agent not found"}), 404
            return jsonify(agent), 200
        elif request.method == 'PUT':
            data = request.json
            agent = agent_manager.update_agent(agent_id, data)
            if not agent:
                return jsonify({"error": "Agent not found"}), 404
            return jsonify(agent), 200
        else:
            if not agent_manager.delete_agent(agent_id):
                return jsonify({"error": "Agent not found"}), 404
            return '', 204
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/agents/<agent_id>/execute', methods=['POST'])
def execute_agent(agent_id):
    try:
        data = request.json
        result = agent_manager.execute_agent(agent_id, data)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Analytics routes
@api.route('/analytics/usage', methods=['GET'])
def usage_analytics():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        usage = analytics_manager.get_usage_analytics(start_date, end_date)
        return jsonify(usage), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api.route('/analytics/performance', methods=['GET'])
def performance_analytics():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        performance = analytics_manager.get_performance_analytics(start_date, end_date)
        return jsonify(performance), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
