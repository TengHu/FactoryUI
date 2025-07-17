#!/usr/bin/env python3
"""Test RobotStatusReader node streaming functionality"""

import asyncio
import websockets
import json
import time
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from custom_nodes.so101_nodes import RobotStatusReader
from websocket_manager import websocket_manager

class MockScsServoSDK:
    """Mock SDK for testing without real hardware"""
    
    def __init__(self):
        self.connected = True
        self.call_count = 0
    
    def sync_read_positions(self, servo_ids):
        """Mock position reading"""
        self.call_count += 1
        # Simulate changing positions
        base_positions = {1: 1000, 2: 2000, 3: 1500, 4: 3000, 5: 800}
        return {servo_id: base_positions.get(servo_id, 0) + self.call_count * 10 
                for servo_id in servo_ids}
    
    def read_mode(self, servo_id):
        """Mock mode reading"""
        return "servo_mode" if servo_id <= 3 else "wheel_mode"

async def test_robot_node_streaming():
    """Test RobotStatusReader node streaming capabilities"""
    
    print("🤖 Testing RobotStatusReader node streaming functionality...")
    
    # Test 1: Basic node instantiation
    try:
        robot_reader = RobotStatusReader()
        print("✅ Test 1: RobotStatusReader node created successfully")
    except Exception as e:
        print(f"❌ Test 1 failed: {e}")
        return False
    
    # Test 2: Input types validation
    try:
        input_types = robot_reader.INPUT_TYPES()
        required_inputs = input_types["required"]
        optional_inputs = input_types["optional"]
        
        assert "sdk" in required_inputs
        assert "servo_ids" in required_inputs
        assert "stream_results" in optional_inputs
        assert "update_interval" in optional_inputs
        
        print("✅ Test 2: Input types validation passed")
    except Exception as e:
        print(f"❌ Test 2 failed: {e}")
        return False
    
    # Test 3: Non-streaming mode (fallback)
    try:
        mock_sdk = MockScsServoSDK()
        
        # Test without WebSocket manager (should use single read)
        result = robot_reader.read_robot_status(
            sdk=mock_sdk,
            servo_ids="1,2,3",
            read_positions=True,
            read_modes=False,
            stream_results=False,
            update_interval=0.1
        )
        
        status_data, positions = result
        assert status_data["connected"] == True
        assert len(positions) == 3
        assert 1 in positions
        assert 2 in positions
        assert 3 in positions
        
        print("✅ Test 3: Non-streaming mode works correctly")
    except Exception as e:
        print(f"❌ Test 3 failed: {e}")
        return False
    
    # Test 4: Mock streaming mode
    try:
        # Mock WebSocket manager
        class MockWebSocketManager:
            def __init__(self):
                self.messages = []
            
            async def broadcast(self, message):
                self.messages.append(message)
                print(f"📤 Mock broadcast: {message['type']}")
        
        mock_ws_manager = MockWebSocketManager()
        
        # Set up node with WebSocket manager
        robot_reader._websocket_manager = mock_ws_manager
        robot_reader._node_id = "test-robot-reader"
        
        # Test streaming mode (should collect broadcasts)
        result = robot_reader.read_robot_status(
            sdk=mock_sdk,
            servo_ids="1,2,3,4,5",
            read_positions=True,
            read_modes=True,
            stream_results=True,
            update_interval=0.01  # Fast updates for testing
        )
        
        status_data, positions = result
        assert status_data["connected"] == True
        assert len(positions) == 5
        assert mock_ws_manager.messages  # Should have broadcast messages
        
        print(f"✅ Test 4: Streaming mode works - {len(mock_ws_manager.messages)} broadcasts sent")
    except Exception as e:
        print(f"❌ Test 4 failed: {e}")
        return False
    
    # Test 5: Error handling
    try:
        class FailingSdk:
            def sync_read_positions(self, servo_ids):
                raise Exception("Mock connection error")
        
        failing_sdk = FailingSdk()
        
        try:
            robot_reader.read_robot_status(
                sdk=failing_sdk,
                servo_ids="1,2,3",
                read_positions=True,
                stream_results=False
            )
            print("❌ Test 5 failed: Should have raised exception")
            return False
        except Exception as e:
            if "Robot status read failed" in str(e):
                print("✅ Test 5: Error handling works correctly")
            else:
                print(f"❌ Test 5 failed: Unexpected error: {e}")
                return False
    except Exception as e:
        print(f"❌ Test 5 failed: {e}")
        return False
    
    # Test 6: Input validation
    try:
        mock_sdk = MockScsServoSDK()
        
        try:
            robot_reader.read_robot_status(
                sdk=mock_sdk,
                servo_ids="invalid,servo,ids",
                stream_results=False
            )
            print("❌ Test 6 failed: Should have raised ValueError")
            return False
        except ValueError as e:
            if "Invalid servo_ids format" in str(e):
                print("✅ Test 6: Input validation works correctly")
            else:
                print(f"❌ Test 6 failed: Unexpected error: {e}")
                return False
    except Exception as e:
        print(f"❌ Test 6 failed: {e}")
        return False
    
    print("🎉 All RobotStatusReader node tests passed!")
    return True

