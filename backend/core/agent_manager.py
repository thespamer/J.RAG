from typing import Dict, List, Optional
from datetime import datetime
import json
import os
from .llm_manager import LLMManager
from .rag_pipeline import RAGPipeline

class Tool:
    def __init__(self, name: str, description: str, func):
        self.name = name
        self.description = description
        self.func = func
        
    def run(self, *args, **kwargs):
        return self.func(*args, **kwargs)
        
    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'description': self.description
        }

class Agent:
    def __init__(self, name: str, description: str, agent_type: str,
                 tools: List[Tool], llm_manager: LLMManager):
        self.id = f"agent_{int(datetime.now().timestamp())}"
        self.name = name
        self.description = description
        self.agent_type = agent_type
        self.tools = tools
        self.llm_manager = llm_manager
        self.status = "stopped"
        self.history = []
        
    def start(self):
        """Start the agent"""
        self.status = "running"
        
    def stop(self):
        """Stop the agent"""
        self.status = "stopped"
        
    def process(self, input_text: str) -> str:
        """Process input using the agent"""
        if self.status != "running":
            return "Agent is not running"
            
        try:
            # Generate tool selection prompt
            tools_desc = "\n".join([
                f"- {tool.name}: {tool.description}"
                for tool in self.tools
            ])
            
            prompt = f"""Available tools:
{tools_desc}

Task: {input_text}

Select the most appropriate tool and explain why."""
            
            # Get tool selection from LLM
            response = self.llm_manager.generate_response(prompt)
            
            # Parse response and execute tool
            selected_tool = self._parse_tool_selection(response)
            if selected_tool:
                result = selected_tool.run(input_text)
            else:
                result = "No appropriate tool found"
                
            # Log interaction
            self.history.append({
                'timestamp': datetime.now().isoformat(),
                'input': input_text,
                'response': result
            })
            
            return result
            
        except Exception as e:
            return f"Error processing input: {str(e)}"
            
    def _parse_tool_selection(self, response: str) -> Optional[Tool]:
        """Parse LLM response to select tool"""
        for tool in self.tools:
            if tool.name.lower() in response.lower():
                return tool
        return None
        
    def to_dict(self) -> Dict:
        """Convert agent to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'agent_type': self.agent_type,
            'tools': [tool.to_dict() for tool in self.tools],
            'status': self.status,
            'history': self.history
        }
        
    @classmethod
    def from_dict(cls, data: Dict, llm_manager: LLMManager) -> 'Agent':
        """Create agent from dictionary"""
        # Recreate tools
        tools = []
        for tool_data in data['tools']:
            if tool_data['name'] == 'rag_search':
                rag = RAGPipeline()
                tools.append(Tool(
                    name='rag_search',
                    description='Search through documents using RAG',
                    func=rag.query
                ))
                
        agent = cls(
            name=data['name'],
            description=data['description'],
            agent_type=data['agent_type'],
            tools=tools,
            llm_manager=llm_manager
        )
        agent.id = data['id']
        agent.status = data['status']
        agent.history = data['history']
        return agent

class AgentManager:
    def __init__(self, llm_manager: LLMManager):
        self.llm_manager = llm_manager
        self.agents: Dict[str, Agent] = {}
        self.load_agents()
        
    def load_agents(self):
        """Load saved agents"""
        if os.path.exists('data/agents.json'):
            with open('data/agents.json', 'r') as f:
                data = json.load(f)
                for agent_data in data:
                    agent = Agent.from_dict(agent_data, self.llm_manager)
                    self.agents[agent.id] = agent
                    
    def save_agents(self):
        """Save agents to disk"""
        os.makedirs('data', exist_ok=True)
        with open('data/agents.json', 'w') as f:
            json.dump([agent.to_dict() for agent in self.agents.values()], f)
            
    def create_agent(self, name: str, description: str,
                    agent_type: str, tools: List[str]) -> Agent:
        """Create a new agent"""
        # Create tools
        agent_tools = []
        if 'rag_search' in tools:
            rag = RAGPipeline()
            agent_tools.append(Tool(
                name='rag_search',
                description='Search through documents using RAG',
                func=rag.query
            ))
            
        agent = Agent(
            name=name,
            description=description,
            agent_type=agent_type,
            tools=agent_tools,
            llm_manager=self.llm_manager
        )
        
        self.agents[agent.id] = agent
        self.save_agents()
        return agent
        
    def get_agent(self, agent_id: str) -> Optional[Agent]:
        """Get agent by ID"""
        return self.agents.get(agent_id)
        
    def list_agents(self) -> List[Dict]:
        """List all agents"""
        return [agent.to_dict() for agent in self.agents.values()]
        
    def delete_agent(self, agent_id: str) -> bool:
        """Delete an agent"""
        if agent_id in self.agents:
            del self.agents[agent_id]
            self.save_agents()
            return True
        return False
