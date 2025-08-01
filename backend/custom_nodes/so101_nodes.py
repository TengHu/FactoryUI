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
            },
            "optional": {
                
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
        return "SO101 Robot Status Reader"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Read status (positions, modes) from connected robot servos using feetech-servo-sdk"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return (
            """
            RobotStatusReader Node

            Purpose: Reads status (positions, modes) from connected robot servos using feetech-servo-sdk.

            Inputs:
              - sdk (ScsServoSDK): The SDK instance for communicating with servos.

            Outputs:
              - status_data (DICT): Dictionary containing read positions, modes, servo_ids, timestamp, and connection status.
              - positions (DICT): Dictionary of servo positions keyed by servo ID.

            Features:
              - Automatically reads positions for servos 1-6
              - Reads servo modes for each connected servo
              - Provides timestamp and connection status information
              - Handles errors gracefully with detailed error messages
              - Returns both comprehensive status data and positions separately

            Usage:
              - Connect the ScsServoSDK output from a robot connection node
              - The node automatically reads from servos 1-6
              - Use status_data for comprehensive robot state information
              - Use positions for direct access to servo position values
              - Monitor connection status and error handling
            """
        )
    
    def read_robot_status(self, sdk: ScsServoSDK) -> tuple:
        """Read status from robot servos using a provided ScsServoSDK instance"""
        
        servo_id_list = [1,2,3,4,5,6]
        status_data, positions = self._read_robot_status_once(sdk, servo_id_list)

        return (status_data, positions), positions
    
    def _read_robot_status_once(self, sdk: ScsServoSDK, servo_id_list: List[int]) -> tuple:
        """Read robot status once (non-streaming)"""
        
        status_data = {}
        
        try:
            # Read positions if requested
        
            try:
                positions = sdk.sync_read_positions(servo_id_list)
                status_data["positions"] = positions
            except Exception as e:
                print(f"Warning: Failed to read positions: {e}")
                status_data["positions"] = {}
            
            # Read modes if requested
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
            SO101JointAnglesToPositions Node

            Purpose: Converts joint angles to servo positions for the SO-101 robot arm.

            Inputs:
              - rotation (FLOAT): Base rotation angle in degrees (range: -180.0 to 180.0, default: 0.0)
              - pitch (FLOAT): Shoulder pitch angle in degrees (range: -90.0 to 90.0, default: 0.0)
              - elbow (FLOAT): Elbow joint angle in degrees (range: -120.0 to 120.0, default: 0.0)
              - wrist_pitch (FLOAT): Wrist pitch angle in degrees (range: -90.0 to 90.0, default: 0.0)
              - wrist_roll (FLOAT): Wrist roll angle in degrees (range: -180.0 to 180.0, default: 0.0)
              - jaw (FLOAT): Gripper jaw angle in degrees (range: 0.0 to 90.0, default: 0.0)

            Outputs:
              - positions (DICT): Dictionary mapping servo IDs (1-6) to calculated servo positions.

            Conversion Details:
              - Converts degrees to servo positions using 0-4096 range
              - Maps joint angles to servos: rotation→1, pitch→2, elbow→3, wrist_pitch→4, wrist_roll→5, jaw→6
              - Applies bounds checking to ensure positions stay within valid range
              - Uses linear conversion: position = (angle * 4096) / 360

            Usage:
              - Input desired joint angles for each robot joint
              - The node converts angles to servo positions automatically
              - Connect the positions output to a write position node
              - Ensure all angles are within their specified ranges
              - Use with SO101 robot arm for precise joint control
            """
        )
    
    def angles_to_positions(self, rotation: float, pitch: float, elbow: float, 
                      wrist_pitch: float, wrist_roll: float, jaw: float) -> tuple:
        # Helper to check if value is empty/None/''
        def is_valid(val):
            return val is not None and val != '' and str(val).strip() != ''

        servo_ids = [1, 2, 3, 4, 5, 6]
        input_angles = [rotation, pitch, elbow, wrist_pitch, wrist_roll, jaw]

        positions = {}
        for angle, servo_id in zip(input_angles, servo_ids):
            if not is_valid(angle):
                continue
            try:
                angle_f = float(angle)
            except Exception as e:
                raise ValueError(f"Joint angle for servo {servo_id} must be convertible to float: {e}")
            # Convert angle to servo position (assuming 0-4095 range for SCS servos)
            servo_position = int(round((angle_f * 4096) / 360))  # Convert 0-360 to 0-4096
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
                "sdk": ("ScsServoSDK", {}),
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
            So101WritePositionNode

            Purpose: Writes multiple servo positions to the robot using ScsServoSDK.

            Inputs:
              - sdk (ScsServoSDK): The SDK instance for communicating with servos.
              - positions (DICT): Dictionary mapping servo IDs to target positions (e.g., {1: 2048, 2: 1024}).

            Outputs:
              - sdk (ScsServoSDK): The SDK instance, passed through for chaining.
              - write_result (DICT): Dictionary reflecting the positions written to the servos.

            Features:
              - Writes positions to multiple servos simultaneously
              - Uses sync_write_positions for efficient communication
              - Provides detailed error messages with stack traces
              - Returns the positions that were successfully written
              - Handles connection errors and servo communication failures

            Usage:
              - Connect the ScsServoSDK output from a robot connection node
              - Provide positions dictionary with servo ID to position mapping
              - The node will attempt to write all positions to the robot
              - Monitor the write_result for confirmation of successful writes
              - Use with position data from joint angle conversion nodes
            """
        )

    def write_positions(self, sdk: ScsServoSDK, positions: dict) -> tuple:
        """Write positions to robot servos and pass sdk as output as well"""
        import traceback

        # TODO: Remove this once we have a proper gripper
        positions[6] = positions[6] - 1000

        try:
            sdk.sync_write_positions(positions)
            return ((sdk, positions), "success")
        except Exception as e:
            error_msg = str(e) + "\n" + traceback.format_exc()
            raise Exception(f"Failed to write positions: {error_msg}")


NODE_CLASS_MAPPINGS = {
    "SO101RobotStatusReader": RobotStatusReader,
    "SO101JointAnglesToPositions": SO101JointAnglesToPositions,
    "So101WritePositionNode": So101WritePositionNode,
}