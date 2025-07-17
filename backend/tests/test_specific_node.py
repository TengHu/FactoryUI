#!/usr/bin/env python3
"""Test node state updates for a specific node ID"""

import asyncio
import websockets
import json
import time

async def test_specific_node_state():
    """Test node state updates for a specific node that should exist in UI"""
    
    print("🧪 Testing Specific Node State Updates")
    print("=" * 50)
    print("📋 This test sends node state updates for a specific node ID")
    print("💡 Create a node in the UI and copy its ID, then update this script")
    print()
    
    # You'll need to replace this with an actual node ID from your UI
    # Example: "RobotStatusReader-1710123456789"
    test_node_id = input("Enter a node ID from your UI (or press Enter for default): ").strip()
    if not test_node_id:
        test_node_id = "RobotStatusReader-1710123456789"  # Default example
    
    uri = "ws://localhost:8000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected")
            
            # Send node state updates for the specific node
            states = ["idle", "executing", "completed", "error"]
            
            print(f"\n🎯 Sending node state updates for: {test_node_id}")
            print("📱 Watch the node in the UI for visual changes")
            
            for i, state in enumerate(states):
                node_state_message = {
                    "type": "node_state", 
                    "timestamp": time.time(),
                    "data": {
                        "node_id": test_node_id,
                        "state": state,
                        "data": {
                            "step": i + 1,
                            "message": f"Testing {state} state",
                            "timestamp": time.time()
                        }
                    }
                }
                
                await websocket.send(json.dumps(node_state_message))
                print(f"📤 {i+1}/4: Sent {state} state")
                
                # Wait 2 seconds between state changes so you can see the visual changes
                await asyncio.sleep(2)
            
            print("\n✅ All node state updates sent!")
            print("🔍 Expected visual changes:")
            print("   - idle: default appearance")
            print("   - executing: orange border + pulsing animation")
            print("   - completed: green border + flash animation")
            print("   - error: red border + shake animation")
            
            return True
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_specific_node_state())
    exit(0 if success else 1)