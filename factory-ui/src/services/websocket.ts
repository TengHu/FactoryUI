interface WebSocketMessage {
  type: string;
  timestamp?: number;
  data?: any;
  event?: string;
}

interface WebSocketEventHandler {
  (data: any): void;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000; // 3 seconds
  private isConnecting = false;
  private url: string;

  constructor(url: string = 'ws://localhost:8000/ws') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Send initial ping
          this.send('ping', { timestamp: Date.now() });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message.data);
      } catch (error) {
        console.error('Error in WebSocket event handler:', error);
      }
    });

    // Handle special message types
    if (message.type === 'pong') {
      console.log('Received pong from server');
    } else if (message.type === 'error') {
      console.error('Server error:', message.data?.message);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectInterval);
  }

  send(type: string, data?: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        timestamp: Date.now(),
        data
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', type);
    }
  }

  // Event subscription methods
  on(eventType: string, handler: WebSocketEventHandler): () => void {
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

  off(eventType: string, handler?: WebSocketEventHandler) {
    if (!handler) {
      // Remove all handlers for this event type
      this.eventHandlers.delete(eventType);
    } else {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  // Specific methods for common operations
  sendInputUpdate(nodeId: string, inputName: string, inputValue: any) {
    this.send('input_update', {
      node_id: nodeId,
      input_name: inputName,
      input_value: inputValue
    });
  }

  requestStatus() {
    this.send('get_status');
  }

  subscribe(events: string[]) {
    this.send('subscribe', { events });
  }

  // Connection status
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
    this.reconnectAttempts = 0;
  }

  // Ping to keep connection alive
  startHeartbeat(intervalMs: number = 30000) {
    const interval = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', { timestamp: Date.now() });
      } else {
        clearInterval(interval);
      }
    }, intervalMs);
    
    return () => clearInterval(interval);
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();

// Export types for use in components
export type { WebSocketMessage, WebSocketEventHandler };
export default WebSocketService;