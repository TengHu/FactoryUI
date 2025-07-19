import { useState, useEffect } from 'react';
import { NodeInfo, apiService } from '../services/api';
import './NodePanel.css';

interface NodePanelProps {
  onNodeDrag: (nodeInfo: NodeInfo, event: React.DragEvent) => void;
}

const NodePanel = ({ onNodeDrag }: NodePanelProps) => {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('all');

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const response = await apiService.fetchAvailableNodes();
      setNodes(response.nodes);
      setError(null);
    } catch (err) {
      setError('Failed to load nodes from backend');
      console.error('Error fetching nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (nodeInfo: NodeInfo, event: React.DragEvent) => {
    console.log('Drag start for node:', nodeInfo.display_name);
    event.dataTransfer.setData('application/json', JSON.stringify(nodeInfo));
    event.dataTransfer.effectAllowed = 'copy';
    onNodeDrag(nodeInfo, event);
  };

  const allTags = Array.from(new Set(nodes.flatMap(node => node.tags || [])));
  const tags = ['all', ...allTags];
  const filteredNodes = selectedTag === 'all' 
    ? nodes 
    : nodes.filter(node => node.tags && node.tags.includes(selectedTag));

  const groupedNodes = filteredNodes.reduce((groups, node) => {
    const primaryTag = node.tags && node.tags.length > 0 ? node.tags[0] : 'untagged';
    if (!groups[primaryTag]) {
      groups[primaryTag] = [];
    }
    groups[primaryTag].push(node);
    return groups;
  }, {} as Record<string, NodeInfo[]>);

  if (loading) {
    return (
      <div className="node-panel">
        <div className="node-panel-header">
          <h3>Available Nodes</h3>
        </div>
        <div className="loading">Loading nodes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="node-panel">
        <div className="node-panel-header">
          <h3>Available Nodes</h3>
        </div>
        <div className="error">
          <p>{error}</p>
          <button onClick={fetchNodes} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="node-panel">
      <div className="node-panel-header">
        <h3>Available Nodes ({nodes.length})</h3>
        <button onClick={fetchNodes} className="refresh-button" title="Refresh nodes">
          🔄
        </button>
      </div>
      
      <div className="tag-filter">
        <select 
          value={selectedTag} 
          onChange={(e) => setSelectedTag(e.target.value)}
          className="tag-select"
        >
          {tags.map(tag => (
            <option key={tag} value={tag}>
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="nodes-list">
        {Object.entries(groupedNodes).map(([tag, tagNodes]) => (
          <div key={tag} className="node-tag-group">
            {selectedTag === 'all' && (
              <h4 className="tag-title">
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </h4>
            )}
            {tagNodes.map((node) => (
              <div
                key={node.name}
                className={`node-item node-${node.tags?.[0] || 'untagged'}`}
                draggable
                onDragStart={(e) => handleDragStart(node, e)}
                title={node.description}
              >
                <div className="node-item-header">
                  <span className="node-name">{node.display_name}</span>
                  <div className="node-tags">
                    {node.tags && node.tags.map(tag => (
                      <span key={tag} className="node-tag-badge">{tag}</span>
                    ))}
                  </div>
                </div>
                {node.description && (
                  <div className="node-description">{node.description}</div>
                )}
                <div className="node-details">
                  <span className="node-inputs">
                    Inputs: {Object.keys(node.input_types.required || {}).length + 
                             Object.keys(node.input_types.optional || {}).length}
                  </span>
                  <span className="node-outputs">
                    Outputs: {Array.isArray(node.return_types) 
                      ? node.return_types.length 
                      : Object.keys(node.return_types.required || {}).length + Object.keys(node.return_types.optional || {}).length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodePanel;