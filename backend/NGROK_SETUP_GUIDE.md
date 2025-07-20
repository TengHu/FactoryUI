# Ngrok Server Setup and Data Sending Guide

This guide explains how to set up ngrok server and configure your Factory UI system to send and receive data through ngrok tunnels.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Basic Setup](#basic-setup)
4. [Using Ngrok with Factory UI](#using-ngrok-with-factory-ui)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Usage](#advanced-usage)

## Prerequisites

- Python 3.8+
- Factory UI backend running on port 8000
- Internet connection for ngrok tunnels

## Installation

### 1. Install Ngrok

```bash
# macOS (using Homebrew)
brew install ngrok

# Windows
# Download from https://ngrok.com/download

# Linux
# Download and install from https://ngrok.com/download
```

### 2. Sign up for Ngrok Account

1. Go to [ngrok.com](https://ngrok.com)
2. Create a free account
3. Get your auth token from the dashboard

### 3. Authenticate Ngrok

```bash
ngrok authtoken YOUR_AUTH_TOKEN
```

### 4. Install Python Dependencies

```bash
cd backend
pip install requests
```

## Basic Setup

### Step 1: Start Factory UI Backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

The backend will start on `http://localhost:8000`

### Step 2: Start Ngrok Tunnel

In a new terminal:

```bash
ngrok http 8000
```

You'll see output like:
```
Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       51ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:8000
```

**Important**: Copy the `https://abc123.ngrok.io` URL - this is your public ngrok URL.

### Step 3: Test the Setup

Test that your ngrok tunnel is working:

```bash
curl https://abc123.ngrok.io/
```

Should return:
```json
{"message": "Factory UI Backend is running"}
```

## Using Ngrok with Factory UI

### Method 1: Using Ngrok HTTP Sender Node

1. **Create a workflow** in Factory UI
2. **Add NgrokHttpSenderNode** to your workflow
3. **Configure the node**:
   - `data`: The data you want to send (any type)
   - `ngrok_url`: Your ngrok URL (e.g., `https://abc123.ngrok.io`)
4. **Run the workflow** to send data

### Method 2: Using Ngrok HTTP Receiver Node

1. **Add NgrokHttpReceiverNode** to your workflow
2. **Configure the node**:
   - `endpoint`: The endpoint path (default: `/webhook`)
3. **Run the workflow** to start receiving data
4. **External clients can POST to**: `https://abc123.ngrok.io/webhook`

### Method 3: Direct HTTP Requests

Send data directly to your ngrok URL:

```bash
curl -X POST https://abc123.ngrok.io/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sensor_data",
    "data": {
      "temperature": 25.5,
      "humidity": 60.2,
      "timestamp": 1640995200
    }
  }'
```

## Testing

### Test Script

Run the provided test script:

```bash
cd backend
python test_ngrok_websocket.py
```

### Manual Testing

1. **Start the backend**:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

2. **Start ngrok**:
   ```bash
   ngrok http 8000
   ```

3. **Send test data**:
   ```bash
   curl -X POST https://YOUR_NGROK_URL.ngrok.io/webhook \
     -H "Content-Type: application/json" \
     -d '{"type": "test", "data": {"message": "Hello from ngrok!"}}'
   ```

4. **Check received messages**:
   ```bash
   curl https://YOUR_NGROK_URL.ngrok.io/webhook/messages
   ```

### Web Client Testing

1. Open `test_ngrok_client.html` in a browser
2. Enter your ngrok WebSocket URL: `wss://YOUR_NGROK_URL.ngrok.io`
3. Connect and send test messages

## Workflow Examples

### Example 1: Robot Status Broadcasting

```json
{
  "nodes": [
    {
      "id": "robot_status",
      "type": "SO101RobotStatusReader",
      "inputs": {
        "servo_ids": "1,2,3,4,5",
        "stream_results": true,
        "update_interval": 0.1
      }
    },
    {
      "id": "ngrok_sender",
      "type": "NgrokHttpSenderNode",
      "inputs": {
        "data": "{{robot_status.output}}",
        "ngrok_url": "https://abc123.ngrok.io"
      }
    }
  ],
  "edges": [
    {
      "from": "robot_status",
      "to": "ngrok_sender",
      "from_output": "robot_status",
      "to_input": "data"
    }
  ]
}
```

### Example 2: External Data Reception

```json
{
  "nodes": [
    {
      "id": "ngrok_receiver",
      "type": "NgrokHttpReceiverNode",
      "inputs": {
        "endpoint": "/webhook"
      }
    },
    {
      "id": "processor",
      "type": "TextProcessorNode",
      "inputs": {
        "text": "{{ngrok_receiver.received_data}}",
        "operation": "json_to_text"
      }
    }
  ],
  "edges": [
    {
      "from": "ngrok_receiver",
      "to": "processor",
      "from_output": "received_data",
      "to_input": "text"
    }
  ]
}
```

## API Endpoints

### Webhook Endpoints

- **POST** `/webhook` - Receive data from external clients
- **GET** `/webhook/messages` - Get all received messages
- **DELETE** `/webhook/messages` - Clear all messages

### Message Format

```json
{
  "type": "message_type",
  "timestamp": 1640995200.0,
  "data": {
    "key": "value"
  }
}
```

## Troubleshooting

### Common Issues

#### 1. 404 Errors
**Problem**: HTTP requests failing with 404
**Solution**: 
- Ensure backend is running on port 8000
- Check ngrok tunnel is active
- Verify the ngrok URL is correct

#### 2. Connection Refused
**Problem**: Cannot connect to ngrok tunnel
**Solution**:
- Check if ngrok is authenticated: `ngrok authtoken YOUR_TOKEN`
- Verify ngrok is running: `ngrok status`
- Check firewall settings

#### 3. Rate Limiting
**Problem**: Too many requests error
**Solution**:
- Upgrade to ngrok paid plan for higher limits
- Implement request throttling in your application
- Use ngrok's rate limiting features

#### 4. Tunnel Not Found
**Problem**: ngrok tunnel not accessible
**Solution**:
- Restart ngrok: `ngrok http 8000`
- Check ngrok dashboard at `http://localhost:4040`
- Verify tunnel status in ngrok console

### Debug Commands

```bash
# Check ngrok status
ngrok status

# View ngrok logs
ngrok http 8000 --log=stdout

# Test tunnel
curl https://YOUR_NGROK_URL.ngrok.io/

# Check backend health
curl http://localhost:8000/

# View webhook messages
curl http://localhost:8000/webhook/messages
```

### Log Analysis

Check backend logs for:
- `✓ Received webhook data: message_type`
- `❌ Webhook error: error_message`
- Connection status messages

## Advanced Usage

### Custom Endpoints

Create custom webhook endpoints by modifying the FastAPI app:

```python
@app.post("/custom-webhook")
async def custom_webhook(request: Dict[str, Any]):
    # Custom webhook logic
    return {"success": True}
```

### Authentication

Add authentication to your webhooks:

```python
@app.post("/secure-webhook")
async def secure_webhook(request: Dict[str, Any], token: str = Header(None)):
    if token != "your-secret-token":
        raise HTTPException(status_code=401, detail="Invalid token")
    # Process webhook
    return {"success": True}
```

### Message Filtering

Filter messages by type in your workflow:

```python
# In NgrokHttpReceiverNode
received_data = receiver.receive_http("/webhook")
sensor_messages = received_data.get("grouped_by_type", {}).get("sensor_data", [])
```

### Continuous Data Streaming

Set up continuous data streaming:

```python
# In a continuous workflow
while True:
    # Get sensor data
    sensor_data = get_sensor_readings()
    
    # Send through ngrok
    sender.send_http(
        data=sensor_data,
        ngrok_url="https://abc123.ngrok.io"
    )
    
    time.sleep(1)  # Send every second
```

### Multiple Tunnels

Run multiple ngrok tunnels for different services:

```bash
# Terminal 1: Main backend
ngrok http 8000

# Terminal 2: WebSocket server
ngrok http 8765

# Terminal 3: Custom service
ngrok http 3000
```

## Security Considerations

1. **Public Exposure**: Ngrok tunnels are publicly accessible
2. **Authentication**: Consider adding authentication to your webhooks
3. **Rate Limiting**: Be aware of ngrok's rate limits
4. **Data Validation**: Validate incoming messages
5. **HTTPS**: Use HTTPS URLs for secure communication

## Monitoring

### Ngrok Dashboard

Access ngrok dashboard at `http://localhost:4040` to:
- View tunnel status
- Monitor traffic
- Check request logs
- Manage tunnels

### Backend Monitoring

Monitor your backend for:
- Webhook message count
- Error rates
- Response times
- Connection status

## Support

For additional help:

1. Check ngrok documentation: [ngrok.com/docs](https://ngrok.com/docs)
2. Review Factory UI logs
3. Test with provided scripts
4. Check ngrok dashboard for tunnel status

## Quick Start Checklist

- [ ] Install ngrok
- [ ] Sign up for ngrok account
- [ ] Authenticate ngrok: `ngrok authtoken YOUR_TOKEN`
- [ ] Start Factory UI backend: `python -m uvicorn app.main:app --reload`
- [ ] Start ngrok tunnel: `ngrok http 8000`
- [ ] Test connection: `curl https://YOUR_NGROK_URL.ngrok.io/`
- [ ] Send test webhook: `curl -X POST https://YOUR_NGROK_URL.ngrok.io/webhook -H "Content-Type: application/json" -d '{"type":"test","data":{"message":"Hello"}}'`
- [ ] Check received messages: `curl https://YOUR_NGROK_URL.ngrok.io/webhook/messages`
- [ ] Create Factory UI workflow with NgrokHttpSenderNode or NgrokHttpReceiverNode
- [ ] Test workflow execution 