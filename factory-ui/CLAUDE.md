# Factory UI Frontend

## Communication Architecture

### Overview

The frontend implements a **dual communication system** that combines HTTP REST API calls for traditional request-response operations and WebSocket connections for real-time bidirectional communication. This hybrid approach provides both reliable data operations and instant visual feedback during workflow execution.

**Communication Channels:**
- **HTTP REST API**: For CRUD operations, workflow management, and one-time requests
- **WebSocket**: For real-time updates, live monitoring, and instant feedback

### Communication Flow

```
Frontend (React)
    ↕️ HTTP API (REST)
    ↕️ WebSocket (Real-time)
Backend (FastAPI)
```

**HTTP API Usage:**
- Workflow creation, updates, and deletion
- Node configuration and parameter management
- File uploads and downloads
- Authentication and user management
- One-time data retrieval

**WebSocket Usage:**
- Real-time node state updates
- Live execution monitoring
- Instant input synchronization
- Continuous workflow status
- Live error reporting and notifications

## Real-Time Communication Implementation

### Overview

The frontend implements a WebSocket-based real-time communication system that provides instant visual feedback during workflow execution. Built with React and ReactFlow, it delivers sub-10ms latency for real-time updates and collaborative editing capabilities.

### Architecture

```
React Application (App.tsx)
    ↕️
WebSocket Service (websocket.ts)
    ↕️
Custom Node Components (CustomNode.tsx)
    ↕️
Real-Time State Management (React Hooks)
```

## Core Components

### 1. HTTP API Service (`src/services/api.ts`)

RESTful API client for traditional request-response operations with the backend.

**Key Features:**
- CRUD operations for workflows and nodes
- File upload/download capabilities
- Authentication and session management
- Error handling and retry logic
- Request/response interceptors

**Usage:**
```typescript
import { apiService } from './services/api';

// Create a new workflow
const workflow = await apiService.createWorkflow({
  name: 'My Workflow',
  nodes: [...],
  edges: [...]
});

// Update node configuration
await apiService.updateNode(nodeId, {
  position: { x: 100, y: 200 },
  data: { ... }
});

// Upload files
const fileData = await apiService.uploadFile(file);

// Get workflow status
const status = await apiService.getWorkflowStatus(workflowId);
```

### 2. WebSocket Service (`src/services/websocket.ts`)

Comprehensive WebSocket client with automatic reconnection and event management.

**Key Features:**
- Auto-reconnection with exponential backoff
- Event subscription system
- Connection state management
- Heartbeat/ping system
- Message queuing during disconnection

**Usage:**
```typescript
import { websocketService } from './services/websocket';

// Connect to WebSocket
await websocketService.connect();

// Subscribe to events
const unsubscribe = websocketService.on('node_state', (data) => {
  console.log('Node state updated:', data);
});

// Send input update
websocketService.sendInputUpdate(nodeId, inputName, value);

// Cleanup
unsubscribe();
websocketService.disconnect();
```

### 2. React Integration (`src/App.tsx`)

Main application component with both HTTP API and WebSocket integration for comprehensive backend communication.

**Dual Communication Pattern:**
```typescript
// HTTP for initial data loading and CRUD operations
useEffect(() => {
  const loadWorkflow = async () => {
    try {
      const workflow = await apiService.getWorkflow(workflowId);
      setNodes(workflow.nodes);
      setEdges(workflow.edges);
    } catch (error) {
      console.error('Failed to load workflow:', error);
    }
  };
  
  loadWorkflow();
}, [workflowId]);

// WebSocket for real-time updates
useEffect(() => {
  websocketService.on('node_state', (data) => {
    setNodeStates(prev => ({
      ...prev,
      [data.node_id]: data
    }));
  });
}, []);
```

**Communication Strategy:**
- **Initial Load**: HTTP API fetches complete workflow state
- **Real-time Updates**: WebSocket provides live node state changes
- **User Actions**: HTTP API for persistent changes, WebSocket for immediate feedback
- **Error Handling**: HTTP API for retry logic, WebSocket for instant error notifications

