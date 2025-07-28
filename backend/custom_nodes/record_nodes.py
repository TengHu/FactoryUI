import os
import sys
import time
from typing import Any, Dict, List
from pathlib import Path

from core.node_base import NodeBase

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
        try:
            import sys
            from lerobot.record import RecordConfig, DatasetRecordConfig
            from lerobot.configs import parser
            
            @parser.wrap()
            def get_robot_config(cfg: RecordConfig) -> RecordConfig:
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

class SetupHuggingFaceNode(NodeBase):
    """Setup HuggingFace account for dataset upload"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "hf_username": ("STRING", {"default": "your_username"}),
                "hf_token": ("STRING", {"default": "hf_your_token_here"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "hf_config": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "setup_hf"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Setup HuggingFace"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Setup HuggingFace credentials for dataset upload"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
SetupHuggingFaceNode

Purpose: Configures HuggingFace credentials for uploading recorded datasets to the HuggingFace hub.

Inputs:
  - hf_username (STRING): Your HuggingFace username
  - hf_token (STRING): Your HuggingFace access token

Outputs:
  - hf_config (DICT): HuggingFace configuration for dataset operations

Usage: Use this node to setup HuggingFace credentials before creating a LeRobot dataset. This enables automatic upload of recorded datasets to the HuggingFace hub.
        """
    
    def setup_hf(self, hf_username: str, hf_token: str) -> tuple:
        """Setup HuggingFace configuration"""
        try:
            # Set environment variables for HuggingFace
            os.environ['HF_TOKEN'] = hf_token
            os.environ['HF_USERNAME'] = hf_username
            
            hf_config = {
                "username": hf_username,
                "token_set": True,
                "status": "configured"
            }
            
            rt_update = {
                "status": "HuggingFace configured",
                "username": hf_username
            }
            
            return (hf_config, rt_update)
            
        except Exception as e:
            rt_update = {"error": f"Failed to setup HuggingFace: {str(e)}"}
            return (None, rt_update)

class CreateLeRobotDatasetNode(NodeBase):
    """Create a LeRobot dataset for recording"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "robot_config": ("DICT", {}),
                "hf_config": ("DICT", {}),
                "dataset_name": ("STRING", {"default": "test_dataset"}),
                "task_description": ("STRING", {"default": "Pick and place task"}),
                "fps": ("INT", {"default": 30, "min": 1, "max": 60}),
                "num_episodes": ("INT", {"default": 10, "min": 1, "max": 1000})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "dataset": ("DICT", {}),
                "dataset_config": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "create_dataset"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Create LeRobot Dataset"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Create a LeRobot dataset for recording episodes"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
CreateLeRobotDatasetNode

Purpose: Creates a LeRobot dataset for recording robot episodes with the specified configuration.

Inputs:
  - robot_config (DICT): Robot configuration from ConnectLeRobotNode
  - hf_config (DICT): HuggingFace configuration from SetupHuggingFaceNode
  - dataset_name (STRING): Name of the dataset to create
  - task_description (STRING): Description of the task being recorded
  - fps (INT): Frames per second for recording (1-60)
  - num_episodes (INT): Number of episodes to record (1-1000)

Outputs:
  - dataset (DICT): Created dataset instance
  - dataset_config (DICT): Dataset configuration object

Usage: Use this node to create a dataset for recording robot episodes. Connect the outputs to the RecordLoopNode for actual recording.
        """
    
    def create_dataset(self, robot_config: dict, hf_config: dict, dataset_name: str, task_description: str, fps: int, num_episodes: int) -> tuple:
        """Create LeRobot dataset"""
        try:
            # Create repo_id using HuggingFace username
            repo_id = f"{hf_config['username']}/{dataset_name}"
            
            # Create dataset record config
            dataset_config = DatasetRecordConfig(
                repo_id=repo_id,
                single_task=task_description,
                fps=fps,
                num_episodes=num_episodes,
                episode_time_s=60,
                reset_time_s=30,
                video=True,
                push_to_hub=True
            )
            
            rt_update = {
                "status": "dataset_created",
                "repo_id": repo_id,
                "task": task_description,
                "fps": fps,
                "num_episodes": num_episodes
            }
            
            return ({"config": dataset_config, "repo_id": repo_id}, dataset_config.__dict__, rt_update)
            
        except Exception as e:
            rt_update = {"error": f"Failed to create dataset: {str(e)}"}
            return (None, None, rt_update)

