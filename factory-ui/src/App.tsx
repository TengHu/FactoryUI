import React, { useCallback, useState, useRef, useEffect } from 'react';
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
import ContextMenu, { ContextMenuItem } from './components/ContextMenu';
import ThemeToggle from './components/ThemeToggle';
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

const createCustomNodeWithContextMenu = (
  onContextMenu: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void,
  onInputValueChange: (nodeId: string, inputName: string, value: string) => void
) => {
  return (props: any) => <CustomNode {...props} onContextMenu={onContextMenu} onInputValueChange={onInputValueChange} />;
};

// Safe expression evaluator for sleep time calculations
const evaluateExpression = (expression: string): { value: number; error: string | null } => {
  try {
    // Remove whitespace
    const cleanExpr = expression.trim();
    
    // Return early for empty input
    if (!cleanExpr) {
      return { value: 0, error: 'Expression cannot be empty' };
    }
    
    // Allow only safe mathematical characters and operations
    const safePattern = /^[0-9+\-*/().\s]+$/;
    if (!safePattern.test(cleanExpr)) {
      return { value: 0, error: 'Invalid characters in expression' };
    }
    
    // Evaluate the expression safely using Function constructor
    // This is safer than eval() but still allows mathematical expressions
    const result = Function(`"use strict"; return (${cleanExpr})`)();
    
    // Validate result
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return { value: 0, error: 'Expression must evaluate to a valid number' };
    }
    
    if (result <= 0) {
      return { value: 0, error: 'Sleep time must be greater than 0' };
    }
    
    return { value: result, error: null };
  } catch (error) {
    return { value: 0, error: 'Invalid mathematical expression' };
  }
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
  const [isContinuousRunning, setIsContinuousRunning] = useState(false);
  const [continuousStatus, setContinuousStatus] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    nodeId: string | null;
    nodeInfo: NodeInfo | null;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    nodeId: null,
    nodeInfo: null,
  });
  
  // State for copy/paste functionality
  const [copiedNodeData, setCopiedNodeData] = useState<Node | null>(null);
  
  // State for continuous execution modal
  const [showContinuousExecutionModal, setShowContinuousExecutionModal] = useState(false);
  const [modalSleepTime, setModalSleepTime] = useState('1');
  const [sleepTimeError, setSleepTimeError] = useState<string | null>(null);

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
        // Helper function to get output type from return_types
        const getOutputType = (returnTypes: any, handleId: string) => {
          if (Array.isArray(returnTypes)) {
            // Old format: string array
            if (handleId === 'output' && returnTypes.length === 1) {
              return returnTypes[0];
            } else if (handleId.startsWith('output-')) {
              const index = parseInt(handleId.split('-')[1]);
              return returnTypes[index] || 'unknown';
            }
          } else if (returnTypes && typeof returnTypes === 'object') {
            // New format: dict with required/optional
            const allOutputs = {...(returnTypes.required || {}), ...(returnTypes.optional || {})};
            const outputEntries = Object.entries(allOutputs);
            
            if (handleId === 'output' && outputEntries.length === 1) {
              const [, typeInfo] = outputEntries[0];
              return Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
            } else if (handleId.startsWith('output-')) {
              const index = parseInt(handleId.split('-')[1]);
              if (outputEntries[index]) {
                const [, typeInfo] = outputEntries[index];
                return Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
              }
            }
          }
          return 'unknown';
        };
        
        outputType = getOutputType(sourceNodeInfo.return_types, sourceHandleId);
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
      // Helper function to get output type from return_types
      const getOutputType = (returnTypes: any, handleId: string) => {
        if (Array.isArray(returnTypes)) {
          // Old format: string array
          if (handleId === 'output' && returnTypes.length === 1) {
            return returnTypes[0];
          } else if (handleId.startsWith('output-')) {
            const index = parseInt(handleId.split('-')[1]);
            return returnTypes[index] || 'unknown';
          }
        } else if (returnTypes && typeof returnTypes === 'object') {
          // New format: dict with required/optional
          const allOutputs = {...(returnTypes.required || {}), ...(returnTypes.optional || {})};
          const outputEntries = Object.entries(allOutputs);
          
          if (handleId === 'output' && outputEntries.length === 1) {
            const [, typeInfo] = outputEntries[0];
            return Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
          } else if (handleId.startsWith('output-')) {
            const index = parseInt(handleId.split('-')[1]);
            if (outputEntries[index]) {
              const [, typeInfo] = outputEntries[index];
              return Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
            }
          }
        }
        return 'unknown';
      };
      
      outputType = getOutputType(sourceNodeInfo.return_types, sourceHandleId);
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

  const prepareWorkflowData = useCallback(() => {
    // Filter out bypassed nodes
    const activeNodes = nodes.filter(node => !node.data.bypassed);
    const activeNodeIds = new Set(activeNodes.map(node => node.id));
    
    // Filter out edges connected to bypassed nodes
    const activeEdges = edges.filter(edge => 
      activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)
    );
    
    // Log bypassed nodes for user feedback
    const bypassedNodes = nodes.filter(node => node.data.bypassed);
    if (bypassedNodes.length > 0) {
      console.log(`⚫ Skipping ${bypassedNodes.length} bypassed node(s):`, 
        bypassedNodes.map(n => n.data.nodeInfo.display_name).join(', ')
      );
    }
    
    return {
      nodes: activeNodes.map(node => ({
        id: node.id,
        type: node.data.nodeInfo?.name || node.data.type || node.type,
        data: {
          ...node.data,
          parameters: node.data.inputValues || {}
        },
        position: node.position
      })),
      edges: activeEdges.map(edge => ({
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
  }, [nodes, edges]);

  const runWorkflowOnce = useCallback(async () => {
    if (nodes.length === 0) {
      alert('No nodes to execute. Please add some nodes to the canvas first.');
      return;
    }

    setIsExecuting(true);
    setExecutionResults(null);

    try {
      const workflowData = prepareWorkflowData();
      
      // Check if all nodes are bypassed
      if (workflowData.nodes.length === 0) {
        alert('All nodes are bypassed. Please enable at least one node to execute the workflow.');
        setIsExecuting(false);
        return;
      }
      
      console.log('Executing workflow once:', workflowData);
      
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
  }, [nodes.length, prepareWorkflowData]);

  const showContinuousModal = useCallback(() => {
    setShowContinuousExecutionModal(true);
    setSleepTimeError(null); // Reset error when opening modal
  }, []);

  const handleSleepTimeChange = useCallback((value: string) => {
    setModalSleepTime(value);
    
    // Validate the expression
    const evaluation = evaluateExpression(value);
    setSleepTimeError(evaluation.error);
  }, []);

  const startContinuousExecution = useCallback(async () => {
    if (nodes.length === 0) {
      alert('No nodes to execute. Please add some nodes to the canvas first.');
      return;
    }

    try {
      const workflowData = prepareWorkflowData();
      
      // Check if all nodes are bypassed
      if (workflowData.nodes.length === 0) {
        alert('All nodes are bypassed. Please enable at least one node to execute the workflow.');
        return;
      }
      
      // Evaluate the sleep time expression
      const evaluation = evaluateExpression(modalSleepTime);
      if (evaluation.error) {
        alert(`Invalid sleep time: ${evaluation.error}`);
        return;
      }
      
      // Add sleep_time to workflow data
      const workflowWithSleepTime = {
        ...workflowData,
        sleep_time: evaluation.value
      };
      
      console.log('Starting continuous execution:', workflowWithSleepTime);
      
      const result = await apiService.startContinuousExecution(workflowWithSleepTime);
      
      if (result.success) {
        setIsContinuousRunning(true);
        setShowContinuousExecutionModal(false);
        console.log('Continuous execution started:', result);
        alert('Continuous execution started! The workflow will run repeatedly.');
        
        // Start polling for status updates
        pollContinuousStatus();
      } else {
        alert(`Failed to start continuous execution: ${result.message}`);
      }
    } catch (error) {
      console.error('Error starting continuous execution:', error);
      alert('Failed to start continuous execution. Please check the backend server.');
    }
  }, [nodes.length, prepareWorkflowData, modalSleepTime]);

  const stopContinuousExecution = useCallback(async () => {
    try {
      const result = await apiService.stopContinuousExecution();
      
      if (result.success) {
        setIsContinuousRunning(false);
        setContinuousStatus(null);
        console.log('Continuous execution stopped:', result);
        alert('Continuous execution stopped.');
      } else {
        alert(`Failed to stop continuous execution: ${result.message}`);
      }
    } catch (error) {
      console.error('Error stopping continuous execution:', error);
      alert('Failed to stop continuous execution. Please check the backend server.');
    }
  }, []);

  const pollContinuousStatus = useCallback(async () => {
    if (!isContinuousRunning) return;
    
    try {
      const status = await apiService.getContinuousStatus();
      setContinuousStatus(status);
      
      if (status.is_running) {
        // Continue polling every 2 seconds
        setTimeout(pollContinuousStatus, 2000);
      } else {
        // Execution stopped
        setIsContinuousRunning(false);
      }
    } catch (error) {
      console.error('Error polling continuous status:', error);
      // Continue polling even if there's an error
      if (isContinuousRunning) {
        setTimeout(pollContinuousStatus, 5000);
      }
    }
  }, [isContinuousRunning]);

  // Start polling when continuous execution begins
  React.useEffect(() => {
    if (isContinuousRunning) {
      pollContinuousStatus();
    }
  }, [isContinuousRunning, pollContinuousStatus]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => {
    setContextMenu({
      isVisible: true,
      position: { x: event.clientX, y: event.clientY },
      nodeId,
      nodeInfo,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  }, []);

  const deleteNode = useCallback(() => {
    if (contextMenu.nodeId) {
      setNodes(nodes => nodes.filter(node => node.id !== contextMenu.nodeId));
      setEdges(edges => edges.filter(edge => 
        edge.source !== contextMenu.nodeId && edge.target !== contextMenu.nodeId
      ));
    }
  }, [contextMenu.nodeId, setNodes, setEdges]);

  const duplicateNode = useCallback(() => {
    if (contextMenu.nodeId && contextMenu.nodeInfo) {
      const originalNode = nodes.find(node => node.id === contextMenu.nodeId);
      if (originalNode) {
        const newNode: Node = {
          ...originalNode,
          id: `${contextMenu.nodeInfo.name}-${Date.now()}`,
          position: {
            x: originalNode.position.x + 50,
            y: originalNode.position.y + 50,
          },
        };
        setNodes(nodes => [...nodes, newNode]);
      }
    }
  }, [contextMenu.nodeId, contextMenu.nodeInfo, nodes, setNodes]);

  const copyNodeId = useCallback(() => {
    if (contextMenu.nodeId) {
      navigator.clipboard.writeText(contextMenu.nodeId);
      alert(`Node ID copied: ${contextMenu.nodeId}`);
    }
  }, [contextMenu.nodeId]);

  // Copy node functionality
  const copyNode = useCallback(() => {
    if (contextMenu.nodeId) {
      const nodeToCopy = nodes.find(node => node.id === contextMenu.nodeId);
      if (nodeToCopy) {
        setCopiedNodeData(nodeToCopy);
        console.log('✓ Node copied:', nodeToCopy.data.nodeInfo.display_name);
      }
    }
  }, [contextMenu.nodeId, nodes]);

  // Copy selected node (for keyboard shortcut)
  const copySelectedNode = useCallback(() => {
    const selectedNode = nodes.find(node => node.selected);
    if (selectedNode) {
      setCopiedNodeData(selectedNode);
      console.log('✓ Node copied:', selectedNode.data.nodeInfo.display_name);
    } else {
      console.log('⚠ No node selected to copy');
    }
  }, [nodes]);

  // Paste node functionality
  const pasteNode = useCallback((position?: { x: number; y: number }) => {
    if (copiedNodeData) {
      let pastePosition: { x: number; y: number };
      
      // If position provided, use it
      if (position) {
        pastePosition = position;
      } else if (contextMenu.isVisible && reactFlowInstance) {
        // Convert screen coordinates to flow coordinates
        pastePosition = reactFlowInstance.project({
          x: contextMenu.position.x,
          y: contextMenu.position.y
        });
      } else {
        // Default position with some offset from the original
        pastePosition = {
          x: copiedNodeData.position.x + 50,
          y: copiedNodeData.position.y + 50
        };
      }
      
      // Create new node with unique ID
      const newNode: Node = {
        ...copiedNodeData,
        id: `${copiedNodeData.data.nodeInfo.name}-${Date.now()}`,
        position: pastePosition,
        selected: false, // Don't select the pasted node by default
      };

      setNodes(nodes => [...nodes, newNode]);
      console.log('✓ Node pasted:', newNode.data.nodeInfo.display_name);
    } else {
      console.log('⚠ No node copied to paste');
    }
  }, [copiedNodeData, setNodes, contextMenu.isVisible, contextMenu.position, reactFlowInstance]);

  // Toggle bypass functionality
  const toggleBypass = useCallback(() => {
    if (contextMenu.nodeId) {
      setNodes(nodes => 
        nodes.map(node => {
          if (node.id === contextMenu.nodeId) {
            const newBypassed = !node.data.bypassed;
            console.log(`${newBypassed ? '⚫' : '✓'} Node ${newBypassed ? 'bypassed' : 'activated'}:`, node.data.nodeInfo.display_name);
            return {
              ...node,
              data: {
                ...node.data,
                bypassed: newBypassed
              }
            };
          }
          return node;
        })
      );
    }
  }, [contextMenu.nodeId, setNodes]);

  // Keyboard event handler for copy/paste
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle if not typing in an input field
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).contentEditable === 'true') {
      return;
    }

    // Handle copy (Ctrl+C or Cmd+C)
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      event.preventDefault();
      copySelectedNode();
    }

    // Handle paste (Ctrl+V or Cmd+V)
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      event.preventDefault();
      // Paste at a default position, could be enhanced to paste at mouse position
      pasteNode();
    }

    // Handle delete (Delete or Backspace)
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      const selectedNode = nodes.find(node => node.selected);
      if (selectedNode) {
        setNodes(nodes => nodes.filter(node => node.id !== selectedNode.id));
        setEdges(edges => edges.filter(edge => 
          edge.source !== selectedNode.id && edge.target !== selectedNode.id
        ));
      }
    }
  }, [copySelectedNode, pasteNode, nodes, setNodes, setEdges]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleInputValueChange = useCallback((nodeId: string, inputName: string, value: string) => {
    setNodes(nodes => 
      nodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              inputValues: {
                ...node.data.inputValues,
                [inputName]: value
              }
            }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const toggleInputMode = useCallback((inputName: string) => {
    if (!contextMenu.nodeId) return;
    
    setNodes(nodes => 
      nodes.map(node => {
        if (node.id === contextMenu.nodeId) {
          // Get the type information to determine default mode
          const nodeInfo = node.data.nodeInfo as NodeInfo;
          const typeInfo = 
            nodeInfo.input_types.required?.[inputName] ||
            nodeInfo.input_types.optional?.[inputName];
          const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
          const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT') ? 'manual' : 'connection';
          
          const currentMode = node.data.inputModes?.[inputName] || defaultMode;
          const newMode = currentMode === 'connection' ? 'manual' : 'connection';
          
          // If switching to connection mode, remove any edges for this input
          if (newMode === 'connection') {
            setEdges(edges => 
              edges.filter(edge => 
                !(edge.target === contextMenu.nodeId && edge.targetHandle === inputName)
              )
            );
          }
          
          return {
            ...node,
            data: {
              ...node.data,
              inputModes: {
                ...node.data.inputModes,
                [inputName]: newMode
              }
            }
          };
        }
        return node;
      })
    );
  }, [contextMenu.nodeId, setNodes, setEdges]);

  const contextMenuItems: ContextMenuItem[] = React.useMemo(() => {
    // Check if current node is bypassed
    const currentNode = contextMenu.nodeId ? nodes.find(n => n.id === contextMenu.nodeId) : null;
    const isBypassed = currentNode?.data?.bypassed || false;
    
    const baseItems: ContextMenuItem[] = [
      {
        id: 'bypass',
        label: isBypassed ? 'Enable Node' : 'Bypass Node',
        icon: isBypassed ? '✅' : '⚫',
        onClick: toggleBypass,
      },
      {
        id: 'copy',
        label: 'Copy Node (Ctrl+C)',
        icon: '📋',
        onClick: copyNode,
      },
      {
        id: 'paste',
        label: 'Paste Node (Ctrl+V)',
        icon: '📄',
        onClick: () => pasteNode(),
        disabled: !copiedNodeData,
      },
      {
        id: 'copy-id',
        label: 'Copy Node ID',
        icon: '📋',
        onClick: copyNodeId,
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: '📄',
        onClick: duplicateNode,
      },
      {
        id: 'delete',
        label: 'Delete (Del)',
        icon: '🗑️',
        danger: true,
        onClick: deleteNode,
      },
    ];

    // Add input mode toggles if the node has string inputs
    if (contextMenu.nodeInfo && contextMenu.nodeId) {
      const node = nodes.find(n => n.id === contextMenu.nodeId);
      const requiredInputs = Object.keys(contextMenu.nodeInfo.input_types.required || {});
      const optionalInputs = Object.keys(contextMenu.nodeInfo.input_types.optional || {});
      const allInputs = [...requiredInputs, ...optionalInputs];
      
      const manualInputs = allInputs.filter(inputName => {
        const typeInfo = 
          contextMenu.nodeInfo!.input_types.required?.[inputName] ||
          contextMenu.nodeInfo!.input_types.optional?.[inputName];
        const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
        return typeName === 'STRING' || typeName === 'FLOAT';
      });

      if (manualInputs.length > 0) {
        // Add separator
        baseItems.splice(-1, 0, {
          id: 'separator',
          label: '---',
          onClick: () => {},
          disabled: true,
        });

        // Add input mode toggles
        manualInputs.forEach(inputName => {
          // Get the type information to determine default mode
          const typeInfo = 
            contextMenu.nodeInfo!.input_types.required?.[inputName] ||
            contextMenu.nodeInfo!.input_types.optional?.[inputName];
          const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
          const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT') ? 'manual' : 'connection';
          
          const currentMode = node?.data.inputModes?.[inputName] || defaultMode;
          const isManual = currentMode === 'manual';
          
          baseItems.splice(-1, 0, {
            id: `toggle-${inputName}`,
            label: `${inputName}: ${isManual ? 'Switch to Connection' : 'Switch to Manual Input'}`,
            icon: isManual ? '🔗' : '✏️',
            onClick: () => toggleInputMode(inputName),
          });
        });
      }
    }

    return baseItems;
  }, [toggleBypass, copyNode, pasteNode, copiedNodeData, copyNodeId, duplicateNode, deleteNode, contextMenu.nodeInfo, contextMenu.nodeId, nodes, toggleInputMode]);

  const nodeTypes: NodeTypes = React.useMemo(() => ({
    customNode: createCustomNodeWithContextMenu(handleNodeContextMenu, handleInputValueChange),
  }), [handleNodeContextMenu, handleInputValueChange]);

  return (
    <div className="app">
      <div className="app-tabs">
        <div className="tab-group">
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
        <div className="tab-controls">
          <ThemeToggle />
        </div>
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
            onClick={runWorkflowOnce}
            disabled={nodes.length === 0 || isExecuting || isContinuousRunning}
            title="Execute the workflow once"
          >
            {isExecuting ? '⏳ Running...' : '▶️ Run Once'}
          </button>
          
          {!isContinuousRunning ? (
            <button 
              className="toolbar-btn continuous-btn" 
              onClick={showContinuousModal}
              disabled={nodes.length === 0 || isExecuting}
              title="Start continuous execution"
            >
              🔄 Run Continuous
            </button>
          ) : (
            <button 
              className="toolbar-btn stop-btn" 
              onClick={stopContinuousExecution}
              title="Stop continuous execution"
            >
              ⏹️ Stop
            </button>
          )}
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
          
          {isContinuousRunning && continuousStatus && (
            <span className="continuous-status">
              🔄 Continuous: {continuousStatus.execution_count} runs
            </span>
          )}
          
          {executionResults && !isContinuousRunning && (
            <span className={`execution-status ${executionResults.success ? 'success' : 'error'}`}>
              {executionResults.success ? '✅ Success' : '❌ Failed'}
            </span>
          )}
        </div>
      </div>
      
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={closeContextMenu}
      />
      
      {/* Continuous Execution Modal */}
      {showContinuousExecutionModal && (
        <div className="modal-overlay" onClick={() => setShowContinuousExecutionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Start Continuous Execution</h3>
              <button 
                className="modal-close-btn"
                onClick={() => setShowContinuousExecutionModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="sleep-interval">Sleep interval in seconds between iteration:</label>
                <input
                  id="sleep-interval"
                  type="text"
                  value={modalSleepTime}
                  onChange={(e) => handleSleepTimeChange(e.target.value)}
                  className={`modal-input ${sleepTimeError ? 'error' : ''}`}
                  placeholder="1.0 or 1/30"
                />
                {sleepTimeError && (
                  <div className="error-message">{sleepTimeError}</div>
                )}
                {!sleepTimeError && modalSleepTime && (
                  <div className="success-message">
                    = {evaluateExpression(modalSleepTime).value.toFixed(3)} seconds
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn cancel-btn"
                onClick={() => setShowContinuousExecutionModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn start-btn"
                onClick={startContinuousExecution}
                disabled={!modalSleepTime || sleepTimeError !== null}
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
