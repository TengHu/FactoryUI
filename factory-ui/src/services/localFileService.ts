import { apiService, WorkflowData } from './api';

export interface WorkflowItem {
  filename: string;
  workflow: WorkflowData;
}

export class LocalFileService {
  private static instance: LocalFileService;
  private listeners: Set<() => void> = new Set();

  static getInstance(): LocalFileService {
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService();
    }
    return LocalFileService.instance;
  }

  // Event system for auto-refresh
  addListener(callback: () => void): () => void {
    console.log(`📝 LocalFileService: Adding listener, total listeners: ${this.listeners.size + 1}`);
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
      console.log(`📝 LocalFileService: Removed listener, total listeners: ${this.listeners.size}`);
    };
  }

  private notifyListeners(): void {
    console.log(`📢 LocalFileService: Notifying ${this.listeners.size} listeners of changes`);
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
      const response = await apiService.getAllWorkflows();
      
      if (response.success) {
        // Convert the Record<string, WorkflowData> to WorkflowItem[]
        const workflows: WorkflowItem[] = Object.entries(response.workflows).map(([filename, workflow]) => ({
          filename,
          workflow
        }));
        
        return {
          success: true,
          workflows
        };
      } else {
        return {
          success: false,
          workflows: []
        };
      }
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
          name: filename.replace('.json', ''),
          modified: new Date().toISOString()
        }
      };

      // Use API service to save workflow
      const response = await apiService.createOrUpdateWorkflow({
        filename: filename.endsWith('.json') ? filename : `${filename}.json`,
        workflow_data: workflowData
      });

      if (response.success) {
        // Notify listeners of the change
        console.log(`💾 LocalFileService: Workflow saved successfully, notifying listeners`);
        this.notifyListeners();

        return {
          success: true,
          message: `Workflow saved as ${filename}`,
          workflow_id: filename
        };
      } else {
        return {
          success: false,
          message: 'Failed to save workflow to backend'
        };
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return {
        success: false,
        message: `Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async deleteWorkflow(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
      const response = await apiService.deleteWorkflow(normalizedFilename);

      if (response.success) {
        // Notify listeners of the change
        console.log(`🗑️ LocalFileService: Workflow deleted successfully, notifying listeners`);
        this.notifyListeners();

        return {
          success: true,
          message: `Workflow ${filename} deleted`
        };
      } else {
        return {
          success: false,
          message: 'Failed to delete workflow from backend'
        };
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      return {
        success: false,
        message: `Failed to delete workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async renameWorkflow(oldFilename: string, newFilename: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.renameWorkflow({
        old_filename: oldFilename.endsWith('.json') ? oldFilename : `${oldFilename}.json`,
        new_filename: newFilename.endsWith('.json') ? newFilename : `${newFilename}.json`
      });

      if (response.success) {
        // Notify listeners of the change
        console.log(`✏️ LocalFileService: Workflow renamed successfully, notifying listeners`);
        this.notifyListeners();

        return {
          success: true,
          message: `Workflow renamed from ${oldFilename} to ${newFilename}`
        };
      } else {
        return {
          success: false,
          message: 'Failed to rename workflow in backend'
        };
      }
    } catch (error) {
      console.error('Failed to rename workflow:', error);
      return {
        success: false,
        message: `Failed to rename workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const localFileService = LocalFileService.getInstance();