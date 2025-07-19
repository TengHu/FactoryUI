"""
Simple User Workflows Repository

Manages workflows as JSON files using filenames.
"""

import os
import json
from typing import List, Dict, Any, Optional
from pathlib import Path

class UserWorkflowRepository:
    """Simple repository for managing user workflows as JSON files"""
    
    def __init__(self, base_path: str = None):
        """Initialize the repository with a base path for storing workflows"""
        if base_path is None:
            base_path = os.path.join(os.path.dirname(__file__), "workflows")
        
        self.base_path = Path(base_path)
        self.base_path.mkdir(exist_ok=True)
    
    def save_workflow(self, filename: str, workflow_data: Dict[str, Any]) -> str:
        """
        Save a workflow to a file
        
        Args:
            filename: The filename (without .json extension)
            workflow_data: The workflow data
            
        Returns:
            The filename of the saved workflow
        """
        if not filename.endswith('.json'):
            filename = f"{filename}.json"
        
        file_path = self.base_path / filename
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(workflow_data, f, indent=2, ensure_ascii=False)
        
        return filename
    
    def get_workflow(self, filename: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a workflow by filename
        
        Args:
            filename: The filename (with or without .json extension)
            
        Returns:
            The workflow data or None if not found
        """
        if not filename.endswith('.json'):
            filename = f"{filename}.json"
            
        file_path = self.base_path / filename
        
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
    
    def get_all_workflows(self) -> List[Dict[str, Any]]:
        """
        Retrieve all workflows
        
        Returns:
            List of dictionaries with 'filename' and 'workflow' keys
        """
        workflows = []
        
        for file_path in self.base_path.glob("*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    workflow_data = json.load(f)
                    workflows.append({
                        "filename": file_path.stem,  # filename without .json extension
                        "workflow": workflow_data
                    })
            except (json.JSONDecodeError, IOError):
                continue
        
        # Sort by filename for consistent ordering
        workflows.sort(key=lambda x: x["filename"])
        return workflows
    
    def delete_workflow(self, filename: str) -> bool:
        """
        Delete a workflow
        
        Args:
            filename: The filename (with or without .json extension)
            
        Returns:
            True if deleted successfully, False if not found
        """
        if not filename.endswith('.json'):
            filename = f"{filename}.json"
            
        file_path = self.base_path / filename
        
        if not file_path.exists():
            return False
        
        try:
            file_path.unlink()
            return True
        except OSError:
            return False