class SetupTeleopNode(NodeBase):
    """Setup teleoperator for robot control (dummy node)"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "teleop_type": (["so100_leader", "so101_leader", "koch_leader", "keyboard"], {"default": "keyboard"}),
                "teleop_port": ("STRING", {"default": "/dev/tty.usbmodem58760431551"}),
                "teleop_id": ("STRING", {"default": "blue"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "teleop_config": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "setup_teleop"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Setup Teleop"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Setup teleoperator configuration for robot control"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
SetupTeleopNode

Purpose: Configures teleoperator for controlling the robot during recording sessions.

Inputs:
  - teleop_type (SELECTION): Type of teleoperator (so100_leader, so101_leader, koch_leader, keyboard)
  - teleop_port (STRING): Serial port for the teleoperator device
  - teleop_id (STRING): Identifier for the teleoperator

Outputs:
  - teleop_config (DICT): Teleoperator configuration object

Usage: Use this node to setup teleoperator configuration before recording. This enables manual control of the robot during data collection.
        """
    
    def setup_teleop(self, teleop_type: str, teleop_port: str, teleop_id: str) -> tuple:
        """Setup teleoperator configuration"""
        try:
            if teleop_type == "keyboard":
                teleop_config = {"type": "keyboard", "enabled": True}
            else:
                teleop_config = {
                    "type": teleop_type,
                    "port": teleop_port,
                    "id": teleop_id,
                    "enabled": True
                }
            
            rt_update = {
                "status": "teleop_configured",
                "type": teleop_type
            }
            
            return (teleop_config, rt_update)
            
        except Exception as e:
            rt_update = {"error": f"Failed to setup teleop: {str(e)}"}
            return (None, rt_update)

class SetupPolicyNode(NodeBase):
    """Setup policy for autonomous robot control (dummy node)"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "policy_path": ("STRING", {"default": "lerobot/diffusion_pusht"}),
                "use_policy": ("BOOLEAN", {"default": False})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "policy_config": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "setup_policy"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Setup Policy"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Setup policy configuration for autonomous robot control"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
SetupPolicyNode

Purpose: Configures a pre-trained policy for autonomous robot control during recording.

Inputs:
  - policy_path (STRING): Path to the pre-trained policy model
  - use_policy (BOOLEAN): Whether to use policy for autonomous control

Outputs:
  - policy_config (DICT): Policy configuration object

Usage: Use this node to setup autonomous robot control using a pre-trained policy. This enables automatic data collection without manual teleoperator control.
        """
    
    def setup_policy(self, policy_path: str, use_policy: bool) -> tuple:
        """Setup policy configuration"""
        try:
            policy_config = {
                "path": policy_path,
                "enabled": use_policy,
                "type": "pretrained"
            }
            
            rt_update = {
                "status": "policy_configured",
                "path": policy_path,
                "enabled": use_policy
            }
            
            return (policy_config, rt_update)
            
        except Exception as e:
            rt_update = {"error": f"Failed to setup policy: {str(e)}"}
            return (None, rt_update)

