import time
import random
import sys
import os
import re
import traceback
from typing import Any, Dict, List
from core.node_base import NodeBase

# Add feetech-servo-sdk to path for robot connectivity
feetech_path = os.path.join(os.path.dirname(__file__), 'feetech-servo-sdk')
sys.path.insert(0, feetech_path)

from feetech_servo import ScsServoSDK

import http.client
import json
import base64
import asyncio


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
                "output": ("ANY", {})
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
  - output (ANY): The same value that was input, passed through to connected nodes

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
    """A node that introduces a delay in workflow execution."""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "input": ("ANY", {}),
                "delay_seconds": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 10.0}),
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output": ("ANY", {})
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
        return "Pause workflow execution for a specified number of seconds."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
DelayNode

Purpose: Introduces a configurable delay (pause) in the workflow, which is useful for timing control, synchronization, or rate limiting.

Inputs:
  - input (ANY): The value to pass through after the delay.
  - delay_seconds (FLOAT): The number of seconds to wait before passing the input forward (range: 0.1 to 10.0, default: 1.0).

Outputs:
  - output (ANY): The same input value, returned after the delay.

Usage: Use this node to add a pause in your workflow. This is helpful when you need to wait between hardware commands, throttle API calls, or synchronize steps in your process.
        """

    def execute(self, input, delay_seconds: float):
        import time
        time.sleep(float(delay_seconds))
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

        return (sdk, None)
     
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
                        rt_update = {"error": f"Invalid data URL format: {e}\n{traceback.format_exc()}"}
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
            rt_update = {"error": f"Error processing image: {str(e)}\n{traceback.format_exc()}"}
        
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
CameraNode

Purpose: Takes a camera image stream and outputs it as an image for processing or display.

Inputs:
  - image_stream (CAMERA): Camera image stream data from the frontend

Outputs:
  - image (IMAGE): The image from the camera stream

Usage: Use this node to capture and process images from a camera. Connect it to camera input from the frontend to get live image data for further processing or display.
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
  - value (ANY): The same value that was input, for display purposes

Usage: Use this node to inspect values in your workflow. It prints the value to the backend console and passes it through for display in the UI.
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

    def note(self):
        pass

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

        # Convert only available positions to angles
        angle_map = {int(servo_id): (position / 4095.0) * 360.0 for servo_id, position in positions.items()}

        list_of_angles = ['Rotation', 'Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll', 'Jaw']

        # Only include angles for servo IDs present in positions
        angles = [
            {'name': list_of_angles[servo_id - 1], 'angle': angle_map[servo_id], 'servoId': servo_id}
            for servo_id in sorted(angle_map.keys())
            if 1 <= servo_id <= len(list_of_angles)
        ]

        return (None, angles)


class UnlockRobotNode(NodeBase):
    """Node for unlocking the robot"""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "sdk": ("ScsServoSDK", {}),
            },
            "optional": {}
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def FUNCTION(cls) -> str:
        return "unlock"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Unlock Robot"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Unlock the robot using ScsServoSDK"

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
UnlockRobotNode

Purpose: Unlocks the robot, allowing manual or programmatic control of the servos.

Inputs:
  - sdk (ScsServoSDK): The SDK instance for communicating with the robot servos

Outputs:
  - None (this node has no outputs)

Usage: Use this node to enable control mode on the robot. This is typically required before sending position commands or reading servo status. Place this node early in your workflow before other robot control nodes.

Note: This operation may be required to establish proper communication with the robot's servo controller and enable command execution.
        """

    def unlock(self, sdk: ScsServoSDK) -> tuple:
        """Unlock the robot using _unlock_servo method"""
        import traceback

        try:
            for servo_id in range(1, 7):
                sdk.write_torque_enable(servo_id, False)
            return ()
        except Exception as e:
            error_msg = str(e) + "\n" + traceback.format_exc()
            print(f"❌ Failed to unlock robot: {error_msg}")
            raise Exception(f"Failed to unlock robot: {error_msg}")


class DisconnectRobotNode(NodeBase):
    """Node for disconnecting from the robot using ScsServoSDK"""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "sdk": ("ScsServoSDK", {}),
            },
            "optional": {}
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {}

    @classmethod
    def FUNCTION(cls) -> str:
        return "disconnect_robot"

    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Disconnect Robot"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Disconnect from the robot using ScsServoSDK."

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
DisconnectRobotNode

