#!/usr/bin/env python3
"""Test script for Ngrok WebSocket nodes"""

import asyncio
import websockets
import json
import time
import threading
from custom_nodes.basic_nodes import NgrokWebSocketSenderNode, NgrokWebSocketReceiverNode

def test_ngrok_websocket_nodes():
    """Test the ngrok websocket sender and receiver nodes"""
    
    print("🧪 Testing Ngrok WebSocket Nodes")
    print("=" * 50)
    
    # Create node instances
    sender = NgrokWebSocketSenderNode()
    receiver = NgrokWebSocketReceiverNode()
    
    # Test receiver first (start server)
    print("\n1. Starting WebSocket Receiver Server...")
    received_data, message_count, server_status = receiver.receive_websocket(8765, True)
    print(f"   Server Status: {server_status}")
    print(f"   Message Count: {message_count}")
    
    # Wait a moment for server to start
    time.sleep(2)
    
    # Test sender (connect to local server for testing)
    print("\n2. Testing WebSocket Sender...")
    test_data = {
        "message": "Hello from Factory UI!",
        "timestamp": time.time(),
        "node_id": "test-sender-123"
    }
    
    success, message = sender.send_websocket(
        data=test_data,
        ngrok_url="ws://localhost:8765",  # Connect to local server for testing
        message_type="test_message"
    )
    
    print(f"   Success: {success}")
    print(f"   Message: {message}")
    
    # Wait a moment for message to be received
    time.sleep(1)
    
    # Check receiver for new messages
    print("\n3. Checking Receiver for Messages...")
    received_data, message_count, server_status = receiver.receive_websocket(8765, False)
    print(f"   Server Status: {server_status}")
    print(f"   Message Count: {message_count}")
    
    if received_data and "messages" in received_data:
        print(f"   Messages: {len(received_data['messages'])}")
        if received_data['messages']:
            latest = received_data['messages'][-1]
            print(f"   Latest Message Type: {latest.get('type', 'unknown')}")
            print(f"   Latest Message Data: {latest.get('data', {})}")
    
    print("\n✅ Ngrok WebSocket Nodes Test Complete!")
    print("\n📋 Usage Instructions:")
    print("1. Use NgrokWebSocketReceiverNode to start a server on port 8765")
    print("2. Run 'ngrok http 8765' to expose the server")
    print("3. Use the ngrok URL with NgrokWebSocketSenderNode to send data")
    print("4. External clients can connect to the ngrok URL to send/receive data")

def test_external_client():
    """Test connecting as an external client to the receiver"""
    
    print("\n🌐 Testing External Client Connection")
    print("=" * 50)
    
    async def connect_and_send():
        uri = "ws://localhost:8765"
        
        try:
            async with websockets.connect(uri) as websocket:
                print("✅ Connected to WebSocket server")
                
                # Send a test message
                test_message = {
                    "type": "external_client",
                    "data": {
                        "client_id": "test-client-456",
                        "message": "Hello from external client!",
                        "timestamp": time.time()
                    }
                }
                
                await websocket.send(json.dumps(test_message))
                print("📤 Sent test message")
                
                # Wait for acknowledgment
                response = await websocket.recv()
                print(f"📥 Received response: {response}")
                
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
    
    # Run the async function
    asyncio.run(connect_and_send())

if __name__ == "__main__":
    # Test the nodes
    test_ngrok_websocket_nodes()
    
    # Test external client connection
    test_external_client() 