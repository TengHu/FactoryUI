#!/usr/bin/env python3
"""
Continuous Workflow Executor
A lightweight server that continuously executes workflows in a loop
"""

import time
import json
import threading
from collections import defaultdict, deque
from typing import Dict, Any, List, Optional, Set
import traceback
import sys
import os
import hashlib
import copy
import asyncio

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.node_registry import node_registry

class ContinuousExecutor:
    """Continuously executes workflows in a loop"""
    
    def __init__(self, loop_interval: float = 1.0, websocket_manager=None):
        self.loop_interval = loop_interval
        self.is_running = False
        self.current_workflow = None
        self.execution_results = {}
        self.execution_logs = []
        self.count_of_iterations = 0
        self.last_execution_time = 0
        self.thread = None
        self.websocket_manager = websocket_manager
        
        # Pre-computed execution data for performance optimization
        self._execution_order = []
        self._node_instances = {}
        self._node_data_map = {}
        self._edges = []
        self._is_setup = False
        
    def _broadcast_sync(self, coro):
        """Helper method to run async WebSocket broadcasts from sync thread"""
        try:
            # Try to get the current event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an event loop, schedule the coroutine
                asyncio.create_task(coro)
                self.log_message("debug", "WebSocket message scheduled as task")
            else:
                # If no event loop is running, run the coroutine
                asyncio.run(coro)
                self.log_message("debug", "WebSocket message sent via asyncio.run")
        except RuntimeError:
            # If there's no event loop, create one and run the coroutine
            try:
                asyncio.run(coro)
                # self.log_message("debug", "WebSocket message sent via new event loop")
            except Exception as e:
                # If all else fails, just log the error and continue
                self.log_message("warning", f"Failed to broadcast WebSocket message: {str(e)}")
        
    def load_workflow(self, workflow_data: Dict[str, Any]) -> bool:
        """Load a workflow for continuous execution"""
        try:
            # Validate workflow structure
            if not workflow_data.get("nodes") or not isinstance(workflow_data["nodes"], list):
                raise ValueError("Workflow must contain a 'nodes' list")
            
            if "edges" not in workflow_data or not isinstance(workflow_data["edges"], list):
                raise ValueError("Workflow must contain an 'edges' list")
            
            self.current_workflow = workflow_data
            self._is_setup = False  # Mark for re-setup
            self.log_message("info", f"Loaded workflow with {len(workflow_data['nodes'])} nodes and {len(workflow_data['edges'])} edges")
            return True
            
        except Exception as e:
            self.log_message("error", f"Failed to load workflow: {str(e)}")
            return False
    
    def start_continuous_execution(self):
        """Start the continuous execution loop in a separate thread"""
        if self.is_running:
            self.log_message("warning", "Continuous execution is already running")
            return
        
        if not self.current_workflow:
            self.log_message("error", "No workflow loaded. Cannot start execution.")
            return
        
        self.is_running = True
        self.count_of_iterations = 0
        self.thread = threading.Thread(target=self._execution_loop, daemon=True)
        self.thread.start()
        self.log_message("info", "Started continuous execution")
    
    def stop_continuous_execution(self, join_thread: bool = True):
        """Stop the continuous execution loop

        Args:
            join_thread (bool): Whether to join the execution thread. 
                Set to False if calling from within the execution thread itself.
        """
        if not self.is_running:
            self.log_message("warning", "Continuous execution is not running")
            return

        self.is_running = False

        # Broadcast workflow stopped event
        if self.websocket_manager:
            self.log_message("info", "Broadcasting continuous_stopped event")
            self._broadcast_sync(self.websocket_manager.broadcast_workflow_event("continuous_stopped", {
                "workflow_id": id(self.current_workflow) if self.current_workflow else None,
                "total_iterations": self.count_of_iterations
            }))
        else:
            self.log_message("warning", "No websocket_manager available for broadcasting stop event")

        if self.thread and join_thread:
            # Avoid joining the current thread
            if threading.current_thread() != self.thread:
                self.thread.join(timeout=5.0)
        self.log_message("info", "Stopped continuous execution")
    
    def set_loop_interval(self, interval: float):
        """Set the loop interval (sleep time between iterations)"""
        if interval <= 0:
            raise ValueError("Loop interval must be positive")
        self.loop_interval = interval
        self.log_message("info", f"Set loop interval to {interval} seconds")
    
    def _setup_execution(self):
        """Setup execution data structures for optimal performance"""
        if not self.current_workflow or self._is_setup:
            return
            
        try:
            nodes = self.current_workflow["nodes"]
            edges = self.current_workflow["edges"]
            
            # Store edges for quick access
            self._edges = edges
            
            # Perform topological sort once
            self._execution_order = self._topological_sort(nodes, edges)
            
            # Pre-create node data map for quick lookup
            self._node_data_map = {node["id"]: node for node in nodes}
            
            # Pre-instantiate node classes and instances
            self._node_instances = {}
            for node_id in self._execution_order:
                node_data = self._node_data_map[node_id]
                
                # Get node type and class
                node_type = node_data.get("type") or node_data.get("data", {}).get("type")
                if not node_type:
                    node_info = node_data.get("data", {}).get("nodeInfo", {})
                    node_type = node_info.get("name")
                    
                if not node_type:
                    raise ValueError(f"Node {node_id} has no type specified")
                    
                node_class = node_registry.get_node(node_type)
                if not node_class:
                    raise ValueError(f"Unknown node type: {node_type}")
                    
                # Create and configure node instance
                node_instance = node_class()
                if self.websocket_manager:
                    node_instance._websocket_manager = self.websocket_manager
                    node_instance._node_id = node_id
                    
                self._node_instances[node_id] = {
                    "instance": node_instance,
                    "class": node_class,
                    "function_name": node_class.FUNCTION()
                }
            
            self._is_setup = True
            self.log_message("info", f"Setup completed for {len(self._execution_order)} nodes")
            
        except Exception as e:
            self.log_message("error", f"Setup failed: {str(e)}")
            raise
    
    def _execution_loop(self):
        """Main execution loop that runs continuously"""
        self.log_message("info", "Continuous execution loop started")
        
        # Setup execution data structures once
        self._setup_execution()
        
        # Broadcast workflow started event
        if self.websocket_manager:
            self._broadcast_sync(self.websocket_manager.broadcast_workflow_event("continuous_started", {
                "workflow_id": id(self.current_workflow),
                "node_count": len(self.current_workflow.get("nodes", []))
            }))
        
        while self.is_running:

            try:
                start_time = time.time()
                
                # Broadcast execution start
                if self.websocket_manager:
                    self._broadcast_sync(self.websocket_manager.broadcast_continuous_update(
                        self.count_of_iterations + 1, "executing", {"start_time": start_time}
                    ))
                
                # Execute the workflow (optimized version)
                self._execute_workflow_once_optimized()
                
                # Update timing
                self.last_execution_time = time.time() - start_time
                self.count_of_iterations += 1
                
                # Broadcast execution completed
                if self.websocket_manager:
                    self._broadcast_sync(self.websocket_manager.broadcast_continuous_update(
                        self.count_of_iterations, "completed", {
                            "execution_time": self.last_execution_time,
                        }
                    ))
                
                # Log execution stats periodically
                if self.count_of_iterations % 10 == 0:
                    self.log_message("info", 
                        f"Completed {self.count_of_iterations} executions. "
                        f"Last execution took {self.last_execution_time:.3f}s")
                
                # Sleep for the specified interval
                time.sleep(self.loop_interval)
                
            except Exception as e:
                stacktrace = traceback.format_exc()
                self.log_message("error", f"Error in execution loop: {str(e)}")
                self.log_message("error", f"Traceback: {stacktrace}")

                # Broadcast workflow error event
                if self.websocket_manager:
                    self._broadcast_sync(self.websocket_manager.broadcast_workflow_event("workflow_error", {
                        "workflow_id": id(self.current_workflow),
                        "error": str(e),
                        "stacktrace": stacktrace
                    }))
                
                self.stop_continuous_execution()
                return
    
    def _execute_workflow_once_optimized(self):
        """Execute the workflow once using pre-computed data structures for maximum performance"""
        if not self._is_setup:
            self._setup_execution()
            
        # Execute nodes in pre-computed order
        node_results = {}
        for node_id in self._execution_order:
            # Broadcast node execution start
            if self.websocket_manager:
                self._broadcast_sync(self.websocket_manager.broadcast_node_state(
                    node_id, "executing", {"start_time": time.time()}
                ))
            
            try:
                node_result, rt_update = self._execute_node_optimized(node_id, node_results)
                if node_result is not None:
                    node_results[node_id] = node_result
                
                # Broadcast node execution completed
                if self.websocket_manager:
                    self._broadcast_sync(self.websocket_manager.broadcast_node_state(
                        node_id, "completed", {"rt_update": rt_update}
                    ))
                    
            except Exception as e:
                # Broadcast node error
                if self.websocket_manager:
                    self._broadcast_sync(self.websocket_manager.broadcast_node_state(
                        node_id, "error", {"error": str(e)}
                    ))
                raise e
        
        # Store results
        self.execution_results = node_results
    
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
            if source in node_ids and target in node_ids:
                graph[source].append(target)
                in_degree[target] += 1
        
        # Kahn's algorithm for topological sorting
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
            remaining_nodes = node_ids - set(result)
            raise ValueError(f"Workflow contains cycles. Remaining nodes: {remaining_nodes}")
        
        return result
    
    def _execute_node_optimized(self, node_id: str, node_results: Dict[str, Any]) -> Any:
        """Execute a single node using pre-computed instance data for maximum performance"""
        try:
            # Get pre-instantiated node data
            node_instance_data = self._node_instances[node_id]
            node_instance = node_instance_data["instance"]
            function_name = node_instance_data["function_name"]
            
            # Get node data for input preparation
            node_data = self._node_data_map[node_id]
            
            # Prepare inputs from connected edges and node parameters
            inputs = self._prepare_node_inputs_optimized(node_id, node_data, node_results)
            
            
            # Validate inputs
            try:
                node_instance.validate_inputs(**inputs)
            except Exception as e:
                pass
                
            # Execute using pre-cached function
            execute_func = getattr(node_instance, function_name)
            result = execute_func(**inputs)
            
            # If result is a 2-tuple, use the second element for websocket broadcast
            rt_update = None
            node_result = None
            if isinstance(result, tuple) and len(result) == 2:
                node_result, rt_update = result
            else:
                node_result = result
                
            # Log successful execution
            if self.count_of_iterations % 50 == 0:
                self.log_message("debug", f"Node {node_id} executed successfully")
            return node_result, rt_update
            
        except Exception as e:
            self.log_message("error", f"Node {node_id} execution failed: {str(e)}")
            raise e
    
    def _prepare_node_inputs_optimized(self, node_id: str, node_data: Dict, 
                                     node_results: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare inputs for a node using pre-stored edges for maximum performance"""
        inputs = {}
        
        # Get inputs from connected edges using pre-stored edge data
        for edge in self._edges:
            if edge["target"] == node_id:
                source_id = edge["source"]
                source_handle = edge.get("sourceHandle", "output")
                target_handle = edge.get("targetHandle", "input")
                
                # Get result from source node
                if source_id in node_results:
                    source_result = node_results[source_id]
                    
                    # Handle different output formats
                    if isinstance(source_result, tuple):
                        # Multiple outputs - extract by index
                        if source_handle.startswith("output-"):
                            index = int(source_handle.split("-")[1])
                            if index < len(source_result):
                                inputs[target_handle] = source_result[index]
                        elif len(source_result) == 1:
                            # Single output in tuple
                            inputs[target_handle] = source_result[0]
                        else:
                            # Default to first output
                            inputs[target_handle] = source_result[0] if source_result else None
                    elif isinstance(source_result, dict) and source_handle in source_result:
                        inputs[target_handle] = source_result[source_handle]
                    else:
                        # Single output
                        inputs[target_handle] = source_result
        
        # Get inputs from node data (default values, parameters)
        node_params = node_data.get("data", {}).get("parameters", {})
        inputs.update(node_params)
        
        # Get inputs from nodeInfo if available
        node_info = node_data.get("data", {}).get("nodeInfo", {})
        if node_info:
            # Check for default values in input types
            required_inputs = node_info.get("input_types", {}).get("required", {})
            optional_inputs = node_info.get("input_types", {}).get("optional", {})
            
            for input_name, input_spec in required_inputs.items():
                if input_name not in inputs and isinstance(input_spec, list) and len(input_spec) > 1:
                    if isinstance(input_spec[1], dict) and "default" in input_spec[1]:
                        inputs[input_name] = input_spec[1]["default"]
            
            for input_name, input_spec in optional_inputs.items():
                if input_name not in inputs and isinstance(input_spec, list) and len(input_spec) > 1:
                    if isinstance(input_spec[1], dict) and "default" in input_spec[1]:
                        inputs[input_name] = input_spec[1]["default"]
        
        return inputs
   
    def log_message(self, level: str, message: str):
        """Add a log message"""
        log_entry = {
            "timestamp": time.time(),
            "level": level,
            "message": message
        }
        self.execution_logs.append(log_entry)
        
        # Keep only last 100 log entries
        if len(self.execution_logs) > 100:
            self.execution_logs = self.execution_logs[-100:]
        
        # Print to console
        timestamp = time.strftime("%H:%M:%S", time.localtime(log_entry["timestamp"]))
        print(f"[{timestamp}] {level.upper()}: {message}")
    
    def execute_workflow_once(self, workflow_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a workflow once (single execution, not continuous)"""
        if self.is_running:
            raise ValueError("Cannot execute single workflow while continuous execution is running")
        
        # Load the workflow
        if not self.load_workflow(workflow_data):
            return {
                "success": False,
                "error": "Failed to load workflow",
                "logs": self.execution_logs
            }
        
        # Broadcast workflow started event
        if self.websocket_manager:
            self._broadcast_sync(self.websocket_manager.broadcast_workflow_event("workflow_started", {
                "workflow_id": id(workflow_data),
                "node_count": len(workflow_data.get("nodes", []))
            }))
        
        try:
            # Execute the workflow once
            start_time = time.time()
            
            # Setup and use optimized execution if possible
            self._setup_execution()
            self._execute_workflow_once_optimized()
            
            execution_time = time.time() - start_time
            
            # Broadcast workflow completed event
            if self.websocket_manager:
                self._broadcast_sync(self.websocket_manager.broadcast_workflow_event("workflow_completed", {
                    "workflow_id": id(workflow_data),
                    "execution_time": execution_time,
                }))
            
            return {
                "success": True,
            }
            
        except Exception as e:
            stacktrace = traceback.format_exc()
            self.log_message("error", f"Single workflow execution failed: {str(e)}")
            self.log_message("error", f"Traceback: {stacktrace}")
            
            # Broadcast workflow error event
            if self.websocket_manager:
                self._broadcast_sync(self.websocket_manager.broadcast_workflow_event("workflow_error", {
                    "workflow_id": id(workflow_data),
                    "error": str(e),
                    "stacktrace": stacktrace
                }))
            
            return {
                "success": False,
                "error": str(e),
                "logs": self.execution_logs
            }
        
        finally:
            pass
    
    def stop_single_execution(self) -> bool:
        """Stop single workflow execution (for compatibility with workflow_executor interface)"""
        # For single execution, we don't have a separate stop mechanism
        # This is mainly for API compatibility
        return not self.is_running
    
    def update_node_parameter(self, node_id: str, parameter_name: str, parameter_value: Any) -> bool:
        """Update a node parameter in real-time during execution"""
        try:
            
            # Update in cached node data map if setup is complete
            if self._is_setup and node_id in self._node_data_map:
                node_data = self._node_data_map[node_id]
                if "data" not in node_data:
                    node_data["data"] = {}
                if "parameters" not in node_data["data"]:
                    node_data["data"]["parameters"] = {}
                node_data["data"]["parameters"][parameter_name] = parameter_value
                
                self.log_message("info", f"Updated node {node_id} parameter {parameter_name}")
                return True
            else:
                self.log_message("warning", f"Node {node_id} not found in setup data, parameter update may not take effect until next setup")
                return False
                
        except Exception as e:
            self.log_message("error", f"Failed to update node parameter: {str(e)}")
            return False
    
    
    def get_status(self) -> Dict[str, Any]:
        """Get current execution status"""
        return {
            "is_running": self.is_running,
            "has_workflow": self.current_workflow is not None,
            "count_of_iterations": self.count_of_iterations,
            "last_execution_time": self.last_execution_time,
            "loop_interval": self.loop_interval,
            "results": self.execution_results,
            "logs": self.execution_logs[-10:],  # Last 10 logs
            "is_setup": self._is_setup
        }

def main():
    """Main function to run the continuous executor"""
    print("Factory UI Continuous Executor")
    print("=" * 40)
    
    # Initialize node registry
    custom_nodes_dir = os.path.join(os.path.dirname(__file__), "custom_nodes")
    node_registry.discover_nodes(custom_nodes_dir)
    print(f"Discovered {len(node_registry.get_all_nodes())} nodes")
    
    # Create executor
    executor = ContinuousExecutor(loop_interval=2.0)  # Execute every 2 seconds
    
    # Example workflow for testing
    example_workflow = {
        "nodes": [
            {
                "id": "hello-1",
                "type": "HelloWorldNode",
                "data": {
                    "nodeInfo": {
                        "name": "HelloWorldNode",
                        "input_types": {"required": {}, "optional": {}},
                        "return_types": ["STRING"]
                    }
                }
            },
            {
                "id": "print-1",
                "type": "PrintNode",
                "data": {
                    "nodeInfo": {
                        "name": "PrintNode",
                        "input_types": {"required": {"text": ["STRING", {}]}, "optional": {}},
                        "return_types": []
                    }
                }
            }
        ],
        "edges": [
            {
                "id": "e1",
                "source": "hello-1",
                "target": "print-1",
                "sourceHandle": "output",
                "targetHandle": "text"
            }
        ]
    }
    
    # Load and start execution
    if executor.load_workflow(example_workflow):
        executor.start_continuous_execution()
        
        try:
            # Run for a while
            print("Continuous execution started. Press Ctrl+C to stop.")
            while True:
                time.sleep(5)
                status = executor.get_status()
                print(f"Status: {status['count_of_iterations']} executions, "
                      f"last took {status['last_execution_time']:.3f}s")
        
        except KeyboardInterrupt:
            print("\nStopping continuous execution...")
            executor.stop_continuous_execution()
            print("Stopped.")

if __name__ == "__main__":
    main()