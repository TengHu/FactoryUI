import os
import sys
import time
import traceback
import math
from typing import Any, Dict, List
from pathlib import Path

from core.node_base import NodeBase

# Add lerobot path for imports
lerobot_path = os.path.join(os.path.dirname(__file__), 'lerobot', 'src')
sys.path.insert(0, lerobot_path)

# Import LeRobot modules
try:

    from lerobot.teleoperators.keyboard import KeyboardTeleop, KeyboardTeleopConfig
except ImportError as e:
    print(f"Warning: Could not import lerobot modules: {e}")

MODULE_TAG = "XLeRobot"



class So100KeyboardEEControlNode(NodeBase):
    """Keyboard end-effector control for LeRobot robots"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
            },
            "optional": {
                "kp": ("FLOAT", {"default": 0.5, "min": 0.1, "max": 2.0}),
                "xy_step": ("FLOAT", {"default": 0.004, "min": 0.001, "max": 0.01}),
                "joint_step": ("INT", {"default": 1, "min": 1, "max": 5}),
                "pitch_step": ("FLOAT", {"default": 1.0, "min": 0.5, "max": 5.0}),
                "initial_x": ("FLOAT", {"default": 0.1629}),
                "initial_y": ("FLOAT", {"default": 0.1131}),
                "l1": ("FLOAT", {"default": 0.1159}),
                "l2": ("FLOAT", {"default": 0.1350})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "action_generator": ("DICT", {}),
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "create_keyboard_ee_control"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Keyboard EE Control"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Keyboard end-effector control for LeRobot robots"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
So100KeyboardEEControlNode

Purpose: Provides keyboard-based end-effector control for LeRobot robots with inverse kinematics.

Inputs:
  - kp (FLOAT, optional): Proportional gain for P control (default: 0.5)
  - xy_step (FLOAT, optional): Step size for x,y coordinate control (default: 0.004)
  - joint_step (INT, optional): Step size for joint control (default: 1)
  - pitch_step (FLOAT, optional): Step size for pitch adjustment (default: 1.0)
  - initial_x (FLOAT, optional): Initial x coordinate (default: 0.1629)
  - initial_y (FLOAT, optional): Initial y coordinate (default: 0.1131)
  - l1 (FLOAT, optional): Upper arm length for IK (default: 0.1159)
  - l2 (FLOAT, optional): Lower arm length for IK (default: 0.1350)

Outputs:
  - action_generator (DICT): Action generator with init_action and generate_action functions

Usage: Use this node with ControlLoopNode to provide keyboard-based end-effector control. The node creates its own keyboard teleoperator instance internally.
        """
    
    def create_keyboard_ee_control(self,  kp: float = 0.5,
                                  xy_step: float = 0.004, joint_step: int = 1, pitch_step: float = 1.0,
                                  initial_x: float = 0.1629, initial_y: float = 0.1131,
                                  l1: float = 0.1159, l2: float = 0.1350) -> tuple:
        """Create keyboard end-effector control system"""
        
        try:
            keyboard_config = KeyboardTeleopConfig()
            keyboard_instance = KeyboardTeleop(keyboard_config)
            keyboard_instance.connect()

            # Joint calibration coefficients - manually edited
            # Format: [joint_name, zero_position_offset(degrees), scale_factor]
            JOINT_CALIBRATION = [
                ['shoulder_pan', 6.0, 1.0],      # Joint 1: zero position offset, scale factor
                ['shoulder_lift', 2.0, 0.97],     # Joint 2: zero position offset, scale factor
                ['elbow_flex', 0.0, 1.05],        # Joint 3: zero position offset, scale factor
                ['wrist_flex', 0.0, 0.94],        # Joint 4: zero position offset, scale factor
                ['wrist_roll', 0.0, 0.5],        # Joint 5: zero position offset, scale factor
                ['gripper', 0.0, 1.0],           # Joint 6: zero position offset, scale factor
            ]
            
            def apply_joint_calibration(joint_name, raw_position):
                """Apply joint calibration coefficients"""
                for joint_cal in JOINT_CALIBRATION:
                    if joint_cal[0] == joint_name:
                        offset = joint_cal[1]  # zero position offset
                        scale = joint_cal[2]   # scale factor
                        calibrated_position = (raw_position - offset) * scale
                        return calibrated_position
                return raw_position  # if no calibration coefficient found, return original value
            
            def inverse_kinematics(x, y, l1=l1, l2=l2):
                """Calculate inverse kinematics for a 2-link robotic arm"""
                # Calculate joint2 and joint3 offsets in theta1 and theta2
                theta1_offset = math.atan2(0.028, 0.11257)  # theta1 offset when joint2=0
                theta2_offset = math.atan2(0.0052, 0.1349) + theta1_offset  # theta2 offset when joint3=0
                
                # Calculate distance from origin to target point
                r = math.sqrt(x**2 + y**2)
                r_max = l1 + l2  # Maximum reachable distance
                
                # If target point is beyond maximum workspace, scale it to the boundary
                if r > r_max:
                    scale_factor = r_max / r
                    x *= scale_factor
                    y *= scale_factor
                    r = r_max
                
                # If target point is less than minimum workspace (|l1-l2|), scale it
                r_min = abs(l1 - l2)
                if r < r_min and r > 0:
                    scale_factor = r_min / r
                    x *= scale_factor
                    y *= scale_factor
                    r = r_min
                
                # Use law of cosines to calculate theta2
                cos_theta2 = -(r**2 - l1**2 - l2**2) / (2 * l1 * l2)
                
                # Calculate theta2 (elbow angle)
                theta2 = math.pi - math.acos(cos_theta2)
                
                # Calculate theta1 (shoulder angle)
                beta = math.atan2(y, x)
                gamma = math.atan2(l2 * math.sin(theta2), l1 + l2 * math.cos(theta2))
                theta1 = beta + gamma
                
                # Convert theta1 and theta2 to joint2 and joint3 angles
                joint2 = theta1 + theta1_offset
                joint3 = theta2 + theta2_offset
                
                # Ensure angles are within URDF limits
                joint2 = max(-0.1, min(3.45, joint2))
                joint3 = max(-0.2, min(math.pi, joint3))
                
                # Convert from radians to degrees
                joint2_deg = math.degrees(joint2)
                joint3_deg = math.degrees(joint3)

                joint2_deg = 90-joint2_deg
                joint3_deg = joint3_deg-90
                
                return joint2_deg, joint3_deg
            
            # Initialize control state
            current_x, current_y = initial_x, initial_y
            pitch = 0.0  # Initial pitch adjustment
            
            # Initialize target positions
            target_positions = {
                'shoulder_pan': 0.0,
                'shoulder_lift': 0.0,
                'elbow_flex': 0.0,
                'wrist_flex': 0.0,
                'wrist_roll': 0.0,
                'gripper': 0.0
            }
            
            # Joint control mapping
            joint_controls = {
                'q': ('shoulder_pan', -joint_step),    # Joint 1 decrease
                'a': ('shoulder_pan', joint_step),     # Joint 1 increase
                't': ('wrist_roll', -joint_step),      # Joint 5 decrease
                'g': ('wrist_roll', joint_step),       # Joint 5 increase
                'y': ('gripper', -joint_step),         # Joint 6 decrease
                'h': ('gripper', joint_step),          # Joint 6 increase
            }
            
            # x,y coordinate control
            xy_controls = {
                'w': ('x', -xy_step),  # x decrease
                's': ('x', xy_step),   # x increase
                'e': ('y', -xy_step),  # y decrease
                'd': ('y', xy_step),   # y increase
            }
            
            def init_action(robot_instance):
                """Initialize robot to zero position and setup initial state"""
                print("Initializing robot to zero position...")
                
                # Read initial joint angles
                print("Reading initial joint angles...")
                start_obs = robot_instance.get_observation()
                start_positions = {}
                for key, value in start_obs.items():
                    if key.endswith('.pos'):
                        motor_name = key.removesuffix('.pos')
                        start_positions[motor_name] = int(value)  # Don't apply calibration coefficients
                
                print("Initial joint angles:")
                for joint_name, position in start_positions.items():
                    print(f"  {joint_name}: {position}°")
                
                # Move to zero position using P control
                print("Using P control to slowly move robot to zero position...")
                
                # Zero position targets
                zero_positions = {
                    'shoulder_pan': 0.0,
                    'shoulder_lift': 0.0,
                    'elbow_flex': 0.0,
                    'wrist_flex': 0.0,
                    'wrist_roll': 0.0,
                    'gripper': 0.0
                }
                
                # Calculate control steps
                control_freq = 50  # 50Hz control frequency
                duration = 3.0  # 3 seconds to move to zero
                total_steps = int(duration * control_freq)
                step_time = 1.0 / control_freq
                
                print(f"Will use P control to move to zero position in {duration} seconds, control frequency: {control_freq}Hz, proportional gain: {kp}")
                
                for step in range(total_steps):
                    # Get current robot state
                    current_obs = robot_instance.get_observation()
                    current_positions = {}
                    for key, value in current_obs.items():
                        if key.endswith('.pos'):
                            motor_name = key.removesuffix('.pos')
                            # Apply calibration coefficients
                            calibrated_value = apply_joint_calibration(motor_name, value)
                            current_positions[motor_name] = calibrated_value
                    
                    # P control calculation
                    robot_action = {}
                    for joint_name, target_pos in zero_positions.items():
                        if joint_name in current_positions:
                            current_pos = current_positions[joint_name]
                            error = target_pos - current_pos
                            
                            # P control: output = Kp * error
                            control_output = kp * error
                            
                            # Convert control output to position command
                            new_position = current_pos + control_output
                            robot_action[f"{joint_name}.pos"] = new_position
                    
                    # Send action to robot
                    if robot_action:
                        robot_instance.send_action(robot_action)
                    
                    # Show progress
                    if step % (control_freq // 2) == 0:  # Show progress every 0.5 seconds
                        progress = (step / total_steps) * 100
                        print(f"Moving to zero position progress: {progress:.1f}%")
                    
                    time.sleep(step_time)
                
                print("Robot has moved to zero position")
                
                # Initialize target positions as zero positions
                target_positions.update(zero_positions)
                
                # Initialize x,y coordinate control
                print(f"Initialize end effector position: x={current_x:.4f}, y={current_y:.4f}")
                
                # Calculate initial joint2 and joint3 from initial x,y
                joint2_target, joint3_target = inverse_kinematics(current_x, current_y)
                target_positions['shoulder_lift'] = joint2_target
                target_positions['elbow_flex'] = joint3_target
                
                print("Keyboard control instructions:")
                print("- Q/A: Joint 1 (shoulder_pan) decrease/increase")
                print("- W/S: Control end effector x coordinate (joint2+3)")
                print("- E/D: Control end effector y coordinate (joint2+3)")
                print("- R/F: Pitch adjustment increase/decrease (affects wrist_flex)")
                print("- T/G: Joint 5 (wrist_roll) decrease/increase")
                print("- Y/H: Joint 6 (gripper) decrease/increase")
                print("="*50)
                print("Note: Robot will continuously move to target positions")
                
                return {
                    "target_positions": target_positions,
                    "current_x": current_x,
                    "current_y": current_y,
                    "pitch": pitch,
                }
            
            def generate_action(action_state, robot_instance, observations):
                """Generate actions based on keyboard input and current observations"""
                # Get keyboard input
                keyboard_action = keyboard_instance.get_action() 
                current_x = action_state["current_x"]
                current_y = action_state["current_y"]
                pitch = action_state["pitch"]
                target_positions = action_state["target_positions"]
                
                if keyboard_action:
                    # Process keyboard input, update target positions
                    for key, value in keyboard_action.items():
                        # Pitch control
                        if key == 'r':
                            pitch += pitch_step
                            print(f"Increase pitch adjustment: {pitch:.3f}")
                        elif key == 'f':
                            pitch -= pitch_step
                            print(f"Decrease pitch adjustment: {pitch:.3f}")
                        
                        # Joint control
                        if key in joint_controls:
                            joint_name, delta = joint_controls[key]
                            if joint_name in target_positions:
                                current_target = target_positions[joint_name]
                                new_target = int(current_target + delta)
                                target_positions[joint_name] = new_target
                                print(f"Update target position {joint_name}: {current_target} -> {new_target}")
                        
                        # x,y coordinate control
                        elif key in xy_controls:
                            coord, delta = xy_controls[key]
                            if coord == 'x':
                                current_x += delta
                                # Calculate target angles for joint2 and joint3
                                joint2_target, joint3_target = inverse_kinematics(current_x, current_y)
                                target_positions['shoulder_lift'] = joint2_target
                                target_positions['elbow_flex'] = joint3_target
                                print(f"Update x coordinate: {current_x:.4f}, joint2={joint2_target:.3f}, joint3={joint3_target:.3f}")
                            elif coord == 'y':
                                current_y += delta
                                # Calculate target angles for joint2 and joint3
                                joint2_target, joint3_target = inverse_kinematics(current_x, current_y)
                                target_positions['shoulder_lift'] = joint2_target
                                target_positions['elbow_flex'] = joint3_target
                                print(f"Update y coordinate: {current_y:.4f}, joint2={joint2_target:.3f}, joint3={joint3_target:.3f}")
                
                # Apply pitch adjustment to wrist_flex
                # Calculate wrist_flex target position based on shoulder_lift and elbow_flex
                if 'shoulder_lift' in target_positions and 'elbow_flex' in target_positions:
                    target_positions['wrist_flex'] = - target_positions['shoulder_lift'] - target_positions['elbow_flex'] + pitch
                
                # Extract current joint positions from observations
                current_positions = {}
                for key, value in observations.items():
                    if key.endswith('.pos'):
                        motor_name = key.removesuffix('.pos')
                        # Apply calibration coefficients
                        calibrated_value = apply_joint_calibration(motor_name, value)
                        current_positions[motor_name] = calibrated_value
                
                # P control calculation
                robot_action = {}
                for joint_name, target_pos in target_positions.items():
                    if joint_name in current_positions:
                        current_pos = current_positions[joint_name]
                        error = target_pos - current_pos
                        
                        # P control: output = Kp * error
                        control_output = kp * error
                        
                        # Convert control output to position command
                        new_position = current_pos + control_output
                        robot_action[f"{joint_name}.pos"] = new_position
                
                return robot_action,  {
                    "target_positions": target_positions,
                    "current_x": current_x,
                    "current_y": current_y,
                    "pitch": pitch,
                }
            
            
            
            rt_update = {
                "status": "initialized",
                "kp": kp,
                "initial_x": initial_x,
                "initial_y": initial_y
            }
            
            return ({"init_action": init_action, "generate_action": generate_action},), rt_update
            
        except Exception as e:
            rt_update = {"error": f"Failed to create keyboard EE control: {str(e)}\n{traceback.format_exc()}"}
            return (None, None, None), rt_update


# Export the nodes
NODE_CLASS_MAPPINGS = {
    "So100KeyboardEEControlNode": So100KeyboardEEControlNode,
}