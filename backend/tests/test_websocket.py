#!/usr/bin/env python3
"""Test WebSocket connection to Factory UI backend"""

import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:8000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully!")
            
            # Send a ping message
            ping_message = {
                "type": "ping",
                "timestamp": 1234567890
            }
            await websocket.send(json.dumps(ping_message))
            print("📤 Sent ping message")
            
            # Wait for response
            response = await websocket.recv()
            print(f"📥 Received response: {response}")
            
            # Send status request
            status_request = {
                "type": "get_status"
            }
            await websocket.send(json.dumps(status_request))
            print("📤 Sent status request")
            
            # Wait for status response
            status_response = await websocket.recv()
            print(f"📥 Received status: {status_response}")
            
    except Exception as e:
        print(f"❌ WebSocket connection failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_websocket())
    if success:
        print("🎉 WebSocket test completed successfully!")
    else:
        print("💥 WebSocket test failed!")