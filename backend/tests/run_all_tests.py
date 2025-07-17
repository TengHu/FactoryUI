#!/usr/bin/env python3
"""Test runner for Factory UI real-time communication system"""

import subprocess
import sys
import time
import requests

def check_server_running():
    """Check if the backend server is running"""
    try:
        response = requests.get("http://localhost:8000/", timeout=2)
        return response.status_code == 200
    except:
        return False

def run_test(test_file, description):
    """Run a single test file and return success status"""
    print(f"\n🧪 Running: {description}")
    print("=" * 60)
    
    try:
        result = subprocess.run([sys.executable, test_file], 
                              capture_output=True, text=True, timeout=30)
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        success = result.returncode == 0
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"\n📊 Result: {status}")
        
        return success
        
    except subprocess.TimeoutExpired:
        print("❌ Test timed out after 30 seconds")
        return False
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        return False

def main():
    """Run all tests in the correct order"""
    
    print("🧪 Factory UI Real-Time Communication Test Suite")
    print("📋 Comprehensive testing of WebSocket streaming functionality")
    print("⏰ Started at:", time.strftime("%Y-%m-%d %H:%M:%S"))
    print()
    
    # Check prerequisites
    print("🔍 Checking prerequisites...")
    
    if not check_server_running():
        print("❌ Backend server is not running!")
        print("💡 Please start the server first: python run_server.py")
        return False
    else:
        print("✅ Backend server is running")
    
    # Define test suite (with full paths)
    import os
    test_dir = os.path.dirname(os.path.abspath(__file__))
    tests = [
        (os.path.join(test_dir, "test_simple_robot_streaming.py"), "RobotStatusReader Core Functionality"),
        (os.path.join(test_dir, "test_websocket.py"), "Basic WebSocket Connection"),
        (os.path.join(test_dir, "test_frontend_integration.py"), "Frontend Integration Simulation"),
    ]
    
    # Run tests
    results = []
    
    for test_file, description in tests:
        success = run_test(test_file, description)
        results.append((description, success))
        
        if not success:
            print(f"⚠️  Test failed: {description}")
            print("🤔 Consider debugging before running remaining tests")
        
        # Small delay between tests
        time.sleep(1)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 FINAL TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed_count = 0
    total_count = len(results)
    
    for description, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"   {status:<10} {description}")
        if success:
            passed_count += 1
    
    print(f"\n📈 Score: {passed_count}/{total_count} tests passed")
    
    overall_success = passed_count == total_count
    
    if overall_success:
        print("🎉 ALL TESTS PASSED!")
        print("\n💡 Real-time communication system is ready for production!")
        print("\n🚀 Next steps:")
        print("   1. Test in UI: Create RobotStatusReader node")
        print("   2. Run continuous execution with streaming enabled")
        print("   3. Verify real-time robot status display")
        
    else:
        print("💥 SOME TESTS FAILED!")
        print(f"\n🔍 Failed tests: {total_count - passed_count}")
        print("\n🛠️  Debugging suggestions:")
        print("   1. Check backend server logs for errors")
        print("   2. Verify websockets library is installed correctly")
        print("   3. Test individual components separately")
        print("   4. Check network connectivity and firewall settings")
    
    print(f"\n⏰ Test suite completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    return overall_success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)