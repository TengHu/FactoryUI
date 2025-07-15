from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from enum import Enum

class NodeCategory(Enum):
    INPUT = "input"
    OUTPUT = "output"
    PROCESSING = "processing"
    CONTROL = "control"
    ROBOT = "robot"

class NodeBase(ABC):
    """Base class for all nodes in the workflow system"""
    
    @classmethod
    @abstractmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        """Define input types for the node"""
        pass
    
    @classmethod
    @abstractmethod
    def RETURN_TYPES(cls) -> tuple:
        """Define return types for the node"""
        pass
    
    @classmethod
    @abstractmethod
    def FUNCTION(cls) -> str:
        """Name of the function to execute"""
        pass
    
    @classmethod
    @abstractmethod
    def CATEGORY(cls) -> str:
        """Category of the node"""
        pass
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        """Display name for the node in UI"""
        return cls.__name__
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        """Description of what the node does"""
        return ""
    
    def validate_inputs(self, **kwargs) -> bool:
        """Validate input parameters"""
        input_types = self.INPUT_TYPES()
        required_inputs = input_types.get("required", {})
        
        for key, type_info in required_inputs.items():
            if key not in kwargs:
                raise ValueError(f"Missing required input: {key}")
        
        return True