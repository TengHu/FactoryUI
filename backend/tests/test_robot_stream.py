#!/usr/bin/env python3
"""Test robot status streaming functionality"""

import asyncio
import websockets
import json
import time

async def test_robot_streaming():
    uri = "ws://localhost:8000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully!")
            
            # Subscribe to robot status stream events
            subscribe_message = {
                "type": "subscribe",
                "events": ["robot_status_stream", "node_state", "continuous_update"]
            }
            await websocket.send(json.dumps(subscribe_message))
            print("📤 Subscribed to robot status stream events")
            
            # Create a test workflow with RobotStatusReader
            # Note: This is a mock workflow - in real usage, you'd need a proper ScsServoSDK connection
            test_workflow = {
                "nodes": [
                    {
                        "id": "robot-reader-1",
                        "type": "RobotStatusReader",
                        "data": {
                            "nodeInfo": {
                                "name": "RobotStatusReader",
                                "input_types": {
                                    "required": {
                                        "sdk": ["ScsServoSDK", {}],
                                        "servo_ids": ["STRING", {"default": "1,2,3,4,5"}]
                                    },
                                    "optional": {
                                        "read_positions": ["BOOLEAN", {"default": True}],
                                        "read_modes": ["BOOLEAN", {"default": False}],
                                        "stream_results": ["BOOLEAN", {"default": True}],
                                        "update_interval": ["FLOAT", {"default": 0.1}]
                                    }
                                },
                                "return_types": {
                                    "required": {
                                        "status_data": ["DICT", {}],
                                        "positions": ["DICT", {}]
                                    }
                                }
                            },
                            "parameters": {
                                "servo_ids": "1,2,3,4,5",
                                "read_positions": True,
                                "read_modes": False,
                                "stream_results": True,
                                "update_interval": 0.1
                            }
                        }
                    }
                ],
                "edges": [],
                "metadata": {
                    "name": "robot-stream-test",
                    "created": "2025-01-01T00:00:00Z",
                    "version": "1.0.0"
                },
                "sleep_time": 0.5
            }
            
            print("📤 Starting continuous execution with robot streaming...")
            
            # Start continuous execution
            start_message = {
                "type": "start_continuous",
                "workflow": test_workflow
            }
            # Note: We can't actually start execution via WebSocket - this would need to be done via HTTP API
            # But we can listen for streaming events
            
            print("👂 Listening for robot status stream events...")
            
            # Listen for streaming events for 30 seconds
            start_time = time.time()
            message_count = 0
            
            while (time.time() - start_time) < 30:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    message = json.loads(response)
                    message_count += 1
                    
                    if message.get("type") == "robot_status_stream":
                        print(f"🤖 Robot status stream #{message_count}:")
                        data = message.get("data", {})
                        if data.get("stream_update"):
                            print(f"   📡 Live update from node {data.get('node_id')}")
                            status = data.get("status", {})
                            if status.get("positions"):
                                print(f"   🔧 Positions: {status['positions']}")
                            if status.get("connected"):
                                print(f"   🟢 Connected: {status['connected']}")
                            if status.get("stream_count"):
                                print(f"   📊 Stream count: {status['stream_count']}")
                        elif data.get("stream_complete"):
                            print(f"   ✅ Stream completed for node {data.get('node_id')}")
                        elif data.get("stream_error"):
                            print(f"   ❌ Stream error for node {data.get('node_id')}: {data.get('error')}")
                    
                    elif message.get("type") == "node_state":
                        print(f"🎯 Node state update: {message.get('data', {}).get('node_id')} -> {message.get('data', {}).get('state')}")
                    
                    elif message.get("type") == "continuous_update":
                        print(f"🔄 Continuous update: {message.get('data', {}).get('status')} (count: {message.get('data', {}).get('execution_count')})")
                    
                    else:
                        print(f"📥 Other message: {message.get('type')}")
                    
                except asyncio.TimeoutError:
                    # No message received in 1 second, continue listening
                    continue
                except Exception as e:
                    print(f"❌ Error receiving message: {e}")
                    break
            
            print(f"📊 Test completed. Received {message_count} messages in 30 seconds.")
            
    except Exception as e:
        print(f"❌ WebSocket connection failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_robot_streaming())
    if success:
        print("🎉 Robot streaming test completed!")
    else:
        print("💥 Robot streaming test failed!")