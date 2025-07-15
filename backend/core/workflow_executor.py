import asyncio
from typing import Dict, Any, List, Optional
from collections import defaultdict, deque
import json
import traceback
from .node_registry import node_registry

class WorkflowExecutor:
    """Executes workflows by running nodes in topological order"""
    
    def __init__(self):
        self.is_running = False
        self.current_workflow = None
        self.execution_results = {}
        self.execution_logs = []
    
    async def execute_workflow(self, workflow_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a workflow from JSON data"""
        self.is_running = True
        self.current_workflow = workflow_data
        self.execution_results = {}
        self.execution_logs = []
        
        try:
            # Parse workflow
            nodes = workflow_data.get("nodes", [])
            edges = workflow_data.get("edges", [])
            
            # Build execution order using topological sort
            execution_order = self._topological_sort(nodes, edges)
            
            # Execute nodes in order
            for node_id in execution_order:
                if not self.is_running:
                    break
                
                await self._execute_node(node_id, nodes, edges)
            
            return {
                "success": True,
                "results": self.execution_results,
                "logs": self.execution_logs
            }
        
        except Exception as e:
            self.execution_logs.append({
                "level": "error",
                "message": f"Workflow execution failed: {str(e)}",
                "traceback": traceback.format_exc()
            })
            return {
                "success": False,
                "error": str(e),
                "logs": self.execution_logs
            }
        
        finally:
            self.is_running = False
    
    def stop_execution(self) -> bool:
        """Stop the current workflow execution"""
        if self.is_running:
            self.is_running = False
            self.execution_logs.append({
                "level": "info",
                "message": "Workflow execution stopped by user"
            })
            return True
        return False
    
    def _topological_sort(self, nodes: List[Dict], edges: List[Dict]) -> List[str]:
        """Perform topological sort to determine execution order"""
        # Build adjacency list and in-degree count
        graph = defaultdict(list)
        in_degree = defaultdict(int)
        node_ids = set()
        
        # Initialize all nodes
        for node in nodes:
            node_id = node["id"]
            node_ids.add(node_id)
            in_degree[node_id] = 0
        
        # Build graph from edges
        for edge in edges:
            source = edge["source"]
            target = edge["target"]
            graph[source].append(target)
            in_degree[target] += 1
        
        # Kahn's algorithm
        queue = deque([node_id for node_id in node_ids if in_degree[node_id] == 0])
        result = []
        
        while queue:
            current = queue.popleft()
            result.append(current)
            
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        # Check for cycles
        if len(result) != len(node_ids):
            raise ValueError("Workflow contains cycles")
        
        return result
    
    async def _execute_node(self, node_id: str, nodes: List[Dict], edges: List[Dict]) -> None:
        """Execute a single node"""
        # Find node data
        node_data = None
        for node in nodes:
            if node["id"] == node_id:
                node_data = node
                break
        
        if not node_data:
            raise ValueError(f"Node {node_id} not found")
        
        try:
            # Get node class
            node_type = node_data.get("type", node_data.get("data", {}).get("type"))
            node_class = node_registry.get_node(node_type)
            
            if not node_class:
                raise ValueError(f"Unknown node type: {node_type}")
            
            # Prepare inputs
            inputs = self._prepare_node_inputs(node_id, node_data, edges)
            
            # Create node instance and execute
            node_instance = node_class()
            node_instance.validate_inputs(**inputs)
            
            # Get the function name and execute
            function_name = node_class.FUNCTION()
            if hasattr(node_instance, function_name):
                execute_func = getattr(node_instance, function_name)
                
                # Execute synchronously or asynchronously
                if asyncio.iscoroutinefunction(execute_func):
                    result = await execute_func(**inputs)
                else:
                    result = execute_func(**inputs)
                
                # Store result
                self.execution_results[node_id] = result
                
                self.execution_logs.append({
                    "level": "info",
                    "message": f"Node {node_id} ({node_type}) executed successfully"
                })
            
            else:
                raise ValueError(f"Node {node_type} does not have function {function_name}")
        
        except Exception as e:
            self.execution_logs.append({
                "level": "error",
                "message": f"Node {node_id} execution failed: {str(e)}",
                "traceback": traceback.format_exc()
            })
            raise
    
    def _prepare_node_inputs(self, node_id: str, node_data: Dict, edges: List[Dict]) -> Dict[str, Any]:
        """Prepare inputs for a node from connected edges and node data"""
        inputs = {}
        
        # Get inputs from connected edges
        for edge in edges:
            if edge["target"] == node_id:
                source_id = edge["source"]
                source_handle = edge.get("sourceHandle", "output")
                target_handle = edge.get("targetHandle", "input")
                
                # Get result from source node
                if source_id in self.execution_results:
                    source_result = self.execution_results[source_id]
                    
                    # Handle different output formats
                    if isinstance(source_result, dict) and source_handle in source_result:
                        inputs[target_handle] = source_result[source_handle]
                    else:
                        inputs[target_handle] = source_result
        
        # Get inputs from node data (default values, parameters)
        node_params = node_data.get("data", {}).get("parameters", {})
        inputs.update(node_params)
        
        return inputs
    
    def get_status(self) -> Dict[str, Any]:
        """Get current execution status"""
        return {
            "is_running": self.is_running,
            "has_workflow": self.current_workflow is not None,
            "results": self.execution_results,
            "logs": self.execution_logs[-10:]  # Last 10 logs
        }

# Global executor instance
workflow_executor = WorkflowExecutor()