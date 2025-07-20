import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeInfo } from '../services/api';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import URDFLoader, { URDFRobot, URDFJoint } from 'urdf-loader';
import { GroundPlane } from './3d/GroundPlane';
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
            // Force bright green color for all STL meshes
            const material = new THREE.MeshLambertMaterial({ 
              color: 0x00FF00,  // Bright green
              transparent: false,
              opacity: 1.0
            });
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
        // Fallback for other formats - use bright green
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const material = new THREE.MeshLambertMaterial({ color: 0x00FF00 });
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
        // Function to recursively color all meshes green
        const colorAllMeshesGreen = (object: THREE.Object3D) => {
          object.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              // Force all robot parts to be green by creating new materials
              const greenMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x00FF00,  // Bright green for better visibility
                transparent: false,
                opacity: 1.0
              });
              
              // Replace the material completely
              child.material = greenMaterial;
              
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Debug: log what we're coloring
              console.log('Colored mesh:', child.name, 'with green material');
            }
          });
        };
        
        // Color all meshes green
        colorAllMeshesGreen(robot);
        
        // Also traverse after delays to catch any late-loaded meshes
        setTimeout(() => {
          colorAllMeshesGreen(robot);
        }, 100);
        
        setTimeout(() => {
          colorAllMeshesGreen(robot);
        }, 500);
        
        setTimeout(() => {
          colorAllMeshesGreen(robot);
        }, 1000);
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

  useEffect(() => {
    console.log('🤖 [RobotScene DEBUG] Joint states useEffect triggered:', {
      hasRobot: !!robotRef.current,
      hasJoints: !!(robotRef.current && robotRef.current.joints),
      jointStatesCount: jointStates?.length || 0,
      jointStates: jointStates
    });

    if (robotRef.current && robotRef.current.joints && jointStates) {
      console.log('🔧 [RobotScene DEBUG] Applying joint states to robot:', jointStates);
      jointStates.forEach((state) => {
        const joint = robotRef.current!.joints[state.name];
        if (joint && joint.jointType !== 'continuous') {
          const radians = state.angle * (Math.PI / 180);
          console.log(`🎯 [RobotScene DEBUG] Setting joint ${state.name} to ${state.angle}° (${radians.toFixed(3)} rad)`);
          // Direct conversion from degrees to radians (same as bambot)
          joint.setJointValue(radians);
        } else {
          console.log(`❌ [RobotScene DEBUG] Joint ${state.name} not found or is continuous type`);
        }
      });
      console.log('✅ [RobotScene DEBUG] Finished applying all joint states');
    } else {
      console.log('⚠️ [RobotScene DEBUG] Cannot apply joint states:', {
        robotRef: !!robotRef.current,
        joints: !!(robotRef.current && robotRef.current.joints),
        jointStates: !!jointStates
      });
    }
  }, [jointStates]);


  return (
    <>
      <OrbitControls target={SO_ARM100_CONFIG.orbitTarget} enablePan={true} enableZoom={true} enableRotate={true} />
      
      {/* Ground plane */}
      <GroundPlane />
      
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
  
  // Local state for input values
  const [localInputValues, setLocalInputValues] = useState<Record<string, string>>(inputValues);

  // Handle ResizeObserver errors and canvas resizing
  useEffect(() => {
    const handleResizeObserverError = (e: ErrorEvent) => {
      if (e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
        e.stopImmediatePropagation();
        return false;
      }
      return true;
    };

    window.addEventListener('error', handleResizeObserverError);
    
    // Set up resize observer for the 3D viewport
    const viewportElement = nodeRef.current?.querySelector('.threed-viewport');
    if (viewportElement) {
      const resizeObserver = new ResizeObserver(() => {
        // Force canvas to update its size
        const canvas = viewportElement.querySelector('canvas');
        if (canvas) {
          // Trigger a resize event on the canvas
          canvas.dispatchEvent(new Event('resize'));
          
          // Also trigger a window resize event to ensure React Three Fiber updates
          window.dispatchEvent(new Event('resize'));
        }
      });
      
      resizeObserver.observe(viewportElement);
      
      return () => {
        window.removeEventListener('error', handleResizeObserverError);
        resizeObserver.disconnect();
      };
    }
    
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

  const handleRobotLoaded = useCallback((robot: URDFRobot) => {
    console.log('🤖 [DEBUG] Robot loaded, processing joints...');
    const joints: Record<string, URDFJoint> = {};
    const jointStates: JointState[] = [];

    if (robot.joints) {
      console.log('🔍 [DEBUG] Available robot joints:', Object.keys(robot.joints));
      Object.values(robot.joints).forEach((joint: any) => {
        console.log(`🔧 [DEBUG] Processing joint: ${joint.name}, type: ${joint.jointType}`);
        if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
          joints[joint.name] = joint;
          
          // Get initial angle from SO-ARM100 config or default to 0
          const servoInitAngle = (SO_ARM100_CONFIG.urdfInitJointAngles as any)[joint.name] || 0;
          const servoId = (SO_ARM100_CONFIG.jointNameIdMap as any)[joint.name];
          
          const jointAngle = servoInitAngle
          
          console.log(`✅ [DEBUG] Added joint: ${joint.name}, servoId: ${servoId}, angle: ${jointAngle}°`);
          jointStates.push({
            name: joint.name,
            angle: jointAngle,
            servoId: servoId
          });
        }
      });
    }

    console.log('📊 [DEBUG] Final joint states:', jointStates);
    console.log('🎯 [DEBUG] SO_ARM100_CONFIG.jointNameIdMap:', SO_ARM100_CONFIG.jointNameIdMap);
    
    setRobotModel({
      robot,
      joints,
      jointStates
    });
  }, []);

  // Convert rt_update data to jointStates and update robotModel
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`🔍 [DEBUG ${timestamp}] useEffect TRIGGERED! Dependencies changed:`, {
      hasNodeState: !!nodeState,
      hasRtUpdate: !!nodeState?.data?.rt_update,
      hasRobot: !!robotModel.robot,
      rtUpdateData: nodeState?.data?.rt_update,
      currentJointStates: robotModel.jointStates,
      robotJointsCount: robotModel.robot ? Object.keys(robotModel.robot.joints || {}).length : 0
    });
    
    if (nodeState?.data?.rt_update && robotModel.robot) {
      const rtUpdate = nodeState.data.rt_update;
      console.log('🎯 [DEBUG] Starting rt_update conversion:', rtUpdate);
      console.log('🔧 [DEBUG] Current robotModel.jointStates:', robotModel.jointStates);
      
      // Start with current joint states
      let newJointStates = [...robotModel.jointStates];
      let hasChanges = false;
      
      if (Array.isArray(rtUpdate)) {
        // Handle rt_update as array of joint state objects
        rtUpdate.forEach((jointState: any) => {
          if (jointState && typeof jointState === 'object' && jointState.servoId && jointState.angle !== undefined) {
            const servoId = jointState.servoId;
            const angle = jointState.angle;
            
            // Find joint by servo ID and update angle
            const jointIndex = newJointStates.findIndex(joint => joint.servoId === servoId);
            console.log(`🔍 [DEBUG] Looking for servo ${servoId}, found joint index: ${jointIndex}`);
            if (jointIndex !== -1) {
              const oldAngle = newJointStates[jointIndex].angle;
              newJointStates[jointIndex] = {
                ...newJointStates[jointIndex],
                angle: angle
              };
              hasChanges = true;
              console.log(`✅ [DEBUG] Updated joint ${newJointStates[jointIndex].name} (servo ${servoId}) from ${oldAngle}° to ${angle.toFixed(1)}°`);
            } else {
              console.log(`❌ [DEBUG] No joint found for servo ID ${servoId}`);
            }
          } else {
            console.log(`⚠️ [DEBUG] Invalid joint state object:`, jointState);
          }
        });
      } else if (typeof rtUpdate === 'object' && !Array.isArray(rtUpdate)) {
        // Handle rt_update as dictionary of servo positions (legacy format)
        Object.entries(rtUpdate).forEach(([servoIdStr, position]) => {
          const servoId = parseInt(servoIdStr);
          
          // Find joint by servo ID and update angle
          const jointIndex = newJointStates.findIndex(joint => joint.servoId === servoId);
          console.log(`🔍 [DEBUG] Looking for servo ${servoId}, found joint index: ${jointIndex}`);
          if (jointIndex !== -1) {
            const oldAngle = newJointStates[jointIndex].angle;
            // Convert servo position to angle (assuming 0-4095 range maps to 0-360 degrees)
            const angle = ((position as number) / 4095) * 360;
            newJointStates[jointIndex] = {
              ...newJointStates[jointIndex],
              angle: angle
            };
            hasChanges = true;
            console.log(`✅ [DEBUG] Updated joint ${newJointStates[jointIndex].name} (servo ${servoId}) from ${oldAngle}° to ${angle.toFixed(1)}°`);
          } else {
            console.log(`❌ [DEBUG] No joint found for servo ID ${servoId}`);
          }
        });
      }

      console.log('newJointStates', newJointStates)
      
      // Update robot model with new joint states
      if (hasChanges) {
        console.log('🚀 [DEBUG] Updating robotModel.jointStates:', newJointStates);
        setRobotModel(prev => {
          const updated = {
            ...prev,
            jointStates: newJointStates
          };
          console.log('📊 [DEBUG] New robotModel:', updated);
          return updated;
        });
      } else {
        console.log('⚠️ [DEBUG] No changes detected, skipping robotModel update');
      }
    } else {
      if (!nodeState?.data?.rt_update) {
        console.log('📭 [DEBUG] No rt_update data in nodeState');
      }
      if (!robotModel.robot) {
        console.log('🤖 [DEBUG] Robot not loaded yet');
      }
    }
  }, [nodeState?.data?.rt_update, robotModel.robot, robotModel.jointStates]);



  // Handle local input value changes
  const handleInputValueChange = useCallback((inputName: string, value: string) => {
    setLocalInputValues(prev => ({
      ...prev,
      [inputName]: value
    }));
  }, []);

  // Get URDF URL from inputs or use SO-ARM100 default
  const urdfUrl = localInputValues['urdf_path'] || localInputValues['urdf_url'] || SO_ARM100_CONFIG.urdfUrl;
  

  return (
    <div className="node-container">
      <div 
        ref={nodeRef}
        className={`custom-node threed-node ${selected ? 'selected' : ''} ${bypassed ? 'bypassed' : ''} ${nodeState?.state ? `node-${nodeState.state}` : ''} node-${primaryTag} ${isResizing ? `resizing resizing-${resizeDirection}` : ''}`}
        onContextMenu={handleContextMenu}
      >
        {/* Node header */}
        <div className="node-header">
          <div className="node-title">🎲 {nodeInfo.display_name}</div>
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
                const inputValue = localInputValues[input] || '';
                
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
                            onChange={(e) => handleInputValueChange(input, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            rows={1}
                          />
                        ) : typeName === 'FLOAT' ? (
                          <input
                            type="number"
                            className="manual-input"
                            value={inputValue}
                            placeholder={`Enter ${typeName.toLowerCase()}`}
                            onChange={(e) => handleInputValueChange(input, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <input
                            type="text"
                            className="manual-input"
                            value={inputValue}
                            placeholder={`Enter ${typeName.toLowerCase()}`}
                            onChange={(e) => handleInputValueChange(input, e.target.value)}
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
            {nodeState?.data?.rt_update && (
              <small style={{color: 'blue'}}>🔄 Real-time updates active</small>
            )}
          </div>
          <Canvas
            shadows
            camera={{ 
              position: SO_ARM100_CONFIG.camera.position, 
              fov: SO_ARM100_CONFIG.camera.fov 
            }}
            style={{
              width: '100%',
              height: '100%',
              display: 'block'
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance"
            }}
            onCreated={({ scene, gl }: { scene: THREE.Scene; gl: THREE.WebGLRenderer }) => {
              scene.background = new THREE.Color(0x263238);
              // Ensure the renderer handles resize properly
              gl.setSize(gl.domElement.clientWidth, gl.domElement.clientHeight);
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
        {/* {robotModel.jointStates.length > 0 && (
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
        )} */}
        
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