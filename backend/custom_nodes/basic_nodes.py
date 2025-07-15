import time
import random
import sys
import os
from typing import Any, Dict
from core.node_base import NodeBase, NodeCategory

# Add feetech-servo-sdk to path for robot connectivity
feetech_path = os.path.join(os.path.dirname(__file__), 'feetech-servo-sdk')
sys.path.insert(0, feetech_path)

from feetech_servo import ScsServoSDK

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

class HelloWorldNode(NodeBase):
    """A node that returns 'hello world' with no input."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("STRING",)

    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"

    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.UTILITY.value if hasattr(NodeCategory, 'UTILITY') else NodeCategory.PROCESSING.value

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Hello World"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Returns the string 'hello world'"

    def execute(self) -> str:
        return "hello world"

class PrintNode(NodeBase):
    """A node that prints the input value and returns no output."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "value": ("ANY", {})
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return tuple()

    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"

    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.UTILITY.value if hasattr(NodeCategory, 'UTILITY') else NodeCategory.PROCESSING.value

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Print"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Prints the input value to the console."

    def execute(self, value: Any):
        print(value)

class ConcatNode(NodeBase):
    """Concatenate two strings with a '+' in between."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "a": ("STRING", {}),
                "b": ("STRING", {})
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
        return "Concat"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Concatenate two strings with a '+' in between."

    def execute(self, a: str, b: str) -> str:
        return f"{a}+{b}"

class ConnectRobotNode(NodeBase):
    """Connect to a robot and return ScsServoSDK instance"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "port_name": ("STRING", {"default": ""})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> tuple:
        return ("ScsServoSDK",)
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "connect_robot"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Connect Robot"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Connect to a robot using ScsServoSDK.connect() and return SDK instance"
    
    def connect_robot(self, port_name: str) -> tuple:
        """Connect to robot and return SDK instance"""
        
        sdk = ScsServoSDK()
        
        try:
            # Connect to servo controller
            # If port_name is empty, pass None to auto-detect
            port_to_use = port_name if port_name.strip() else None
            success = sdk.connect(port_name=port_to_use)
            
            if not success:
                raise Exception("Failed to connect to robot")
            
            print(f"✓ Robot connected successfully")
            if sdk.port_handler:
                print(f"  Port: {sdk.port_handler.port_name}")
            
            return (sdk,)
            
        except Exception as e:
            # Clean up on failure
            try:
                sdk.disconnect()
            except:
                pass
            
            error_msg = f"Robot connection failed: {str(e)}"
            print(f"❌ {error_msg}")
            raise Exception(error_msg)

# Node class mappings for registration
NODE_CLASS_MAPPINGS = {
    "InputNode": InputNode,
    "OutputNode": OutputNode,
    "TextProcessorNode": TextProcessorNode,
    "DelayNode": DelayNode,
    "RandomNumberNode": RandomNumberNode,
    "MathNode": MathNode,
    "HelloWorldNode": HelloWorldNode,
    "PrintNode": PrintNode,
    "ConcatNode": ConcatNode,
    "ConnectRobotNode": ConnectRobotNode
}