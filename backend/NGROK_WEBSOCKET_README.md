# Ngrok WebSocket Nodes

This document explains how to use the Ngrok WebSocket nodes for sending and receiving data through ngrok tunnels.

## Overview

The Factory UI now includes two new nodes for WebSocket communication through ngrok:

1. **NgrokWebSocketSenderNode** - Sends data to external clients through ngrok
2. **NgrokWebSocketReceiverNode** - Receives data from external clients through ngrok

## Prerequisites

1. **Ngrok Account**: Sign up at [ngrok.com](https://ngrok.com)
2. **Ngrok CLI**: Install ngrok CLI tool
3. **WebSocket Support**: The `websockets` Python package is already included in requirements.txt

## Installation

### 1. Install Ngrok

```bash
# macOS
brew install ngrok

# Windows
# Download from https://ngrok.com/download

# Linux
# Download and install from https://ngrok.com/download
```

### 2. Authenticate Ngrok

```bash
ngrok authtoken YOUR_AUTH_TOKEN
```

## Usage

### Step 1: Start the WebSocket Receiver

1. Add a **NgrokWebSocketReceiverNode** to your workflow
2. Configure the port (default: 8765)
3. Set `start_server` to `True`
4. Run the workflow to start the server

### Step 2: Expose with Ngrok

```bash
ngrok http 8765
```

This will give you a public URL like:
```
Forwarding    https://abc123.ngrok.io -> http://localhost:8765
```

### Step 3: Send Data

1. Add a **NgrokWebSocketSenderNode** to your workflow
2. Configure the ngrok URL (replace `https://` with `wss://`)
3. Set your message type and data
4. Run the workflow to send data

## Node Details

### NgrokWebSocketSenderNode

**Purpose**: Sends data through ngrok websocket to external clients

**Inputs**:
- `data` (ANY): The data to send (will be JSON serialized)
- `ngrok_url` (STRING): The ngrok websocket URL (e.g., `wss://abc123.ngrok.io`)
- `message_type` (STRING): The type of message to send

**Outputs**:
- `success` (BOOLEAN): True if sent successfully
- `message` (STRING): Status message

**Example Usage**:
```python
# Send robot status data
sender.send_websocket(
    data={
        "robot_id": "robot_001",
        "position": [x, y, z],
        "status": "active"
    },
    ngrok_url="wss://abc123.ngrok.io",
    message_type="robot_status"
)
```

### NgrokWebSocketReceiverNode

**Purpose**: Receives data from external clients through ngrok websocket

**Inputs**:
- `port` (INT): Port to run the server on (default: 8765)
- `start_server` (BOOLEAN): Whether to start the server

**Outputs**:
- `received_data` (DICT): All received messages with timestamps
- `message_count` (INT): Number of messages received
- `server_status` (STRING): Current server status

**Example Output**:
```python
{
    "messages": [
        {
            "type": "robot_status",
            "timestamp": 1640995200.0,
            "data": {"robot_id": "robot_001", "position": [1, 2, 3]}
        }
    ],
    "grouped_by_type": {
        "robot_status": [...],
        "sensor_data": [...]
    },
    "latest_message": {...}
}
```

## Testing

### 1. Test with Python Script

Run the test script to verify functionality:

```bash
cd backend
python test_ngrok_websocket.py
```

### 2. Test with Web Client

1. Start the receiver node in Factory UI
2. Run `ngrok http 8765`
3. Open `test_ngrok_client.html` in a browser
4. Connect to the ngrok WebSocket URL
5. Send test messages

### 3. Test with External Tools

Use tools like `websocat` or `wscat`:

```bash
# Install websocat
cargo install websocat

# Connect and send message
echo '{"type":"test","data":{"message":"hello"}}' | websocat ws://localhost:8765
```

## Message Format

All messages follow this JSON format:

```json
{
    "type": "message_type",
    "timestamp": 1640995200.0,
    "data": {
        "key": "value"
    }
}
```

## Error Handling

### Common Issues

1. **Connection Failed**
   - Check if ngrok is running
   - Verify the URL format (use `wss://` not `https://`)
   - Ensure the port matches between receiver and ngrok

2. **Server Not Starting**
   - Check if port is already in use
   - Verify firewall settings
   - Check ngrok tunnel status

3. **Messages Not Received**
   - Verify ngrok tunnel is active
   - Check client connection status
   - Review server logs

### Debugging

Enable debug logging in the nodes:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Security Considerations

1. **Public Exposure**: Ngrok tunnels are publicly accessible
2. **Authentication**: Consider adding authentication to your messages
3. **Rate Limiting**: Be aware of ngrok's rate limits
4. **Data Validation**: Validate incoming messages

## Advanced Usage

### Continuous Data Streaming

```python
# In a continuous workflow
while True:
    # Get sensor data
    sensor_data = get_sensor_readings()
    
    # Send through ngrok
    sender.send_websocket(
        data=sensor_data,
        ngrok_url="wss://abc123.ngrok.io",
        message_type="sensor_stream"
    )
    
    time.sleep(1)  # Send every second
```

### Multiple Clients

The receiver node can handle multiple simultaneous connections. Each client will receive acknowledgment messages.

### Message Filtering

Filter messages by type in your workflow:

```python
received_data = receiver.receive_websocket(8765, False)
robot_messages = received_data.get("grouped_by_type", {}).get("robot_status", [])
```

## Integration Examples

### Robot Control

```python
# Send robot commands
sender.send_websocket(
    data={
        "command": "move",
        "target": [x, y, z],
        "speed": 0.5
    },
    ngrok_url="wss://robot-control.ngrok.io",
    message_type="robot_command"
)
```

### Sensor Data Collection

```python
# Receive sensor data from external devices
received_data = receiver.receive_websocket(8765, False)
sensor_messages = received_data.get("grouped_by_type", {}).get("sensor_data", [])

for msg in sensor_messages:
    process_sensor_data(msg["data"])
```

### Real-time Monitoring

```python
# Monitor system status
sender.send_websocket(
    data={
        "cpu_usage": get_cpu_usage(),
        "memory_usage": get_memory_usage(),
        "temperature": get_temperature()
    },
    ngrok_url="wss://monitoring.ngrok.io",
    message_type="system_status"
)
```

## Troubleshooting

### Ngrok Issues

```bash
# Check ngrok status
ngrok status

# View ngrok logs
ngrok http 8765 --log=stdout

# Test tunnel
curl https://abc123.ngrok.io
```

### WebSocket Issues

```bash
# Test WebSocket connection
websocat ws://localhost:8765

# Check if port is open
netstat -an | grep 8765
```

### Factory UI Issues

1. Check backend logs for errors
2. Verify node registration in `NODE_CLASS_MAPPINGS`
3. Test with simple data types first
4. Restart the backend server if needed

## Support

For issues or questions:

1. Check the test scripts for working examples
2. Review the node documentation in the code
3. Test with the provided HTML client
4. Check ngrok documentation at [ngrok.com/docs](https://ngrok.com/docs) 