import time
import random
import sys
import os
import re
from typing import Any, Dict, List
from core.node_base import NodeBase

# Add feetech-servo-sdk to path for robot connectivity
feetech_path = os.path.join(os.path.dirname(__file__), 'feetech-servo-sdk')
sys.path.insert(0, feetech_path)

from feetech_servo import ScsServoSDK

import http.client
import json
import base64


MODULE_TAG = "Basic"

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
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Input"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Provides input data to the workflow"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
InputNode

Purpose: Provides input data to the workflow by allowing users to enter text values manually.

Inputs:
  - value (STRING): The input text value to pass through the workflow (default: empty string)

Outputs:
  - output (STRING): The same value that was input, passed through to connected nodes

Usage: Use this node to inject text data into your workflow, either by setting a default value or connecting it to other nodes that provide string data.
        """
    
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
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Output"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Displays workflow output"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
OutputNode

Purpose: Displays workflow output by printing the input value to the console and passing it through.

Inputs:
  - input (STRING): The value to display and pass through

Outputs:
  - output (STRING): The same value that was input, after displaying it

Usage: Use this node at the end of your workflow to see the final results. It will print the value to the console and also pass it through for further processing if needed.
        """
    
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
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Text Processor"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Apply text transformations"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
TextProcessorNode

Purpose: Applies various text transformations to input strings.

Inputs:
  - text (STRING): The input text to transform
  - operation (SELECTION): The transformation to apply - options are:
    * uppercase: Convert text to uppercase
    * lowercase: Convert text to lowercase  
    * reverse: Reverse the order of characters
    * length: Return the length of the text as a string

Outputs:
  - output (STRING): The transformed text result

Usage: Use this node to manipulate text data in your workflow. Select the desired operation from the dropdown to transform your input text.
        """
    
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
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Delay"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Add delay to workflow execution"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
DelayNode

Purpose: Adds a configurable delay to workflow execution, useful for timing control and rate limiting.

Inputs:
  - input (STRING): The value to pass through after the delay
  - delay_seconds (FLOAT): The number of seconds to wait (range: 0.1 to 10.0, default: 1.0)

Outputs:
  - output (STRING): The same input value, passed through after the delay

Usage: Use this node to add pauses in your workflow, for example when interfacing with hardware that needs time between commands or when rate-limiting API calls.
        """
    
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
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("INT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Random Number"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Generate random integer between min and max values"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
RandomNumberNode

Purpose: Generates random integer values within a specified range.

Inputs:
  - min_value (INT): The minimum value for the random number (default: 0)
  - max_value (INT): The maximum value for the random number (default: 100)

Outputs:
  - output (INT): A random integer between min_value and max_value (inclusive)

Usage: Use this node to introduce randomness into your workflow, such as for testing, simulations, or generating varied inputs for robot movements.
        """
    
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
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("FLOAT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Math"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Perform basic mathematical operations"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
MathNode

Purpose: Performs basic mathematical operations on two floating-point numbers.

Inputs:
  - a (FLOAT): The first operand (default: 0.0)
  - b (FLOAT): The second operand (default: 0.0)
  - operation (SELECTION): The mathematical operation to perform:
    * add: a + b
    * subtract: a - b
    * multiply: a * b
    * divide: a / b (throws error if b is 0)

Outputs:
  - output (FLOAT): The result of the mathematical operation

Usage: Use this node for calculations in your workflow, such as converting units, scaling values, or performing computations on sensor data.
        """
    
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


class PrintToConsoleNode(NodeBase):
    """A node that prints the input value and returns no output."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "value": ("ANY", {})
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Print To Console"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Prints the input value to the console."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
PrintToConsoleNode

Purpose: Prints any input value to the console for debugging and monitoring purposes.

Inputs:
  - value (ANY): Any value to print to the console

Outputs:
  - None (this node has no outputs)

Usage: Use this node to debug your workflow by printing intermediate values to the console. Place it anywhere in your workflow to see what data is flowing through.
        """

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
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("STRING", {})
            }
        }

    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Concat"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Concatenate two strings with a '+' in between."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ConcatNode

Purpose: Concatenates two strings with a '+' character between them.

Inputs:
  - a (STRING): The first string
  - b (STRING): The second string

Outputs:
  - output (STRING): The concatenated result in format 'a+b'

