import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeInfo } from '../services/api';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import URDFLoader, { URDFRobot, URDFJoint } from 'urdf-loader';
import './CustomNode.css';
import './ThreeDNode.css';

export interface ThreeDNodeProps extends NodeProps {
  onContextMenu?: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void;
  onInputValueChange?: (nodeId: string, inputName: string, value: string) => void;
}

interface ThreeDNodeData {
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
}

interface JointState {
  name: string;
  angle: number;
  servoId?: number;
}

interface RobotModel {
  robot: URDFRobot | null;
  joints: Record<string, URDFJoint>;
  jointStates: JointState[];
}

const SO_ARM100_CONFIG = {
  urdfUrl: "/URDFs/so101.urdf",
  camera: { position: [-30, 10, 30] as [number, number, number], fov: 12 },
  orbitTarget: [1, 2, 0] as [number, number, number],
  jointNameIdMap: {
    Rotation: 1,
    Pitch: 2,
    Elbow: 3,
    Wrist_Pitch: 4,
    Wrist_Roll: 5,
    Jaw: 6,
  } as const,
  urdfInitJointAngles: {
    Rotation: 180,
    Pitch: 180,
    Elbow: 180,
    Wrist_Pitch: 180,
    Wrist_Roll: 180,
    Jaw: 180,
  } as const,
};

const stlLoader = new STLLoader();

