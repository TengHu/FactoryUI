import React, { useState, useCallback, useEffect } from 'react';
import { Tree } from 'react-arborist';
import { localFileService, WorkflowItem } from '../services/localFileService';
import './WorkflowExplorer.css';

interface WorkflowTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'workflow';
  workflow?: WorkflowItem;
  children?: WorkflowTreeNode[];
}

interface WorkflowExplorerProps {
  onWorkflowSelect: (workflowData: any, workflowName: string) => void;
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
      const response = await localFileService.getAllWorkflows();
      if (response.success) {
        // Convert to tree structure
        const workflowNodes: WorkflowTreeNode[] = response.workflows.map(workflow => ({
          id: `workflow-${workflow.filename}`,
          name: workflow.workflow.metadata?.name || workflow.filename.replace('.json', ''),
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

  // Automatically load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleWorkflowClick = useCallback(async (node: WorkflowTreeNode) => {
    if (node.type === 'workflow' && node.workflow) {
      try {
        setSelectedId(node.id);
        
        if (onWorkflowLoad) {
          onWorkflowLoad(node.workflow);
        } else {
          const workflowName = node.workflow.workflow.metadata?.name || node.workflow.filename.replace('.json', '');
          onWorkflowSelect(node.workflow.workflow, workflowName);
        }
        
        console.log(`✓ Workflow "${node.workflow.filename}" loaded`);
      } catch (error) {
        console.error('Failed to load workflow:', error);
        alert('Failed to load workflow file');
      }
    }
  }, [onWorkflowSelect, onWorkflowLoad]);

  const Node = ({ node, style, dragHandle }: any) => {
    const handleClick = () => {
      if (node.data.type === 'workflow') {
        handleWorkflowClick(node.data);
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
            height={300}
            indent={16}
          >
            {Node}
          </Tree>
        ) : !error && (
          <div className="empty-state">
            <p>No workflows found</p>
            <p>Add workflow files to the public/workflows directory</p>
            <button onClick={loadWorkflows}>Refresh</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowExplorer;