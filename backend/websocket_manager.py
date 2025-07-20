from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_ids: Dict[WebSocket, str] = {}
        
    async def connect(self, websocket: WebSocket, client_id: str = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        if client_id:
            self.connection_ids[websocket] = client_id
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")
        
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            if websocket in self.connection_ids:
                client_id = self.connection_ids.pop(websocket)
                logger.info(f"WebSocket client {client_id} disconnected")
            logger.info(f"WebSocket client disconnected. Total connections: {len(self.active_connections)}")
            
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
            self.disconnect(websocket)
            
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients"""
        if not self.active_connections:
            return
            
        message_str = json.dumps(message)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Failed to send broadcast message: {e}")
                disconnected.append(connection)
                
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)
            
        
    async def broadcast_node_state(self, node_id: str, state: str, data: Dict[str, Any] = None):
        """Broadcast node state change"""
        message = {
            "type": "node_state",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "node_id": node_id,
                "state": state,
                "data": data or {}
            }
        }
        await self.broadcast(message)
        
    async def broadcast_workflow_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast workflow-related events"""
        message = {
            "type": "workflow_event",
            "data": {
                "event": event_type,
                "timestamp": asyncio.get_event_loop().time(),
                "data": data
            }
        }
        await self.broadcast(message)
        
    async def broadcast_continuous_update(self, execution_count: int, status: str, data: Dict[str, Any] = None):
        """Broadcast continuous execution updates"""
        message = {
            "type": "continuous_update",
            "timestamp": asyncio.get_event_loop().time(),
            "data": {
                "execution_count": execution_count,
                "status": status,
                "data": data or {}
            }
        }
        await self.broadcast(message)
        
    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self.active_connections)

# Global WebSocket manager instance
websocket_manager = WebSocketManager()