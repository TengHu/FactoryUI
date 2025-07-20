#!/usr/bin/env python3
"""
Test script for the relay server
"""

import requests
import json
import time

RELAY_URL = "http://localhost:8001"

def test_relay():
    """Test the relay server functionality"""
    
    print("Testing Relay Server...")
    
    # Test 1: Check server info
    print("\n1. Testing server info...")
    try:
        response = requests.get(f"{RELAY_URL}/")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: Add data
    print("\n2. Testing POST /data...")
    try:
        test_data = {"message": "hello", "value": 42}
        message = {
            "timestamp": time.time(),
            "data": test_data
        }
        response = requests.post(
            f"{RELAY_URL}/data",
            json=message,
            headers={"Content-Type": "application/json"}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: Check status
    print("\n3. Testing GET /status...")
    try:
        response = requests.get(f"{RELAY_URL}/status")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 4: Get data
    print("\n4. Testing GET /data...")
    try:
        response = requests.get(f"{RELAY_URL}/data")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 5: Test invalid endpoint
    print("\n5. Testing invalid endpoint...")
    try:
        response = requests.get(f"{RELAY_URL}/invalid")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_relay() 