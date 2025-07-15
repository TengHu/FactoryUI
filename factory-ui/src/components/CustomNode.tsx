import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeInfo } from '../services/api';
import './CustomNode.css';

interface CustomNodeData {
  label: string;
  nodeInfo: NodeInfo;
  type: string;
}

const CustomNode = ({ data, selected }: NodeProps<CustomNodeData>) => {
  const { nodeInfo } = data;

  // Parse inputs from nodeInfo
  const requiredInputs = Object.keys(nodeInfo.input_types.required || {});
  const optionalInputs = Object.keys(nodeInfo.input_types.optional || {});
  const allInputs = [...requiredInputs, ...optionalInputs];
  
  // Parse outputs from nodeInfo
  const outputs = nodeInfo.return_types || [];

  // Get category for styling
  const category = nodeInfo.category;

  return (
    <div className={`custom-node ${selected ? 'selected' : ''} node-${category}`}>
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
            
            return (
              <div key={`input-${input}`} className="io-item input-item">
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
                <span className={`connection-label ${isRequired ? 'required' : 'optional'}`}>
                  {`${input} (${typeName})`}
                </span>
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