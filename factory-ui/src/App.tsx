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
  Background,
  BackgroundVariant,
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
    event.dataTransfer.dropEffect = 'copy';
    console.log('Drag over canvas');
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      console.log('Drop event triggered');

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) {
        console.log('Missing reactFlowBounds');
        return;
      }
      
      if (!reactFlowInstance) {
        console.log('Missing reactFlowInstance');
        return;
      }

      const nodeData = event.dataTransfer.getData('application/json');
      console.log('Node data from transfer:', nodeData);
      
      if (!nodeData) {
        console.log('No node data found');
        return;
      }

      try {
        const nodeInfo: NodeInfo = JSON.parse(nodeData);
        console.log('Parsed node info:', nodeInfo);
        
        const position = reactFlowInstance.project({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });
        console.log('Calculated position:', position);

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

        console.log('Adding new node:', newNode);
        setNodes((nds) => {
          console.log('Previous nodes:', nds);
          const updated = [...nds, newNode];
          console.log('Updated nodes:', updated);
          return updated;
        });
      } catch (error) {
        console.error('Error parsing node data:', error);
      }
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
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onInit={(instance) => {
                    console.log('ReactFlow instance initialized:', instance);
                    setReactFlowInstance(instance);
                  }}
                  connectionMode={ConnectionMode.Loose}
                  fitView
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                </ReactFlow>
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