Usage: Use this node to combine string values in your workflow, useful for creating composite commands or labels.
        """

    def execute(self, a: str, b: str) -> str:
        return f"{a}+{b}"

class ConnectRobotNode(NodeBase):
    """Connect to a robot and return ScsServoSDK instance"""
    
    def __init__(self):
        self.port2sdk = {}
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "port_name": ("STRING", {"default": ""})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "sdk": ("ScsServoSDK", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "connect_robot"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Connect Robot"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return """Connect to a robot using ScsServoSDK.connect() and return SDK instance."""

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ConnectRobotNode

Purpose: Establishes a connection to a robot using the ScsServoSDK and returns the SDK instance for use by other robot control nodes.

Inputs:
  - port_name (STRING): port name to connect the robot, e.g. /dev/tty.usbmodem5A7A0573841

Outputs:
  - sdk (ScsServoSDK): The connected SDK instance that can be used by other robot control nodes

Usage: Use this node at the beginning of robot workflows to establish communication. The SDK output should be connected to other robot nodes that require servo control. If port_name is empty, the system will attempt to auto-detect the robot.
        """
    
    def connect_robot(self, port_name: str) -> tuple:
        """Connect to robot and return SDK instance"""
        
        if port_name in self.port2sdk:
            return (self.port2sdk[port_name],)

        sdk = ScsServoSDK()
    
        # Connect to servo controller
        # If port_name is empty, pass None to auto-detect
        port_to_use = port_name if port_name.strip() else None
        success = sdk.connect(port_name=port_to_use)
        
        if not success:
            raise Exception("Failed to connect to robot")
        
        print(f"✓ Robot connected successfully")
        if sdk.port_handler:
            print(f"  Port: {sdk.port_handler.port_name}")
        

        self.port2sdk[port_name] = sdk

        return (sdk,)
            

class Grok4Node(NodeBase):
    """Node for calling Grok4 LLM to get a position dict from a prompt and instruction"""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "system_prompt": ("STRING", {"default": "You are a robot arm controller."}),
                "instruction": ("STRING", {"default": "Move to home position."}),
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "positions": ("DICT", {})
            }
        }

    @classmethod
    def FUNCTION(cls) -> str:
        return "call_grok4"

    @classmethod
    def TAGS(cls) -> str:
        return TAG

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Grok4 LLM Node"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Call Grok4 LLM with a system prompt and instruction, return a position dict."

    @classmethod
    def get_detailed_description(cls) -> str:
        return (
            """
            Grok4Node

            Purpose: Calls the Grok4 LLM API with a system prompt and instruction, and returns a dict of positions.

            Inputs:
              - system_prompt (STRING): The system prompt for the LLM.
              - instruction (STRING): The user instruction for the LLM.

            Outputs:
              - positions (DICT): The parsed position dictionary from the LLM response.

            Usage:
              - Use this node to generate robot arm positions from natural language instructions using Grok4.
            """
        )

    def call_grok4(self, system_prompt: str, instruction: str) -> tuple:
        
        try:
            positions = {
                1: 1506,
                2: 1034,
                3: 3019,
                4: random.randint(300, 1000),
                5: random.randint(300, 1000),
                6: random.randint(30, 4000)
            }
            
            return (positions, "success")
        except Exception as e:
            return ({"error": str(e)},)

class ShowImageNode(NodeBase):
    """A node that shows an image (takes image input, no output)."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "image": ("IMAGE", {})  # Accepts bytes or base64 string
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def FUNCTION(cls) -> str:
        return "show_image"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Show Image"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Show an image in the UI (takes image input, no output)."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ShowImageNode

Purpose: Shows an image in the UI. This node takes an image input (bytes or base64 string) and produces no output. Intended for UI demonstration or static image display in workflows.

Inputs:
  - image (IMAGE): The image to display (bytes or base64 string)

Outputs:
  - None

Usage: Use this node to display an image in your workflow. The backend will print a message, and the frontend can render the image.
        """

    def show_image(self, image):
        # Pass through the image for UI rendering (if needed)
        rt_update = {}


        
        try:
            if isinstance(image, bytes):
                # Convert bytes to base64
                image_b64 = base64.b64encode(image).decode("utf-8")
                # Try to detect format from content
                if image.startswith(b'<svg') or b'<svg' in image[:100]:
                    image_format = "svg+xml"
                elif image.startswith(b'\x89PNG'):
                    image_format = "png"
                elif image.startswith(b'\xff\xd8'):
                    image_format = "jpeg"
                else:
                    image_format = "png"  # Default
                rt_update = {"image_base64": image_b64, "image_format": image_format}
                
            elif isinstance(image, str):
                # Check if it's already a data URL
                if image.startswith('data:image/'):
                    try:
                        header, base64_data = image.split(',', 1)
                        format_match = re.match(r'data:image/([^;]+)', header)
                        image_format = format_match.group(1) if format_match else 'png'
                        rt_update = {"image_base64": base64_data, "image_format": image_format}
                    except Exception as e:
                        rt_update = {"error": f"Invalid data URL format: {e}"}
                else:
                    # Assume it's already base64, try to detect format
                    if image.startswith('<svg') or '<svg' in image[:100]:
                        image_format = "svg+xml"
                    else:
                        image_format = "png"  # Default
                    rt_update = {"image_base64": image, "image_format": image_format}
                    
            elif image is None:
                rt_update = {"error": "No image data received"}
                
            else:
                rt_update = {"error": f"Invalid image format: {type(image)}"}
                
        except Exception as e:
            rt_update = {"error": f"Error processing image: {str(e)}"}
        
        return (None, rt_update)

