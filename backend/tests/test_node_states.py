#!/usr/bin/env python3
"""Test node state updates via WebSocket"""

import asyncio
import websockets
import json
import time

async def test_node_state_updates():
    """Test that node state updates are sent correctly"""
    
    print("🧪 Testing Node State Updates")
    print("=" * 50)
    
    uri = "ws://localhost:8000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected")
            
            # Subscribe to node_state events
            subscribe_message = {
                "type": "subscribe",
                "events": ["node_state"]
            }
            await websocket.send(json.dumps(subscribe_message))
            print("📤 Subscribed to node_state events")
            
            # Simulate node state changes
            node_id = "TestNode-12345"
            
            states = [
                ("idle", {"message": "Node initialized"}),
                ("executing", {"start_time": time.time()}),
                ("completed", {"result": "Success!", "execution_time": 1.23}),
                ("error", {"error": "Test error message"})
            ]
            
            print("\n🔄 Simulating node state changes...")
            
            for state, data in states:
                # Simulate backend sending node state update
                node_state_message = {
                    "type": "node_state",
                    "timestamp": time.time(),
                    "data": {
                        "node_id": node_id,
                        "state": state,
                        "data": data
                    }
                }
                
                await websocket.send(json.dumps(node_state_message))
                print(f"📤 Sent node state: {state}")
                
                # Small delay between state changes
                await asyncio.sleep(0.5)
            
            print("\n✅ All node state updates sent!")
            print("📱 Check the frontend to see if nodes update their visual state")
            print("🔍 Look for CSS classes: .node-idle, .node-executing, .node-completed, .node-error")
            
            return True
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_node_state_updates())
    exit(0 if success else 1)