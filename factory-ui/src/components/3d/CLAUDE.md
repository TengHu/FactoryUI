# 3D Visualization Components

## Overview

The 3D visualization components provide real-time 3D model visualization and manipulation capabilities for robotic systems in Factory UI. Built with React Three Fiber and Three.js, these components enable loading URDF files, rendering STL meshes, and applying joint transformations in real-time.

### Architecture

```
ThreeDNode (React Component)
    ↕️
RobotScene (Three.js Scene)
    ↕️
URDF Loader + STL Loader
    ↕️
Joint Controls (React Sliders)
```

## Core Components

### 1. ThreeDNode (`src/components/ThreeDNode.tsx`)

Main React component that provides a complete 3D visualization node for Factory UI workflows.

**Key Features:**
- URDF file loading and parsing
- STL mesh rendering with automatic material assignment
- Real-time joint angle manipulation
- Interactive 3D viewport with camera controls
- Seamless integration with Factory UI node system

**Props Interface:**
```typescript
export interface ThreeDNodeProps extends NodeProps {
  onContextMenu?: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void;
  onInputValueChange?: (nodeId: string, inputName: string, value: string) => void;
}
```

**Usage in Workflow:**
```typescript
// The node accepts URDF file paths through inputs
// and provides 3D visualization with joint controls
const threeDNode = {
  type: 'threed',
  data: {
    nodeInfo: {
      display_name: '3D Robot Viewer',
      input_types: {
        required: {
          urdf_path: ['STRING']
        }
      },
      return_types: {
        required: {
          joint_states: ['OBJECT']
        }
      }
    }
  }
};
```

### 2. RobotScene (`ThreeDNode.tsx` - Internal Component)

Three.js scene component that handles 3D rendering and robot model management.

**Key Features:**
- URDF robot loading with custom STL mesh support
- Real-time joint state application
- Proper lighting and environment setup
- Camera controls (orbit, zoom, pan)
- Shadow casting and receiving

**Implementation:**
```typescript
function RobotScene({ 
  urdfUrl, 
  jointStates, 
  onRobotLoaded 
}: { 
  urdfUrl: string;
  jointStates: JointState[];
  onRobotLoaded: (robot: URDFRobot) => void;
}) {
  // URDF loading with custom STL loader
  const loader = new URDFLoader(manager);
  loader.loadMeshCb = (path: string, manager, done) => {
    if (path.endsWith('.stl')) {
      STLLoader.load(path, (geometry) => {
        const material = new THREE.MeshLambertMaterial({ color: 0x808080 });
        const mesh = new THREE.Mesh(geometry, material);
        done(mesh);
      });
    }
  };
}
```

## Features Implemented

### ✅ URDF File Loading
- **Feature**: Parse and load URDF (Unified Robot Description Format) files
- **Implementation**: Uses `urdf-loader` with custom STL mesh loading callbacks
- **Supported Formats**: XML-based URDF files with STL mesh references

### ✅ STL Mesh Rendering
- **Feature**: Load and render STL (Stereolithography) files for robot parts
- **Implementation**: Custom STL loader with automatic material assignment
- **Formats**: Both ASCII and binary STL files supported

### ✅ Real-Time Joint Control
- **Feature**: Interactive sliders for controlling robot joint angles
- **Implementation**: React sliders connected to Three.js joint transformations
- **Range**: -180° to +180° for revolute joints

### ✅ 3D Scene Visualization
- **Feature**: Complete 3D environment with lighting and camera controls
- **Implementation**: React Three Fiber with OrbitControls and Environment
- **Lighting**: Directional lights with shadows, ambient lighting, grid helper

### ✅ Factory UI Integration
- **Feature**: Seamless integration with Factory UI node system
- **Implementation**: Standard node interface with inputs/outputs and resize handles
- **States**: Supports all node states (idle, executing, completed, error)

## Data Structures

### Joint State Interface
```typescript
interface JointState {
  name: string;        // Joint name from URDF
  angle: number;       // Current angle in degrees
  servoId?: number;    // Optional servo ID for hardware control
}
```

### Robot Model Interface
```typescript
interface RobotModel {
  robot: URDFRobot | null;           // Loaded URDF robot instance
  joints: Record<string, URDFJoint>; // Available joints by name
  jointStates: JointState[];         // Current joint state values
}
```

### Component Data Interface
```typescript
interface ThreeDNodeData {
  label: string;
  nodeInfo: NodeInfo;
  type: string;
  inputModes?: Record<string, 'connection' | 'manual'>;
  inputValues?: Record<string, string>;  // Contains URDF path
  bypassed?: boolean;
  nodeState?: {
    state: 'idle' | 'executing' | 'completed' | 'error';
    data?: any;
    timestamp?: number;
  };
}
```

## Implementation Details

### URDF Loading Process