class RecordLoopNode(NodeBase):
    """Execute the LeRobot record loop to collect data"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "robot": ("DICT", {}),
                "dataset": ("DICT", {}),
                "teleop_config": ("DICT", {}),
                "policy_config": ("DICT", {}),
                "episode_duration": ("INT", {"default": 60, "min": 5, "max": 300}),
                "display_data": ("BOOLEAN", {"default": False})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "recording_result": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute_recording"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Record Episodes"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Execute LeRobot record loop to collect robot data"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
RecordLoopNode

Purpose: Executes the LeRobot record_loop function to collect robot demonstration data using the configured robot, dataset, and control method.

Inputs:
  - robot (DICT): Connected robot instance from ConnectLeRobotNode
  - dataset (DICT): Dataset configuration from CreateLeRobotDatasetNode
  - teleop_config (DICT): Teleoperator configuration from SetupTeleopNode
  - policy_config (DICT): Policy configuration from SetupPolicyNode
  - episode_duration (INT): Duration of each recording episode in seconds (5-300)
  - display_data (BOOLEAN): Whether to display recording data in real-time

Outputs:
  - recording_result (DICT): Results of the recording session including episode count and status

Usage: Use this node to start the actual recording process. Ensure all prerequisite nodes are connected and configured properly. The recording will collect robot demonstration data according to the specified configuration.
        """
    
    def execute_recording(self, robot: dict, dataset: dict, teleop_config: dict, policy_config: dict, episode_duration: int, display_data: bool) -> tuple:
        """Execute LeRobot recording loop"""
        try:
            from lerobot.robots import make_robot_from_config
            from lerobot.teleoperators import make_teleoperator_from_config
            from lerobot.datasets.lerobot_dataset import LeRobotDataset
            from lerobot.datasets.utils import hw_to_dataset_features
            from lerobot.utils.control_utils import init_keyboard_listener
            
            # Get robot instance
            robot_instance = robot["robot"]
            robot_type = robot["type"]
            
            # Create dataset instance
            dataset_config = dataset["config"]
            
            # Setup features
            action_features = hw_to_dataset_features(robot_instance.action_features, "action", dataset_config.video)
            obs_features = hw_to_dataset_features(robot_instance.observation_features, "observation", dataset_config.video)
            dataset_features = {**action_features, **obs_features}
            
            # Create actual dataset
            dataset_instance = LeRobotDataset.create(
                dataset_config.repo_id,
                dataset_config.fps,
                robot_type=robot_type,
                features=dataset_features,
                use_videos=dataset_config.video
            )
            
            # Setup teleoperator if enabled
            teleop_instance = None
            if teleop_config.get("enabled", False):
                if teleop_config["type"] == "keyboard":
                    from lerobot.teleoperators.keyboard.teleop_keyboard import KeyboardTeleop
                    teleop_instance = KeyboardTeleop()
                else:
                    teleop_cfg = TeleoperatorConfig(
                        type=teleop_config["type"],
                        port=teleop_config.get("port"),
                        id=teleop_config.get("id")
                    )
                    teleop_instance = make_teleoperator_from_config(teleop_cfg)
                    teleop_instance.connect()
            
            # Setup policy if enabled
            policy_instance = None
            if policy_config.get("enabled", False):
                # For now, just indicate policy is configured but not loaded
                pass
            
            # Initialize keyboard listener for events
            listener, events = init_keyboard_listener()
            
            rt_update = {
                "status": "recording_started",
                "episode_duration": episode_duration,
                "display_data": display_data
            }
            
            # Execute record loop
            record_loop(
                robot=robot_instance,
                events=events,
                fps=dataset_config.fps,
                dataset=dataset_instance,
                teleop=teleop_instance,
                policy=policy_instance,
                control_time_s=episode_duration,
                single_task=dataset_config.single_task,
                display_data=display_data
            )
            
            # Save episode
            dataset_instance.save_episode()
            
            recording_result = {
                "status": "completed",
                "episodes_recorded": 1,
                "dataset_repo_id": dataset_config.repo_id,
                "episode_duration": episode_duration
            }
            
            rt_update = {
                "status": "recording_completed",
                "episodes_recorded": 1
            }
            
            # Cleanup
            if teleop_instance and hasattr(teleop_instance, 'disconnect'):
                teleop_instance.disconnect()
            
            if listener:
                listener.stop()
            
            return (recording_result, rt_update)
            
        except Exception as e:
            rt_update = {"error": f"Recording failed: {str(e)}"}
            return ({"status": "failed", "error": str(e)}, rt_update)

# Export the nodes
NODE_CLASS_MAPPINGS = {
    "ConnectLeRobotNode": ConnectLeRobotNode,
    "SetupHuggingFaceNode": SetupHuggingFaceNode,
    "CreateLeRobotDatasetNode": CreateLeRobotDatasetNode,
    "SetupTeleopNode": SetupTeleopNode,
    "SetupPolicyNode": SetupPolicyNode,
    "RecordLoopNode": RecordLoopNode,
}