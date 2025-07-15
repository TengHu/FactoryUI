import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeInfo } from '../services/api';
import './CustomNode.css';

export interface CustomNodeProps extends NodeProps<CustomNodeData> {
  onContextMenu?: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void;
  onInputValueChange?: (nodeId: string, inputName: string, value: string) => void;
}

interface CustomNodeData {
  label: string;
  nodeInfo: NodeInfo;
  type: string;
  inputModes?: Record<string, 'connection' | 'manual'>;
  inputValues?: Record<string, string>;
}

const CustomNode = ({ id, data, selected, ...props }: CustomNodeProps) => {
  const { nodeInfo, inputModes = {}, inputValues = {} } = data;
  const onContextMenu = (props as any).onContextMenu;
  const onInputValueChange = (props as any).onInputValueChange;
  
  // State for detailed description modal
  const [showDetailedDescription, setShowDetailedDescription] = useState(false);

  // Parse inputs from nodeInfo
  const requiredInputs = Object.keys(nodeInfo.input_types.required || {});
  const optionalInputs = Object.keys(nodeInfo.input_types.optional || {});
  const allInputs = [...requiredInputs, ...optionalInputs];
  
  // Parse outputs from nodeInfo - handle both old format (string[]) and new format (dict)
  let outputs: Array<{name: string, type: string, required?: boolean}> = [];
  if (Array.isArray(nodeInfo.return_types)) {
    // Old format: string array
    outputs = nodeInfo.return_types.map((type, index) => ({
      name: (nodeInfo.return_types as string[]).length === 1 ? 'output' : `output-${index}`,
      type: type,
      required: true
    }));
  } else if (nodeInfo.return_types && typeof nodeInfo.return_types === 'object') {
    // New format: dict with required/optional
    const requiredOutputs = Object.entries(nodeInfo.return_types.required || {}).map(([name, typeInfo]) => ({
      name,
      type: Array.isArray(typeInfo) ? typeInfo[0] : typeInfo,
      required: true
    }));
    const optionalOutputs = Object.entries(nodeInfo.return_types.optional || {}).map(([name, typeInfo]) => ({
      name,
      type: Array.isArray(typeInfo) ? typeInfo[0] : typeInfo,
      required: false
    }));
    outputs = [...requiredOutputs, ...optionalOutputs];
  }

  // Get category for styling
  const category = nodeInfo.category;

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onContextMenu) {
      onContextMenu(event, id, nodeInfo);
    }
  };

  const handleQuestionMarkClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setShowDetailedDescription(true);
  };

  const handleModalClose = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setShowDetailedDescription(false);
  };

  return (
    <div 
      className={`custom-node ${selected ? 'selected' : ''} node-${category}`}
      onContextMenu={handleContextMenu}
    >
      {/* Node header */}
      <div className="node-header">
        <div className="node-title">{nodeInfo.display_name}</div>
        <div className="node-header-right">
          <div className="node-category-badge">{category}</div>
          {nodeInfo.detailed_description && (
            <button 
              className="node-help-button"
              onClick={handleQuestionMarkClick}
              title="Show detailed description"
            >
              ?
            </button>
          )}
        </div>
      </div>
      {nodeInfo.description && (
        <div className="node-description">{nodeInfo.description}</div>
      )}
      {/* Main node body: inputs left, content center, outputs right */}
      <div className="node-io-row">
        {/* Inputs column */}
        <div className="io-column io-inputs">
          {allInputs.map((input) => {
            const isRequired = requiredInputs.includes(input);
            const typeInfo =
              (nodeInfo.input_types.required && nodeInfo.input_types.required[input]) ||
              (nodeInfo.input_types.optional && nodeInfo.input_types.optional[input]) ||
              ['unknown'];
            const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
            // Default to manual mode for STRING and FLOAT inputs, connection mode for others
            const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT') ? 'manual' : 'connection';
            const inputMode = inputModes[input] || defaultMode;
            const inputValue = inputValues[input] || '';
            
            return (
              <div key={`input-${input}`} className="io-item input-item">
                {inputMode === 'connection' && (
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={input}
                    className="connection-handle input-handle"
                    data-input-type={typeName}
                    style={{
                      background: isRequired ? '#ef4444' : '#94a3b8',
                      border: '2px solid white',
                      width: '10px',
                      height: '10px',
                    }}
                    title={`${input} (${typeName}) - ${isRequired ? 'required' : 'optional'}`}
                  />
                )}
                
                {inputMode === 'manual' ? (
                  <div className="manual-input-container">
                    <span className="input-label">{input}:</span>
                    <input
                      type="text"
                      className="manual-input"
                      value={inputValue}
                      placeholder={`Enter ${typeName.toLowerCase()}`}
                      onChange={(e) => {
                        if (onInputValueChange) {
                          onInputValueChange(id, input, e.target.value);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <span className={`connection-label ${isRequired ? 'required' : 'optional'}`}>
                    {`${input} (${typeName})`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Center content */}
        <div className="io-center" />
        {/* Outputs column */}
        <div className="io-column io-outputs">
          {outputs.map((output, index) => {
            const outputId = outputs.length === 1 ? 'output' : `output-${index}`;
            const isRequired = output.required !== false; // Default to required if not specified
            return (
              <div key={`output-${index}`} className="io-item output-item">
                <span className={`connection-label output-label ${isRequired ? 'required' : 'optional'}`}>
                  {`${output.name} (${output.type})`}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={outputId}
                  className="connection-handle output-handle"
                  data-output-type={output.type}
                  style={{
                    background: isRequired ? '#22c55e' : '#10b981',
                    border: '2px solid white',
                    width: '10px',
                    height: '10px',
                  }}
                  title={`${output.name} (${output.type}) - ${isRequired ? 'required' : 'optional'}`}
                />
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Detailed Description Modal */}
      {showDetailedDescription && (
        <div className="node-modal-overlay" onClick={handleModalClose}>
          <div className="node-modal" onClick={(e) => e.stopPropagation()}>
            <div className="node-modal-header">
              <h3>{nodeInfo.display_name} - Detailed Description</h3>
              <button className="node-modal-close" onClick={handleModalClose}>
                ×
              </button>
            </div>
            <div className="node-modal-content">
              <pre className="node-detailed-description">
                {nodeInfo.detailed_description}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(CustomNode);