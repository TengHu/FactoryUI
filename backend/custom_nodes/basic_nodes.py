import time
import random
from typing import Any, Dict
from core.node_base import NodeBase, NodeCategory

class InputNode(NodeBase):
    """Basic input node for providing data to the workflow"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "value": ("STRING", {"default": ""})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("STRING",)
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.INPUT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Input"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Provides input data to the workflow"
    
    def execute(self, value: str) -> str:
        return value

class OutputNode(NodeBase):
    """Basic output node for displaying workflow results"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "input": ("STRING", {})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("STRING",)
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.OUTPUT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Output"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Displays workflow output"
    
    def execute(self, input: str) -> str:
        print(f"Output: {input}")
        return input

class TextProcessorNode(NodeBase):
    """Process text with various transformations"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "text": ("STRING", {}),
                "operation": (["uppercase", "lowercase", "reverse", "length"], {"default": "uppercase"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("STRING",)
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.PROCESSING.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Text Processor"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Apply text transformations"
    
    def execute(self, text: str, operation: str) -> str:
        if operation == "uppercase":
            return text.upper()
        elif operation == "lowercase":
            return text.lower()
        elif operation == "reverse":
            return text[::-1]
        elif operation == "length":
            return str(len(text))
        else:
            return text

class DelayNode(NodeBase):
    """Add delay to workflow execution"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "input": ("STRING", {}),
                "delay_seconds": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 10.0})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("STRING",)
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.CONTROL.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Delay"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Add delay to workflow execution"
    
    def execute(self, input: str, delay_seconds: float) -> str:
        time.sleep(delay_seconds)
        return input

class RandomNumberNode(NodeBase):
    """Generate random numbers"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "min_value": ("INT", {"default": 0}),
                "max_value": ("INT", {"default": 100})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("INT",)
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.PROCESSING.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Random Number"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Generate random integer between min and max values"
    
    def execute(self, min_value: int, max_value: int) -> int:
        return random.randint(min_value, max_value)

class MathNode(NodeBase):
    """Perform basic mathematical operations"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "a": ("FLOAT", {"default": 0.0}),
                "b": ("FLOAT", {"default": 0.0}),
                "operation": (["add", "subtract", "multiply", "divide"], {"default": "add"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("FLOAT",)
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.PROCESSING.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Math"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Perform basic mathematical operations"
    
    def execute(self, a: float, b: float, operation: str) -> float:
        if operation == "add":
            return a + b
        elif operation == "subtract":
            return a - b
        elif operation == "multiply":
            return a * b
        elif operation == "divide":
            if b == 0:
                raise ValueError("Division by zero")
            return a / b
        else:
            raise ValueError(f"Unknown operation: {operation}")

# Node class mappings for registration
NODE_CLASS_MAPPINGS = {
    "InputNode": InputNode,
    "OutputNode": OutputNode,
    "TextProcessorNode": TextProcessorNode,
    "DelayNode": DelayNode,
    "RandomNumberNode": RandomNumberNode,
    "MathNode": MathNode
}