#!/usr/bin/env python3
"""Test script for Ngrok HTTP functionality"""

import requests
import json
import time
import sys

def test_ngrok_http():
    """Test the ngrok HTTP sender and receiver functionality"""
    
    print("🧪 Testing Ngrok HTTP Functionality")
    print("=" * 50)
    
    # Test data
    test_data = {
        "type": "test_message",
        "data": {
            "message": "Hello from Factory UI!",
            "timestamp": time.time(),
            "node_id": "test-sender-123"
        }
    }
    
    # Test 1: Check if backend is running
    print("\n1. Checking backend status...")
    try:
        response = requests.get("http://localhost:8000/", timeout=5)
        if response.status_code == 200:
            print("   ✅ Backend is running")
        else:
            print(f"   ❌ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Cannot connect to backend: {e}")
        print("   Please start the backend with: python -m uvicorn app.main:app --reload")
        return False
    
    # Test 2: Send webhook data
    print("\n2. Sending webhook data...")
    try:
        response = requests.post(
            "http://localhost:8000/webhook",
            json=test_data,
            timeout=5
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Webhook sent successfully")
            print(f"   Message count: {result.get('message_count', 0)}")
        else:
            print(f"   ❌ Webhook failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Failed to send webhook: {e}")
        return False
    
    # Test 3: Retrieve webhook messages
    print("\n3. Retrieving webhook messages...")
    try:
        response = requests.get("http://localhost:8000/webhook/messages", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            message_count = data.get("message_count", 0)
            print(f"   ✅ Retrieved {message_count} messages")
            
            if message_count > 0:
                latest = data.get("latest_message")
                if latest:
                    print(f"   Latest message type: {latest.get('type', 'unknown')}")
                    print(f"   Latest message data: {latest.get('data', {})}")
            
            # Check grouped messages
            grouped = data.get("grouped_by_type", {})
            if grouped:
                print(f"   Message types: {list(grouped.keys())}")
                
        else:
            print(f"   ❌ Failed to retrieve messages: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Failed to retrieve messages: {e}")
        return False
    
    # Test 4: Test with ngrok URL (if provided)
    if len(sys.argv) > 1:
        ngrok_url = sys.argv[1]
        print(f"\n4. Testing with ngrok URL: {ngrok_url}")
        
        try:
            # Test ngrok connection
            response = requests.get(f"{ngrok_url}/", timeout=10)
            if response.status_code == 200:
                print("   ✅ Ngrok tunnel is working")
                
                # Send webhook through ngrok
                webhook_url = f"{ngrok_url}/webhook"
                response = requests.post(
                    webhook_url,
                    json=test_data,
                    timeout=10
                )
                
                if response.status_code == 200:
                    print("   ✅ Webhook sent through ngrok successfully")
                else:
                    print(f"   ❌ Ngrok webhook failed: {response.status_code}")
                    
            else:
                print(f"   ❌ Ngrok tunnel not accessible: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Ngrok test failed: {e}")
    
    print("\n✅ Ngrok HTTP Test Complete!")
    print("\n📋 Next Steps:")
    print("1. Start ngrok: ngrok http 8000")
    print("2. Use the ngrok URL in your Factory UI workflows")
    print("3. Test with external clients sending data to your ngrok URL")
    
    return True

def test_external_client():
    """Test sending data from an external client perspective"""
    
    print("\n🌐 Testing External Client Perspective")
    print("=" * 50)
    
    # Simulate external client sending data
    external_data = {
        "type": "external_sensor",
        "data": {
            "temperature": 25.5,
            "humidity": 60.2,
            "pressure": 1013.25,
            "client_id": "external-sensor-001"
        }
    }
    
    print("\n1. Sending external sensor data...")
    try:
        response = requests.post(
            "http://localhost:8000/webhook",
            json=external_data,
            timeout=5
        )
        
        if response.status_code == 200:
            print("   ✅ External data sent successfully")
        else:
            print(f"   ❌ External data failed: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ External data error: {e}")
    
    # Check messages again
    print("\n2. Checking all messages...")
    try:
        response = requests.get("http://localhost:8000/webhook/messages", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            message_count = data.get("message_count", 0)
            print(f"   Total messages: {message_count}")
            
            grouped = data.get("grouped_by_type", {})
            for msg_type, messages in grouped.items():
                print(f"   {msg_type}: {len(messages)} messages")
                
    except Exception as e:
        print(f"   ❌ Failed to check messages: {e}")

if __name__ == "__main__":
    # Run basic tests
    success = test_ngrok_http()
    
    if success:
        # Run external client test
        test_external_client()
        
        print("\n🎉 All tests completed!")
        print("\n💡 To test with ngrok:")
        print("1. Start ngrok: ngrok http 8000")
        print("2. Run: python test_ngrok_http.py https://YOUR_NGROK_URL.ngrok.io")
    else:
        print("\n❌ Tests failed. Please check the backend is running.")
        sys.exit(1) 