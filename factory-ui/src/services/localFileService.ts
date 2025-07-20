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

  static getInstance(): LocalFileService {
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService();
    }
    return LocalFileService.instance;
  }

  async getAllWorkflows(): Promise<{ success: boolean; workflows: WorkflowItem[] }> {
    try {
      // Fetch list of workflow files from public/workflows directory
      const workflowFiles = [
        'Untitleddd.json',
        'joints_control.json',
        'llm.json',
        'read_robot_status.json',
        'teleoperation.json',
        'teleoperation_through_ngrok.json',
        'unlock_robot.json'
      ];

      const workflows: WorkflowItem[] = [];

      for (const filename of workflowFiles) {
        try {
          const response = await fetch(`${this.baseUrl}/${filename}`);
          if (response.ok) {
            const workflow = await response.json();
            workflows.push({
              filename,
              workflow
            });
          }
        } catch (error) {
          console.warn(`Failed to load workflow ${filename}:`, error);
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
      // In a real browser environment, we can't directly write to the public directory
      // Instead, we'll simulate saving by storing in localStorage and providing download functionality
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

      // Create a downloadable blob
      const blob = new Blob([JSON.stringify(workflowData, null, 2)], {
        type: 'application/json'
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Workflow ${filename} saved to localStorage and downloaded`);

      return {
        success: true,
        message: `Workflow saved as ${filename} and downloaded`,
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

      return {
        success: true,
        message: `Workflow ${filename} removed from local storage`
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