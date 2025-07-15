import { memo } from 'react';
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

  // Parse inputs from nodeInfo
  const requiredInputs = Object.keys(nodeInfo.input_types.required || {});
  const optionalInputs = Object.keys(nodeInfo.input_types.optional || {});
  const allInputs = [...requiredInputs, ...optionalInputs];
  
  // Parse outputs from nodeInfo
  const outputs = nodeInfo.return_types || [];

  // Get category for styling
  const category = nodeInfo.category;

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onContextMenu) {
      onContextMenu(event, id, nodeInfo);
    }
  };

  return (
    <div 
      className={`custom-node ${selected ? 'selected' : ''} node-${category}`}
      onContextMenu={handleContextMenu}
    >
      {/* Node header */}
      <div className="node-header">
        <div className="node-title">{nodeInfo.display_name}</div>
        <div className="node-category-badge">{category}</div>
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
            const inputMode = inputModes[input] || 'connection';
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
            return (
              <div key={`output-${index}`} className="io-item output-item">
                <span className="connection-label output-label">{output}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={outputId}
                  className="connection-handle output-handle"
                  data-output-type={output}
                  style={{
                    background: '#22c55e',
                    border: '2px solid white',
                    width: '10px',
                    height: '10px',
                  }}
                  title={`Output: ${output}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(CustomNode);