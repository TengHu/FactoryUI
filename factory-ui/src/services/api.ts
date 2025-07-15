const API_BASE_URL = 'http://localhost:8000';

export interface NodeInfo {
  name: string;
  display_name: string;
  description: string;
  category: string;
  input_types: {
    required?: Record<string, any>;
    optional?: Record<string, any>;
  };
  return_types: string[];
  function: string;
}

export interface NodesResponse {
  nodes: NodeInfo[];
  count: number;
}

export interface WorkflowData {
  nodes: any[];
  edges: any[];
  metadata?: Record<string, any>;
}

export interface ExecutionResponse {
  success: boolean;
  results?: Record<string, any>;
  logs?: Array<{
    level: string;
    message: string;
    traceback?: string;
  }>;
  error?: string;
}

export class ApiService {
  private static instance: ApiService;

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  async fetchAvailableNodes(): Promise<NodesResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/nodes`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch available nodes:', error);
      throw error;
    }
  }

  async getNodeInfo(nodeName: string): Promise<NodeInfo> {
    try {
      const response = await fetch(`${API_BASE_URL}/nodes/${nodeName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch node info for ${nodeName}:`, error);
      throw error;
    }
  }

  async saveWorkflow(workflow: WorkflowData): Promise<{ success: boolean; message: string; workflow_id?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to save workflow:', error);
      throw error;
    }
  }

  async executeWorkflow(workflow: WorkflowData): Promise<ExecutionResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      throw error;
    }
  }

  async stopExecution(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/stop`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to stop execution:', error);
      throw error;
    }
  }

  async getExecutionStatus(): Promise<{
    is_running: boolean;
    has_workflow: boolean;
    results: Record<string, any>;
    logs: Array<{ level: string; message: string }>;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get execution status:', error);
      throw error;
    }
  }

  async connectRobot(port: string, baudrate: number = 115200, deviceType: string = 'serial'): Promise<{
    success: boolean;
    message: string;
    device_info?: any;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/robot/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          port,
          baudrate,
          device_type: deviceType,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to connect robot:', error);
      throw error;
    }
  }

  async disconnectRobot(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/robot/disconnect`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to disconnect robot:', error);
      throw error;
    }
  }

  async getRobotStatus(): Promise<{
    connected: boolean;
    port: string | null;
    device_info: any;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/robot/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get robot status:', error);
      throw error;
    }
  }

  async startContinuousExecution(workflow: WorkflowData): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/continuous/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to start continuous execution:', error);
      throw error;
    }
  }

  async stopContinuousExecution(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/continuous/stop`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to stop continuous execution:', error);
      throw error;
    }
  }

  async getContinuousStatus(): Promise<{
    is_running: boolean;
    has_workflow: boolean;
    execution_count: number;
    last_execution_time: number;
    loop_interval: number;
    results: Record<string, any>;
    logs: Array<{ level: string; message: string }>;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/continuous/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get continuous status:', error);
      throw error;
    }
  }

  async setContinuousInterval(interval: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/continuous/set-interval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(interval),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to set continuous interval:', error);
      throw error;
    }
  }
}

export const apiService = ApiService.getInstance();