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
  const overlayCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const frameBufferRefs = useRef<Record<string, string>>({});
  const backendQueueRef = useRef<Record<string, NodeJS.Timeout>>({});
  
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

  // Camera canvas management
  const initializeCameraCanvas = useCallback((canvas: HTMLCanvasElement, showPlaceholder = true) => {
    canvas.width = 200;
    canvas.height = 150;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (showPlaceholder) {
        // Draw placeholder when no camera
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No Camera', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('Selected', canvas.width / 2, canvas.height / 2 + 10);
      } else {
        // Clear canvas for camera feed
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // Queued frame sender to prevent re-render cascade
  const sendFrameToBackend = useCallback((inputName: string, frameData: string) => {
    // Store frame immediately for display consistency
    frameBufferRefs.current[inputName] = frameData;
    
    // Clear existing timeout for this input
    if (backendQueueRef.current[inputName]) {
      clearTimeout(backendQueueRef.current[inputName]);
    }
    
    // Queue the backend call to break synchronous execution
    backendQueueRef.current[inputName] = setTimeout(() => {
      if (onInputValueChange) {
        onInputValueChange(id, inputName, frameData);
        console.log(`📤 Frame sent to backend for ${inputName} (queued)`);
      }
      delete backendQueueRef.current[inputName];
    }, 1000); // 1 second delay to reduce frequency
    
  }, [id, onInputValueChange]);

  // Camera stream management
  const setupCameraStream = useCallback((inputName: string, stream: MediaStream) => {
    setCameraStreams(prev => ({ ...prev, [inputName]: stream }));
    
    // Update canvas to show it's active
    const canvas = overlayCanvasRefs.current[inputName];
    if (canvas) {
      canvas.className = 'camera-canvas active';
      initializeCameraCanvas(canvas, false);
    }
  }, [initializeCameraCanvas]);

  const createFrameProcessor = useCallback((inputName: string) => {
    // Separate canvases for different purposes
    const processingCanvas = document.createElement('canvas');
    const processingCtx = processingCanvas.getContext('2d');
    processingCanvas.width = 320; // Backend processing resolution
    processingCanvas.height = 240;

    let frameCounter = 0;

    // High frequency display updates (smooth video)
    const updateDisplay = () => {
      const video = cameraRefs.current[inputName];
      const displayCanvas = overlayCanvasRefs.current[inputName];
      
      if (video && video.readyState === 4 && displayCanvas) {
        requestAnimationFrame(() => {
          try {
            // Direct video-to-canvas for smooth display (no re-renders)
            const displayCtx = displayCanvas.getContext('2d');
            if (displayCtx) {
              displayCtx.drawImage(video, 0, 0, displayCanvas.width, displayCanvas.height);
            }
          } catch (error) {
            console.warn('Display update error:', error);
          }
        });
      }
    };

    // Backend frame capture and processing
    const processFrameForBackend = () => {
      const video = cameraRefs.current[inputName];
      
      if (video && video.readyState === 4 && processingCtx) {
        try {
          // Capture frame for backend
          processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);
          const frameData = processingCanvas.toDataURL('image/jpeg', 0.7);
          
          // Send to backend with debouncing to prevent re-renders
          sendFrameToBackend(inputName, frameData);
          
          
        } catch (error) {
          console.warn('Backend frame processing error:', error);
        }
      }
    };
    
    // Smooth display at 30 FPS (no parent re-renders)
    const intervalId = setInterval(updateDisplay, 1000 / 30);
    
    return { intervalId, intervalId};
  }, [sendFrameToBackend]);

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
      
      // Setup camera stream and UI
      setupCameraStream(inputName, stream);
      
      // Create separated frame processor
      const processor = createFrameProcessor(inputName);
      
      // Store interval IDs for cleanup
      (stream as any).displayIntervalId = processor.displayIntervalId;
      (stream as any).backendIntervalId = processor.backendIntervalId;
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  }, [setupCameraStream, createFrameProcessor]);

  const stopCamera = useCallback((inputName: string) => {
    const stream = cameraStreams[inputName];
    if (stream) {
      // Clear both processing intervals
      if ((stream as any).displayIntervalId) {
        clearInterval((stream as any).displayIntervalId);
      }
      if ((stream as any).backendIntervalId) {
        clearInterval((stream as any).backendIntervalId);
      }
      
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      setCameraStreams(prev => ({ ...prev, [inputName]: null }));
      
      // Clear video element
      const video = cameraRefs.current[inputName];
      if (video) {
        video.srcObject = null;
      }
      
      // Reset canvas to placeholder state
      const overlayCanvas = overlayCanvasRefs.current[inputName];
      if (overlayCanvas) {
        overlayCanvas.className = 'camera-canvas placeholder';
        initializeCameraCanvas(overlayCanvas, true);
      }
      
      // Clear buffers and pending backend calls
      frameBufferRefs.current[inputName] = '';
      if (backendQueueRef.current[inputName]) {
        clearTimeout(backendQueueRef.current[inputName]);
        delete backendQueueRef.current[inputName];
      }
    }
  }, [cameraStreams, initializeCameraCanvas]);

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
                          {/* Always present camera display container */}
                          <div className="camera-display-container">
                            {/* Hidden video element for stream processing */}
                            <video
                              ref={(el) => {
                                cameraRefs.current[input] = el;
                                if (el && cameraStreams[input]) {
                                  el.srcObject = cameraStreams[input];
                                  el.onloadedmetadata = () => {
                                    el.play().catch(console.error);
                                  };
                                }
                              }}
                              autoPlay
                              muted
                              playsInline
                              style={{
                                position: 'absolute',
                                top: '-9999px',
                                left: '-9999px',
                                width: '1px',
                                height: '1px'
                              }}
                            />
                            
                            {/* Persistent camera view */}
                            <div className="camera-view">
                              <canvas
                                ref={(el) => {
                                  if (el !== overlayCanvasRefs.current[input]) {
                                    console.log(`🎨 Canvas recreated for ${input}, previous:`, overlayCanvasRefs.current[input], 'new:', el);
                                  }
                                  overlayCanvasRefs.current[input] = el;
                                  if (el) {
                                    initializeCameraCanvas(el, !cameraStreams[input]);
                                  }
                                }}
                                className={`camera-canvas ${cameraStreams[input] ? 'active' : 'placeholder'}`}
                              />
                            </div>
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