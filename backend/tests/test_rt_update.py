#!/usr/bin/env python3
"""Test real-time update (rt_update) display in frontend"""

import asyncio
import websockets
import json
import time

async def test_rt_update_display():
    """Test that rt_update data is displayed in frontend nodes"""
    
    print("🔄 Testing Real-Time Update Display")
    print("=" * 50)
    print("📋 This test sends node state updates with rt_update data")
    print("💡 Create a node in the UI and watch for the 'Real-Time Update' section")
    print()
    
    # Get node ID from user
    test_node_id = input("Enter a node ID from your UI (or press Enter for demo): ").strip()
    if not test_node_id:
        test_node_id = "DemoNode-12345"
        print(f"Using demo node ID: {test_node_id}")
    
    uri = "ws://localhost:8000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected")
            
            # Test different types of rt_update data
            test_cases = [
                {
                    "state": "executing",
                    "rt_update": "Starting process...",
                    "description": "Simple text rt_update"
                },
                {
                    "state": "executing", 
                    "rt_update": {
                        "progress": 0.25,
                        "current_step": "Processing data",
                        "items_processed": 250,
                        "total_items": 1000
                    },
                    "description": "Object rt_update with progress data"
                },
                {
                    "state": "executing",
                    "rt_update": {
                        "servo_positions": {"1": 1024, "2": 2048, "3": 1500},
                        "temperature": 45.6,
                        "status": "operational"
                    },
                    "description": "Robot sensor data rt_update"
                },
                {
                    "state": "completed",
                    "rt_update": {
                        "result": "Success!",
                        "execution_time": 3.45,
                        "output_file": "/path/to/result.json",
                        "final_status": "All operations completed successfully"
                    },
                    "description": "Completion data rt_update"
                }
            ]
            
            print(f"\n🎯 Sending rt_update data for node: {test_node_id}")
            print("📱 Watch the node in the UI for 'Real-Time Update' section")
            
            for i, test_case in enumerate(test_cases):
                print(f"\n📤 Test {i+1}/4: {test_case['description']}")
                
                node_state_message = {
                    "type": "node_state",
                    "timestamp": time.time(),
                    "data": {
                        "node_id": test_node_id,
                        "state": test_case["state"],
                        "data": {
                            "rt_update": test_case["rt_update"],
                            "test_case": i + 1,
                            "description": test_case["description"]
                        }
                    }
                }
                
                await websocket.send(json.dumps(node_state_message))
                print(f"   Sent {test_case['state']} state with rt_update")
                
                # Wait so you can see each update
                await asyncio.sleep(3)
            
            print("\n✅ All rt_update tests sent!")
            print("\n🔍 Expected UI changes:")
            print("   1. 'Real-Time Update' section appears in the node")
            print("   2. Header shows 'REAL-TIME UPDATE' + state badge")
            print("   3. Content shows the rt_update data (text or JSON)")
            print("   4. Timestamp shows when last updated")
            print("\n💡 The rt_update section only appears when rt_update data is present")
            
            return True
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_rt_update_display())
    exit(0 if success else 1)