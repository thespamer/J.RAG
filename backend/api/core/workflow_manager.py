class WorkflowManager:
    def __init__(self, llm_manager):
        self.llm_manager = llm_manager
        self.workflows = {}

    def list_workflows(self):
        return list(self.workflows.values())

    def get_workflow(self, workflow_id):
        return self.workflows.get(workflow_id)

    def create_workflow(self, name, description, steps):
        workflow = {
            'id': len(self.workflows) + 1,
            'name': name,
            'description': description,
            'steps': steps
        }
        self.workflows[workflow['id']] = workflow
        return workflow

    def delete_workflow(self, workflow_id):
        if workflow_id in self.workflows:
            del self.workflows[workflow_id]
            return True
        return False

    def save_workflows(self):
        # TODO: Implement persistence
        pass