**Real-Time Features:**
- Live node state visualization
- Instant input synchronization
- Continuous execution monitoring
- Connection status display

**State Management:**
```typescript
const [nodeStates, setNodeStates] = useState<Record<string, any>>({});
const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
const [continuousStatus, setContinuousStatus] = useState<any>(null);

// WebSocket event handlers
websocketService.on('node_state', (data) => {
  setNodeStates(prev => ({
    ...prev,
    [data.node_id]: {
      state: data.state,
      data: data.data,
      timestamp: data.timestamp
    }
  }));
});
```

### 3. Custom Node Component (`src/components/CustomNode.tsx`)

Enhanced node component with real-time state visualization and animations.

**Real-Time States:**
- `idle` - Default state
- `executing` - Node is currently running (animated)
- `completed` - Node finished successfully (flash animation)
- `error` - Node failed (shake animation)

**Implementation:**
```typescript
const CustomNode = ({ id, data, selected, ...props }: CustomNodeProps) => {
  const { nodeState } = data;
  
  return (
    <div 
      className={`custom-node ${nodeState?.state ? `node-${nodeState.state}` : ''}`}
    >
      {/* Node content */}
    </div>
  );
};
```

## Message Protocol

### HTTP API Protocol

#### RESTful Endpoints
```typescript
// Workflow Management
GET    /api/workflows                    // List all workflows
POST   /api/workflows                    // Create new workflow
GET    /api/workflows/{id}               // Get specific workflow
PUT    /api/workflows/{id}               // Update workflow
DELETE /api/workflows/{id}               // Delete workflow

// Node Operations
GET    /api/nodes/{id}                   // Get node details
PUT    /api/nodes/{id}                   // Update node configuration
POST   /api/nodes/{id}/execute           // Execute single node

// File Operations
POST   /api/files/upload                 // Upload file
GET    /api/files/{id}                   // Download file
DELETE /api/files/{id}                   // Delete file

// System Status
GET    /api/status                       // Get system status
GET    /api/health                       // Health check
```

#### Request/Response Examples
```typescript
// Create Workflow
const response = await apiService.createWorkflow({
  name: "Robot Control Workflow",
  description: "Controls robot joints",
  nodes: [
    {
      id: "joint1",
      type: "JointControl",
      position: { x: 100, y: 100 },
      data: { joint_id: 1, angle: 45 }
    }
  ],
  edges: []
});

// Response:
{
  "id": "workflow_12345",
  "name": "Robot Control Workflow",
  "created_at": "2024-01-15T10:30:00Z",
  "status": "created"
}

// Update Node
await apiService.updateNode("joint1", {
  data: { joint_id: 1, angle: 90 }
});

// Get Workflow Status
const status = await apiService.getWorkflowStatus("workflow_12345");
// Response:
{
  "workflow_id": "workflow_12345",
  "status": "running",
  "execution_count": 42,
  "last_execution": "2024-01-15T10:35:00Z"
}
```

### WebSocket Protocol

### Outbound Messages (Client → Server)

#### Input Updates
```typescript
websocketService.sendInputUpdate(nodeId, inputName, value);
// Sends:
{
  "type": "input_update",
  "timestamp": 1234567890,
  "data": {
    "node_id": "TextInput-1234",
    "input_name": "text",
    "input_value": "Updated value"
  }
}
```

#### Status Requests
```typescript
websocketService.requestStatus();
// Sends:
{
  "type": "get_status",
  "timestamp": 1234567890
}
```

#### Heartbeat
```typescript
websocketService.send('ping', { timestamp: Date.now() });
// Sends:
{
  "type": "ping",
  "timestamp": 1234567890,
  "data": { "timestamp": 1234567890 }
}
```

### Inbound Messages (Server → Client)

#### Node State Updates
```typescript
websocketService.on('node_state', (data) => {
  // Receives:
  {
    "node_id": "ProcessingNode-1234",
    "state": "executing",
    "data": {
      "start_time": 1234567890,
      "result": null
    }
  }
});
```

