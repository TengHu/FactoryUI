import os
import sys
import time
import traceback
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
            rt_update = {"error": f"Failed to connect robot: {str(e)}\n{traceback.format_exc()}"}
            return (None, rt_update)


class DatasetRecordConfigForOneEpisodeNode(NodeBase):
    """Configure dataset recording parameters"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "repo_id": ("STRING", {"default": "user/dataset_name"}),
                "single_task": ("STRING", {"default": "Pick and place task"}),
                "fps": ("INT", {"default": 30, "min": 1, "max": 120}),
                "episode_time_s": ("FLOAT", {"default": 60.0}),
                "reset_time_s": ("FLOAT", {"default": 60.0}),
            },
            "optional": {
                "root": ("STRING", {"default": ""}),
                "video": ("BOOLEAN", {"default": True}),
                "push_to_hub": ("BOOLEAN", {"default": True}),
                "private": ("BOOLEAN", {"default": False}),
                "num_image_writer_processes": ("INT", {"default": 0}),
                "num_image_writer_threads_per_camera": ("INT", {"default": 4})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "dataset_config": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "create_dataset_config"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Dataset Record Config For One Episode"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Configure dataset recording parameters"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
DatasetRecordConfigNode

Purpose: Configure parameters for dataset recording including episodes, timing, and storage options.

Inputs:
  - repo_id (STRING): Dataset identifier (e.g., 'user/dataset_name')
  - single_task (STRING): Task description for the recording
  - fps (INT): Frames per second for recording
  - episode_time_s (FLOAT): Duration of each episode in seconds
  - reset_time_s (FLOAT): Time for environment reset between episodes
  - root (STRING, optional): Root directory for dataset storage
  - video (BOOLEAN, optional): Encode frames as video
  - push_to_hub (BOOLEAN, optional): Upload to Hugging Face hub
  - private (BOOLEAN, optional): Make repository private
  - num_image_writer_processes (INT, optional): Number of image writer processes
  - num_image_writer_threads_per_camera (INT, optional): Threads per camera for image writing

Outputs:
  - dataset_config (DICT): DatasetRecordConfig object

Usage: Use this node to configure all dataset recording parameters before creating the dataset.
        """
    
    def create_dataset_config(self, repo_id: str, single_task: str, fps: int, 
                            episode_time_s: float, reset_time_s: float,
                            root: str = None, video: bool = True, push_to_hub: bool = True,
                            private: bool = False, num_image_writer_processes: int = 0,
                            num_image_writer_threads_per_camera: int = 4) -> tuple:
        """Create dataset recording configuration"""
        
        num_episodes = 1
        try:
            # Create DatasetRecordConfig
            dataset_config = DatasetRecordConfig(
                repo_id=repo_id,
                single_task=single_task,
                root=Path(root) if root else None,
                fps=fps,
                episode_time_s=episode_time_s,
                reset_time_s=reset_time_s,
                num_episodes=num_episodes,
                video=video,
                push_to_hub=push_to_hub,
                private=private,
                num_image_writer_processes=num_image_writer_processes,
                num_image_writer_threads_per_camera=num_image_writer_threads_per_camera
            )
            
            rt_update = {
                "status": "configured",
                "repo_id": repo_id,
                "fps": fps
            }
            
            return ({"dataset_config": dataset_config},), rt_update
            
        except Exception as e:
            rt_update = {"error": f"Failed to create dataset config: {str(e)}\n{traceback.format_exc()}"}
            return (rt_update,)