class CameraNode(NodeBase):
    """A node that prompts the user to open their camera and outputs an image."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "image_stream": ("CAMERA", {}),
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "image": ("IMAGE", {})
            }
        }

    @classmethod
    def FUNCTION(cls) -> str:
        return "open_camera"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Camera"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Prompt the user to open their camera and output an image."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
        """

    def open_camera(self, image_stream):
        return (image_stream, None)

class DisplayNode(NodeBase):
    """A node that takes ANY input and returns nothing, for display/debugging purposes."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "value": ("ANY", {})
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def FUNCTION(cls) -> str:
        return "display"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Display"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Display the input value (ANY type) for debugging or monitoring."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
DisplayNode

Purpose: Takes any input value and displays it (prints to console). Useful for debugging or monitoring workflow data.

Inputs:
  - value (ANY): Any value to display

Outputs:
  - None

Usage: Use this node to inspect values in your workflow. It prints the value to the backend console.
        """

    def display(self, value: Any):
        print(f"[DisplayNode] Value: {value}")
        return (None,value)

class NoteNode(NodeBase):
    """A node that takes text as input and has no output, useful for adding comments or notes to workflows."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "text": ("STRING", {"default": "Add your note here..."})
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def FUNCTION(cls) -> str:
        return "note"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Note"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Add a note or comment to your workflow (no output)."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
NoteNode

Purpose: Takes text input and produces no output. Useful for adding comments, notes, or documentation to your workflow.

Inputs:
  - text (STRING): The note or comment text to add to the workflow

Outputs:
  - None

Usage: Use this node to add documentation, comments, or notes to your workflow. The text will be visible in the node but won't affect the workflow execution.
        """

    def note(self, text: str):
        # Simply consume the text input without producing any output
        return (None,)

class ThreeDVisualizationNode(NodeBase):
    """A node that takes motor positions and provides 3D visualization capabilities."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "positions": ("DICT", {})  # Expected format: {1: 1510, 2: 1029, 3: 3010, 4: 967, 5: 638, 6: 2039}
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
            }
        }

    @classmethod
    def FUNCTION(cls) -> str:
        return "visualize_3d"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "3D Visualization"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Visualize robot positions in 3D by converting motor positions to angles."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ThreeDVisualizationNode

Purpose: Takes motor position data and converts it to joint angles for 3D visualization. This node processes motor position data and returns visualization data that can be rendered in a 3D viewer.

Inputs:
  - positions (DICT): Dictionary mapping servo IDs to positions in format:
    {1: 1510, 2: 1029, 3: 3010, 4: 967, 5: 638, 6: 2039}

Outputs:
  - None (produces rt_update for 3D visualization)

Usage: Use this node to visualize robot joint states in 3D. Connect it to nodes that provide motor position data to see the 3D representation of the robot's current configuration in the UI.
        """

    def visualize_3d(self, positions: dict):
        """
        Convert motor positions to angles and return 3D visualization data.
        
        Args:
            positions: Dictionary mapping servo IDs to positions
            
        Returns:
            tuple: (None, rt_update)
        """

        angles = {servo_id: (position / 4095.0) * 360.0 for servo_id, position in positions.items()}

        list_of_angles = ['Rotation', 'Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll', 'Jaw']

        angles = [
            {'name': list_of_angles[servo_id], 'angle': angles[servo_id+1], 'servoId': servo_id + 1}
            for servo_id in range(len(list_of_angles))
        ]

        return (None, angles)


# Node class mappings for registration
NODE_CLASS_MAPPINGS = {
    "InputNode": InputNode,
    "PrintToConsoleNode": PrintToConsoleNode,
    "ConnectRobotNode": ConnectRobotNode,
    "Grok4Node": Grok4Node,
    "ShowImageNode": ShowImageNode,
    "CameraNode": CameraNode,
    "DisplayNode": DisplayNode,
    "NoteNode": NoteNode,
    "ThreeDVisualizationNode": ThreeDVisualizationNode,
}