interface WebSocketMessage {
  type: string;
  timestamp?: number;
  data?: any;
  event?: string;
}

interface WebSocketEventHandler {
  (data: any): void;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastError: Error | null;
  connectionTime: number | null;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000; // 3 seconds
  private isConnecting = false;
  private url: string;
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    lastError: null,
    connectionTime: null
  };
  private connectionStateListeners: ((state: ConnectionState) => void)[] = [];

  constructor(url: string = 'ws://localhost:8000/ws') {
    this.url = url;
  }

  private updateConnectionState(updates: Partial<ConnectionState>) {
    this.connectionState = { ...this.connectionState, ...updates };
    this.isConnecting = this.connectionState.isConnecting;
    this.reconnectAttempts = this.connectionState.reconnectAttempts;
    
    // Notify all listeners
    this.connectionStateListeners.forEach(listener => {
      try {
        listener(this.connectionState);
      } catch (error) {
        console.error('Error in connection state listener:', error);
      }
    });
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionStateListeners.push(listener);
    
    // Immediately call with current state
    listener(this.connectionState);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionStateListeners.indexOf(listener);
      if (index > -1) {
        this.connectionStateListeners.splice(index, 1);
      }
    };
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.connectionState.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.updateConnectionState({ 
        isConnecting: true, 
        lastError: null 
      });

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.updateConnectionState({
            isConnected: true,
            isConnecting: false,
            reconnectAttempts: 0,
            lastError: null,
            connectionTime: Date.now()
          });
          
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
          this.updateConnectionState({
            isConnected: false,
            isConnecting: false,
            connectionTime: null
          });
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          const wsError = error instanceof Error ? error : new Error('WebSocket error');
          this.updateConnectionState({
            isConnected: false,
            isConnecting: false,
            lastError: wsError
          });
          if (this.connectionState.reconnectAttempts === 0) {
            reject(wsError);
          }
        };

      } catch (error) {
        const wsError = error instanceof Error ? error : new Error('Failed to create WebSocket');
        this.updateConnectionState({
          isConnecting: false,
          lastError: wsError
        });
        reject(wsError);
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
    if (this.connectionState.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.updateConnectionState({
        lastError: new Error('Max reconnection attempts reached')
      });
      return;
    }

    const newAttempts = this.connectionState.reconnectAttempts + 1;
    this.updateConnectionState({
      reconnectAttempts: newAttempts
    });
    
    console.log(`Attempting to reconnect (${newAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        this.updateConnectionState({
          lastError: error instanceof Error ? error : new Error('Reconnection failed')
        });
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
    return this.connectionState.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      lastError: null,
      connectionTime: null
    });
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
export type { WebSocketMessage, WebSocketEventHandler, ConnectionState };
export default WebSocketService;