from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import os
import sys
import json
import logging

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.node_registry import node_registry
from continuous_executor import ContinuousExecutor
from websocket_manager import websocket_manager

app = FastAPI(title="Factory UI Backend", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class WorkflowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = {}
    sleep_time: Optional[float] = 1.0  # Sleep time between iterations for continuous execution

class WorkflowResponse(BaseModel):
    success: bool
    message: str
    workflow_id: Optional[str] = None

class ExecutionResponse(BaseModel):
    success: bool
    results: Optional[Dict[str, Any]] = None
    logs: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None

class RobotConnectionRequest(BaseModel):
    port: str
    baudrate: int = 115200
    device_type: str = "serial"


# Robot connection state
robot_state = {
    "connected": False,
    "port": None,
    "device_info": None
}

# Global executor instance with WebSocket support
# This single executor handles both continuous and single workflow execution
executor = ContinuousExecutor(loop_interval=1, websocket_manager=websocket_manager)

@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    # Discover nodes from custom_nodes directory
    custom_nodes_dir = os.path.join(os.path.dirname(__file__), "..", "custom_nodes")
    node_registry.discover_nodes(custom_nodes_dir)
    print(f"Discovered {len(node_registry.get_all_nodes())} nodes")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Factory UI Backend is running"}

@app.get("/nodes")
async def get_available_nodes():
    """Get all available node types"""
    return {
        "nodes": node_registry.get_all_node_info(),
        "count": len(node_registry.get_all_nodes())
    }

@app.get("/nodes/{node_name}")
async def get_node_info(node_name: str):
    """Get detailed information about a specific node"""
    node_info = node_registry.get_node_info(node_name)
    if not node_info:
        raise HTTPException(status_code=404, detail=f"Node {node_name} not found")
    return node_info

@app.post("/workflow", response_model=WorkflowResponse)
async def save_workflow(workflow: WorkflowRequest):
    """Save a workflow (placeholder - could save to database/file)"""
    try:
        # For now, just validate the workflow structure
        if not workflow.nodes:
            raise HTTPException(status_code=400, detail="Workflow must contain at least one node")
        
        # Could implement actual saving logic here
        return WorkflowResponse(
            success=True,
            message="Workflow saved successfully",
            workflow_id="temp_id"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/run", response_model=ExecutionResponse)
async def run_workflow(workflow: WorkflowRequest):
    """Execute a workflow once"""
    try:
        if executor.is_running:
            raise HTTPException(status_code=409, detail="Continuous execution is running. Stop it first to run a single workflow.")
        
        # Convert workflow to execution format
        workflow_data = {
            "nodes": workflow.nodes,
            "edges": workflow.edges,
            "metadata": workflow.metadata
        }
        
        # Execute workflow once
        result = executor.execute_workflow_once(workflow_data)
        
        return ExecutionResponse(**result)
    
    except Exception as e:
        return ExecutionResponse(
            success=False,
            error=str(e)
        )

@app.post("/stop")
async def stop_execution():
    """Stop the current workflow execution"""
    try:
        if executor.is_running:
            executor.stop_continuous_execution()
            return {
                "success": True,
                "message": "Execution stopped"
            }
        else:
            return {
                "success": True,
                "message": "No execution running"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop execution: {str(e)}")

@app.get("/status")
async def get_execution_status():
    """Get current execution status"""
    status = executor.get_status()
    
    return {
        "execution": status
    }

@app.post("/robot/connect")
async def connect_robot(connection: RobotConnectionRequest):
    """Connect to a robot device"""
    try:
        # Placeholder for robot connection logic
        # This would integrate with your actual robot communication library
        robot_state["connected"] = True
        robot_state["port"] = connection.port
        robot_state["device_info"] = {
            "port": connection.port,
            "baudrate": connection.baudrate,
            "device_type": connection.device_type
        }
        
        return {
            "success": True,
            "message": f"Connected to robot on {connection.port}",
            "device_info": robot_state["device_info"]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to robot: {str(e)}")

@app.post("/robot/disconnect")
async def disconnect_robot():
    """Disconnect from robot device"""
    try:
        # Placeholder for robot disconnection logic
        robot_state["connected"] = False
        robot_state["port"] = None
        robot_state["device_info"] = None
        
        return {
            "success": True,
            "message": "Disconnected from robot"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect from robot: {str(e)}")

@app.get("/robot/status")
async def get_robot_status():
    """Get robot connection status"""
    return robot_state

@app.post("/continuous/start")
async def start_continuous_execution(workflow: WorkflowRequest):
    """Start continuous execution of a workflow"""
    try:
        # Convert workflow to execution format
        workflow_data = {
            "nodes": workflow.nodes,
            "edges": workflow.edges,
            "metadata": workflow.metadata
        }
        
        # Set the sleep time for continuous execution
        executor.set_loop_interval(workflow.sleep_time)
        
        # Load workflow into continuous executor
        if executor.load_workflow(workflow_data):
            executor.start_continuous_execution()
            return {
                "success": True,
                "message": f"Continuous execution started with {workflow.sleep_time}s sleep interval"
            }
        else:
            return {
                "success": False,
                "message": "Failed to load workflow for continuous execution"
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start continuous execution: {str(e)}")

@app.post("/continuous/stop")
async def stop_continuous_execution():
    """Stop continuous execution"""
    try:
        executor.stop_continuous_execution()
        return {
            "success": True,
            "message": "Continuous execution stopped"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop continuous execution: {str(e)}")

@app.get("/continuous/status")
async def get_continuous_status():
    """Get continuous execution status"""
    return executor.get_status()

# WebSocket endpoint for real-time communication
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                await handle_websocket_message(websocket, message)
            except json.JSONDecodeError:
                await websocket_manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format"
                }, websocket)
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

async def handle_websocket_message(websocket: WebSocket, message: Dict[str, Any]):
    """Handle incoming WebSocket messages from client"""
    message_type = message.get("type")

    print(f"📨 Received WebSocket message type: {message_type}")
    
    if message_type == "ping":
        # Respond to ping with pong
        await websocket_manager.send_personal_message({
            "type": "pong",
            "timestamp": message.get("timestamp")
        }, websocket)
        
    elif message_type == "subscribe":
        # Client wants to subscribe to specific events
        events = message.get("events", [])
        await websocket_manager.send_personal_message({
            "type": "subscription_confirmed",
            "events": events
        }, websocket)
        
        
    elif message_type == "get_status":
        # Client requesting current status
        execution_status = executor.get_status()
        
        await websocket_manager.send_personal_message({
            "type": "status_response",
            "data": {
                "execution": execution_status,
                "robot": robot_state
            }
        }, websocket)


    elif message_type == "input_update":
        # Only allow parameter updates when executor is running
        if not executor.is_running:
            return

        # Handle real-time parameter updates
        data = message.get("data", {})
        node_id = data.get("node_id")
        input_name = data.get("input_name")
        input_value = data.get("input_value")
        
        if not all([node_id, input_name is not None]):
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Missing required fields: node_id, input_name"
            }, websocket)
            return
        
        # Update the node parameter in real-time
        success = executor.update_node_parameter(node_id, input_name, input_value)
        
        print ("Updated node parameter", node_id, input_name, input_value, success)

        if success:
            # Broadcast the parameter update to all connected clients
            await websocket_manager.broadcast({
                "type": "parameter_updated",
                "timestamp": message.get("timestamp"),
                "data": {
                    "node_id": node_id,
                    "parameter_name": input_name,
                    "parameter_value": input_value,
                    "success": True
                }
            })
            
            # Send confirmation to the requesting client
            await websocket_manager.send_personal_message({
                "type": "input_update_response",
                "data": {
                    "node_id": node_id,
                    "input_name": input_name,
                    "input_value": input_value,
                    "success": True,
                    "message": "Parameter updated successfully"
                }
            }, websocket)
        else:
            # Send error response
            await websocket_manager.send_personal_message({
                "type": "input_update_response",
                "data": {
                    "node_id": node_id,
                    "input_name": input_name,
                    "input_value": input_value,
                    "success": False,
                    "message": "Failed to update parameter"
                }
            }, websocket)
    
    else:
        # Unknown message type
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }, websocket)
            

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)