#### Execution Status
```typescript
websocketService.on('execution_status', (data) => {
  // Receives:
  {
    "is_running": true,
    "execution_count": 42,
    "results": {...}
  }
});
```

#### Workflow Events
```typescript
websocketService.on('workflow_event', (data) => {
  // Receives:
  {
    "event": "continuous_started",
    "workflow_id": "workflow_12345",
    "node_count": 5
  }
});
```

## Implementation Details

### WebSocket Connection Management

```typescript
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.send('ping', { timestamp: Date.now() });
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };
      
      this.ws.onclose = () => {
        this.attemptReconnect();
      };
    });
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    
    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect().catch(console.error);
    }, this.reconnectInterval);
  }
}
```

### Event Subscription System

```typescript
private eventHandlers: Map<string, Function[]> = new Map();

on(eventType: string, handler: Function): () => void {
  if (!this.eventHandlers.has(eventType)) {
    this.eventHandlers.set(eventType, []);
  }
  this.eventHandlers.get(eventType)!.push(handler);
  
  // Return unsubscribe function
  return () => {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  };
}

private handleMessage(message: any) {
  const handlers = this.eventHandlers.get(message.type) || [];
  handlers.forEach(handler => {
    try {
      handler(message.data);
    } catch (error) {
      console.error('Error in WebSocket event handler:', error);
    }
  });
}
```

### Real-Time State Integration

```typescript
// WebSocket connection and event handlers
useEffect(() => {
  const connectWebSocket = async () => {
    try {
      await websocketService.connect();
      setIsWebSocketConnected(true);
      
      // Start heartbeat
      websocketService.startHeartbeat();
      
      // Subscribe to events
      websocketService.subscribe(['execution_status', 'node_state', 'workflow_event']);
      
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsWebSocketConnected(false);
    }
  };

  connectWebSocket();
  
  // Set up event handlers
  const unsubscribeHandlers = [
    websocketService.on('node_state', (data) => {
      setNodeStates(prev => ({
        ...prev,
        [data.node_id]: {
          state: data.state,
          data: data.data,
          timestamp: data.timestamp
        }
      }));
    }),
    
    websocketService.on('continuous_update', (data) => {
      setContinuousStatus({
        is_running: data.status === 'executing' || data.status === 'completed',
        execution_count: data.execution_count,
        last_execution_time: data.data?.execution_time || 0,
        results: data.data?.results || {}
      });
    })
  ];
  
  // Cleanup on unmount
  return () => {
    unsubscribeHandlers.forEach(unsub => unsub());
    websocketService.disconnect();
    setIsWebSocketConnected(false);
  };
}, []);
```

## Visual Feedback System

### CSS Animations (`src/components/CustomNode.css`)

#### Executing State
```css
.custom-node.node-executing {
  border-color: #fd7e14;
  background: linear-gradient(145deg, #fff3e0, #fff8f0);
  animation: pulse-executing 2s infinite;
}

@keyframes pulse-executing {
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(253, 126, 20, 0.4);
  }
  50% { 
    transform: scale(1.02);
    box-shadow: 0 0 0 8px rgba(253, 126, 20, 0.1);
  }
}
```

#### Completed State
```css
.custom-node.node-completed {
  border-color: #198754;
  background: linear-gradient(145deg, #e8f5e8, #f0fff4);
  animation: flash-success 0.5s ease-in-out;
}

@keyframes flash-success {
  0% { background: linear-gradient(145deg, #ffffff, #f0fff4); }
  50% { background: linear-gradient(145deg, #d4edda, #e8f5e8); }
  100% { background: linear-gradient(145deg, #e8f5e8, #f0fff4); }
}
```

#### Error State
```css
.custom-node.node-error {
  border-color: #dc3545;
  background: linear-gradient(145deg, #ffeaea, #fff5f5);
  animation: shake-error 0.5s ease-in-out;
}

@keyframes shake-error {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

### Dynamic Node Updates

```typescript
// Update nodes with real-time state information
const nodesWithState = React.useMemo(() => {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      nodeState: nodeStates[node.id]
    }
  }));
}, [nodes, nodeStates]);

