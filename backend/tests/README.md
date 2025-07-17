# Backend Tests - Real-Time Communication System

This directory contains test-driven development tests for the Factory UI real-time communication system.

## Test Files

### Core WebSocket Tests
- **`test_websocket.py`** - Basic WebSocket connection and message testing
- **`test_robot_stream.py`** - Robot status streaming event listener
- **`test_frontend_integration.py`** - Simulates robot data streaming for frontend testing

### Running Tests

#### Basic WebSocket Connection Test
```bash
cd backend
python tests/test_websocket.py
```
**Expected Output:**
- ✅ WebSocket connected successfully
- 📤📥 Ping/pong message exchange
- 📤📥 Status request/response
- 🎉 Test completed successfully

#### Robot Status Streaming Test
```bash
cd backend  
python tests/test_robot_stream.py
```
**Expected Output:**
- ✅ WebSocket connected
- 📤 Subscribed to robot events
- 👂 Listening for streaming events
- 📊 Message count and statistics

#### Frontend Integration Test
```bash
cd backend
python tests/test_frontend_integration.py
```
**Expected Output:**
- 🤖 Starting robot status streaming simulation
- 📤 10 robot status stream updates
- ✅ Stream complete message
- 🎉 Simulation completed

## Test Development Workflow

### 1. Basic Functionality Testing
```bash
# Test WebSocket connection
python tests/test_websocket.py

# Expected: Connection successful, ping/pong working
```

### 2. Robot Streaming Testing  
```bash
# Test robot status streaming
python tests/test_robot_stream.py

# Expected: Event subscription working, listening for streams
```

### 3. Frontend Integration Testing
```bash
# Simulate robot data for frontend
python tests/test_frontend_integration.py

# Then check frontend at http://localhost:3000
# Expected: RobotStatusReader node shows streaming data
```

### 4. End-to-End Testing
```bash
# 1. Start backend
python run_server.py

# 2. Start frontend  
cd ../factory-ui && npm start

# 3. Create workflow with RobotStatusReader node
# 4. Run continuous execution
# 5. Verify real-time robot status display
```

## Test Coverage

### ✅ WebSocket Infrastructure
- Connection establishment
- Message sending/receiving
- Error handling
- Auto-reconnection

### ✅ Robot Status Streaming
- Message format validation
- Event subscription
- Stream lifecycle (start/update/complete/error)
- Node-specific data routing

### ✅ Frontend Integration
- Real-time UI updates
- Robot status display
- Stream indicator animations
- Error state handling

## Development Guidelines

### Adding New Tests
1. Create test file in `tests/` directory
2. Follow naming convention: `test_<feature>.py`
3. Include descriptive output messages
4. Add test to this README

### Test Structure
```python
#!/usr/bin/env python3
"""Test description"""

import asyncio
import websockets
import json

async def test_feature():
    """Test specific feature"""
    try:
        # Test implementation
        print("✅ Test passed")
        return True
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_feature())
    print("🎉 Test completed!" if success else "💥 Test failed!")
```

### Debugging Failed Tests
1. Check backend server is running: `curl http://localhost:8000/`
2. Verify WebSocket dependencies: `pip list | grep websockets`
3. Check server logs for errors
4. Test basic HTTP endpoints first
5. Use browser dev tools for frontend debugging

## Future Test Enhancements

### Planned Tests
- **Load Testing**: Multiple concurrent WebSocket connections
- **Performance Testing**: Message latency and throughput
- **Error Recovery Testing**: Connection loss and reconnection
- **Security Testing**: Input validation and authentication

### Integration Tests
- **Continuous Execution**: Full workflow with streaming nodes
- **Multi-Node Streaming**: Multiple nodes streaming simultaneously  
- **Error Propagation**: How errors flow through the system
- **Resource Usage**: Memory and CPU impact of streaming

### Frontend Tests
- **React Component Testing**: CustomNode robot status display
- **WebSocket Service Testing**: Connection management
- **State Management Testing**: Real-time state updates
- **UI Animation Testing**: Stream indicators and transitions

The test-driven development approach ensures reliable real-time communication features and enables confident refactoring and feature additions.