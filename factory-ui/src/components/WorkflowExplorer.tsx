import React, { useState, useCallback, useEffect } from 'react';
import { Tree } from 'react-arborist';
import { localFileService, WorkflowItem } from '../services/localFileService';
import './WorkflowExplorer.css';

// Local interface definitions to avoid API dependencies
interface WorkflowData {
  nodes: any[];
  edges: any[];
  metadata?: Record<string, any>;
}

interface WorkflowTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'workflow';
  workflow?: WorkflowItem;
  children?: WorkflowTreeNode[];
}

interface WorkflowExplorerProps {
  onWorkflowSelect: (filename: string, workflowName: string) => void;
  onWorkflowLoad?: (workflow: WorkflowItem) => void;
}

const WorkflowExplorer: React.FC<WorkflowExplorerProps> = ({ onWorkflowSelect, onWorkflowLoad }) => {
  const [treeData, setTreeData] = useState<WorkflowTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load workflows from local file service
  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 WorkflowExplorer: Loading workflows...');
      const response = await localFileService.getAllWorkflows();
      if (response.success) {
        // Convert to tree structure
        const workflowNodes: WorkflowTreeNode[] = response.workflows.map(workflow => ({
          id: `workflow-${workflow.filename}`,
          name: workflow.filename,
          type: 'workflow' as const,
          workflow: workflow
        }));

        const rootStructure: WorkflowTreeNode[] = [
          {
            id: 'workflows-folder',
            name: 'Workflows',
            type: 'folder' as const,
            children: workflowNodes
          }
        ];

        setTreeData(rootStructure);
        console.log(`✅ WorkflowExplorer: Loaded ${workflowNodes.length} workflows`);
      } else {
        setError('Failed to load workflows');
      }
    } catch (err) {
      setError('Error loading workflows');
      console.error('Error loading workflows:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically load workflows on mount and set up auto-refresh
  useEffect(() => {
    loadWorkflows();
    
    // Subscribe to file service changes for auto-refresh with debouncing
    let debounceTimer: NodeJS.Timeout;
    const unsubscribe = localFileService.addListener(() => {
      console.log('🔄 WorkflowExplorer: Received change notification, reloading workflows...');
      // Debounce the reload to prevent too many rapid calls
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadWorkflows();
      }, 100);
    });
    
    return () => {
      clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [loadWorkflows]);

  const handleWorkflowClick = useCallback(async (node: WorkflowTreeNode) => {
    if (node.type === 'workflow' && node.workflow) {
      try {
        setSelectedId(node.id);
        
        if (onWorkflowLoad) {
          onWorkflowLoad(node.workflow);
        } else {
          const workflowName = node.workflow.filename;
          onWorkflowSelect(node.workflow.filename, workflowName);
        }
        
        console.log(`✓ Workflow "${node.workflow.filename}" loaded`);
      } catch (error) {
        console.error('Failed to load workflow:', error);
        alert('Failed to load workflow file');
      }
    }
  }, [onWorkflowSelect, onWorkflowLoad]);

  const handleRenameWorkflow = useCallback(async (workflow: WorkflowItem) => {
    const currentName = workflow.filename;
    const newName = prompt('Enter new workflow name:', currentName);
    if (!newName || newName === currentName) {
      return;
    }

    try {
      // Use the new name as-is
      const newFilename = newName;
      
      // Use rename operation which handles both the rename and cleanup
      const result = await localFileService.renameWorkflow(workflow.filename, newFilename);



      if (result.success) {
        console.log(`✓ Workflow renamed to "${newName}"`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Failed to rename workflow:', error);
      alert('Failed to rename workflow');
    }
  }, []);

  const handleDeleteWorkflow = useCallback(async (workflow: WorkflowItem) => {
    const workflowName = workflow.filename;
    if (!window.confirm(`Are you sure you want to delete workflow "${workflowName}"?`)) {
      return;
    }

    try {
      const result = await localFileService.deleteWorkflow(workflow.filename);
      if (result.success) {
        console.log(`✓ Workflow "${workflowName}" deleted`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      alert('Failed to delete workflow');
    }
  }, []);

  const handleDuplicateWorkflow = useCallback(async (workflow: WorkflowItem) => {
    const originalName = workflow.filename;
    const newName = prompt('Enter name for the duplicate:', `${originalName} (Copy)`);
    if (!newName) {
      return;
    }

    try {
      const newFilename = newName.endsWith('.json') ? newName : `${newName}.json`;
      const duplicatedWorkflow: WorkflowData = {
        ...workflow.workflow,
        metadata: {
          ...workflow.workflow.metadata,
          name: newName,
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      };

      const result = await localFileService.saveWorkflowByFilename(newFilename, duplicatedWorkflow);
      if (result.success) {
        console.log(`✓ Workflow duplicated as "${newFilename}"`);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Failed to duplicate workflow:', error);
      alert('Failed to duplicate workflow');
    }
  }, []);

  const Node = ({ node, style, dragHandle }: any) => {
    const handleClick = () => {
      if (node.data.type === 'workflow') {
        handleWorkflowClick(node.data);
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      
      if (node.data.type === 'workflow' && node.data.workflow) {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'workflow-context-menu';
        contextMenu.innerHTML = `
          <div class="context-menu-item" data-action="rename">✏️ Rename</div>
          <div class="context-menu-item" data-action="duplicate">📄 Duplicate</div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item danger" data-action="delete">🗑️ Delete</div>
        `;
        
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.zIndex = '1000';
        
        document.body.appendChild(contextMenu);

        const handleContextClick = (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          const action = target.getAttribute('data-action');
          
          if (action) {
            switch (action) {
              case 'rename':
                handleRenameWorkflow(node.data.workflow);
                break;
              case 'duplicate':
                handleDuplicateWorkflow(node.data.workflow);
                break;
              case 'delete':
                handleDeleteWorkflow(node.data.workflow);
                break;
            }
          }
          
          document.body.removeChild(contextMenu);
          document.removeEventListener('click', handleContextClick);
        };

        contextMenu.addEventListener('click', handleContextClick);
        
        // Remove menu when clicking elsewhere
        setTimeout(() => {
          document.addEventListener('click', handleContextClick, { once: true });
        }, 0);
      }
    };

    const isSelected = selectedId === node.data.id;
    const icon = node.data.type === 'folder' ? (node.isOpen ? '📂' : '📁') : '📄';

    return (
      <div
        ref={dragHandle}
        style={style}
        className={`workflow-tree-node ${node.data.type} ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="node-icon">{icon}</span>
        <span className="node-name">{node.data.name}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="workflow-explorer">
        <div className="workflow-explorer-header">
          <h3>Workflows</h3>
        </div>
        <div className="loading">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="workflow-explorer">
      <div className="workflow-explorer-header">
        <h3>Workflows</h3>
      </div>
      <div className="workflow-tree-container">
        {error && (
          <div className="error">
            {error}
            <button onClick={loadWorkflows}>Retry</button>
          </div>
        )}

        {!error && treeData.length > 0 ? (
          <Tree
            data={treeData}
            openByDefault={true}
            width="100%"
            height={1000}
            indent={16}
          >
            {Node}
          </Tree>
        ) : !error && (
          <div className="empty-state">
            <p>No workflows found</p>
            <p>Add workflow files to the backend/user/workflows directory</p>
            <button onClick={loadWorkflows}>Refresh</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowExplorer;