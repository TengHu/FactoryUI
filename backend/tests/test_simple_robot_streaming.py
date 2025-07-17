#!/usr/bin/env python3
"""Simple test for RobotStatusReader streaming functionality"""

import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from custom_nodes.so101_nodes import RobotStatusReader

class MockScsServoSDK:
    """Mock SDK for testing without real hardware"""
    
    def __init__(self):
        self.connected = True
        self.call_count = 0
    
    def sync_read_positions(self, servo_ids):
        """Mock position reading"""
        self.call_count += 1
        return {servo_id: 1000 + servo_id * 100 + self.call_count 
                for servo_id in servo_ids}
    
    def read_mode(self, servo_id):
        """Mock mode reading"""
        return "servo_mode"

def test_basic_robot_functionality():
    """Test basic RobotStatusReader functionality"""
    
    print("🧪 Testing RobotStatusReader Basic Functionality")
    print("=" * 50)
    
    try:
        # Test 1: Node creation
        robot_reader = RobotStatusReader()
        print("✅ Test 1: Node created successfully")
        
        # Test 2: Input validation
        input_types = robot_reader.INPUT_TYPES()
        assert "sdk" in input_types["required"]
        assert "servo_ids" in input_types["required"] 
        assert "stream_results" in input_types["optional"]
        print("✅ Test 2: Input types correct")
        
        # Test 3: Basic reading (non-streaming)
        mock_sdk = MockScsServoSDK()
        result = robot_reader.read_robot_status(
            sdk=mock_sdk,
            servo_ids="1,2,3",
            read_positions=True,
            read_modes=False,
            stream_results=False  # Disable streaming for simple test
        )
        
        status_data, positions = result
        assert status_data["connected"] == True
        assert len(positions) == 3
        assert 1 in positions and 2 in positions and 3 in positions
        print("✅ Test 3: Basic robot status reading works")
        
        # Test 4: Input validation
        try:
            robot_reader.read_robot_status(
                sdk=mock_sdk,
                servo_ids="invalid,servo,ids",
                stream_results=False
            )
            print("❌ Test 4: Should have failed with invalid servo IDs")
            return False
        except ValueError:
            print("✅ Test 4: Input validation working")
        
        # Test 5: Mode reading
        result = robot_reader.read_robot_status(
            sdk=mock_sdk,
            servo_ids="1,2",
            read_positions=True,
            read_modes=True,
            stream_results=False
        )
        
        status_data, positions = result
        assert "modes" in status_data
        assert len(status_data["modes"]) == 2
        print("✅ Test 5: Mode reading works")
        
        print("\n🎉 All basic functionality tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_streaming_setup():
    """Test streaming setup without actual execution"""
    
    print("\n🔄 Testing Streaming Setup")
    print("=" * 30)
    
    try:
        robot_reader = RobotStatusReader()
        
        # Test streaming parameters
        input_types = robot_reader.INPUT_TYPES()["optional"]
        
        # Check streaming parameters exist
        assert "stream_results" in input_types
        assert "update_interval" in input_types
        
        # Check default values
        stream_default = input_types["stream_results"][1]["default"]
        interval_default = input_types["update_interval"][1]["default"]
        interval_min = input_types["update_interval"][1]["min"]
        interval_max = input_types["update_interval"][1]["max"]
        
        assert stream_default == True
        assert interval_default == 0.1
        assert interval_min == 0.01
        assert interval_max == 5.0
        
        print("✅ Streaming parameters configured correctly")
        
        # Test method signature
        import inspect
        sig = inspect.signature(robot_reader.read_robot_status)
        params = list(sig.parameters.keys())
        
        expected_params = ['sdk', 'servo_ids', 'read_positions', 'read_modes', 'stream_results', 'update_interval']
        for param in expected_params:
            assert param in params, f"Missing parameter: {param}"
        
        print("✅ Method signature includes streaming parameters")
        print("🎉 Streaming setup tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Streaming setup test failed: {e}")
        return False

def main():
    """Run all simple tests"""
    
    print("🤖 RobotStatusReader Simple Test Suite")
    print("📋 Testing core functionality without complex async operations")
    print()
    
    # Run basic functionality tests
    basic_success = test_basic_robot_functionality()
    
    # Run streaming setup tests
    streaming_success = test_streaming_setup()
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    print(f"   Basic Functionality: {'✅ PASS' if basic_success else '❌ FAIL'}")
    print(f"   Streaming Setup: {'✅ PASS' if streaming_success else '❌ FAIL'}")
    
    overall_success = basic_success and streaming_success
    print(f"\n🎯 Overall Result: {'🎉 ALL TESTS PASSED' if overall_success else '💥 SOME TESTS FAILED'}")
    
    if overall_success:
        print("\n💡 Next Steps:")
        print("   1. Run: python tests/test_websocket.py")
        print("   2. Run: python tests/test_frontend_integration.py")
        print("   3. Test in UI: Create RobotStatusReader node and run workflow")
    
    return overall_success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)