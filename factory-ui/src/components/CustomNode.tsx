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
  
  // Debug logging for node state
  if (nodeState) {
    console.log(`🔄 Node ${id} state:`, nodeState.state, nodeState);
  }
  
  // State for detailed description modal
  const [showDetailedDescription, setShowDetailedDescription] = useState(false);
  
  // Camera state for CAMERA input types
  const [cameraStreams, setCameraStreams] = useState<Record<string, MediaStream | null>>({});
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [showCameraMenu, setShowCameraMenu] = useState<Record<string, boolean>>({});
  const cameraRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  
  // Camera utility functions
  const enumerateDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      return videoDevices;
    } catch (error) {
      console.error('Error enumerating devices:', error);
      alert('Could not access camera devices. Please check permissions.');
      return [];
    }
  }, []);

  const startCamera = useCallback(async (inputName: string, deviceId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      };
      
      if (deviceId) {
        (constraints.video as MediaTrackConstraints).deviceId = { exact: deviceId };
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setCameraStreams(prev => ({ ...prev, [inputName]: stream }));
      
      // Set up frame capture interval
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 480;
      
      const captureFrame = () => {
        const video = cameraRefs.current[inputName];
        if (video && ctx && onInputValueChange && video.readyState === 4) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frameData = canvas.toDataURL('image/jpeg', 0.8);
          onInputValueChange(id, inputName, frameData);
        }
      };
      
      // Capture frames at 10 FPS
      const intervalId = setInterval(captureFrame, 100);
      
      // Store interval ID for cleanup
      (stream as any).intervalId = intervalId;
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  }, [id, onInputValueChange]);

  const stopCamera = useCallback((inputName: string) => {
    const stream = cameraStreams[inputName];
    if (stream) {
      // Clear frame capture interval
      if ((stream as any).intervalId) {
        clearInterval((stream as any).intervalId);
      }
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      setCameraStreams(prev => ({ ...prev, [inputName]: null }));
      
      // Clear video element
      const video = cameraRefs.current[inputName];
      if (video) {
        video.srcObject = null;
      }
    }
  }, [cameraStreams]);

  const handleCameraMenuClick = useCallback(async (inputName: string) => {
    if (cameraStreams[inputName]) {
      stopCamera(inputName);
      return;
    }
    
    if (availableDevices.length === 0) {
      await enumerateDevices();
    }
    
    setShowCameraMenu(prev => ({ ...prev, [inputName]: !prev[inputName] }));
  }, [cameraStreams, availableDevices, enumerateDevices, stopCamera]);

  const handleDeviceSelect = useCallback(async (inputName: string, deviceId: string) => {
    setShowCameraMenu(prev => ({ ...prev, [inputName]: false }));
    await startCamera(inputName, deviceId);
  }, [startCamera]);
  
  // Cleanup camera streams on unmount
  useEffect(() => {
    return () => {
      Object.keys(cameraStreams).forEach(inputName => {
        stopCamera(inputName);
      });
    };
  }, [stopCamera, cameraStreams]);

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

  // Handle clicks outside camera menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.camera-controls')) {
        setShowCameraMenu({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
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
    <div className="node-container">
      <div 
        ref={nodeRef}
        className={`custom-node ${selected ? 'selected' : ''} ${bypassed ? 'bypassed' : ''} ${nodeState?.state ? `node-${nodeState.state}` : ''} node-${category} ${isResizing ? `resizing resizing-${resizeDirection}` : ''}`}
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
            // Default to manual mode for STRING, FLOAT, and CAMERA inputs, connection mode for others
            const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT' || typeName === 'CAMERA') ? 'manual' : 'connection';
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

                {inputMode === 'manual' ? (() => {
                  switch (typeName) {
                    case 'CAMERA':
                      return (
                        <div className="camera-input-container">
                          <span className="input-label">{input}:</span>
                          <div className="camera-controls">
                            <button
                              className="camera-button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleCameraMenuClick(input);
                              }}
                            >
                              {cameraStreams[input] ? '⏹️ Stop' : '📹 Camera'}
                            </button>
                            {showCameraMenu[input] && !cameraStreams[input] && (
                              <div className="camera-menu">
                                <div className="camera-menu-header">Select Camera:</div>
                                {availableDevices.length === 0 ? (
                                  <div className="camera-menu-item loading">Loading devices...</div>
                                ) : (
                                  availableDevices.map((device, index) => (
                                    <button
                                      key={device.deviceId}
                                      className="camera-menu-item"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeviceSelect(input, device.deviceId);
                                      }}
                                    >
                                      {device.label || `Camera ${index + 1}`}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                          <div className="camera-feed-container" style={{ minHeight: cameraStreams[input] ? '150px' : '0px' }}>
                            {cameraStreams[input] && (
                              <div className="camera-feed">
                                <video
                                  ref={(el) => {
                                    cameraRefs.current[input] = el;
                                    if (el && cameraStreams[input]) {
                                      el.srcObject = cameraStreams[input];
                                      el.play().catch(console.error);
                                    }
                                  }}
                                  autoPlay
                                  muted
                                  style={{
                                    width: '100%',
                                    maxWidth: '200px',
                                    height: '150px',
                                    objectFit: 'cover',
                                    borderRadius: '4px'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    case 'STRING':
                      return (
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
                      );
                    case 'FLOAT':
                      return (
                        <div className="manual-input-container">
                          <span className="input-label">{input}:</span>
                          <input
                            type="number"
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
                      );
                    default:
                      return (
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
                      );
                  }
                })() : (
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
        <div className="rt-update-display" style={{ borderWidth: '1px', padding: '1px 1px' }}>
          {/* <div className="rt-update-header">
            <span className="rt-update-title">Real-Time Update</span>
            <span className="rt-update-state">{nodeState.state}</span>
          </div> */}
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