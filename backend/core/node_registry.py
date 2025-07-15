import os
import importlib.util
import inspect
from typing import Dict, Type, List
from .node_base import NodeBase

class NodeRegistry:
    """Registry for discovering and managing node classes"""
    
    def __init__(self):
        self.nodes: Dict[str, Type[NodeBase]] = {}
        self.node_mappings: Dict[str, str] = {}
    
    def register_node(self, node_class: Type[NodeBase], name: str = None) -> None:
        """Register a single node class"""
        if not issubclass(node_class, NodeBase):
            raise ValueError(f"Node class {node_class} must inherit from NodeBase")
        
        node_name = name or node_class.__name__
        self.nodes[node_name] = node_class
        self.node_mappings[node_name] = node_class.__name__
        print(f"Registered node: {node_name}")
    
    def discover_nodes(self, directory: str) -> None:
        """Discover and register nodes from a directory"""
        if not os.path.exists(directory):
            print(f"Directory {directory} does not exist")
            return
        
        for filename in os.listdir(directory):
            if filename.endswith('.py') and not filename.startswith('_'):
                self._load_module(directory, filename)
    
    def _load_module(self, directory: str, filename: str) -> None:
        """Load a Python module and register any node classes"""
        module_path = os.path.join(directory, filename)
        module_name = filename[:-3]  # Remove .py extension
        
        try:
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Look for NODE_CLASS_MAPPINGS
            if hasattr(module, 'NODE_CLASS_MAPPINGS'):
                mappings = getattr(module, 'NODE_CLASS_MAPPINGS')
                for name, node_class in mappings.items():
                    self.register_node(node_class, name)
            else:
                # Auto-discover NodeBase subclasses
                for name, obj in inspect.getmembers(module):
                    if (inspect.isclass(obj) and 
                        issubclass(obj, NodeBase) and 
                        obj != NodeBase):
                        self.register_node(obj)
        
        except Exception as e:
            print(f"Error loading module {filename}: {e}")
    
    def get_node(self, name: str) -> Type[NodeBase]:
        """Get a node class by name"""
        return self.nodes.get(name)
    
    def get_all_nodes(self) -> Dict[str, Type[NodeBase]]:
        """Get all registered nodes"""
        return self.nodes.copy()
    
    def get_node_info(self, name: str) -> Dict:
        """Get node information for API response"""
        node_class = self.get_node(name)
        if not node_class:
            return None
        
        # Get detailed description if available
        detailed_description = ""
        if hasattr(node_class, 'get_detailed_description'):
            try:
                detailed_description = node_class.get_detailed_description()
            except Exception as e:
                print(f"Warning: Failed to get detailed description for {name}: {e}")
        
        return {
            "name": name,
            "display_name": node_class.DISPLAY_NAME(),
            "description": node_class.DESCRIPTION(),
            "detailed_description": detailed_description,
            "category": node_class.CATEGORY(),
            "input_types": node_class.INPUT_TYPES(),
            "return_types": node_class.RETURN_TYPES(),
            "function": node_class.FUNCTION()
        }
    
    def get_all_node_info(self) -> List[Dict]:
        """Get information for all registered nodes"""
        return [self.get_node_info(name) for name in self.nodes.keys()]

# Global registry instance
node_registry = NodeRegistry()