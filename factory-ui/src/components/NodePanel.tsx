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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  const categories = ['all', ...Array.from(new Set(nodes.map(node => node.category)))];
  const filteredNodes = selectedCategory === 'all' 
    ? nodes 
    : nodes.filter(node => node.category === selectedCategory);

  const groupedNodes = filteredNodes.reduce((groups, node) => {
    const category = node.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(node);
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
      
      <div className="category-filter">
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="category-select"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="nodes-list">
        {Object.entries(groupedNodes).map(([category, categoryNodes]) => (
          <div key={category} className="node-category">
            {selectedCategory === 'all' && (
              <h4 className="category-title">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </h4>
            )}
            {categoryNodes.map((node) => (
              <div
                key={node.name}
                className={`node-item node-${node.category}`}
                draggable
                onDragStart={(e) => handleDragStart(node, e)}
                title={node.description}
              >
                <div className="node-item-header">
                  <span className="node-name">{node.display_name}</span>
                  <span className="node-category-badge">{node.category}</span>
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
                    Outputs: {node.return_types.length}
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