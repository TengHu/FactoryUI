import sys
import os
from typing import Dict, Any, List
import time
import asyncio

# Add feetech-servo-sdk to path (custom_nodes/feetech-servo-sdk)
feetech_path = os.path.join(os.path.dirname(__file__), 'feetech-servo-sdk')
sys.path.insert(0, feetech_path)

from feetech_servo import ScsServoSDK
from core.node_base import NodeBase

MODULE_TAGS = ["SO101", "SO100"]


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
                "stream_results": ("BOOLEAN", {"default": True}),
                "update_interval": ("FLOAT", {"default": 0.1, "min": 0.01, "max": 5.0}),
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
    def TAGS(cls) -> List[str]:
        return MODULE_TAGS
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Robot Status Reader"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Read status (positions, modes) from connected robot servos using feetech-servo-sdk"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return (
            """
            RobotStatusReader Node

            Purpose: Reads status (positions, modes) from connected robot servos using feetech-servo-sdk with real-time streaming support.

            Inputs:
              - sdk (ScsServoSDK): The SDK instance for communicating with servos.
              - servo_ids (STRING): Comma-separated list of servo IDs to read (e.g., '1,2,3,4,5').
              - read_positions (BOOLEAN, optional): Whether to read servo positions (default: True).
              - read_modes (BOOLEAN, optional): Whether to read servo modes (default: False).
              - stream_results (BOOLEAN, optional): Enable real-time streaming to frontend (default: True).
              - update_interval (FLOAT, optional): Time between updates in seconds (default: 0.1, range: 0.01-5.0).

            Outputs:
              - status_data (DICT): Dictionary containing read positions, modes (if requested), servo_ids, timestamp, and connection status.
              - positions (DICT): Dictionary of servo positions keyed by servo ID.

            Real-time Features:
              - When stream_results is enabled, robot status is continuously broadcast to the frontend
              - The node displays live servo positions and modes in the UI
              - Update frequency is configurable via update_interval
              - Streaming runs for a maximum of 10 seconds per execution
              - Real-time indicators show streaming status (Live, Complete, Error)

            Usage:
              - Connect the ScsServoSDK output from a robot connection node
              - Specify servo IDs to monitor (e.g., "1,2,3,4,5,6")
              - Enable streaming for real-time monitoring
              - Adjust update_interval for performance vs. responsiveness balance
              - Monitor the node UI for live robot status updates
            """
        )
    
    def read_robot_status(self, sdk: ScsServoSDK, servo_ids: str,
                         read_positions: bool = True, read_modes: bool = False,
                         stream_results: bool = True, update_interval: float = 0.1) -> tuple:
        """Read status from robot servos using a provided ScsServoSDK instance"""
        
        # Parse servo IDs
        try:
            servo_id_list = [int(id.strip()) for id in servo_ids.split(",")]
        except ValueError:
            raise ValueError(f"Invalid servo_ids format: {servo_ids}. Use comma-separated integers like '1,2,3'")
        
        result = self._read_robot_status_once(sdk, servo_id_list, read_positions, read_modes)

        if stream_results:
            return (result, result)
        else:
            return result
    
    def _read_robot_status_once(self, sdk: ScsServoSDK, servo_id_list: List[int], 
                              read_positions: bool, read_modes: bool) -> tuple:
        """Read robot status once (non-streaming)"""
        
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
            status_data["timestamp"] = time.time()
            status_data["connected"] = True
            
        except Exception as e:
            status_data = {
                "error": str(e),
                "servo_ids": servo_id_list,
                "timestamp": time.time(),
                "connected": False
            }
            raise Exception(f"Robot status read failed: {e}")
        
        return (status_data, status_data.get("positions", {}))


