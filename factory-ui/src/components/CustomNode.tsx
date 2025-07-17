import { memo, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
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
  bypassed?: boolean;
  nodeState?: {
    state: 'idle' | 'executing' | 'completed' | 'error';
    data?: any;
    timestamp?: number;
  };
  robotStatus?: {
    positions?: Record<string, number>;
    modes?: Record<string, any>;
    servo_ids?: number[];
    timestamp?: number;
    connected?: boolean;
    stream_count?: number;
    error?: string;
  };
  streamUpdate?: boolean;
  streamComplete?: boolean;
  streamError?: boolean;
}

const CustomNode = ({ id, data, selected, ...props }: CustomNodeProps) => {
  const { nodeInfo, inputModes = {}, inputValues = {}, bypassed = false, nodeState, robotStatus, streamUpdate, streamComplete, streamError } = data;
  const onContextMenu = (props as any).onContextMenu;
  const onInputValueChange = (props as any).onInputValueChange;
  
  // Debug logging for node state
  if (nodeState) {
    console.log(`🔄 Node ${id} state:`, nodeState.state, nodeState);
  }
  
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
    <>
      <NodeResizer 
        minWidth={200}
        minHeight={100}
        isVisible={selected}
        lineClassName="resize-line"
        handleClassName="resize-handle"
        shouldResize={() => true}
        onResizeStart={() => {}}
        onResizeEnd={() => {}}
      />
      <div 
        className={`custom-node ${selected ? 'selected' : ''} ${bypassed ? 'bypassed' : ''} ${nodeState?.state ? `node-${nodeState.state}` : ''} node-${category}`}
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
      
      {/* Robot Status Display */}
      {robotStatus && nodeInfo.name === 'RobotStatusReader' && (
        <div className="robot-status-display">
          <div className="robot-status-header">
            <span className="robot-status-title">Robot Status</span>
            {streamUpdate && <span className="stream-indicator">🔄 Live</span>}
            {streamComplete && <span className="stream-indicator">✅ Complete</span>}
            {streamError && <span className="stream-indicator">❌ Error</span>}
          </div>
          
          {robotStatus.error ? (
            <div className="robot-status-error">
              Error: {robotStatus.error}
            </div>
          ) : (
            <div className="robot-status-content">
              {robotStatus.positions && (
                <div className="robot-positions">
                  <div className="robot-section-title">Positions:</div>
                  <div className="robot-positions-grid">
                    {Object.entries(robotStatus.positions).map(([servoId, position]) => (
                      <div key={servoId} className="robot-position-item">
                        <span className="servo-id">ID {servoId}:</span>
                        <span className="servo-position">{position}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {robotStatus.modes && (
                <div className="robot-modes">
                  <div className="robot-section-title">Modes:</div>
                  <div className="robot-modes-grid">
                    {Object.entries(robotStatus.modes).map(([servoId, mode]) => (
                      <div key={servoId} className="robot-mode-item">
                        <span className="servo-id">ID {servoId}:</span>
                        <span className="servo-mode">{mode || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="robot-metadata">
                <div className="robot-meta-item">
                  <span className="meta-label">Connected:</span>
                  <span className={`meta-value ${robotStatus.connected ? 'connected' : 'disconnected'}`}>
                    {robotStatus.connected ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
                {robotStatus.stream_count !== undefined && (
                  <div className="robot-meta-item">
                    <span className="meta-label">Updates:</span>
                    <span className="meta-value">{robotStatus.stream_count}</span>
                  </div>
                )}
                {robotStatus.timestamp && (
                  <div className="robot-meta-item">
                    <span className="meta-label">Last Update:</span>
                    <span className="meta-value">
                      {new Date(robotStatus.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Real-Time Update Display */}
      {nodeState?.data?.rt_update && (
        <div className="rt-update-display">
          <div className="rt-update-header">
            <span className="rt-update-title">Real-Time Update</span>
            <span className="rt-update-state">{nodeState.state}</span>
          </div>
          <div className="rt-update-content">
            {typeof nodeState.data.rt_update === 'object' ? (
              <pre className="rt-update-json">
                {JSON.stringify(nodeState.data.rt_update, null, 2)}
              </pre>
            ) : (
              <div className="rt-update-text">
                {nodeState.data.rt_update}
              </div>
            )}
          </div>
          {nodeState.timestamp && (
            <div className="rt-update-timestamp">
              Updated: {new Date(nodeState.timestamp * 1000).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
      
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
    </>
  );
};

export default memo(CustomNode);