#!/usr/bin/env python3
"""
Factory UI Backend Server
Run this script to start the backend server
"""

import sys
import os
import uvicorn

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting Factory UI Backend Server...")
    print("API documentation will be available at: http://localhost:8000/docs")
    print("Server will run on: http://localhost:8000")
    print("Press Ctrl+C to stop the server")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload for development
        log_level="info"
    )