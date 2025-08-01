import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeInfo } from '../services/api';
import './CustomNode.css';

export interface CustomNodeProps extends NodeProps {
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
  const nodeData = data as unknown as CustomNodeData;
  const { nodeInfo, inputModes = {}, inputValues = {}, bypassed = false, nodeState, robotStatus, streamUpdate, streamComplete, streamError } = nodeData;
  const onContextMenu = (props as any).onContextMenu;
  const onInputValueChange = (props as any).onInputValueChange;
  
  
  
  // State for detailed description modal
  const [showDetailedDescription, setShowDetailedDescription] = useState(false);
  
  
  
  // Handle ResizeObserver errors
  useEffect(() => {
    const handleResizeObserverError = (e: ErrorEvent) => {
      if (e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
        e.stopImmediatePropagation();
        return false;
      }
      return true;
    };

    window.addEventListener('error', handleResizeObserverError);
    return () => window.removeEventListener('error', handleResizeObserverError);
  }, []);

  // Auto-resize textareas when content changes
  useEffect(() => {
    const autoResizeTextareas = () => {
      const textareas = nodeRef.current?.querySelectorAll('.auto-expand-textarea') as NodeListOf<HTMLTextAreaElement>;
      textareas?.forEach((textarea) => {
        const container = textarea.closest('.custom-node') as HTMLElement;
        const containerHeight = container ? container.offsetHeight : 0;
        const maxHeight = Math.max(120, containerHeight - 100);
        
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
      });
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(autoResizeTextareas, 0);
    return () => clearTimeout(timeoutId);
  }, [inputValues]);
  
  // Custom resize functionality
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  
  const handleResizeStart = useCallback((direction: string) => (e: React.MouseEvent) => {
    // Completely prevent all event propagation
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    e.nativeEvent.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    setIsResizing(true);
    setResizeDirection(direction);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const node = nodeRef.current;
    if (!node) return;
    
    const startWidth = node.offsetWidth;
    const startHeight = node.offsetHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!node) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      if (direction.includes('e')) {
        newWidth = Math.max(200, startWidth + deltaX);
      }
      if (direction.includes('w')) {
        newWidth = Math.max(200, startWidth - deltaX);
      }
      if (direction.includes('s')) {
        newHeight = Math.max(100, startHeight + deltaY);
      }
      if (direction.includes('n')) {
        newHeight = Math.max(100, startHeight - deltaY);
      }
      
      node.style.width = `${newWidth}px`;
      node.style.height = `${newHeight}px`;
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection('');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

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

  // Get primary tag for styling
  const primaryTag = nodeInfo.tags && nodeInfo.tags.length > 0 ? nodeInfo.tags[0] : 'untagged';

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
    <div className="node-container">
      <div 
        ref={nodeRef}
        className={`custom-node ${selected ? 'selected' : ''} ${bypassed ? 'bypassed' : ''} ${nodeState?.state ? `node-${nodeState.state}` : ''} node-${primaryTag} ${isResizing ? `resizing resizing-${resizeDirection}` : ''}`}
        onContextMenu={handleContextMenu}
      >
      {/* Node header */}
      <div className="node-header">
        <div className="node-title">{nodeInfo.display_name}</div>
        <div className="node-header-right">
          <div className="node-tags">
            {nodeInfo.tags && nodeInfo.tags.map(tag => (
              <span key={tag} className="node-tag-badge">{tag}</span>
            ))}
          </div>
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
          {/* Connection inputs first */}
          {allInputs.map((input) => {
            const isRequired = requiredInputs.includes(input);
            const typeInfo =
              (nodeInfo.input_types.required && nodeInfo.input_types.required[input]) ||
              (nodeInfo.input_types.optional && nodeInfo.input_types.optional[input]) ||
              ['unknown'];
            const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
            // Default to manual mode for STRING, FLOAT, INT, BOOLEAN, and CAMERA inputs, connection mode for others
            const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT' || typeName === 'INT' || typeName === 'BOOLEAN' || typeName === 'CAMERA') ? 'manual' : 'connection';
            const inputMode = inputModes[input] || defaultMode;
            
            // Only render connection inputs here
            if (inputMode === 'connection') {
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
                      width: '16px',
                      height: '16px',
                    }}
                    title={`${input} (${typeName}) - ${isRequired ? 'required' : 'optional'}`}
                  />
                  <span className={`connection-label ${isRequired ? 'required' : 'optional'}`}>
                    {`${input} (${typeName})`}
                  </span>
                </div>
              );
            }
            return null;
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
                    width: '16px',
                    height: '16px',
                  }}
                  title={`${output.name} (${output.type}) - ${isRequired ? 'required' : 'optional'}`}
                />
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Manual inputs section - below the main IO row */}
      {allInputs.some((input) => {
        const typeInfo =
          (nodeInfo.input_types.required && nodeInfo.input_types.required[input]) ||
          (nodeInfo.input_types.optional && nodeInfo.input_types.optional[input]) ||
          ['unknown'];
        const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
        const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT' || typeName === 'INT' || typeName === 'BOOLEAN' || typeName === 'CAMERA') ? 'manual' : 'connection';
        const inputMode = inputModes[input] || defaultMode;
        return inputMode === 'manual';
      }) && (
        <div className="manual-inputs-section">
          <div className="section-title">Manual Inputs</div>
          <div className="manual-inputs-grid">
            {allInputs.map((input) => {
              const typeInfo =
                (nodeInfo.input_types.required && nodeInfo.input_types.required[input]) ||
                (nodeInfo.input_types.optional && nodeInfo.input_types.optional[input]) ||
                ['unknown'];
              const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
              const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT' || typeName === 'INT' || typeName === 'BOOLEAN' || typeName === 'CAMERA') ? 'manual' : 'connection';
              const inputMode = inputModes[input] || defaultMode;
              const inputValue = inputValues[input] || '';
              
              // Only render manual inputs here
              if (inputMode === 'manual') {
                return (
                  <div key={`manual-input-${input}`} className="manual-input-item">
                    {(() => {
                      switch (typeName) {
                        case 'STRING':
                          return (
                            <div className="manual-input-container">
                              <span className="input-label">{input}:</span>
                              <textarea
                                className="manual-input manual-textarea auto-expand-textarea"
                                value={String(inputValue)}
                                placeholder={`Enter ${typeName.toLowerCase()}`}
                                onChange={(e) => {
                                  if (onInputValueChange) {
                                    onInputValueChange(id, input, e.target.value);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                rows={1}
                                style={{
                                  resize: 'none',
                                  minHeight: '32px',
                                  overflow: 'hidden',
                                  height: 'auto'
                                }}
                                onInput={(e) => {
                                  // Auto-resize the textarea to content, respecting node boundary
                                  const target = e.target as HTMLTextAreaElement;
                                  const container = target.closest('.custom-node') as HTMLElement;
                                  const containerHeight = container ? container.offsetHeight : 0;
                                  const maxHeight = Math.max(120, containerHeight - 100); // Leave space for other elements
                                  
                                  target.style.height = 'auto';
                                  const newHeight = Math.min(target.scrollHeight, maxHeight);
                                  target.style.height = `${newHeight}px`;
                                  
                                  // Show scrollbar if content exceeds max height
                                  target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
                                }}
                              />
                            </div>
                          );
                        case 'FLOAT':
                          return (
                            <div className="manual-input-container">
                              <span className="input-label">{input}:</span>
                              <input
                                type="number"
                                className="manual-input"
                                value={String(inputValue)}
                                placeholder={`Enter ${typeName.toLowerCase()}`}
                                onChange={(e) => {
                                  if (onInputValueChange) {
                                    onInputValueChange(id, input, e.target.value);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          );
                        case 'INT':
                          return (
                            <div className="manual-input-container">
                              <span className="input-label">{input}:</span>
                              <input
                                type="number"
                                step="1"
                                className="manual-input"
                                value={String(inputValue)}
                                placeholder={`Enter ${typeName.toLowerCase()}`}
                                onChange={(e) => {
                                  if (onInputValueChange) {
                                    onInputValueChange(id, input, e.target.value);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          );
                        case 'BOOLEAN':
                          return (
                            <div className="manual-input-container">
                              <span className="input-label">{input}:</span>
                              <select
                                className="manual-input"
                                value={String(inputValue)}
                                onChange={(e) => {
                                  if (onInputValueChange) {
                                    onInputValueChange(id, input, e.target.value);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">Select boolean value</option>
                                <option value="true">True</option>
                                <option value="false">False</option>
                              </select>
                            </div>
                          );
                        default:
                          // Use textarea for expandable text inputs, regular input for short content
                          const shouldUseTextarea = String(inputValue).length > 50 || String(inputValue).includes('\n');
                          
                          return (
                            <div className="manual-input-container">
                              <span className="input-label">{input}:</span>
                              {shouldUseTextarea ? (
                                <textarea
                                  className="manual-input manual-textarea auto-expand-textarea"
                                  value={String(inputValue)}
                                  placeholder={`Enter ${typeName.toLowerCase()}`}
                                  onChange={(e) => {
                                    if (onInputValueChange) {
                                      onInputValueChange(id, input, e.target.value);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  rows={1}
                                  style={{
                                    resize: 'none',
                                    minHeight: '32px',
                                    overflow: 'hidden',
                                    height: 'auto'
                                  }}
                                  onInput={(e) => {
                                    // Auto-resize the textarea to content, respecting node boundary
                                    const target = e.target as HTMLTextAreaElement;
                                    const container = target.closest('.custom-node') as HTMLElement;
                                    const containerHeight = container ? container.offsetHeight : 0;
                                    const maxHeight = Math.max(120, containerHeight - 100); // Leave space for other elements
                                    
                                    target.style.height = 'auto';
                                    const newHeight = Math.min(target.scrollHeight, maxHeight);
                                    target.style.height = `${newHeight}px`;
                                    
                                    // Show scrollbar if content exceeds max height
                                    target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
                                  }}
                                />
                              ) : (
                                <input
                                  type="text"
                                  className="manual-input"
                                  value={String(inputValue)}
                                  placeholder={`Enter ${typeName.toLowerCase()}`}
                                  onChange={(e) => {
                                    if (onInputValueChange) {
                                      onInputValueChange(id, input, e.target.value);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                            </div>
                          );
                      }
                    })()}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
      
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
        <div className="rt-update-display" style={{ borderWidth: '1px', padding: '1px 1px' }}>
          <div className="rt-update-content">
            {typeof nodeState.data.rt_update === 'object' && nodeState.data.rt_update.image_base64 && nodeState.data.rt_update.image_format ? (
              <img
                src={`data:image/${nodeState.data.rt_update.image_format};base64,${nodeState.data.rt_update.image_base64}`}
                alt={nodeState.data.rt_update.filename || 'Real-Time Update Image'}
                style={{ maxWidth: '100%', maxHeight: 200, display: 'block', margin: '0 auto', borderWidth: '1px' }}
              />
            ) : typeof nodeState.data.rt_update === 'object' ? (
              <pre className="rt-update-json" style={{ borderWidth: '1px' }}>
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
      
      {/* Custom resize handles - outside main node */}
      {(selected || false) && (
        <>
          {/* Corner handles */}
          <div 
            className="resize-handle nw" 
            onMouseDownCapture={handleResizeStart('nw')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle ne" 
            onMouseDownCapture={handleResizeStart('ne')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle sw" 
            onMouseDownCapture={handleResizeStart('sw')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle se" 
            onMouseDownCapture={handleResizeStart('se')}
            onDragStart={(e) => e.preventDefault()}
          />
          
          {/* Edge handles */}
          <div 
            className="resize-handle n" 
            onMouseDownCapture={handleResizeStart('n')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle s" 
            onMouseDownCapture={handleResizeStart('s')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle e" 
            onMouseDownCapture={handleResizeStart('e')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle w" 
            onMouseDownCapture={handleResizeStart('w')}
            onDragStart={(e) => e.preventDefault()}
          />
        </>
      )}
    </div>
  );
};

export default memo(CustomNode);