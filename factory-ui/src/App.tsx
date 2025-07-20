import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import NodePanel from './components/NodePanel';
import CustomNode from './components/CustomNode';
import CameraNode from './components/CameraNode';
import ThreeDNode from './components/ThreeDNode';
import ContextMenu, { ContextMenuItem } from './components/ContextMenu';
import ThemeToggle from './components/ThemeToggle';
import { NodeInfo, apiService, WorkflowItem } from './services/api';
import { canConnect, getConnectionError } from './utils/typeMatching';
import { shouldUseCameraNode, shouldUseThreeDNode } from './utils/nodeUtils';
import { mergeCameraFramesWithInputValues } from './utils/cameraFrameUtils';
import { websocketService, ConnectionState } from './services/websocket';

interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    name: string;
    created: string;
    version: string;
  };
}

interface Canvas {
  id: number;
  name: string;
  nodes: Node[];
  edges: Edge[];
  filename?: string; // Backend workflow filename
  hasUnsavedChanges?: boolean; // Track if workflow has unsaved changes
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const createCustomNodeWithContextMenu = (
  onContextMenu: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void,
  onInputValueChange: (nodeId: string, inputName: string, value: string) => void
) => {
  return (props: any) => <CustomNode {...props} onContextMenu={onContextMenu} onInputValueChange={onInputValueChange} />;
};

const createCameraNodeWithContextMenu = (
  onContextMenu: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void,
  onInputValueChange: (nodeId: string, inputName: string, value: string) => void
) => {
  return (props: any) => <CameraNode {...props} onContextMenu={onContextMenu} onInputValueChange={onInputValueChange} />;
};

const createThreeDNodeWithContextMenu = (
  onContextMenu: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void,
  onInputValueChange: (nodeId: string, inputName: string, value: string) => void
) => {
  return (props: any) => <ThreeDNode {...props} onContextMenu={onContextMenu} onInputValueChange={onInputValueChange} />;
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
  // Suppress harmless ResizeObserver errors
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes?.('ResizeObserver loop completed')) {
        return; // Suppress this specific error
      }
      originalError.apply(console, args);
    };
    
    return () => {
      console.error = originalError;
    };
  }, []);

  // 1. Multi-canvas state
  const [canvases, setCanvases] = useState<Canvas[]>([
    { id: 1, name: 'New Workflow', nodes: initialNodes, edges: initialEdges, hasUnsavedChanges: false }
  ]);
  const [activeCanvasId, setActiveCanvasId] = useState(1);

  // 2. ReactFlow state for the active canvas
  const activeCanvasIndex = canvases.findIndex(c => c.id === activeCanvasId);
  const activeCanvas = canvases[activeCanvasIndex] || canvases[0];
  const [nodes, setNodes, onNodesChange] = useNodesState(activeCanvas.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeCanvas.edges);
  
  // Track whether we're programmatically loading vs user making changes
  const isLoadingRef = useRef(false);

  // 3. Sync ReactFlow state with canvases when switching tabs
  useEffect(() => {
    isLoadingRef.current = true;
    // When switching tabs, update the previous canvas's nodes/edges
    setCanvases(prev => prev.map((c, i) =>
      i === activeCanvasIndex ? { ...c, nodes, edges } : c
    ));
    // Then load the new canvas's nodes/edges
    const newIndex = canvases.findIndex(c => c.id === activeCanvasId);
    if (newIndex !== -1) {
      setNodes(canvases[newIndex].nodes);
      setEdges(canvases[newIndex].edges);
    }
    // Set loading flag to false after a short delay to allow state updates
    setTimeout(() => {
      isLoadingRef.current = false;
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCanvasId]);

  // 4. When nodes/edges change, update the canvases array and sync with backend
  useEffect(() => {
    console.log('Canvas sync effect triggered. Nodes count:', nodes.length, 'Edges count:', edges.length);
    console.log('Active canvas index:', activeCanvasIndex);
    setCanvases(prev => {
      const updated = prev.map((c, i) =>
        i === activeCanvasIndex ? { 
          ...c, 
          nodes, 
          edges, 
          hasUnsavedChanges: isLoadingRef.current ? c.hasUnsavedChanges : true 
        } : c
      );
      console.log('Updated canvases:', updated);
      return updated;
    });
    
    // Auto-save to backend if the active canvas has a filename
    const currentActiveCanvas = canvases[activeCanvasIndex];
    if (currentActiveCanvas?.filename) {
      const filename = currentActiveCanvas.filename;
      // Debounce auto-save to avoid too many requests
      const saveTimeout = setTimeout(async () => {
        try {
          const workflowData = {
            nodes: nodes,
            edges: edges,
            metadata: {
              name: currentActiveCanvas.name,
              description: `Auto-saved on ${new Date().toLocaleDateString()}`,
              created: new Date().toISOString(),
              version: '1.0.0'
            }
          };

          await apiService.saveWorkflowByFilename(filename, workflowData);
          console.log('Auto-saved workflow to backend:', filename);
          
          // Clear unsaved changes flag after successful auto-save
          setCanvases(prev => prev.map(canvas => 
            canvas.id === activeCanvasId 
              ? { ...canvas, hasUnsavedChanges: false }
              : canvas
          ));
        } catch (error) {
          console.error('Failed to auto-save workflow:', error);
        }
      }, 2000); // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(saveTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // 5. Update all canvas-related state and actions to use the active canvas
  const [activeTab] = useState<'canvas' | 'nodes'>('canvas');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<any>(null);
  const [isContinuousRunning, setIsContinuousRunning] = useState(false);
  const [continuousStatus, setContinuousStatus] = useState<any>(null);
  const [nodeStates, setNodeStates] = useState<Record<string, any>>({});
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    lastError: null,
    connectionTime: null
  });
  
  // Add debouncing to prevent rapid re-renders
  const [debouncedNodeStates, setDebouncedNodeStates] = useState(nodeStates);
  
  // Throttled state updater
  const throttledSetNodeStates = useCallback((updateFn: (prev: Record<string, any>) => Record<string, any>) => {
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      setNodeStates(updateFn);
    });
  }, []);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedNodeStates(nodeStates);
    }, 50); // 50ms debounce
    
    return () => clearTimeout(timeout);
  }, [nodeStates]);
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

  // State for tab renaming
  const [renamingTabId, setRenamingTabId] = useState<number | null>(null);
  const [newTabName, setNewTabName] = useState('');


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
      setEdges((eds) => {
        const newEdge = addEdge(params, eds);
        // If continuous execution is running, add animation to new edges
        if (isContinuousRunning && newEdge.length > eds.length) {
          const latestEdge = newEdge[newEdge.length - 1];
          latestEdge.className = 'animated';
        }
        return newEdge;
      });
    },
    [setEdges, nodes, isContinuousRunning]
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

        isLoadingRef.current = true;
        setNodes(workflowData.nodes);
        setEdges(workflowData.edges);
        
        // Clear unsaved changes flag when loading a file
        setCanvases(prev => prev.map(canvas => 
          canvas.id === activeCanvasId 
            ? { ...canvas, hasUnsavedChanges: false }
            : canvas
        ));
        
        // Clear loading flag after state updates
        setTimeout(() => {
          isLoadingRef.current = false;
        }, 100);
        
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
        console.log('Missing reactFlowInstance - this is likely the problem!');
        console.log('ReactFlow instance state:', reactFlowInstance);
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
        
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        console.log('Calculated position:', position);

        const newNode: Node = {
          id: `${nodeInfo.name}-${Date.now()}`,
          type: shouldUseCameraNode(nodeInfo) ? 'cameraNode' : shouldUseThreeDNode(nodeInfo) ? 'threeDNode' : 'customNode',
          position,
          data: { 
            label: nodeInfo.display_name,
            nodeInfo,
            type: nodeInfo.name
          },
        };

        console.log('Adding new node:', newNode);
        console.log('Current canvases state:', canvases);
        console.log('Active canvas ID:', activeCanvasId);
        console.log('Active canvas index:', activeCanvasIndex);
        
        setNodes((nds) => {
          console.log('Previous nodes:', nds);
          console.log('Previous nodes length:', nds.length);
          const updated = [...nds, newNode];
          console.log('Updated nodes:', updated);
          console.log('Updated nodes length:', updated.length);
          return updated;
        });
      } catch (error) {
        console.error('Error parsing node data:', error);
      }
    },
    [reactFlowInstance, setNodes, handleFileLoad]
  );

  const onNodeDrag = useCallback((nodeInfo: NodeInfo) => {
    // Optional: Handle node drag start
    console.log('Dragging node:', nodeInfo.display_name);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    // Only reset if leaving the entire wrapper area
    if (!event.currentTarget.contains(event.relatedTarget as Element)) {
      setIsDraggedOver(false);
    }
  }, []);

  const saveWorkflow = useCallback(async () => {
    if (!activeCanvas.filename) {
      alert('No filename available. Please use Download to save as a new file.');
      return;
    }

    try {
      const workflowData = {
        nodes: activeCanvas.nodes,
        edges: activeCanvas.edges,
        metadata: {
          name: activeCanvas.name,
          description: `Workflow saved on ${new Date().toLocaleDateString()}`,
          created: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      const response = await apiService.saveWorkflowByFilename(activeCanvas.filename, workflowData);
      if (response.success) {
        console.log('Workflow saved successfully:', activeCanvas.filename);
        alert('Workflow saved successfully!');
        
        // Clear the unsaved changes flag
        setCanvases(prev => prev.map(canvas => 
          canvas.id === activeCanvasId 
            ? { ...canvas, hasUnsavedChanges: false }
            : canvas
        ));
      } else {
        console.error('Failed to save workflow:', response.message);
        alert(`Failed to save workflow: ${response.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Failed to save workflow. Please check the backend server.');
    }
  }, [activeCanvas]);

  const downloadWorkflow = useCallback(async () => {
    // Save to backend first if the canvas has a filename
    if (activeCanvas.filename) {
      try {
        const workflowData = {
          nodes: activeCanvas.nodes,
          edges: activeCanvas.edges,
          metadata: {
            name: activeCanvas.name,
            description: `Workflow updated on ${new Date().toLocaleDateString()}`,
            created: new Date().toISOString(),
            version: '1.0.0'
          }
        };

        const response = await apiService.saveWorkflowByFilename(activeCanvas.filename, workflowData);
        if (response.success) {
          console.log('Workflow updated in backend:', activeCanvas.filename);
        } else {
          console.error('Failed to update workflow in backend');
        }
      } catch (error) {
        console.error('Error updating workflow in backend:', error);
      }
    }

    // Always save as JSON file
    const workflowData: WorkflowData = {
      nodes: activeCanvas.nodes,
      edges: activeCanvas.edges,
      metadata: {
        name: `${activeCanvas.name}-${new Date().toISOString().split('T')[0]}`,
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
  }, [activeCanvas]);

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

  // Fetch all saved workflows and load them as canvas tabs
  const fetchWorkflows = useCallback(async () => {
    try {
      const response = await apiService.getAllWorkflows();
      if (response.success && response.workflows.length > 0) {
        const workflowCanvases: Canvas[] = response.workflows.map((item, index) => ({
          id: Date.now() + index, // Generate unique ID for canvas
          name: item.filename,
          nodes: item.workflow.nodes || [],
          edges: item.workflow.edges || [],
          filename: item.filename,
          hasUnsavedChanges: false
        }));
        
        // Replace the default canvas with workflow canvases
        setCanvases(workflowCanvases);
        setActiveCanvasId(workflowCanvases[0].id);
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    }
  }, []);

  // Start renaming a tab
  const startRenaming = useCallback((canvasId: number, currentName: string) => {
    setRenamingTabId(canvasId);
    setNewTabName(currentName);
  }, []);

  // Finish renaming a tab
  const finishRenaming = useCallback(async () => {
    if (renamingTabId === null || !newTabName.trim()) {
      setRenamingTabId(null);
      setNewTabName('');
      return;
    }

    const canvasToRename = canvases.find(c => c.id === renamingTabId);
    if (!canvasToRename) {
      setRenamingTabId(null);
      setNewTabName('');
      return;
    }

    const oldFilename = canvasToRename.filename;
    const newFilename = newTabName.trim();

    try {
      // If there's an old filename, delete the old workflow and create a new one
      if (oldFilename) {
        // Get the current workflow data
        const workflowData = {
          nodes: canvasToRename.nodes,
          edges: canvasToRename.edges,
          metadata: {
            name: newFilename,
            description: `Renamed workflow on ${new Date().toLocaleDateString()}`,
            created: new Date().toISOString(),
            version: '1.0.0'
          }
        };

        // Save with new filename
        await apiService.saveWorkflowByFilename(newFilename, workflowData);
        
        // Delete old workflow if filename is different
        if (oldFilename !== newFilename) {
          await apiService.deleteWorkflow(oldFilename);
        }
      }

      // Update the canvas
      setCanvases(prev => prev.map(canvas => 
        canvas.id === renamingTabId 
          ? { ...canvas, name: newFilename, filename: newFilename }
          : canvas
      ));

      console.log(`Renamed workflow from "${oldFilename}" to "${newFilename}"`);
    } catch (error) {
      console.error('Failed to rename workflow:', error);
      // Just update locally if backend fails
      setCanvases(prev => prev.map(canvas => 
        canvas.id === renamingTabId 
          ? { ...canvas, name: newFilename }
          : canvas
      ));
    }

    setRenamingTabId(null);
    setNewTabName('');
  }, [renamingTabId, newTabName, canvases]);

  // Cancel renaming
  const cancelRenaming = useCallback(() => {
    setRenamingTabId(null);
    setNewTabName('');
  }, []);

  const clearCanvas = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      if (window.confirm('Are you sure you want to clear the canvas? This will remove all nodes and connections.')) {
        setNodes([]);
        setEdges([]);
      }
    }
  }, [nodes.length, edges.length, setNodes, setEdges]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
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
    const bypassedNodes = nodes.filter(node => (node.data as any).bypassed);
    if (bypassedNodes.length > 0) {
      console.log(`⚫ Skipping ${bypassedNodes.length} bypassed node(s):`, 
        bypassedNodes.map(n => (n.data as any).nodeInfo.display_name).join(', ')
      );
    }
    
    return {
      nodes: activeNodes.map(node => {
        const inputValues = (node.data as any).inputValues || {};
        
        // Merge camera frames with input values for camera nodes
        const finalParameters = mergeCameraFramesWithInputValues(node.id, inputValues);
        
        return {
          id: node.id,
          type: (node.data as any).nodeInfo?.name || (node.data as any).type || node.type,
          data: {
            ...node.data,
            parameters: finalParameters
          },
          position: node.position
        };
      }),
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
        // do nothing, status will be updated by websocket workflow_event
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
        // Don't set isContinuousRunning here - wait for WebSocket confirmation
        setShowContinuousExecutionModal(false);
        console.log('Continuous execution start requested:', result);
        
        // Show user feedback that we're waiting for confirmation
        if (connectionState.isConnected) {
          console.log('⏳ Waiting for WebSocket confirmation of continuous execution start...');
        } else {
          console.log('⚠️ WebSocket not connected - may need to refresh for accurate state');
        }
        
        // The WebSocket 'workflow_event' with 'continuous_started' will update the state
        // Start polling for status updates
        // pollContinuousStatus(); // This function is removed
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
        console.log('Continuous execution stop requested:', result);
        
        // Show user feedback that we're waiting for confirmation
        if (connectionState.isConnected) {
          console.log('⏳ Waiting for WebSocket confirmation of continuous execution stop...');
          
        
          // poll backend every 500ms for up to 2s, update state as soon as not running
          let attempts = 0;
          const maxAttempts = 4; // 4 * 500ms = 2s
          const poll = async () => {
            if (!isContinuousRunning) return;
            try {
              const status = await apiService.getContinuousStatus();
              if (!status.is_running) {
                setIsContinuousRunning(false);
                setContinuousStatus(null);
                return;
              }
            } catch (e) {
              console.error('Failed to poll backend status:', e);
            }
            attempts += 1;
            if (isContinuousRunning && attempts < maxAttempts) {
              setTimeout(poll, 500);
            } else if (attempts >= maxAttempts) {
              websocketService.send('get_status', {});
            }
          };
          poll();
        } else {
          console.log('⚠️ WebSocket not connected - forcing state update');
          // If WebSocket is not connected, update state immediately
          setIsContinuousRunning(false);
          setContinuousStatus(null);
        }
        
        // The WebSocket 'workflow_event' with 'continuous_stopped' will update the state
      } else {
        alert(`Failed to stop continuous execution: ${result.message}`);
      }
    } catch (error) {
      console.error('Error stopping continuous execution:', error);
      alert('Failed to stop continuous execution. Please check the backend server.');
    }
  }, [isContinuousRunning, connectionState.isConnected, websocketService]);

  // Fetch workflows on initialization
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // WebSocket connection and event handlers
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        await websocketService.connect();
        console.log('WebSocket connected');
        
        // Start heartbeat
        websocketService.startHeartbeat();
        
        // Subscribe to events
        websocketService.subscribe(['node_state', 'workflow_event', 'continuous_update']);
        
        // Request current status to sync state on connection
        websocketService.send('get_status', {});
        
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    connectWebSocket();

    // Set up connection state listener
    const unsubscribeConnectionState = websocketService.onConnectionStateChange(setConnectionState);

    // Set up event handlers, each returns a function to unsubscribe
    const unsubscribeHandlers = [
      
      websocketService.on('status_response', (data) => {
        console.log('Status response received:', data);
        // Sync continuous execution state on connection
        if (data.execution) {
          const backendIsRunning = data.execution.is_running;
          setIsContinuousRunning(backendIsRunning);
          
          if (backendIsRunning) {
            setContinuousStatus({
              is_running: backendIsRunning,
              execution_count: data.execution.count_of_iterations || 0,
              last_execution_time: data.execution.last_execution_time || 0,
              results: data.execution.results || {},
              status: 'running'
            });
          } else {
            setContinuousStatus(null);
          }
          
          console.log(`♾️ Synced continuous running state from backend: ${backendIsRunning}`);
        }
      }),

      websocketService.on('node_state', (data) => {
        console.log('Node state update:', data);

        throttledSetNodeStates(prev => ({
          ...prev,
          [data.node_id]: {
            state: data.state,
            data: data.data,
            timestamp: data.timestamp
          }
        }));
      }),

      websocketService.on('workflow_event', (data) => {
        console.log('Workflow event received:', data);

        if (data.event === 'continuous_started') {
          setIsContinuousRunning(true);
          console.log('✅ Continuous execution started (confirmed by WebSocket)');
        } else if (data.event === 'continuous_stopped') {
          setIsContinuousRunning(false);
          setContinuousStatus(null);
          console.log('✅ Continuous execution stopped (confirmed by WebSocket)');
          
          
          // Clear any pending fallback timeouts since we got confirmation
          console.log('✅ WebSocket stop confirmation received - state updated');
        } else if (data.event === 'workflow_error') {
          console.error('Workflow error:', data.data);
          alert(`Workflow error: ${data.data.error}\n\nPlease check the backend server logs for more details.`);
        } else {
          console.log('🔄 Unknown workflow event:', data);
        }
      }),

      websocketService.on('continuous_update', (data) => {
        console.log('Continuous update:', data);
        
        const isRunning = data.status === 'executing' || data.status === 'completed';
        
        setContinuousStatus({
          is_running: isRunning,
          execution_count: data.execution_count,
          last_execution_time: data.data?.execution_time || 0,
          results: data.data?.results || {},
          status: data.status
        });
        
        // Fallback: sync isContinuousRunning state if it gets out of sync
        // This handles cases where workflow_event might be missed
        setIsContinuousRunning(prev => {
          if (prev !== isRunning) {
            console.log(`♾️ Syncing continuous running state: ${prev} -> ${isRunning}`);
            return isRunning;
          }
          return prev;
        });
      }),


    ];

    // Cleanup on unmount
    return () => {
      unsubscribeHandlers.forEach(unsub => unsub());
      unsubscribeConnectionState();
      websocketService.disconnect();
    };
  }, []);

  // Start polling when continuous execution begins (fallback for WebSocket failures)
  React.useEffect(() => {
    if (isContinuousRunning && !connectionState.isConnected) {
      // pollContinuousStatus(); // This function is removed
    }
  }, [isContinuousRunning, connectionState.isConnected]);

  // Animate edges when continuous execution starts/stops
  React.useEffect(() => {
    setEdges(currentEdges =>
      currentEdges.map(edge => ({
        ...edge,
        className: isContinuousRunning ? 'animated' : ''
      }))
    );
  }, [isContinuousRunning, setEdges]);

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
        console.log('✓ Node copied:', (nodeToCopy.data as any).nodeInfo.display_name);
      }
    }
  }, [contextMenu.nodeId, nodes]);

  // Copy selected node (for keyboard shortcut)
  const copySelectedNode = useCallback(() => {
    const selectedNode = nodes.find(node => node.selected);
    if (selectedNode) {
      setCopiedNodeData(selectedNode);
      console.log('✓ Node copied:', (selectedNode.data as any).nodeInfo.display_name);
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
        id: `${(copiedNodeData.data as any).nodeInfo.name}-${Date.now()}`,
        position: pastePosition,
        selected: false, // Don't select the pasted node by default
      };

      setNodes(nodes => [...nodes, newNode]);
      console.log('✓ Node pasted:', (newNode.data as any).nodeInfo.display_name);
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
            const newBypassed = !(node.data as any).bypassed;
            console.log(`${newBypassed ? '⚫' : '✓'} Node ${newBypassed ? 'bypassed' : 'activated'}:`, (node.data as any).nodeInfo.display_name);
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

  const toggleInputMode = useCallback((inputName: string) => {
    if (!contextMenu.nodeId) return;
    
    setNodes(nodes => 
      nodes.map(node => {
        if (node.id === contextMenu.nodeId) {
          // Get the type information to determine default mode
          const nodeInfo = (node.data as any).nodeInfo as NodeInfo;
          const typeInfo = 
            nodeInfo.input_types.required?.[inputName] ||
            nodeInfo.input_types.optional?.[inputName];
          const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
          const defaultMode = (typeName === 'STRING' || typeName === 'FLOAT') ? 'manual' : 'connection';
          
          const currentMode = (node.data as any).inputModes?.[inputName] || defaultMode;
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
                ...(node.data as any).inputModes,
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
    const isBypassed = (currentNode?.data as any)?.bypassed || false;
    
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
          
          const currentMode = (node?.data as any).inputModes?.[inputName] || defaultMode;
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

  // Update nodes with real-time state information (using debounced state)
  const nodesWithState = React.useMemo(() => {
    return nodes.map(node => {
      const nodeState = debouncedNodeStates[node.id];
      return {
        ...node,
        data: {
          ...node.data,
          nodeState: nodeState ? {
            state: nodeState.state,
            data: nodeState.data,
            timestamp: nodeState.timestamp
          } : undefined,
          robotStatus: nodeState?.robotStatus,
          streamUpdate: nodeState?.streamUpdate,
          streamComplete: nodeState?.streamComplete,
          streamError: nodeState?.streamError
        }
      };
    });
  }, [nodes, debouncedNodeStates]);

  const handleInputValueChange = useCallback((nodeId: string, inputName: string, value: string) => {
    setNodes(nodes => 
      nodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              inputValues: {
                ...(node.data as any).inputValues,
                [inputName]: value
              }
            }
          };
        }
        return node;
      })
    );

    
    // Send real-time input update via WebSocket
    if (connectionState.isConnected) {
      websocketService.sendInputUpdate(nodeId, inputName, value);
    }
  }, [setNodes, connectionState.isConnected]);

  const nodeTypes: NodeTypes = React.useMemo(() => ({
    customNode: createCustomNodeWithContextMenu(handleNodeContextMenu, handleInputValueChange),
    cameraNode: createCameraNodeWithContextMenu(handleNodeContextMenu, handleInputValueChange),
    threeDNode: createThreeDNodeWithContextMenu(handleNodeContextMenu, handleInputValueChange),
  }), [handleNodeContextMenu, handleInputValueChange]);


  return (
    <div className="app">
      <div className="app-tabs">
        <div className="tab-group">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              className={`tab${activeCanvasId === canvas.id ? ' active' : ''}`}
              onClick={() => setActiveCanvasId(canvas.id)}
              onDoubleClick={() => startRenaming(canvas.id, canvas.name)}
            >
              {renamingTabId === canvas.id ? (
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  onBlur={finishRenaming}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      finishRenaming();
                    } else if (e.key === 'Escape') {
                      cancelRenaming();
                    }
                  }}
                  autoFocus
                  className="tab-rename-input"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tab-name">{canvas.name}{canvas.hasUnsavedChanges ? '*' : ''}</span>
              )}
              {canvases.length > 1 && (
                <span
                  className="tab-close"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (canvases.length > 1) {
                      
                      
                      const newCanvases = canvases.filter(c => c.id !== canvas.id);
                      setCanvases(newCanvases);
                      if (activeCanvasId === canvas.id) {
                        setActiveCanvasId(newCanvases[0].id);
                      }
                    }
                  }}
                  title="Close workflow"
                  style={{ marginLeft: 8, cursor: 'pointer' }}
                >
                  ×
                </span>
              )}
            </div>
          ))}
          <button
            className="tab add-tab"
            onClick={async () => {
              const nextId = Math.max(...canvases.map(c => c.id)) + 1;
              const newWorkflowFilename = `Untitled`;
              
              // Save new workflow to backend
              try {
                const workflowData = {
                  nodes: [],
                  edges: [],
                  metadata: {
                    name: newWorkflowFilename,
                    description: `New workflow created on ${new Date().toLocaleDateString()}`,
                    created: new Date().toISOString(),
                    version: '1.0.0'
                  }
                };

                const response = await apiService.saveWorkflowByFilename(newWorkflowFilename, workflowData);
                if (response.success) {
                  const newCanvas: Canvas = {
                    id: nextId,
                    name: newWorkflowFilename,
                    nodes: [],
                    edges: [],
                    filename: newWorkflowFilename,
                    hasUnsavedChanges: false
                  };
                  setCanvases(cs => [...cs, newCanvas]);
                  setActiveCanvasId(nextId);
                } else {
                  // Fallback to local-only canvas if backend save fails
                  const newCanvas: Canvas = {
                    id: nextId,
                    name: newWorkflowFilename,
                    nodes: [],
                    edges: [],
                    hasUnsavedChanges: false
                  };
                  setCanvases(cs => [...cs, newCanvas]);
                  setActiveCanvasId(nextId);
                }
              } catch (error) {
                console.error('Failed to create new workflow:', error);
                // Fallback to local-only canvas
                const newCanvas: Canvas = {
                  id: nextId,
                  name: newWorkflowFilename,
                  nodes: [],
                  edges: [],
                  hasUnsavedChanges: false
                };
                setCanvases(cs => [...cs, newCanvas]);
                setActiveCanvasId(nextId);
              }
            }}
            title="Add new workflow"
          >
            +
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
                  nodes={nodesWithState}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onInit={(instance) => {
                    console.log('ReactFlow instance initialized:', instance);
                    console.log('Instance type:', typeof instance);
                    console.log('Instance screenToFlowPosition method:', typeof instance?.screenToFlowPosition);
                    setReactFlowInstance(instance);
                  }}
                  nodeTypes={nodeTypes}
                  isValidConnection={isValidConnection}
                  connectionMode={ConnectionMode.Loose}
                  nodesDraggable={true}
                  nodesConnectable={true}
                  elementsSelectable={true}
                  onError={(id, message) => {
                    // Suppress ResizeObserver errors which are harmless
                    if (message.includes('ResizeObserver')) {
                      return;
                    }
                    console.error('ReactFlow error:', id, message);
                  }}
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
            disabled={nodes.length === 0 || !activeCanvas.filename}
            title="Save workflow to backend"
          >
            💾 Save
          </button>
          <button 
            className="toolbar-btn" 
            onClick={downloadWorkflow} 
            disabled={nodes.length === 0}
            title="Download workflow as JSON file"
          >
            📥 Download
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
          
          {connectionState.isConnected && (
            <span className="websocket-status">
              🔗 Live
            </span>
          )}
          
          {connectionState.isConnecting && (
            <span className="websocket-status">
              🔄 Connecting...
            </span>
          )}
          
          {connectionState.lastError && !connectionState.isConnected && (
            <span className="websocket-status error" title={connectionState.lastError.message}>
              ⚠️ Disconnected
            </span>
          )}
          
          {isContinuousRunning && continuousStatus && (
            <span className="continuous-status">
              🔄 Number of iterations: {continuousStatus.execution_count}
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
