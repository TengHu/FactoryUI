#!/usr/bin/env python3
"""Test frontend WebSocket integration"""

import asyncio
import websockets
import json
import time

async def simulate_robot_streaming():
    """Simulate robot status streaming for frontend testing"""
    uri = "ws://localhost:8000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected - simulating robot status streaming...")
            
            # Simulate streaming robot status updates
            node_id = "robot-reader-test"
            
            for i in range(10):
                # Simulate robot status data
                mock_status = {
                    "positions": {
                        "1": 1000 + i * 100,
                        "2": 2000 + i * 50,
                        "3": 1500 + i * 75,
                        "4": 3000 + i * 25,
                        "5": 800 + i * 200
                    },
                    "servo_ids": [1, 2, 3, 4, 5],
                    "timestamp": time.time(),
                    "connected": True,
                    "stream_count": i + 1
                }
                
                # Send robot status stream message
                stream_message = {
                    "type": "robot_status_stream",
                    "timestamp": time.time(),
                    "data": {
                        "node_id": node_id,
                        "status": mock_status,
                        "stream_update": True
                    }
                }
                
                await websocket.send(json.dumps(stream_message))
                print(f"📤 Sent robot status stream update {i+1}/10")
                
                # Wait 0.5 seconds between updates
                await asyncio.sleep(0.5)
            
            # Send stream complete message
            complete_message = {
                "type": "robot_status_stream",
                "timestamp": time.time(),
                "data": {
                    "node_id": node_id,
                    "status": mock_status,
                    "stream_complete": True,
                    "total_updates": 10
                }
            }
            
            await websocket.send(json.dumps(complete_message))
            print("✅ Sent stream complete message")
            
            print("🎉 Robot streaming simulation completed!")
            
    except Exception as e:
        print(f"❌ Simulation failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🤖 Starting robot status streaming simulation...")
    print("📱 Open the frontend at http://localhost:3000 to see live updates!")
    print("💡 Create a RobotStatusReader node in the UI to see the streaming data")
    print()
    
    success = asyncio.run(simulate_robot_streaming())
    if success:
        print("🎉 Simulation completed successfully!")
    else:
        print("💥 Simulation failed!")