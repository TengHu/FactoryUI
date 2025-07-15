import asyncio
from typing import Any, Dict, List
from core.node_base import NodeBase, NodeCategory

class RobotMoveNode(NodeBase):
    """Move robot to specified position"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "x": ("FLOAT", {"default": 0.0}),
                "y": ("FLOAT", {"default": 0.0}),
                "z": ("FLOAT", {"default": 0.0}),
                "speed": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 10.0})
            },
            "optional": {
                "wait_for_completion": ("BOOLEAN", {"default": True})
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
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Robot Move"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Move robot to specified XYZ coordinates"
    
    def execute(self, x: float, y: float, z: float, speed: float, wait_for_completion: bool = True) -> str:
        # Placeholder for actual robot movement command
        print(f"Moving robot to position: x={x}, y={y}, z={z} at speed={speed}")
        
        if wait_for_completion:
            # Simulate movement time
            import time
            movement_time = abs(x + y + z) / speed * 0.1  # Simple time calculation
            time.sleep(min(movement_time, 2.0))  # Cap at 2 seconds for demo
        
        return f"Robot moved to ({x}, {y}, {z})"

class RobotGripperNode(NodeBase):
    """Control robot gripper"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "action": (["open", "close", "set_position"], {"default": "open"}),
                "position": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0})
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
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Robot Gripper"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Control robot gripper open/close"
    
    def execute(self, action: str, position: float) -> str:
        # Placeholder for actual gripper control
        if action == "open":
            print("Opening robot gripper")
            return "Gripper opened"
        elif action == "close":
            print("Closing robot gripper")
            return "Gripper closed"
        elif action == "set_position":
            print(f"Setting gripper position to {position}")
            return f"Gripper position set to {position}"
        else:
            raise ValueError(f"Unknown gripper action: {action}")

class RobotSensorNode(NodeBase):
    """Read robot sensor data"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "sensor_type": (["position", "force", "temperature", "current"], {"default": "position"})
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
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Robot Sensor"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Read data from robot sensors"
    
    def execute(self, sensor_type: str) -> float:
        # Placeholder for actual sensor reading
        import random
        
        if sensor_type == "position":
            # Return simulated position
            return round(random.uniform(-100, 100), 2)
        elif sensor_type == "force":
            # Return simulated force in Newtons
            return round(random.uniform(0, 50), 2)
        elif sensor_type == "temperature":
            # Return simulated temperature in Celsius
            return round(random.uniform(20, 80), 1)
        elif sensor_type == "current":
            # Return simulated current in Amperes
            return round(random.uniform(0, 5), 3)
        else:
            raise ValueError(f"Unknown sensor type: {sensor_type}")

class RobotSequenceNode(NodeBase):
    """Execute a sequence of robot commands"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "commands": ("STRING", {"multiline": True, "default": "# Enter robot commands, one per line\n# Example:\n# move 10 20 30\n# gripper close\n# delay 1"}),
                "repeat_count": ("INT", {"default": 1, "min": 1, "max": 100})
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
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Robot Sequence"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Execute a sequence of robot commands"
    
    def execute(self, commands: str, repeat_count: int) -> str:
        # Parse and execute commands
        command_lines = [line.strip() for line in commands.split('\n') if line.strip() and not line.strip().startswith('#')]
        
        executed_commands = []
        
        for i in range(repeat_count):
            for command in command_lines:
                # Placeholder for command parsing and execution
                print(f"Executing command: {command}")
                executed_commands.append(command)
                
                # Simple command simulation
                import time
                time.sleep(0.1)  # Small delay between commands
        
        return f"Executed {len(executed_commands)} commands in {repeat_count} iterations"

class RobotHomeNode(NodeBase):
    """Home the robot to its default position"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {},
            "optional": {
                "speed": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 5.0})
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
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Robot Home"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Move robot to home position"
    
    def execute(self, speed: float = 1.0) -> str:
        # Placeholder for homing sequence
        print(f"Homing robot at speed {speed}")
        
        # Simulate homing time
        import time
        time.sleep(2.0 / speed)
        
        return "Robot homed successfully"

# Node class mappings for registration
NODE_CLASS_MAPPINGS = {
    "RobotMoveNode": RobotMoveNode,
    "RobotGripperNode": RobotGripperNode,
    "RobotSensorNode": RobotSensorNode,
    "RobotSequenceNode": RobotSequenceNode,
    "RobotHomeNode": RobotHomeNode
}