class ConnectTeleoperatorNode(NodeBase):
    """Connect to a LeRobot teleoperator"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "teleop_type": ("STRING", {"default": "so101_leader"}),
                "port": ("STRING", {"default": "/dev/tty.usbmodem58760431551"}),
                "teleop_id": ("STRING", {"default": "blue"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "teleoperator": ("DICT", {}),
                "teleop_config": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "connect_teleoperator"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Connect Teleoperator"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Connect to a LeRobot teleoperator device"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
ConnectTeleoperatorNode

Purpose: Establishes connection to a LeRobot teleoperator device for manual control.

Inputs:
  - teleop_type (STRING): Type of teleoperator (so100_leader, so101_leader, koch_leader)
  - port (STRING): Serial port for the teleoperator device
  - teleop_id (STRING): Identifier for the teleoperator

Outputs:
  - teleoperator (DICT): Connected teleoperator instance
  - teleop_config (DICT): Teleoperator configuration object

Usage: Use this node to connect to a teleoperator device for manual robot control during recording.
        """
    
    def connect_teleoperator(self, teleop_type: str, port: str, teleop_id: str) -> tuple:
        """Connect to LeRobot teleoperator"""
        
        @dataclass
        class ConnectTeleopConfig:
            teleop: TeleoperatorConfig

        try:
            @draccus.wrap()
            def get_teleop_config(cfg: ConnectTeleopConfig) -> ConnectTeleopConfig:
                return cfg
            
            # Temporarily replace sys.argv
            original_argv = sys.argv
            sys.argv = [
                "dummy_script",
                f"--teleop.type={teleop_type}",
                f"--teleop.port={port}",
                f"--teleop.id={teleop_id}",
            ]
            
            try:
                teleop_config = get_teleop_config()
                teleop_cfg = teleop_config.teleop
            finally:
                sys.argv = original_argv
            
            teleoperator = make_teleoperator_from_config(teleop_cfg)
            teleoperator.connect()

            rt_update = {
                "status": "connected",
                "teleop_type": teleop_type,
                "port": port,
                "teleop_id": teleop_id
            }
            
            return ({"teleoperator": teleoperator, "type": teleop_type}, teleop_cfg.__dict__), rt_update
            
        except Exception as e:
            rt_update = {"error": f"Failed to connect teleoperator: {str(e)}\n{traceback.format_exc()}"}
            return (None, rt_update)


class CreateDatasetNode(NodeBase):
    """Create or load LeRobot dataset"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "dataset_config": ("DICT", {}),
                "robot": ("DICT", {}),
                "resume": ("BOOLEAN", {"default": False})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "dataset": ("DICT", {}),
                "dataset_features": ("DICT", {})
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
        return "Create Dataset"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Create or load LeRobot dataset for recording"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
CreateDatasetNode

Purpose: Creates a new LeRobot dataset or loads an existing one for recording episodes.

Inputs:
  - dataset_config (DICT): Dataset configuration from DatasetRecordConfigNode
  - robot (DICT): Connected robot instance from ConnectLeRobotNode
  - resume (BOOLEAN): Whether to resume recording on existing dataset

Outputs:
  - dataset (DICT): LeRobot dataset instance
  - dataset_features (DICT): Dataset features schema

Usage: Use this node to create the dataset structure before recording episodes.
        """
    
    def create_dataset(self, dataset_config: dict, robot: dict, resume: bool = False) -> tuple:
        """Create or load LeRobot dataset"""
        
        try:
            # Reconstruct DatasetRecordConfig from dict
            config = dataset_config["dataset_config"]
            robot_instance = robot["robot"]
            
            # Create dataset features
            action_features = hw_to_dataset_features(robot_instance.action_features, "action", config.video)
            obs_features = hw_to_dataset_features(robot_instance.observation_features, "observation", config.video)
            dataset_features = {**action_features, **obs_features}
            
            if resume:
                # Load existing dataset
                dataset = LeRobotDataset(
                    config.repo_id,
                    root=config.root,
                )
                
                if hasattr(robot_instance, "cameras") and len(robot_instance.cameras) > 0:
                    dataset.start_image_writer(
                        num_processes=config.num_image_writer_processes,
                        num_threads=config.num_image_writer_threads_per_camera * len(robot_instance.cameras),
                    )
            else:
                # Create new dataset
                dataset = LeRobotDataset.create(
                    config.repo_id,
                    config.fps,
                    root=config.root,
                    robot_type=robot_instance.name,
                    features=dataset_features,
                    use_videos=config.video,
                    image_writer_processes=config.num_image_writer_processes,
                    image_writer_threads=config.num_image_writer_threads_per_camera * len(robot_instance.cameras),
                )
            
            rt_update = {
                "status": "created" if not resume else "loaded",
                "repo_id": config.repo_id,
                "num_features": len(dataset_features)
            }
            
            return ({"dataset": dataset, "config": config}, dataset_features), rt_update
            
        except Exception as e:
            rt_update = {"error": f"Failed to create dataset: {str(e)}\n{traceback.format_exc()}"}
            return (None,),  rt_update