```typescript
// 1. Initialize URDF loader with custom STL loading
const manager = new THREE.LoadingManager();
const loader = new URDFLoader(manager);

// 2. Configure STL mesh loading
loader.parseCollision = true;
loader.parseVisual = true;
loader.loadMeshCb = (path: string, manager, done) => {
  if (path.endsWith('.stl')) {
    STLLoader.load(path, (geometry) => {
      const material = new THREE.MeshLambertMaterial({ color: 0x808080 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      done(mesh);
    });
  }
};

// 3. Load URDF file
loader.load(urdfUrl, (robot) => {
  robot.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(robot);
});
```

### Joint Transformation Application

```typescript
// Apply joint states to loaded robot
useEffect(() => {
  if (robotRef.current && robotRef.current.joints && jointStates) {
    jointStates.forEach((state) => {
      const joint = robotRef.current!.joints[state.name];
      if (joint) {
        // Convert degrees to radians for Three.js
        joint.setJointValue(state.angle * (Math.PI / 180));
      }
    });
  }
}, [jointStates]);
```

### Interactive Joint Controls

```typescript
const handleJointAngleChange = useCallback((jointName: string, angle: number) => {
  setRobotModel(prev => ({
    ...prev,
    jointStates: prev.jointStates.map(state =>
      state.name === jointName ? { ...state, angle } : state
    )
  }));
}, []);

// Render joint control sliders
{robotModel.jointStates.map((jointState) => (
  <div key={jointState.name} className="joint-control-item">
    <label>{jointState.name}:</label>
    <input
      type="range"
      min="-180"
      max="180"
      value={jointState.angle}
      onChange={(e) => handleJointAngleChange(jointState.name, parseFloat(e.target.value))}
    />
    <span>{jointState.angle.toFixed(1)}°</span>
  </div>
))}
```

## Visual Styling

### Component Layout (`ThreeDNode.css`)

#### 3D Viewport
```css
.threed-viewport {
  width: 100%;
  height: 200px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  margin: 8px 0;
  background: #263238;
  position: relative;
  overflow: hidden;
}
```

#### Joint Controls
```css
.joint-controls {
  margin-top: 8px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #f8fafc;
}

.joint-control-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.joint-slider {
  flex: 1;
  min-width: 100px;
  height: 4px;
  border-radius: 2px;
  background: #e2e8f0;
}
```

#### Node State Animations
```css
.threed-node.node-executing .threed-viewport {
  border-color: #fd7e14;
  box-shadow: 0 0 0 2px rgba(253, 126, 20, 0.2);
}

.threed-node.node-completed .threed-viewport {
  border-color: #198754;
  box-shadow: 0 0 0 2px rgba(25, 135, 84, 0.2);
}
```

## Configuration and Setup

### Required Dependencies

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.0.0",
    "@react-three/drei": "^9.0.0",
    "three": "^0.155.0",
    "urdf-loader": "^0.12.0"
  }
}
```

### Three.js Extensions

```typescript
// Add STL loader to Three.js globals
declare module 'three' {
  export class STLLoader extends THREE.Loader {
    load(
      url: string,
      onLoad: (geometry: THREE.BufferGeometry) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
  }
}
```

### Node Registration

```typescript
// Register ThreeDNode in node types
const nodeTypes = {
  custom: CustomNode,
  camera: CameraNode,
  threed: ThreeDNode,  // Add ThreeDNode
};
```

## Usage Examples

### Basic 3D Robot Visualization

```typescript
// 1. Create a ThreeDNode in workflow
const threeDNode = {
  id: 'threed-1',
  type: 'threed',
  position: { x: 100, y: 100 },
  data: {
    nodeInfo: {
      display_name: '3D Robot Viewer',
      description: 'Visualize robot URDF with joint controls',
      category: 'visualization',
      input_types: {
        required: {
          urdf_path: ['STRING']
        }
      },
      return_types: {
        required: {
          joint_states: ['OBJECT']
        }
      }
    },
    inputValues: {
      urdf_path: '/path/to/robot.urdf'
    }
  }
};

// 2. Connect URDF file input
// 3. Use joint controls to manipulate robot
// 4. Output joint states for other nodes
```

### Integration with Robot Control

```typescript
// Connect ThreeDNode output to robot control nodes
const robotControlFlow = [
  {
    id: 'urdf-loader',
    type: 'threed',
    data: {
      inputValues: { urdf_path: '/models/robot.urdf' }
    }
  },
  {
    id: 'joint-processor',
    type: 'custom',
    data: {
      nodeInfo: {
        display_name: 'Joint State Processor',
        input_types: { required: { joint_states: ['OBJECT'] } }
      }
    }
  }
];

// Edge connecting 3D node output to processor input
const edge = {
  id: 'joint-connection',
  source: 'urdf-loader',
  sourceHandle: 'output',
  target: 'joint-processor',
  targetHandle: 'joint_states'
};
```

## Performance Considerations

### Model Optimization

```typescript
// Optimize loaded meshes for better performance
robot.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    // Enable frustum culling
    child.frustumCulled = true;
    
