import sys
import os
from typing import Dict, Any, List, Optional

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
    def RETURN_TYPES(cls) -> tuple:
        return ("DICT",)
    
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
    
    def read_robot_status(self, sdk: ScsServoSDK, servo_ids: str, port: str = "", baud_rate: int = 1000000,
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
        
        return (status_data,)


NODE_CLASS_MAPPINGS = {
    "RobotStatusReader": RobotStatusReader
}