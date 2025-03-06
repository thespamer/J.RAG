from typing import Dict, List, Optional
from datetime import datetime
import json
import os
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from .llm_manager import LLMManager

class WorkflowManager:
    def __init__(self, llm_manager: LLMManager):
        self.llm_manager = llm_manager
        self.workflows: Dict[str, 'Workflow'] = {}
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        os.makedirs(self.data_dir, exist_ok=True)
        self.workflows_file = os.path.join(self.data_dir, 'workflows.json')
        self.load_workflows()
        
    def load_workflows(self):
        """Load saved workflows"""
        if os.path.exists(self.workflows_file):
            with open(self.workflows_file, 'r') as f:
                data = json.load(f)
                for wf_data in data:
                    workflow = Workflow.from_dict(wf_data, self.llm_manager)
                    self.workflows[workflow.id] = workflow
                    
    def save_workflows(self):
        """Save workflows to disk"""
        with open(self.workflows_file, 'w') as f:
            json.dump([wf.to_dict() for wf in self.workflows.values()], f)
            
    def create_workflow(self, name: str, description: str, steps: List[Dict]) -> 'Workflow':
        """Create a new workflow"""
        workflow = Workflow(
            name=name,
            description=description,
            steps=steps,
            llm_manager=self.llm_manager
        )
        self.workflows[workflow.id] = workflow
        self.save_workflows()
        return workflow
        
    def get_workflow(self, workflow_id: str) -> Optional['Workflow']:
        """Get workflow by ID"""
        return self.workflows.get(workflow_id)
        
    def list_workflows(self) -> List[Dict]:
        """List all workflows"""
        return [wf.to_dict() for wf in self.workflows.values()]
        
    def delete_workflow(self, workflow_id: str) -> bool:
        """Delete a workflow"""
        if workflow_id in self.workflows:
            del self.workflows[workflow_id]
            self.save_workflows()
            return True
        return False

class Workflow:
    def __init__(self, name: str, description: str, steps: List[Dict], llm_manager: LLMManager):
        self.id = f"wf_{int(datetime.now().timestamp())}"
        self.name = name
        self.description = description
        self.steps = steps
        self.llm_manager = llm_manager
        self.status = "stopped"
        self.current_step = 0
        self.results = []
        
    def start(self):
        """Start workflow execution"""
        if self.status == "running":
            return
            
        self.status = "running"
        self.execute_next_step()
        
    def stop(self):
        """Stop workflow execution"""
        self.status = "stopped"
        
    def execute_next_step(self):
        """Execute next step in workflow"""
        if self.status != "running" or self.current_step >= len(self.steps):
            return
            
        step = self.steps[self.current_step]
        result = self.execute_step(step)
        self.results.append(result)
        
        self.current_step += 1
        if self.current_step < len(self.steps):
            self.execute_next_step()
        else:
            self.status = "completed"
            
    def execute_step(self, step: Dict) -> Dict:
        """Execute a single workflow step"""
        step_type = step['type']
        
        if step_type == 'prompt':
            # Execute prompt with LLM
            prompt = PromptTemplate(
                template=step['template'],
                input_variables=step['variables']
            )
            chain = LLMChain(llm=self.llm_manager.model, prompt=prompt)
            response = chain.run(**step['inputs'])
            return {
                'type': 'prompt',
                'output': response
            }
            
        elif step_type == 'rag':
            # Execute RAG query
            from .rag_pipeline import RAGPipeline
            rag = RAGPipeline()
            results = rag.query(step['query'])
            return {
                'type': 'rag',
                'output': results
            }
            
        return {
            'type': step_type,
            'error': 'Unsupported step type'
        }
        
    def to_dict(self) -> Dict:
        """Convert workflow to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'steps': self.steps,
            'status': self.status,
            'current_step': self.current_step,
            'results': self.results
        }
        
    @classmethod
    def from_dict(cls, data: Dict, llm_manager: LLMManager) -> 'Workflow':
        """Create workflow from dictionary"""
        workflow = cls(
            name=data['name'],
            description=data['description'],
            steps=data['steps'],
            llm_manager=llm_manager
        )
        workflow.id = data['id']
        workflow.status = data['status']
        workflow.current_step = data['current_step']
        workflow.results = data['results']
        return workflow