    // Optimize geometry
    if (child.geometry) {
      child.geometry.computeBoundingSphere();
      child.geometry.computeBoundingBox();
    }
    
    // Configure shadows selectively
    child.castShadow = true;
    child.receiveShadow = true;
  }
});
```

### Rendering Optimization

```typescript
// Use memoization for expensive computations
const memoizedJointStates = useMemo(() => {
  return robotModel.jointStates;
}, [robotModel.jointStates]);

// Debounce joint angle updates
const debouncedAngleUpdate = useCallback(
  debounce((jointName: string, angle: number) => {
    handleJointAngleChange(jointName, angle);
  }, 16), // ~60fps
  []
);
```

### Memory Management

```typescript
// Cleanup on component unmount
useEffect(() => {
  return () => {
    if (robotRef.current) {
      scene.remove(robotRef.current);
      
      // Dispose of geometries and materials
      robotRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  };
}, []);
```

## Error Handling

### URDF Loading Errors

```typescript
loader.load(
  urdfUrl,
  (robot) => {
    // Success callback
    onRobotLoaded(robot);
  },
  undefined,
  (error) => {
    console.error('Error loading URDF:', error);
    // Show error state in viewport
    setLoadingState('error');
  }
);
```

### STL Loading Fallback

```typescript
loader.loadMeshCb = (path: string, manager, done) => {
  if (path.endsWith('.stl')) {
    STLLoader.load(
      path,
      (geometry) => {
        const material = new THREE.MeshLambertMaterial({ color: 0x808080 });
        const mesh = new THREE.Mesh(geometry, material);
        done(mesh);
      },
      undefined,
      (error) => {
        console.error('Failed to load STL:', path, error);
        // Create placeholder geometry
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const mesh = new THREE.Mesh(geometry, material);
        done(mesh);
      }
    );
  }
};
```

## Testing

### Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import ThreeDNode from '../ThreeDNode';

describe('ThreeDNode', () => {
  test('should render 3D viewport', () => {
    const mockNodeData = {
      nodeInfo: {
        display_name: '3D Viewer',
        input_types: { required: { urdf_path: ['STRING'] } }
      }
    };
    
    render(<ThreeDNode id="test" data={mockNodeData} />);
    expect(screen.getByText('🎲 3D Viewer')).toBeInTheDocument();
  });
  
  test('should show joint controls when robot is loaded', async () => {
    // Test implementation with mock URDF data
  });
});
```

### Integration Testing

```typescript
// Test URDF loading and joint manipulation
test('should load URDF and update joint states', async () => {
  const mockUrdf = '/test/robot.urdf';
  const component = render(<ThreeDNode data={{ inputValues: { urdf_path: mockUrdf } }} />);
  
  // Wait for URDF to load
  await waitFor(() => {
    expect(screen.getByText('Joint Controls')).toBeInTheDocument();
  });
  
  // Test joint angle manipulation
  const slider = screen.getByRole('slider', { name: /joint_1/ });
  fireEvent.change(slider, { target: { value: '45' } });
  
  expect(slider.value).toBe('45');
});
```

## Troubleshooting

### Common Issues

1. **URDF Not Loading**: Check file path and CORS settings
2. **STL Meshes Missing**: Verify STL file paths in URDF are correct
3. **Joint Controls Not Working**: Ensure joint names match URDF definitions
4. **Performance Issues**: Optimize mesh complexity and disable unnecessary shadows

### Debug Commands

```javascript
// In browser console
// Check loaded robot model
window.robotRef?.current?.joints

// Inspect joint states
window.robotModel?.jointStates

// Verify Three.js scene
window.threeScene?.children
```

### File Path Requirements

```
/public/
  ├── URDFs/
  │   ├── robot.urdf         # Main URDF file
  │   └── meshes/
  │       ├── base_link.stl  # STL mesh files
  │       ├── arm_link.stl
  │       └── gripper.stl
```

## Future Enhancements

### Planned Features
1. **Animation Playback**: Record and replay joint sequences
2. **Collision Detection**: Visual collision checking
3. **Multiple Robot Support**: Load multiple robots in same scene
4. **Export Capabilities**: Export joint states and animations
5. **Material Customization**: Custom materials and textures

### Technical Improvements
1. **LOD System**: Level-of-detail for performance optimization
2. **Instanced Rendering**: For multiple identical components
3. **Web Workers**: Offload heavy computations
4. **WebXR Support**: VR/AR visualization capabilities

The 3D visualization system provides a powerful foundation for robotic simulation and visualization within Factory UI, enabling intuitive interaction with complex robotic systems through an integrated workflow interface.