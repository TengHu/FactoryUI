import React, { useState } from 'react';
import NodePanel from './NodePanel';
import WorkflowExplorer from './WorkflowExplorer';
import { NodeInfo } from '../services/api';
import { WorkflowItem } from '../services/localFileService';
import './LeftPanel.css';

interface LeftPanelProps {
  onNodeDrag: (nodeInfo: NodeInfo, event: React.DragEvent) => void;
  onWorkflowSelect: (filename: string, workflowName: string) => void;
  onWorkflowLoad?: (workflow: WorkflowItem) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ onNodeDrag, onWorkflowSelect, onWorkflowLoad }) => {
  const [activeTab, setActiveTab] = useState<'nodes' | 'workflows'>('workflows');

  return (
    <div className="left-panel">
      <div className="left-panel-tabs">
        <button 
          className={`tab-button ${activeTab === 'workflows' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          My Workflows
        </button>
        <button 
          className={`tab-button ${activeTab === 'nodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('nodes')}
        >
          Available Nodes
        </button>
      </div>
      
      <div className="left-panel-content">
        {activeTab === 'workflows' && (
          <WorkflowExplorer 
            onWorkflowSelect={onWorkflowSelect}
            onWorkflowLoad={onWorkflowLoad}
          />
        )}
        {activeTab === 'nodes' && (
          <NodePanel onNodeDrag={onNodeDrag} />
        )}
      </div>
    </div>
  );
};

export default LeftPanel;