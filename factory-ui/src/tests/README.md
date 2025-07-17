# Frontend Tests - Real-Time Communication System

This directory contains test-driven development tests for the Factory UI frontend real-time communication features.

## Test Structure

### Manual Testing Workflow

#### 1. WebSocket Connection Test
**Objective**: Verify WebSocket service connects and handles events

**Steps**:
1. Start backend: `cd backend && python run_server.py`
2. Start frontend: `cd factory-ui && npm start`
3. Open browser dev tools → Console
4. Look for WebSocket connection messages:
   ```
   WebSocket connected
   🔗 Live indicator should appear in toolbar
   ```

**Expected Results**:
- ✅ "WebSocket connected" in console
- ✅ Live indicator (🔗 Live) visible in toolbar
- ✅ No connection error messages

#### 2. Robot Status Display Test
**Objective**: Verify RobotStatusReader node displays streaming data

**Steps**:
1. Create new workflow in UI
2. Drag RobotStatusReader node to canvas
3. Configure node inputs:
   - servo_ids: "1,2,3,4,5"
   - stream_results: true
   - update_interval: 0.1
4. Run backend simulation: `cd backend && python tests/test_frontend_integration.py`
5. Observe node UI changes

**Expected Results**:
- ✅ Robot status section appears in node
- ✅ Stream indicator shows "🔄 Live"
- ✅ Servo positions update in real-time
- ✅ Connection status shows "✅ Yes"
- ✅ Update counter increments
- ✅ Stream indicator changes to "✅ Complete" when done

#### 3. Real-Time Input Updates Test
**Objective**: Verify input changes are sent via WebSocket

**Steps**:
1. Create workflow with nodes that have manual inputs
2. Change text input values in nodes
3. Check browser dev tools → Network → WS (WebSocket)
4. Look for `input_update` messages

**Expected Results**:
- ✅ WebSocket messages sent on input change
- ✅ Message format: `{"type": "input_update", "data": {...}}`
- ✅ No network errors or connection drops

#### 4. Continuous Execution Streaming Test
**Objective**: Verify real-time updates during continuous execution

**Steps**:
1. Create workflow with multiple nodes
2. Include RobotStatusReader with streaming enabled
3. Click "Run Continuous"
4. Observe real-time node state changes

**Expected Results**:
- ✅ Nodes show execution states (executing, completed, error)
- ✅ Robot node shows streaming data
- ✅ Execution count updates in toolbar
- ✅ WebSocket connection remains stable

### Automated Testing (Future)

#### Unit Tests
```javascript
// src/tests/websocket.test.js
import { websocketService } from '../services/websocket';

describe('WebSocket Service', () => {
  test('should connect successfully', async () => {
    await expect(websocketService.connect()).resolves.not.toThrow();
  });
  
  test('should handle robot status stream', () => {
    const handler = jest.fn();
    websocketService.on('robot_status_stream', handler);
    
    // Simulate message
    websocketService.handleMessage({
      type: 'robot_status_stream',
      data: { node_id: 'test', status: { connected: true } }
    });
    
    expect(handler).toHaveBeenCalled();
  });
});
```

#### Integration Tests
```javascript
// src/tests/robot-status-display.test.js
import { render, screen } from '@testing-library/react';
import CustomNode from '../components/CustomNode';

test('should display robot status when available', () => {
  const mockData = {
    nodeInfo: { name: 'RobotStatusReader' },
    robotStatus: {
      positions: { 1: 1000, 2: 2000 },
      connected: true
    }
  };
  
  render(<CustomNode data={mockData} />);
  
  expect(screen.getByText('Robot Status')).toBeInTheDocument();
  expect(screen.getByText('✅ Yes')).toBeInTheDocument();
});
```

## Test Data

### Mock Robot Status Data
```javascript
const mockRobotStatus = {
  positions: { 1: 1000, 2: 2000, 3: 1500, 4: 3000, 5: 800 },
  modes: { 1: 'servo_mode', 2: 'servo_mode', 3: 'wheel_mode' },
  servo_ids: [1, 2, 3, 4, 5],
  timestamp: 1640995200,
  connected: true,
  stream_count: 42
};
```

### Mock WebSocket Messages
```javascript
const mockMessages = {
  robotStatusStream: {
    type: 'robot_status_stream',
    timestamp: 1640995200,
    data: {
      node_id: 'robot-reader-1',
      status: mockRobotStatus,
      stream_update: true
    }
  },
  
  nodeState: {
    type: 'node_state',
    timestamp: 1640995200,
    data: {
      node_id: 'robot-reader-1',
      state: 'executing',
      data: { start_time: 1640995200 }
    }
  }
};
```

## Debugging

### Common Issues
1. **WebSocket Not Connecting**
   - Check backend server is running
   - Verify no firewall blocking port 8000
   - Check browser console for connection errors

2. **Robot Status Not Displaying**
   - Verify node type is 'RobotStatusReader'
   - Check robotStatus data is being received
   - Inspect React dev tools for state updates

3. **Streaming Not Working**
   - Check WebSocket connection status
   - Verify backend has websockets library installed
   - Look for streaming messages in dev tools

### Debug Tools
```javascript
// In browser console
websocketService.getConnectionStatus();
websocketService.getMessageStats();

// Enable verbose logging
localStorage.setItem('debug_websocket', 'true');
```

### Network Debugging
1. Open browser dev tools
2. Go to Network tab
3. Filter by WS (WebSocket)
4. Monitor message flow
5. Check for connection drops

## Performance Testing

### Load Testing Checklist
- [ ] Multiple browser tabs connected
- [ ] High-frequency streaming (0.01s intervals)
- [ ] Large robot status payloads
- [ ] Extended streaming duration
- [ ] Memory usage monitoring

### Performance Metrics
- **Connection Time**: < 100ms
- **Message Latency**: < 10ms
- **Memory Usage**: < 50MB additional
- **CPU Usage**: < 5% during streaming
- **UI Responsiveness**: No frame drops

## Future Test Enhancements

### Planned Tests
- **Error Recovery**: Connection loss scenarios
- **Multiple Nodes**: Concurrent streaming from multiple robot nodes
- **Data Validation**: Malformed message handling
- **Performance**: High-frequency update stress testing
- **Accessibility**: Screen reader and keyboard navigation

### Test Automation
- **CI/CD Integration**: Automated testing in build pipeline
- **Visual Regression**: Screenshot comparison tests
- **End-to-End**: Playwright or Cypress tests
- **Load Testing**: Artillery or similar tools

The test-driven development approach ensures robust real-time features and enables confident iteration on the user interface.