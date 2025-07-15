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
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import NodePanel from './components/NodePanel';
import CustomNode from './components/CustomNode';
import { NodeInfo, apiService } from './services/api';
import { canConnect, getConnectionError } from './utils/typeMatching';

interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    name: string;
    created: string;
    version: string;
  };
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const nodeTypes: NodeTypes = {
  customNode: CustomNode,
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [activeTab, setActiveTab] = useState<'canvas' | 'nodes'>('canvas');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<any>(null);

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // Find source and target nodes to get type information
      const sourceNode = nodes.find(node => node.id === params.source);
      const targetNode = nodes.find(node => node.id === params.target);
      
      if (!sourceNode || !targetNode) {
        console.warn('Source or target node not found for connection');
        return;
      }
      
      // Get type information from node data
      const sourceNodeInfo = sourceNode.data.nodeInfo as NodeInfo;
      const targetNodeInfo = targetNode.data.nodeInfo as NodeInfo;
      
      // Get output type from source
      const sourceHandleId = params.sourceHandle || 'output';
      let outputType = 'unknown';
      
      if (sourceNodeInfo && sourceNodeInfo.return_types) {
        if (sourceHandleId === 'output' && sourceNodeInfo.return_types.length === 1) {
          outputType = sourceNodeInfo.return_types[0];
        } else if (sourceHandleId.startsWith('output-')) {
          const index = parseInt(sourceHandleId.split('-')[1]);
          outputType = sourceNodeInfo.return_types[index] || 'unknown';
        }
      }
      
      // Get input type from target
      const targetHandleId = params.targetHandle || '';
      let inputType = 'unknown';
      
      if (targetNodeInfo && targetHandleId) {
        const requiredInputs = targetNodeInfo.input_types.required || {};
        const optionalInputs = targetNodeInfo.input_types.optional || {};
        
        const inputTypeInfo = requiredInputs[targetHandleId] || optionalInputs[targetHandleId];
        if (inputTypeInfo) {
          inputType = Array.isArray(inputTypeInfo) ? inputTypeInfo[0] : inputTypeInfo;
        }
      }
      
      // Check type compatibility
      if (!canConnect(outputType, inputType)) {
        const errorMessage = getConnectionError(outputType, inputType);
        console.warn(errorMessage);
        
        // Show user feedback
        alert(errorMessage);
        return;
      }
      
      // Connection is valid, proceed
      console.log(`Valid connection: ${outputType} → ${inputType}`);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges, nodes]
  );

  const handleFileLoad = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const workflowData: WorkflowData = JSON.parse(content);
        
        // Validate the structure
        if (!workflowData.nodes || !workflowData.edges) {
          alert('Invalid workflow file format');
          return;
        }

        setNodes(workflowData.nodes);
        setEdges(workflowData.edges);
        
        console.log('Workflow loaded:', workflowData.metadata?.name || 'Unknown');
        
        // Fit view after a short delay to ensure nodes are rendered
        setTimeout(() => {
          if (reactFlowInstance) {
            reactFlowInstance.fitView();
          }
        }, 100);
        
      } catch (error) {
        console.error('Error loading workflow:', error);
        alert('Error loading workflow file');
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges, reactFlowInstance]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    
    // Check if dragging a file
    const hasFiles = event.dataTransfer.types.includes('Files');
    if (hasFiles) {
      event.dataTransfer.dropEffect = 'copy';
      setIsDraggedOver(true);
      console.log('Drag over canvas - file detected');
    } else {
      // Dragging a node
      event.dataTransfer.dropEffect = 'copy';
      console.log('Drag over canvas - node');
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDraggedOver(false);
      console.log('Drop event triggered');

      // Check if dropping a file
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        handleFileLoad(files[0]);
        return;
      }

      // Handle node drop
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
          type: 'customNode',
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
    [reactFlowInstance, setNodes, handleFileLoad]
  );

  const onNodeDrag = useCallback((nodeInfo: NodeInfo, event: React.DragEvent) => {
    // Optional: Handle node drag start
    console.log('Dragging node:', nodeInfo.display_name);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    // Only reset if leaving the entire wrapper area
    if (!event.currentTarget.contains(event.relatedTarget as Element)) {
      setIsDraggedOver(false);
    }
  }, []);

  const saveWorkflow = useCallback(() => {
    const workflowData: WorkflowData = {
      nodes,
      edges,
      metadata: {
        name: `workflow-${new Date().toISOString().split('T')[0]}`,
        created: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    const dataStr = JSON.stringify(workflowData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workflowData.metadata.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('Workflow saved:', workflowData.metadata.name);
  }, [nodes, edges]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileLoad(file);
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileLoad]);

  const loadWorkflow = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearCanvas = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      if (window.confirm('Are you sure you want to clear the canvas? This will remove all nodes and connections.')) {
        setNodes([]);
        setEdges([]);
      }
    }
  }, [nodes.length, edges.length, setNodes, setEdges]);

  const isValidConnection = useCallback((connection: Connection) => {
    // Find source and target nodes to get type information
    const sourceNode = nodes.find(node => node.id === connection.source);
    const targetNode = nodes.find(node => node.id === connection.target);
    
    if (!sourceNode || !targetNode) {
      return false;
    }
    
    // Get type information from node data
    const sourceNodeInfo = sourceNode.data.nodeInfo as NodeInfo;
    const targetNodeInfo = targetNode.data.nodeInfo as NodeInfo;
    
    // Get output type from source
    const sourceHandleId = connection.sourceHandle || 'output';
    let outputType = 'unknown';
    
    if (sourceNodeInfo && sourceNodeInfo.return_types) {
      if (sourceHandleId === 'output' && sourceNodeInfo.return_types.length === 1) {
        outputType = sourceNodeInfo.return_types[0];
      } else if (sourceHandleId.startsWith('output-')) {
        const index = parseInt(sourceHandleId.split('-')[1]);
        outputType = sourceNodeInfo.return_types[index] || 'unknown';
      }
    }
    
    // Get input type from target
    const targetHandleId = connection.targetHandle || '';
    let inputType = 'unknown';
    
    if (targetNodeInfo && targetHandleId) {
      const requiredInputs = targetNodeInfo.input_types.required || {};
      const optionalInputs = targetNodeInfo.input_types.optional || {};
      
      const inputTypeInfo = requiredInputs[targetHandleId] || optionalInputs[targetHandleId];
      if (inputTypeInfo) {
        inputType = Array.isArray(inputTypeInfo) ? inputTypeInfo[0] : inputTypeInfo;
      }
    }
    
    // Check type compatibility
    const isValid = canConnect(outputType, inputType);
    
    if (!isValid) {
      console.log(`Invalid connection attempt: ${outputType} → ${inputType}`);
    }
    
    return isValid;
  }, [nodes]);

  const runWorkflow = useCallback(async () => {
    if (nodes.length === 0) {
      alert('No nodes to execute. Please add some nodes to the canvas first.');
      return;
    }

    setIsExecuting(true);
    setExecutionResults(null);

    try {
      const workflowData = {
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          data: node.data,
          position: node.position
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle
        })),
        metadata: {
          name: `workflow-execution-${Date.now()}`,
          created: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      console.log('Executing workflow:', workflowData);
      const result = await apiService.executeWorkflow(workflowData);
      
      setExecutionResults(result);
      
      if (result.success) {
        console.log('Workflow executed successfully:', result);
        alert('Workflow executed successfully! Check the console for details.');
      } else {
        console.error('Workflow execution failed:', result);
        alert(`Workflow execution failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      setExecutionResults({ success: false, error: 'Network or server error' });
      alert('Failed to execute workflow. Please check the backend server.');
    } finally {
      setIsExecuting(false);
    }
  }, [nodes, edges]);

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
                className={`react-flow-wrapper ${isDraggedOver ? 'drag-over' : ''}`}
                ref={reactFlowWrapper}
                style={{ flex: 1, height: '100%' }}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
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
                  nodeTypes={nodeTypes}
                  isValidConnection={isValidConnection}
                  connectionMode={ConnectionMode.Loose}
                  fitView
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                </ReactFlow>
                
                {isDraggedOver && (
                  <div className="drop-overlay">
                    <div className="drop-message">
                      <span>📁 Drop JSON file to load workflow</span>
                    </div>
                  </div>
                )}
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
      
      <div className="app-toolbar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        
        <div className="toolbar-group">
          <button 
            className="toolbar-btn run-btn" 
            onClick={runWorkflow}
            disabled={nodes.length === 0 || isExecuting}
            title="Execute the current workflow"
          >
            {isExecuting ? '⏳ Running...' : '▶️ Run'}
          </button>
          <button className="toolbar-btn" onClick={loadWorkflow} title="Load workflow from JSON file">
            📂 Load
          </button>
          <button 
            className="toolbar-btn" 
            onClick={saveWorkflow} 
            disabled={nodes.length === 0}
            title="Save workflow as JSON file"
          >
            💾 Save
          </button>
          <button 
            className="toolbar-btn danger" 
            onClick={clearCanvas}
            disabled={nodes.length === 0 && edges.length === 0}
            title="Clear all nodes and connections"
          >
            🗑️ Clear
          </button>
        </div>
        
        <div className="toolbar-info">
          <span className="node-count">Nodes: {nodes.length}</span>
          <span className="edge-count">Connections: {edges.length}</span>
          {executionResults && (
            <span className={`execution-status ${executionResults.success ? 'success' : 'error'}`}>
              {executionResults.success ? '✅ Success' : '❌ Failed'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