function RobotScene({ 
  urdfUrl, 
  jointStates, 
  onRobotLoaded 
}: { 
  urdfUrl: string;
  jointStates: JointState[];
  onRobotLoaded: (robot: URDFRobot) => void;
}) {
  const robotRef = useRef<URDFRobot | null>(null);
  const { scene } = useThree();
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error' | 'idle'>('idle');

  useEffect(() => {
    if (!urdfUrl) {
      console.log('No URDF URL provided');
      return;
    }

    setLoadingState('loading');

    const manager = new THREE.LoadingManager();
    const loader = new URDFLoader(manager);
    
    // Loading manager callbacks
    manager.onError = (url) => {
      console.error('Failed to load resource:', url);
    };

    // Custom STL loader for URDF
    loader.parseCollision = true;
    loader.parseVisual = true;
    loader.loadMeshCb = (path: string, _manager: THREE.LoadingManager, done: (mesh: THREE.Object3D) => void) => {
      if (path.endsWith('.stl')) {
        stlLoader.load(
          path,
          (geometry: THREE.BufferGeometry) => {
            // Use green color from URDF material definition (rgba="0.06 0.4 0.1 1.0")
            const material = new THREE.MeshLambertMaterial({ color: 0x0F6619 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            done(mesh);
          },
          undefined,
          (error: unknown) => {
            console.error('Failed to load STL:', path, error);
            // Create a placeholder box in red for errors
            const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
            const mesh = new THREE.Mesh(geometry, material);
            done(mesh);
          }
        );
      } else {
        // Fallback for other formats - use green
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const material = new THREE.MeshLambertMaterial({ color: 0x0F6619 });
        const mesh = new THREE.Mesh(geometry, material);
        done(mesh);
      }
    };

    loader.load(
      urdfUrl,
      (robot: URDFRobot) => {
        if (robotRef.current) {
          scene.remove(robotRef.current);
        }
        
        robotRef.current = robot;
        setLoadingState('loaded');
        
        // Configure robot visualization based on SO-ARM100 config
        robot.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / -2);
        robot.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        robot.updateMatrixWorld(true);
        
        const scale = 15; // Use scale from reference implementation
        robot.scale.set(scale, scale, scale);
        scene.add(robot);
        
        onRobotLoaded(robot);
      },
      undefined,
      (error: unknown) => {
        console.error('Error loading URDF:', urdfUrl, error);
        setLoadingState('error');
      }
    );

    return () => {
      if (robotRef.current) {
        scene.remove(robotRef.current);
      }
    };
  }, [urdfUrl, scene, onRobotLoaded]);

  // Apply joint states (matching bambot implementation)
  useEffect(() => {
    if (robotRef.current && robotRef.current.joints && jointStates) {
      jointStates.forEach((state) => {
        const joint = robotRef.current!.joints[state.name];
        if (joint && joint.jointType !== 'continuous') {
          // Direct conversion from degrees to radians (same as bambot)
          joint.setJointValue(state.angle * (Math.PI / 180));
        }
      });
    }
  }, [jointStates]);

  return (
    <>
      <OrbitControls target={SO_ARM100_CONFIG.orbitTarget} enablePan={true} enableZoom={true} enableRotate={true} />
      
      {/* Ground plane */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 20]} />
        <meshLambertMaterial color="#f5f5f5" />
      </mesh>
      
      <directionalLight
        castShadow
        intensity={1}
        position={[2, 20, 5]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        intensity={1}
        position={[-2, 20, -5]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <ambientLight intensity={0.4} />
    </>
  );
}

const ThreeDNode = ({ id, data, selected, ...props }: ThreeDNodeProps) => {
  const nodeData = data as unknown as ThreeDNodeData;
  const { nodeInfo, inputModes = {}, inputValues = {}, bypassed = false, nodeState } = nodeData;
  const onContextMenu = (props as any).onContextMenu;
  const onInputValueChange = (props as any).onInputValueChange;
  
  // State for detailed description modal
  const [showDetailedDescription, setShowDetailedDescription] = useState(false);
  const [robotModel, setRobotModel] = useState<RobotModel>({
    robot: null,
    joints: {},
    jointStates: []
  });

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
  
  // Custom resize functionality
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  
  const handleResizeStart = useCallback((direction: string) => (e: React.MouseEvent) => {
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
        newWidth = Math.max(400, startWidth + deltaX);
      }
      if (direction.includes('w')) {
        newWidth = Math.max(400, startWidth - deltaX);
      }
      if (direction.includes('s')) {
        newHeight = Math.max(300, startHeight + deltaY);
      }
      if (direction.includes('n')) {
        newHeight = Math.max(300, startHeight - deltaY);
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
  
  // Parse outputs from nodeInfo
  let outputs: Array<{name: string, type: string, required?: boolean}> = [];
  if (Array.isArray(nodeInfo.return_types)) {
    outputs = nodeInfo.return_types.map((type, index) => ({
      name: (nodeInfo.return_types as string[]).length === 1 ? 'output' : `output-${index}`,
      type: type,
      required: true
    }));
  } else if (nodeInfo.return_types && typeof nodeInfo.return_types === 'object') {
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

  const handleRobotLoaded = useCallback((robot: URDFRobot) => {
    const joints: Record<string, URDFJoint> = {};
    const jointStates: JointState[] = [];

    if (robot.joints) {
      Object.values(robot.joints).forEach((joint: any) => {
        if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
          joints[joint.name] = joint;
          
          // Get initial angle from SO-ARM100 config or default to 0
          const servoInitAngle = (SO_ARM100_CONFIG.urdfInitJointAngles as any)[joint.name] || 0;
          const servoId = (SO_ARM100_CONFIG.jointNameIdMap as any)[joint.name];
          
          // Convert from servo angle (0-360°) to joint angle (-180° to +180°)
          // 180° servo angle = 0° joint angle (neutral position)
          const jointAngle = servoInitAngle - 180;
          
          jointStates.push({
            name: joint.name,
            angle: jointAngle,
            servoId: servoId
          });
        }
      });
    }

    setRobotModel({
      robot,
      joints,
      jointStates
    });
  }, []);

  const handleJointAngleChange = useCallback((jointName: string, angle: number) => {
    setRobotModel(prev => ({
      ...prev,
      jointStates: prev.jointStates.map(state =>
        state.name === jointName ? { ...state, angle } : state
      )
    }));
  }, []);

  // Get URDF URL from inputs or use SO-ARM100 default
  const urdfUrl = inputValues['urdf_path'] || inputValues['urdf_url'] || SO_ARM100_CONFIG.urdfUrl;
  

  return (
    <div className="node-container">
      <div 
        ref={nodeRef}
        className={`custom-node threed-node ${selected ? 'selected' : ''} ${bypassed ? 'bypassed' : ''} ${nodeState?.state ? `node-${nodeState.state}` : ''} node-${category} ${isResizing ? `resizing resizing-${resizeDirection}` : ''}`}
        onContextMenu={handleContextMenu}
      >
        {/* Node header */}
        <div className="node-header">
          <div className="node-title">🎲 {nodeInfo.display_name}</div>
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
              const defaultMode = 'connection';
              const inputMode = inputModes[input] || defaultMode;
              
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
              const isRequired = output.required !== false;
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
        
        {/* Manual inputs section */}
        {allInputs.some((input) => {
          const typeInfo =
            (nodeInfo.input_types.required && nodeInfo.input_types.required[input]) ||
            (nodeInfo.input_types.optional && nodeInfo.input_types.optional[input]) ||
            ['unknown'];
          const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
          const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT') ? 'manual' : 'connection';
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
                const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT') ? 'manual' : 'connection';
                const inputMode = inputModes[input] || defaultMode;
                const inputValue = inputValues[input] || '';
                
                if (inputMode === 'manual') {
                  return (
                    <div key={`manual-input-${input}`} className="manual-input-item">
                      <div className="manual-input-container">
                        <span className="input-label">{input}:</span>
                        {typeName === 'STRING' ? (
                          <textarea
                            className="manual-input manual-textarea"
                            value={inputValue}
                            placeholder={`Enter ${typeName.toLowerCase()}`}
                            onChange={(e) => {
                              if (onInputValueChange) {
                                onInputValueChange(id, input, e.target.value);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            rows={1}
                          />
                        ) : typeName === 'FLOAT' ? (
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
                        ) : (
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
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}
        
        {/* 3D Visualization */}
        <div className="threed-viewport">
          <div className="threed-status">
            <small>URDF: {urdfUrl}</small>
            {robotModel.robot ? (
              <small style={{color: 'green'}}>✓ Robot loaded ({Object.keys(robotModel.joints).length} joints)</small>
            ) : (
              <small style={{color: 'orange'}}>Loading robot model...</small>
            )}
          </div>
          <Canvas
            shadows
            camera={{ 
              position: SO_ARM100_CONFIG.camera.position, 
              fov: SO_ARM100_CONFIG.camera.fov 
            }}
            onCreated={({ scene }: { scene: THREE.Scene }) => {
              scene.background = new THREE.Color(0x263238);
            }}
          >
            <RobotScene
              urdfUrl={urdfUrl}
              jointStates={robotModel.jointStates}
              onRobotLoaded={handleRobotLoaded}
            />
          </Canvas>
        </div>
        
        {/* Joint Controls */}
        {robotModel.jointStates.length > 0 && (
          <div className="joint-controls">
            <div className="section-title">Joint Controls</div>
            <div className="joint-controls-grid">
              {robotModel.jointStates.map((jointState) => (
                <div key={jointState.name} className="joint-control-item">
                  <label className="joint-label">
                    {jointState.name}
                    {jointState.servoId && <span className="servo-id"> (ID:{jointState.servoId})</span>}:
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={jointState.angle}
                    onChange={(e) => handleJointAngleChange(jointState.name, parseFloat(e.target.value))}
                    className="joint-slider"
                  />
                  <span className="joint-value">{jointState.angle.toFixed(1)}°</span>
                </div>
              ))}
            </div>
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

export default memo(ThreeDNode);