// Use enhanced nodes in ReactFlow
<ReactFlow
  nodes={nodesWithState}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  nodeTypes={nodeTypes}
  isValidConnection={isValidConnection}
/>
```

## Benefits of Dual Communication

### Why Both HTTP and WebSocket?

**HTTP API Advantages:**
- **Reliability**: Guaranteed delivery with retry mechanisms
- **Caching**: Browser and CDN caching for static resources
- **Security**: Standard authentication and authorization
- **Compatibility**: Works with all browsers and network configurations
- **Debugging**: Easy to inspect with browser dev tools

**WebSocket Advantages:**
- **Real-time**: Sub-10ms latency for instant updates
- **Bidirectional**: Server can push updates without polling
- **Efficiency**: Single connection for multiple updates
- **Stateful**: Maintains connection context
- **Interactive**: Perfect for live collaboration

**Combined Benefits:**
- **Best of Both Worlds**: Reliable operations + real-time feedback
- **Graceful Degradation**: Fallback to HTTP polling if WebSocket fails
- **Scalable Architecture**: HTTP for heavy operations, WebSocket for updates
- **User Experience**: Instant feedback with reliable data persistence

### Use Case Examples

```typescript
// Scenario 1: Workflow Creation
// 1. HTTP API creates workflow (reliable persistence)
const workflow = await apiService.createWorkflow(workflowData);

// 2. WebSocket immediately starts monitoring (real-time updates)
websocketService.subscribeToWorkflow(workflow.id);

// Scenario 2: Node Configuration
// 1. HTTP API updates node config (persistent change)
await apiService.updateNode(nodeId, newConfig);

// 2. WebSocket provides instant visual feedback
websocketService.on('node_updated', (data) => {
  updateNodeVisualState(data.node_id, data.state);
});

// Scenario 3: File Upload
// 1. HTTP API handles file upload (reliable, supports large files)
const fileData = await apiService.uploadFile(file);

// 2. WebSocket notifies when processing starts
websocketService.on('file_processing_started', (data) => {
  showProcessingIndicator(data.file_id);
});
```

## Performance Optimizations

### Efficient State Updates

```typescript
// Batch state updates using React's automatic batching
const handleMultipleUpdates = useCallback((updates: NodeStateUpdate[]) => {
  setNodeStates(prev => {
    const newState = { ...prev };
    updates.forEach(update => {
      newState[update.node_id] = {
        state: update.state,
        data: update.data,
        timestamp: update.timestamp
      };
    });
    return newState;
  });
}, []);
```

### Memoization for Performance

```typescript
// Memoize expensive computations
const nodesWithState = React.useMemo(() => {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      nodeState: nodeStates[node.id]
    }
  }));
}, [nodes, nodeStates]);

// Memoize event handlers
const handleNodeStateUpdate = useCallback((data) => {
  setNodeStates(prev => ({
    ...prev,
    [data.node_id]: {
      state: data.state,
      data: data.data,
      timestamp: data.timestamp
    }
  }));
}, []);
```

### Debounced Input Updates

```typescript
const debouncedInputUpdate = useCallback(
  debounce((nodeId: string, inputName: string, value: string) => {
    if (websocketService.isConnected()) {
      websocketService.sendInputUpdate(nodeId, inputName, value);
    }
  }, 300),
  []
);
```

## Error Handling

### Connection Failures
```typescript
const handleConnectionError = useCallback((error: Error) => {
  console.error('WebSocket connection error:', error);
  setIsWebSocketConnected(false);
  
  // Fallback to HTTP polling
  if (isContinuousRunning) {
    startPolling();
  }
}, [isContinuousRunning]);
```

### Message Validation
```typescript
private handleMessage(message: any) {
  try {
    // Validate message structure
    if (!message.type || !message.data) {
      throw new Error('Invalid message format');
    }
    
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message.data);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    });
  } catch (error) {
    console.error('Failed to handle WebSocket message:', error);
  }
}
```

## Testing

### Unit Tests
```typescript
import { websocketService } from '../services/websocket';