async def test_websocket_robot_streaming():
    """Test robot streaming over actual WebSocket connection"""
    
    print("\n🔗 Testing robot streaming over WebSocket...")
    
    uri = "ws://localhost:8000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected for robot streaming test")
            
            # Subscribe to robot status stream events
            subscribe_message = {
                "type": "subscribe",
                "events": ["robot_status_stream"]
            }
            await websocket.send(json.dumps(subscribe_message))
            
            # Listen for a few seconds to catch any existing streams
            print("👂 Listening for robot status streams...")
            
            received_messages = []
            start_time = time.time()
            
            while (time.time() - start_time) < 5:  # Listen for 5 seconds
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    message = json.loads(response)
                    received_messages.append(message)
                    
                    if message.get("type") == "robot_status_stream":
                        data = message.get("data", {})
                        print(f"🤖 Received robot stream from node: {data.get('node_id')}")
                        
                        if data.get("stream_update"):
                            status = data.get("status", {})
                            print(f"   📊 Positions: {status.get('positions', {})}")
                            print(f"   🔗 Connected: {status.get('connected', False)}")
                    
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"❌ Error receiving message: {e}")
                    break
            
            print(f"📊 Received {len(received_messages)} total messages")
            
            # Test sending a mock robot status stream
            mock_stream = {
                "type": "robot_status_stream",
                "timestamp": time.time(),
                "data": {
                    "node_id": "test-robot-node",
                    "status": {
                        "positions": {1: 1000, 2: 2000, 3: 1500},
                        "connected": True,
                        "timestamp": time.time(),
                        "stream_count": 1
                    },
                    "stream_update": True
                }
            }
            
            await websocket.send(json.dumps(mock_stream))
            print("📤 Sent mock robot status stream")
            
            print("✅ WebSocket robot streaming test completed")
            return True
            
    except Exception as e:
        print(f"❌ WebSocket robot streaming test failed: {e}")
        return False

async def run_all_tests():
    """Run all robot streaming tests"""
    
    print("🧪 Starting Robot Status Streaming Test Suite")
    print("=" * 50)
    
    # Test 1: Node functionality
    test1_result = await test_robot_node_streaming()
    
    # Test 2: WebSocket integration  
    test2_result = await test_websocket_robot_streaming()
    
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    print(f"   Node Functionality: {'✅ PASS' if test1_result else '❌ FAIL'}")
    print(f"   WebSocket Integration: {'✅ PASS' if test2_result else '❌ FAIL'}")
    
    overall_success = test1_result and test2_result
    print(f"\n🎯 Overall Result: {'🎉 ALL TESTS PASSED' if overall_success else '💥 SOME TESTS FAILED'}")
    
    return overall_success

if __name__ == "__main__":
    print("🤖 RobotStatusReader Streaming Test Suite")
    print("📋 This test validates robot status streaming functionality")
    print("🔧 Ensure backend server is running: python run_server.py")
    print()
    
    success = asyncio.run(run_all_tests())
    
    if success:
        print("\n🎉 All robot streaming tests completed successfully!")
        print("💡 The RobotStatusReader node is ready for real-time streaming!")
    else:
        print("\n💥 Some tests failed!")
        print("🔍 Check the error messages above for debugging information")
    
    exit(0 if success else 1)