Purpose: Disconnects from the robot by calling the disconnect() method on the provided ScsServoSDK instance.

Inputs:
  - sdk (ScsServoSDK): The SDK instance for communicating with servos.

Outputs:
  - None (this node has no outputs)

Usage: Use this node at the end of your robot workflow to properly close the connection to the robot. This ensures clean disconnection and frees up system resources.
        """

    def disconnect_robot(self, sdk: ScsServoSDK) -> tuple:
        import traceback
        try:
            sdk.disconnect()
            return ()  # No outputs
        except Exception as e:
            error_msg = str(e) + "\n" + traceback.format_exc()
            print(f"❌ Failed to disconnect robot: {error_msg}")
            raise Exception(f"Failed to disconnect robot: {error_msg}")


class ProxyHttpSenderNode(NodeBase):
    """Send data through HTTP proxy to external clients"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "data": ("ANY", {}),
                "proxy_url": ("STRING", {"default": "https://your-proxy-url.com"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "success": ("BOOLEAN", {}),
                "message": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "send_http"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Proxy HTTP Sender"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Send data through HTTP proxy to external clients"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ProxyHttpSenderNode

Purpose: Sends data through an HTTP proxy URL to external clients. This node makes an HTTP POST request to the specified proxy URL with the input data.

Inputs:
  - data (ANY): The data to send through HTTP (will be JSON serialized)
  - proxy_url (STRING): The HTTP proxy URL (e.g., https://abc123.proxy.com)

Outputs:
  - success (BOOLEAN): True if the data was sent successfully, False otherwise
  - message (STRING): Status message describing the result

Usage: Use this node to send data to external clients through any HTTP proxy service. Make sure your proxy tunnel is running and the URL is correct. The data will be sent as a JSON POST request.
        """
    
    def send_http(self, data: Any, proxy_url: str) -> tuple:
        """Send data through HTTP proxy"""
        import json
        import traceback
        import requests
        
        try:
            # Create message payload
            message = {
                "timestamp": time.time(),
                "payload": data
            }
            
            # Send HTTP POST request
            response = requests.post(proxy_url, json=message, timeout=10)
            
            if response.status_code == 200:
                print(f"✓ Sent data through HTTP proxy: {response.status_code}")
                return (True, f"Data sent successfully to {proxy_url}")
            else:
                error_msg = f"HTTP request failed with status {response.status_code}"
                print(f"❌ {error_msg}")
                return (False, error_msg)
            
        except Exception as e:
            error_msg = f"Failed to send HTTP data: {str(e)}"
            print(f"❌ {error_msg}")
            print(traceback.format_exc())
            return (False, error_msg)

class ProxyHttpClientNode(NodeBase):
    """Make HTTP requests to external endpoints through proxy"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "url": ("STRING", {"default": "https://your-proxy-endpoint.com"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "response_data": ("DICT", {}),
                "status_code": ("INT", {}),
                "success": ("BOOLEAN", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "fetch_data"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Proxy HTTP Client"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Make HTTP requests to external endpoints through proxy"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ProxyHttpClientNode

Purpose: Makes HTTP GET requests to external endpoints that can be accessed through proxy tunnels. This node fetches data from the specified URL and returns the response.

Inputs:
  - url (STRING): The full URL to make the HTTP request to (e.g., https://your-proxy-endpoint.com)

Outputs:
  - response_data (DICT): The response data from the HTTP request (parsed JSON or error info)
  - status_code (INT): The HTTP status code of the response
  - success (BOOLEAN): True if the request was successful (status code 200-299), False otherwise

Usage: Use this node to fetch data from external services through proxy tunnels. Provide the full proxy URL and the node will make a GET request and return the response data.
        """
    
    def fetch_data(self, url: str) -> tuple:
        """Fetch data from external HTTP endpoint"""
        import traceback
        import requests

        response = requests.get(url, timeout=10)
        status_code = response.status_code
        
        try:
            response_data = response.json()
            
            return (
                response_data['data']['payload'],
                status_code,
                True
            )
            
        except Exception as e:
            error_msg = f"Failed to fetch data from {url}: {str(e)}"
            print(f"❌ {error_msg}")
            print(traceback.format_exc())
            
            error_data = {
                "error": error_msg,
                "url": url,
            }
            
            return (
                error_data,
                status_code,
                False
            )

class VLMNode(NodeBase):
    """A mock Vision Language Model node"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "system_prompt": ("STRING", {"default": ""}),
                "user_prompt": ("STRING", {"default": ""}),
                "model_name": ("STRING", {"default": "grok-vlm"}),
                "images": ("IMAGE", {})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "immediate_action": ("STRING", {}),
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "process_vlm"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "VLM"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Grok VLM"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
VLMNode

Purpose: Mock Vision Language Model node that processes images with text prompts.

Inputs:
  - system_prompt (STRING): The system prompt for the VLM (default: empty string)
  - images (IMAGE): The images to process with the VLM

Outputs:
  - response (STRING): The VLM's response to the prompt and images
  - confidence (FLOAT): Confidence score of the response

Usage: Use this node to simulate VLM processing. The node will pass through the inputs and return mock responses.
        """
    
    def process_vlm(self, system_prompt: str, user_prompt: str, model_name, images) -> tuple:
        """Mock VLM processing"""
        response = f"Mock VLM response to prompt: '{system_prompt[:50]}...' with {len(images) if hasattr(images, '__len__') else 1} image(s)"
        confidence = 0.85
        return (response, confidence)

class VLAModelNode(NodeBase):
    """A mock Vision Language Action model node"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "system_status": ("DICT", {}),
                "prompt": ("STRING", {"default": ""}),
                "images": ("IMAGE", {}),
                "model_name": ("STRING", {"default": "grok-vla"}),
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "desired_positions": ("DICT", {}),
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "process_vla"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "VLA Model"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "VLA node"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
VLAModelNode

Purpose: Mock Vision Language Action model node that processes system status, prompts, and images to generate actions.

Inputs:
  - system_status (DICT): Current system status information
  - prompt (STRING): The prompt for the VLA model (default: empty string)
  - images (IMAGE): The images to process with the VLA model

Outputs:
  - action (STRING): The action to be performed
  - parameters (DICT): Parameters for the action
  - confidence (FLOAT): Confidence score of the action

Usage: Use this node to simulate VLA model processing. The node will pass through the inputs and return mock actions and parameters.
        """
    
    def process_vla(self, system_status: dict, prompt: str, images, model_name) -> tuple:
        """Mock VLA processing"""
        action = f"mock_action_{len(prompt) % 3}"
        parameters = {"param1": "value1", "param2": "value2"}
        confidence = 0.92
        return system_status, None
    

class DataRecordNode(NodeBase):
    """A mock node for data recording functionality"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "hf_token": ("STRING", {"default": ""})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "success": ("BOOLEAN", {}),
                "message": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "record_data"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Data Record"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Mock node for data recording functionality"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
DataRecordNode

Purpose: Mock node for data recording functionality. This node simulates recording data using a Hugging Face token.

Inputs:
  - hf_token (STRING): Hugging Face token for data recording (default: empty string)

Outputs:
  - success (BOOLEAN): True if recording was successful, False otherwise
  - message (STRING): Status message describing the recording result

Usage: Use this node to simulate data recording operations. The node will pass through the token and return a mock success response.
        """
    
    def record_data(self, hf_token: str) -> tuple:
        """Mock data recording functionality"""
        if hf_token:
            return (True, f"Data recorded successfully with token: {hf_token[:8]}...")
        else:
            return (False, "No HF token provided for data recording")

# Node class mappings for registration
NODE_CLASS_MAPPINGS = {
    "InputNode": InputNode,
    # "DelayNode": DelayNode,
    "PrintToConsoleNode": PrintToConsoleNode,
    # "ConnectRobotNode": ConnectRobotNode,
    # "ShowImageNode": ShowImageNode,
    # "CameraNode": CameraNode,
    "DisplayNode": DisplayNode,
    "NoteNode": NoteNode,
    # "ThreeDVisualizationNode": ThreeDVisualizationNode,
    # "UnlockRobotNode": UnlockRobotNode,
    # "DisconnectRobotNode": DisconnectRobotNode,
    # "ProxyHttpSenderNode": ProxyHttpSenderNode,
    # "ProxyHttpClientNode": ProxyHttpClientNode,
    # "VLMNode": VLMNode,
    # "VLAModelNode": VLAModelNode,
    # "DataRecordNode": DataRecordNode,
}