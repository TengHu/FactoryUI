#!/usr/bin/env python3
"""
Test script for motor position to angle conversion
"""

def positions_to_angles(positions):
    """Convert motor positions to joint angles"""
    
    # Define joint names in order corresponding to servo IDs 1-6
    joint_names = ['Rotation', 'Pitch', 'Elbow', 'Wrist_Pitch', 'Wrist_Roll', 'Jaw']
    
    if not positions:
        raise ValueError("No positions provided")
    
    # Convert positions to angles
    angles = {}
    for i, joint_name in enumerate(joint_names):
        servo_id = i + 1  # Servo IDs are 1-based
        if servo_id in positions:
            # Convert servo position (0-4095) to angle (0-360 degrees)
            position = positions[servo_id]
            angle = (position / 4095.0) * 360.0
            angles[joint_name] = round(angle, 1)  # Round to 1 decimal place
        else:
            print(f"Warning: No position data for servo {servo_id} ({joint_name})")
            angles[joint_name] = 0.0
    
    return angles

# Test with your motor data
positions = {1: 1510, 2: 1029, 3: 3010, 4: 967, 5: 638, 6: 2039}

print("Input motor positions:")
print(f"  Positions: {positions}")
print()

# Convert to angles
angles = positions_to_angles(positions)

print("Converted joint angles:")
for joint_name, angle in angles.items():
    print(f"  {joint_name}: {angle}°")

print()
print("Summary:")
print(f"  Rotation: {angles['Rotation']}°")
print(f"  Pitch: {angles['Pitch']}°")
print(f"  Elbow: {angles['Elbow']}°")
print(f"  Wrist_Pitch: {angles['Wrist_Pitch']}°")
print(f"  Wrist_Roll: {angles['Wrist_Roll']}°")
print(f"  Jaw: {angles['Jaw']}°") 