describe('WebSocket Service', () => {
  test('should connect successfully', async () => {
    const mockWebSocket = createMockWebSocket();
    global.WebSocket = jest.fn(() => mockWebSocket);
    
    await expect(websocketService.connect()).resolves.not.toThrow();
  });
  
  test('should handle message events', () => {
    const handler = jest.fn();
    const unsubscribe = websocketService.on('test_event', handler);
    
    websocketService.handleMessage({
      type: 'test_event',
      data: { test: 'data' }
    });
    
    expect(handler).toHaveBeenCalledWith({ test: 'data' });
    unsubscribe();
  });
});
```

### Integration Tests
```typescript
import { render, screen } from '@testing-library/react';
import App from '../App';

test('should show WebSocket connection status', () => {
  render(<App />);
  
  // Should show connection status
  expect(screen.getByText('🔗 Live')).toBeInTheDocument();
});

test('should update node states in real-time', () => {
  render(<App />);
  
  // Simulate WebSocket message
  act(() => {
    websocketService.handleMessage({
      type: 'node_state',
      data: {
        node_id: 'test-node',
        state: 'executing',
        data: {}
      }
    });
  });
  
  // Node should show executing state
  expect(screen.getByTestId('test-node')).toHaveClass('node-executing');
});
```

## Configuration

### WebSocket Configuration
```typescript
const websocketConfig = {
  url: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000/ws',
  reconnectAttempts: 5,
  reconnectInterval: 3000,
  heartbeatInterval: 30000,
  messageQueueSize: 100
};
```

### Development vs Production
```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const websocketService = new WebSocketService(
  isDevelopment ? 'ws://localhost:8000/ws' : 'wss://api.example.com/ws'
);
```

## Monitoring and Debugging

### Debug Console
```typescript
if (process.env.NODE_ENV === 'development') {
  // Expose WebSocket service for debugging
  (window as any).websocketService = websocketService;
  
  // Log all messages
  websocketService.on('*', (data, type) => {
    console.log(`[WebSocket] ${type}:`, data);
  });
}
```

### Connection Monitoring
```typescript
const [connectionStats, setConnectionStats] = useState({
  connected: false,
  reconnectAttempts: 0,
  lastMessage: null,
  messageCount: 0
});

useEffect(() => {
  const updateStats = () => {
    setConnectionStats({
      connected: websocketService.isConnected(),
      reconnectAttempts: websocketService.getReconnectAttempts(),
      lastMessage: websocketService.getLastMessage(),
      messageCount: websocketService.getMessageCount()
    });
  };
  
  const interval = setInterval(updateStats, 1000);
  return () => clearInterval(interval);
}, []);
```

## Future Enhancements

### Planned Features
1. **Offline Support**: Queue messages when disconnected
2. **Collaborative Editing**: Real-time multi-user editing
3. **Advanced Visualizations**: Custom node state displays
4. **Performance Metrics**: Real-time performance monitoring
5. **Custom Themes**: Animated themes based on execution state

### Technical Improvements
1. **Message Compression**: Compress large payloads
2. **Binary Protocol**: Protocol buffers for efficiency
3. **Service Worker**: Background message handling
4. **Advanced Caching**: Smart caching of node states

## Troubleshooting

### Common Issues
1. **Connection Lost**: Check network connectivity and server status
2. **Slow Updates**: Verify WebSocket connection quality
3. **Missing Animations**: Check CSS animation support
4. **Memory Leaks**: Ensure proper cleanup of event listeners

### Debug Commands
```javascript
// In browser console
websocketService.getConnectionStatus();
websocketService.getMessageStats();
websocketService.reconnect();
```

The frontend real-time communication system provides a responsive, visually rich interface for monitoring and controlling workflow execution in real-time.