class SO101JointAnglesToPositions(NodeBase):
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "rotation": ("FLOAT", {"default": 0.0, "min": -180.0, "max": 180.0}),
                "pitch": ("FLOAT", {"default": 0.0, "min": -90.0, "max": 90.0}),
                "elbow": ("FLOAT", {"default": 0.0, "min": -120.0, "max": 120.0}),
                "wrist_pitch": ("FLOAT", {"default": 0.0, "min": -90.0, "max": 90.0}),
                "wrist_roll": ("FLOAT", {"default": 0.0, "min": -180.0, "max": 180.0}),
                "jaw": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 90.0}),
            },
            "optional": {
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
        return "angles_to_positions"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return MODULE_TAGS
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "SO-101 Joint Angles to Positions"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Convert joint angles to servo positions for the SO-101 robot"
        
    @classmethod
    def get_detailed_description(cls) -> str:
        return (
            """
            
            """
        )
    
    def angles_to_positions(self, rotation: float, pitch: float, elbow: float, 
                      wrist_pitch: float, wrist_roll: float, jaw: float) -> tuple:
        # Type safety for angles
        try:
            rotation = float(rotation)
            pitch = float(pitch)
            elbow = float(elbow)
            wrist_pitch = float(wrist_pitch)
            wrist_roll = float(wrist_roll)
            jaw = float(jaw)
        except Exception as e:
            raise ValueError(f"All joint angles must be convertible to float: {e}")
       
        servo_ids = [1,2,3,4,5,6]
         
        # Map joint angles to servo IDs
        joint_angles = [rotation, pitch, elbow, wrist_pitch, wrist_roll, jaw]
        
        positions = {}
        # Convert angles to servo positions and send commands
        for angle, servo_id in zip(joint_angles, servo_ids):
            # Convert angle to servo position (assuming 0-4095 range for SCS servos)
            # This is a basic conversion - you may need to adjust based on your servo configuration
            servo_position = int(round((angle * 4096) / 360)) # Convert 0-360 to 0-4096
            servo_position = min(4096, max(0, servo_position))
            positions[servo_id] = servo_position
                
            
        
        return (positions,)


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
    def TAGS(cls) -> List[str]:
        return MODULE_TAGS

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "SO101 Write Position"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Write multiple servo positions to the robot using ScsServoSDK."

    @classmethod
    def get_detailed_description(cls) -> str:
        return (
            """
            So101WritePositionNode Node\n\n"
            "Purpose: Writes multiple servo positions to the robot using ScsServoSDK.\n"
            "Inputs:\n"
            "  - sdk (ScsServoSDK): The SDK instance for communicating with servos.\n"
            "  - positions (DICT): Dictionary mapping servo IDs to target positions.\n"
            "Outputs:\n"
            "  - write_result (DICT): Dictionary reflecting the positions written to the servos.\n"
            """
        )

    def write_positions(self, sdk: ScsServoSDK, positions: dict) -> tuple:
        """Write positions to robot servos"""
        import traceback
        try:
            sdk.sync_write_positions(positions)
            return (positions,)
        except Exception as e:
            error_msg = str(e) + "\n" + traceback.format_exc()
            raise Exception(f"Failed to write positions: {error_msg}")


class UnlockRemoteNode(NodeBase):
    """Node for unlocking remote control of the SO-101 robot"""

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
        return "unlock_remote"

    @classmethod
    def TAGS(cls) -> List[str]:
        return MODULE_TAGS

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Unlock Remote"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Unlock remote control for the SO-101 robot using ScsServoSDK"

    @classmethod
    def get_detailed_description(cls) -> str:
        return """
UnlockRemoteNode

Purpose: Unlocks remote control functionality for the SO-101 robot, allowing manual or programmatic control of the servos.

Inputs:
  - sdk (ScsServoSDK): The SDK instance for communicating with the robot servos

Outputs:
  - None (this node has no outputs)

Usage: Use this node to enable remote control mode on the SO-101 robot. This is typically required before sending position commands or reading servo status. Place this node early in your workflow before other robot control nodes.

Note: This operation may be required to establish proper communication with the robot's servo controller and enable command execution.
        """

    def unlock_remote(self, sdk: ScsServoSDK) -> tuple:
        """Unlock remote control for the robot using _unlock_servo method"""
        import traceback
        try:
            # Use the specific _unlock_servo method from ScsServoSDK
            for servo_id in range(1, 7):
                sdk.write_torque_enable(servo_id, False)
            
            return ()  # Return empty tuple since no outputs
            
        except Exception as e:
            error_msg = str(e) + "\n" + traceback.format_exc()
            print(f"❌ Failed to unlock remote: {error_msg}")
            raise Exception(f"Failed to unlock remote control: {error_msg}")


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
        return MODULE_TAGS

    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Disconnect Robot"

    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Disconnect from the robot using ScsServoSDK."

    @classmethod
    def get_detailed_description(cls) -> str:
        return (
            """
            DisconnectRobotNode\n\n"
            "Purpose: Disconnects from the robot by calling the disconnect() method on the provided ScsServoSDK instance.\n"
            "Inputs:\n"
            "  - sdk (ScsServoSDK): The SDK instance for communicating with servos.\n"
            "Outputs:\n"
            "  - None (this node has no outputs)\n"
            """
        )

    def disconnect_robot(self, sdk: ScsServoSDK) -> tuple:
        import traceback
        try:
            sdk.disconnect()
            return ()  # No outputs
        except Exception as e:
            error_msg = str(e) + "\n" + traceback.format_exc()
            print(f"❌ Failed to disconnect robot: {error_msg}")
            raise Exception(f"Failed to disconnect robot: {error_msg}")


NODE_CLASS_MAPPINGS = {
    "RobotStatusReader": RobotStatusReader,
    "SO101JointAnglesToPositions": SO101JointAnglesToPositions,
    "So101WritePositionNode": So101WritePositionNode,
    "UnlockRemoteNode": UnlockRemoteNode,
    "DisconnectRobotNode": DisconnectRobotNode
}