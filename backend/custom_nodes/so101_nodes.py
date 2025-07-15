import sys
import os
from typing import Dict, Any, List, Optional
import traceback

# Add feetech-servo-sdk to path (custom_nodes/feetech-servo-sdk)
feetech_path = os.path.join(os.path.dirname(__file__), 'feetech-servo-sdk')
sys.path.insert(0, feetech_path)

from feetech_servo import ScsServoSDK
from core.node_base import NodeBase, NodeCategory


class RobotStatusReader(NodeBase):
    """Node for reading status from a connected robot using feetech-servo-sdk"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "sdk": ("ScsServoSDK", {}),
                "servo_ids": ("STRING", {"default": "1,2,3,4,5"}),
            },
            "optional": {
                "read_positions": ("BOOLEAN", {"default": True}),
                "read_modes": ("BOOLEAN", {"default": False}),
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "status_data": ("DICT", {}),
                "positions": ("DICT", {}),
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "read_robot_status"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Robot Status Reader"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Read status (positions, modes) from connected robot servos using feetech-servo-sdk"
    
    def read_robot_status(self, sdk: ScsServoSDK, servo_ids: str,
                         read_positions: bool = True, read_modes: bool = False) -> tuple:
        """Read status from robot servos using a provided ScsServoSDK instance"""
        
        # Parse servo IDs
        try:
            servo_id_list = [int(id.strip()) for id in servo_ids.split(",")]
        except ValueError:
            raise ValueError(f"Invalid servo_ids format: {servo_ids}. Use comma-separated integers like '1,2,3'")
        
        status_data = {}
        
        try:
            # Read positions if requested
            if read_positions:
                try:
                    positions = sdk.sync_read_positions(servo_id_list)
                    status_data["positions"] = positions
                except Exception as e:
                    print(f"Warning: Failed to read positions: {e}")
                    status_data["positions"] = {}
            
            # Read modes if requested
            if read_modes:
                modes = {}
                for servo_id in servo_id_list:
                    try:
                        mode = sdk.read_mode(servo_id)
                        modes[servo_id] = mode
                    except Exception as e:
                        print(f"Warning: Failed to read mode for servo {servo_id}: {e}")
                        modes[servo_id] = None
                status_data["modes"] = modes
            
            # Add metadata
            status_data["servo_ids"] = servo_id_list
            status_data["timestamp"] = __import__('time').time()
            status_data["connected"] = True
            
        except Exception as e:
            status_data = {
                "error": str(e),
                "servo_ids": servo_id_list,
                "timestamp": __import__('time').time(),
                "connected": False
            }
            raise Exception(f"Robot status read failed: {e}")
        
        return (status_data, status_data["positions"])


class JointControlNode(NodeBase):
    """Node for controlling robot joints with individual joint angles"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "sdk": ("ScsServoSDK", {}),
                "rotation": ("FLOAT", {"default": 0.0, "min": -180.0, "max": 180.0}),
                "pitch": ("FLOAT", {"default": 0.0, "min": -90.0, "max": 90.0}),
                "elbow": ("FLOAT", {"default": 0.0, "min": -120.0, "max": 120.0}),
                "wrist_pitch": ("FLOAT", {"default": 0.0, "min": -90.0, "max": 90.0}),
                "wrist_roll": ("FLOAT", {"default": 0.0, "min": -180.0, "max": 180.0}),
                "jaw": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 90.0}),
            },
            "optional": {
                "servo_mapping": ("STRING", {"default": "1,2,3,4,5,6"}),
                "move_time": ("INT", {"default": 1000, "min": 100, "max": 5000}),
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "control_result": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "control_joints"
    
    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.ROBOT.value
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Joint Control"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Control robot joints with individual angle inputs for rotation, pitch, elbow, wrist_pitch, wrist_roll, and jaw"
    
    def control_joints(self, sdk: ScsServoSDK, rotation: float, pitch: float, elbow: float, 
                      wrist_pitch: float, wrist_roll: float, jaw: float, 
                      servo_mapping: str = "1,2,3,4,5,6", move_time: int = 1000) -> tuple:
        """Control robot joints with specified angles"""
        
        # Parse servo mapping
        try:
            servo_ids = [int(id.strip()) for id in servo_mapping.split(",")]
            if len(servo_ids) != 6:
                raise ValueError(f"Servo mapping must contain exactly 6 servo IDs, got {len(servo_ids)}")
        except ValueError as e:
            raise ValueError(f"Invalid servo_mapping format: {servo_mapping}. Use comma-separated integers like '1,2,3,4,5,6'")
        
        # Map joint angles to servo IDs
        joint_angles = [rotation, pitch, elbow, wrist_pitch, wrist_roll, jaw]
        joint_names = ["rotation", "pitch", "elbow", "wrist_pitch", "wrist_roll", "jaw"]
        
        control_data = {
            "joint_commands": {},
            "servo_mapping": dict(zip(joint_names, servo_ids)),
            "move_time": move_time,
            "timestamp": __import__('time').time()
        }
        
        try:
            # Convert angles to servo positions and send commands
            for joint_name, angle, servo_id in zip(joint_names, joint_angles, servo_ids):
                # Convert angle to servo position (assuming 0-4095 range for SCS servos)
                # This is a basic conversion - you may need to adjust based on your servo configuration
                servo_position = int((angle + 180) * 4095 / 360)  # Convert -180 to 180 degrees to 0-4095
                servo_position = max(0, min(4095, servo_position))  # Clamp to valid range
                
                control_data["joint_commands"][joint_name] = {
                    "servo_id": servo_id,
                    "angle": angle,
                    "position": servo_position
                }
                
                # Send command to servo
                try:
                    sdk.write_position(servo_id, servo_position, move_time)
                except Exception as e:
                    print(f"Warning: Failed to control servo {servo_id} ({joint_name}): {e}")
                    control_data["joint_commands"][joint_name]["error"] = str(e) + "\n" + traceback.format_exc()
            
            control_data["success"] = True
            control_data["message"] = f"Successfully sent commands to {len(servo_ids)} joints"
            
        except Exception as e:
            control_data["success"] = False
            control_data["error"] = str(e) + "\n" + traceback.format_exc()
            control_data["message"] = f"Joint control failed: {e}"
            raise Exception(f"Joint control failed: {e}\n{traceback.format_exc()}")
        
        return (control_data,)


class So101WritePositionNode(NodeBase):
    """Node for writing multiple servo positions to the robot using ScsServoSDK"""

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "sdk": ("ScsServoSDK", {}),
                "positions": ("DICT", {}),  # {servo_id: position, ...}
            },
            "optional": {
            }
        }

    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "write_result": ("DICT", {})
            }
        }

    @classmethod
    def FUNCTION(cls) -> str:
        return "write_positions"

    @classmethod
    def CATEGORY(cls) -> str:
        return NodeCategory.ROBOT.value

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "SO101 Write Position"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Write multiple servo positions to the robot using ScsServoSDK."

    def write_positions(self, sdk: ScsServoSDK, positions: dict) -> tuple:
        """Write positions to robot servos"""
        import traceback
        try:
            sdk.sync_write_positions(positions)
            return (positions,)
        except Exception as e:
            error_msg = str(e) + "\n" + traceback.format_exc()
            raise Exception(f"Failed to write positions: {error_msg}")


NODE_CLASS_MAPPINGS = {
    "RobotStatusReader": RobotStatusReader,
    "JointControlNode": JointControlNode,
    "So101WritePositionNode": So101WritePositionNode
}