#!/usr/bin/env python3
"""
Simple Relay Server

A basic HTTP server that stores data in a queue via POST and retrieves it via GET.
"""

import logging
from collections import deque
from datetime import datetime

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s')
logger = logging.getLogger(__name__)

# Global queue
queue = deque()

class Message(BaseModel):
    timestamp: float
    payload: dict

app = FastAPI(title="Relay Server")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Server info"""
    return {
        "message": "Relay Server",
        "endpoints": {
            "POST /data": "Add data to queue",
            "GET /data": "Get data from queue",
            "GET /status": "Queue status"
        }
    }

@app.post("/data")
async def add_data(message: Message):
    """Add data to queue"""
    queue.append({
        "timestamp": message.timestamp,
        "payload": message.payload
    })
    return {"status": "added", "queue_size": len(queue)}

@app.get("/data")
async def get_data():
    """Get data from queue (FIFO)"""
    if not queue:
        return {"status": "empty", "data": None}
    item = queue.popleft()

    return {"data": item}

@app.get("/status")
async def get_status():
    """Get queue status"""
    return {
        "queue_size": len(queue),
        "is_empty": len(queue) == 0
    }

# Handle any other paths to avoid 404s
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def catch_all(request: Request, path: str):
    """Catch all other requests and log them"""
    logger.warning(f"Unhandled request: {request.method} /{path}")
    return {"error": f"Endpoint /{path} not found", "method": request.method}

if __name__ == "__main__":
    logger.info("Starting Relay Server on http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001) 