class RecordEpisodesNode(NodeBase):
    """Record episodes using LeRobot"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "robot": ("DICT", {}),
                "dataset": ("DICT", {}),
                "dataset_config": ("DICT", {})
            },
            "optional": {
                "teleoperator": ("DICT", {}),
                "policy": ("DICT", {}),
                "display_data": ("BOOLEAN", {"default": False}),
                "play_sounds": ("BOOLEAN", {"default": True})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "recorded_dataset": ("DICT", {}),
                "recording_stats": ("DICT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "record_episodes"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Record Episodes"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Record robot episodes with teleoperator or policy control"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
RecordEpisodesNode

Purpose: Records robot episodes using teleoperator control or policy execution.

Inputs:
  - robot (DICT): Connected robot instance
  - dataset (DICT): Dataset instance for recording
  - dataset_config (DICT): Dataset configuration
  - teleoperator (DICT, optional): Teleoperator for manual control
  - policy (DICT, optional): Policy for autonomous control
  - display_data (BOOLEAN, optional): Display camera feeds during recording
  - play_sounds (BOOLEAN, optional): Play audio notifications

Outputs:
  - recorded_dataset (DICT): Dataset with recorded episodes
  - recording_stats (DICT): Statistics about the recording session

Usage: Main recording node that captures robot episodes. Requires either teleoperator or policy for control.
        """
    
    def record_episodes(self, robot: dict, dataset: dict, dataset_config: dict,
                       teleoperator: dict = None, policy: dict = None,
                       display_data: bool = False, play_sounds: bool = True) -> tuple:
        """Record episodes using LeRobot recording system"""

        try:
            robot_instance = robot["robot"]
            dataset_instance = dataset["dataset"]
            config = dataset_config["dataset_config"]



            if teleoperator is None and policy is None:
                rt_update = {"error": "Either teleoperator or policy must be provided for recording"}
                return (None,), rt_update
            
            teleop_instance = teleoperator["teleoperator"] if teleoperator else None
            policy_instance = policy["policy"] if policy else None
            
            # Initialize keyboard listener for control
            listener, events = init_keyboard_listener()
            
            recorded_episodes = 0
            start_time = time.time()

            while recorded_episodes < config.num_episodes and not events["stop_recording"]:

                # Record episode
                record_loop(
                    robot=robot_instance,
                    events=events,
                    fps=config.fps,
                    teleop=teleop_instance,
                    policy=policy_instance,
                    dataset=dataset_instance,
                    control_time_s=config.episode_time_s,
                    single_task=config.single_task,
                    display_data=display_data,
                )
                
                # Reset environment if not last episode
                if not events["stop_recording"] and (
                    (recorded_episodes < config.num_episodes - 1) or events["rerecord_episode"]
                ):
                    record_loop(
                        robot=robot_instance,
                        events=events,
                        fps=config.fps,
                        teleop=teleop_instance,
                        control_time_s=config.reset_time_s,
                        single_task=config.single_task,
                        display_data=display_data,
                    )
                
                if events["rerecord_episode"]:
                    events["rerecord_episode"] = False
                    events["exit_early"] = False
                    dataset_instance.clear_episode_buffer()
                    continue
                
                dataset_instance.save_episode()
                recorded_episodes += 1
            
            total_time = time.time() - start_time
            
            # Push to hub if configured
            if config.push_to_hub:
                dataset_instance.push_to_hub(tags=config.tags, private=config.private)
            
            # Cleanup
            if listener is not None:
                listener.stop()
            
            recording_stats = {
                "episodes_recorded": recorded_episodes,
                "total_time_s": total_time,
                "avg_time_per_episode": total_time / recorded_episodes if recorded_episodes > 0 else 0,
                "pushed_to_hub": config.push_to_hub
            }
            
            rt_update = {
                "status": "completed",
                "episodes_recorded": recorded_episodes,
                "total_time": f"{total_time:.1f}s"
            }
            
            return ({"dataset": dataset_instance, "config": config}, recording_stats), rt_update
            
        except Exception as e:
            rt_update = {"error": f"Recording failed: {str(e)}\n{traceback.format_exc()}"}
            return (None,), rt_update


# Export the nodes
NODE_CLASS_MAPPINGS = {
    "ConnectLeRobotNode": ConnectLeRobotNode,
    "DatasetRecordConfigForOneEpisodeNode": DatasetRecordConfigForOneEpisodeNode,
    "ConnectTeleoperatorNode": ConnectTeleoperatorNode,
    "CreateDatasetNode": CreateDatasetNode,
    "RecordEpisodesNode": RecordEpisodesNode,
}