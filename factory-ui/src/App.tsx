import { useCallback, useState, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import NodePanel from './components/NodePanel';
import { NodeInfo } from './services/api';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [activeTab, setActiveTab] = useState<'canvas' | 'nodes'>('canvas');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const nodeData = event.dataTransfer.getData('application/json');
      
      if (!nodeData) {
        return;
      }

      const nodeInfo: NodeInfo = JSON.parse(nodeData);
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `${nodeInfo.name}-${Date.now()}`,
        type: 'default',
        position,
        data: { 
          label: nodeInfo.display_name,
          nodeInfo,
          type: nodeInfo.name
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeDrag = useCallback((nodeInfo: NodeInfo, event: React.DragEvent) => {
    // Optional: Handle node drag start
    console.log('Dragging node:', nodeInfo.display_name);
  }, []);

  return (
    <div className="app">
      <div className="app-tabs">
        <button 
          className={`tab ${activeTab === 'canvas' ? 'active' : ''}`}
          onClick={() => setActiveTab('canvas')}
        >
          Canvas
        </button>
        <button 
          className={`tab ${activeTab === 'nodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('nodes')}
        >
          Available Nodes
        </button>
      </div>
      
      <div className="app-content">
        {activeTab === 'canvas' && (
          <div className="canvas-container">
            <NodePanel onNodeDrag={onNodeDrag} />
            <ReactFlowProvider>
              <div 
                className="react-flow-wrapper" 
                ref={reactFlowWrapper}
                style={{ flex: 1, height: '100%' }}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onInit={setReactFlowInstance}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  connectionMode={ConnectionMode.Loose}
                  fitView
                />
              </div>
            </ReactFlowProvider>
          </div>
        )}
        
        {activeTab === 'nodes' && (
          <div className="nodes-tab">
            <NodePanel onNodeDrag={onNodeDrag} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
