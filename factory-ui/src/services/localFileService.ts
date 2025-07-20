export interface WorkflowData {
  nodes: any[];
  edges: any[];
  metadata?: Record<string, any>;
}

export interface WorkflowItem {
  filename: string;
  workflow: WorkflowData;
}

export class LocalFileService {
  private static instance: LocalFileService;
  private baseUrl = '/workflows';
  private listeners: Set<() => void> = new Set();

  static getInstance(): LocalFileService {
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService();
    }
    return LocalFileService.instance;
  }

  // Event system for auto-refresh
  addListener(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in LocalFileService listener:', error);
      }
    });
  }

  async getAllWorkflows(): Promise<{ success: boolean; workflows: WorkflowItem[] }> {
    try {
      // First get workflows from public directory
      const publicWorkflowFiles = [
        'Untitleddd.json',
        'joints_control.json',
        'llm.json',
        'read_robot_status.json',
        'teleoperation.json',
        'teleoperation_through_ngrok.json',
        'unlock_robot.json'
      ];

      const workflows: WorkflowItem[] = [];
      const processedFiles = new Set<string>();

      // Load from localStorage first (these take priority)
      const localWorkflows = await this.getLocalWorkflows();
      for (const filename of localWorkflows) {
        try {
          const workflow = await this.loadWorkflowFromFile(filename);
          if (workflow) {
            workflows.push({ filename, workflow });
            processedFiles.add(filename);
          }
        } catch (error) {
          console.warn(`Failed to load local workflow ${filename}:`, error);
        }
      }

      // Get list of deleted workflows
      const deletedWorkflows = JSON.parse(localStorage.getItem('deleted_workflows') || '[]');

      // Then load from public directory (but skip if already loaded from localStorage or deleted)
      for (const filename of publicWorkflowFiles) {
        if (processedFiles.has(filename) || deletedWorkflows.includes(filename)) {
          continue; // Skip, already loaded from localStorage or marked as deleted
        }

        try {
          const response = await fetch(`${this.baseUrl}/${filename}`);
          if (response.ok) {
            const workflow = await response.json();
            workflows.push({ filename, workflow });
            processedFiles.add(filename);
          }
        } catch (error) {
          console.warn(`Failed to load public workflow ${filename}:`, error);
        }
      }

      return {
        success: true,
        workflows
      };
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      return {
        success: false,
        workflows: []
      };
    }
  }

  async saveWorkflowByFilename(filename: string, workflow: WorkflowData): Promise<{ success: boolean; message: string; workflow_id?: string }> {
    try {
      const workflowData = {
        ...workflow,
        metadata: {
          ...workflow.metadata,
          modified: new Date().toISOString()
        }
      };

      // Store in localStorage for persistence
      const storageKey = `workflow_${filename}`;
      localStorage.setItem(storageKey, JSON.stringify(workflowData));

      console.log(`Workflow ${filename} saved to localStorage`);
      
      // Notify listeners of the change
      this.notifyListeners();

      return {
        success: true,
        message: `Workflow saved as ${filename}`,
        workflow_id: filename
      };
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return {
        success: false,
        message: `Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async loadWorkflowFromFile(filename: string): Promise<WorkflowData | null> {
    try {
      // First try to load from localStorage
      const storageKey = `workflow_${filename}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }

      // Fall back to public directory
      const response = await fetch(`${this.baseUrl}/${filename}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to load workflow ${filename}:`, error);
      return null;
    }
  }

  async deleteWorkflow(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      // Remove from localStorage
      const storageKey = `workflow_${filename}`;
      localStorage.removeItem(storageKey);

      // Also add to a "deleted" list to hide public workflows
      const deletedKey = 'deleted_workflows';
      const deleted = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      if (!deleted.includes(filename)) {
        deleted.push(filename);
        localStorage.setItem(deletedKey, JSON.stringify(deleted));
      }

      // Notify listeners of the change
      this.notifyListeners();

      return {
        success: true,
        message: `Workflow ${filename} deleted`
      };
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      return {
        success: false,
        message: `Failed to delete workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getLocalWorkflows(): Promise<string[]> {
    // Get all workflow files from localStorage
    const workflowKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('workflow_')) {
        workflowKeys.push(key.replace('workflow_', ''));
      }
    }
    return workflowKeys;
  }

  async importWorkflowFromFile(file: File): Promise<{ success: boolean; message: string; workflow?: WorkflowData }> {
    try {
      const text = await file.text();
      const workflow = JSON.parse(text);

      // Validate workflow structure
      if (!workflow.nodes || !workflow.edges) {
        throw new Error('Invalid workflow format: missing nodes or edges');
      }

      // Store in localStorage
      const filename = file.name;
      const storageKey = `workflow_${filename}`;
      localStorage.setItem(storageKey, text);

      // Notify listeners of the change
      this.notifyListeners();

      return {
        success: true,
        message: `Workflow imported from ${filename}`,
        workflow
      };
    } catch (error) {
      console.error('Failed to import workflow:', error);
      return {
        success: false,
        message: `Failed to import workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const localFileService = LocalFileService.getInstance();