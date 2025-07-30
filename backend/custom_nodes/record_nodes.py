import os
import sys
import time
from typing import Any, Dict, List
from pathlib import Path
from dataclasses import dataclass

from core.node_base import NodeBase

import draccus
# Add lerobot path for imports
lerobot_path = os.path.join(os.path.dirname(__file__), 'lerobot', 'src')
sys.path.insert(0, lerobot_path)

# Import LeRobot modules
try:
    from lerobot.robots import make_robot_from_config, RobotConfig
    from lerobot.teleoperators import make_teleoperator_from_config, TeleoperatorConfig
    from lerobot.datasets.lerobot_dataset import LeRobotDataset
    from lerobot.record import record_loop, DatasetRecordConfig
    from lerobot.utils.control_utils import init_keyboard_listener
    from lerobot.datasets.utils import hw_to_dataset_features
except ImportError as e:
    print(f"Warning: Could not import lerobot modules: {e}")

MODULE_TAG = "LeRobot"


class ConnectLeRobotNode(NodeBase):
    """Connect to a LeRobot robot"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "robot_type": ("STRING", {"default": "so101_follower"}),
                "port": ("STRING", {"default": "/dev/tty.usbmodem58760431541"}),
                "robot_id": ("STRING", {"default": "black"}),
                "cameras": ("STRING", {"default": '{"laptop": {"type": "opencv", "camera_index": 0, "width": 640, "height": 480, "fps": 30}}'})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "robot": ("DICT", {}),
                "robot_config": ("DICT", {})
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
        return "Connect LeRobot"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Connect to a LeRobot robot and return robot instance"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ConnectLeRobotNode

Purpose: Establishes connection to a LeRobot robot using the specified configuration.

Inputs:
  - robot_type (SELECTION): Type of robot (so100_follower, so101_follower, koch_follower, bi_so100_follower)
  - port (STRING): Serial port for the robot (e.g., /dev/tty.usbmodem58760431541)
  - robot_id (STRING): Identifier for the robot (e.g., black, blue)
  - cameras (STRING): JSON string defining camera configuration

Outputs:
  - robot (DICT): Connected robot instance
  - robot_config (DICT): Robot configuration object

Usage: Use this node to establish connection with a LeRobot robot. The robot instance can be used by other LeRobot nodes for recording and control.
        """
    
    def connect_robot(self, robot_type: str, port: str, robot_id: str, cameras: str) -> tuple:
        """Connect to LeRobot robot"""

        @dataclass
        class ConnectLeRobotConfig:
            robot: RobotConfig

        try:
            @draccus.wrap()
            def get_robot_config(cfg: ConnectLeRobotConfig) -> ConnectLeRobotConfig:
                return cfg
            
            # Temporarily replace sys.argv to pass our arguments
            original_argv = sys.argv
            sys.argv = [
                "dummy_script",
                f"--robot.type={robot_type}",
                f"--robot.port={port}",
                f"--robot.id={robot_id}",
                f"--robot.cameras={cameras}",
            ]
            
            try:
                record_config = get_robot_config()
                robot_config = record_config.robot
            finally:
                # Restore original sys.argv
                sys.argv = original_argv
            
            robot = make_robot_from_config(robot_config)
            robot.connect()

            rt_update = {
                "status": "connected",
                "robot_type": robot_type,
                "port": port,
                "robot_id": robot_id
            }
            
            return ({"robot": robot, "type": robot_type}, robot_config.__dict__), rt_update
            
        except Exception as e:
            rt_update = {"error": f"Failed to connect robot: {str(e)}"}
            return (None, rt_update)


# Export the nodes
NODE_CLASS_MAPPINGS = {
    "ConnectLeRobotNode": ConnectLeRobotNode,
}