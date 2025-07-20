# Custom Nodes

This directory contains custom node implementations for the FactoryUI workflow system. Custom nodes are the building blocks that allow you to extend the functionality of workflows with your own processing logic.

## What are Custom Nodes?

Custom nodes are Python classes that inherit from `NodeBase` and implement specific functionality that can be used in visual workflows. Each node represents a single processing unit that can:

- Accept typed inputs from other nodes
- Process data using custom logic
- Return typed outputs to connected nodes
- Provide real-time updates to the frontend interface

Nodes are automatically discovered and registered by the system, making them available in the workflow editor.

## Node Architecture

### Required Methods

Every custom node must implement these abstract methods from `NodeBase`:

#### 1. `INPUT_TYPES(cls) -> Dict[str, Any]`
Defines what inputs the node accepts.

```python
@classmethod
def INPUT_TYPES(cls) -> Dict[str, Any]:
    return {
        "required": {
            "text": ("STRING", {"default": ""}),
            "number": ("INT", {"default": 0, "min": 0, "max": 100})
        },
        "optional": {
            "advanced_option": ("BOOLEAN", {"default": False})
        }
    }
```

**Supported Types:**
- `STRING` - Text input
- `INT` - Integer number
- `FLOAT` - Floating point number
- `BOOLEAN` - True/False checkbox
- `ANY` - Accepts any data type
- `IMAGE` - Image data (bytes or base64)
- `CAMERA` - Camera stream input
- `DICT` - Dictionary/object data
- `ScsServoSDK` - Robot SDK instance
- Custom types defined by other nodes

**Input Options:**
- `default` - Default value
- `min`, `max` - Numeric ranges
- List of strings for dropdown selections

#### 2. `RETURN_TYPES(cls) -> Dict[str, Any]`
Defines what outputs the node produces.

```python
@classmethod
def RETURN_TYPES(cls) -> Dict[str, Any]:
    return {
        "required": {
            "result": ("STRING", {}),
            "status": ("BOOLEAN", {})
        }
    }
```

#### 3. `FUNCTION(cls) -> str`
Specifies the method name to execute.

```python
@classmethod
def FUNCTION(cls) -> str:
    return "process_data"  # Name of the method to call
```

#### 4. `TAGS(cls) -> List[str]`
Categorizes the node for organization.  
Include the name of your custom node and any other relevant tags.
```

### Optional Methods

#### Display Information
```python
@classmethod
def DISPLAY_NAME(cls) -> str:
    return "My Custom Node"

@classmethod
def DESCRIPTION(cls) -> str:
    return "Short description of what this node does"

@classmethod
def get_detailed_description(cls) -> str:
    return """
    Detailed multi-line description with:
    - Purpose explanation
    - Input/output descriptions
    - Usage examples
    """
```

### The Execute Method

The execute method (specified by `FUNCTION()`) performs the actual work:

```python
def process_data(self, text: str, number: int, advanced_option: bool = False):
    # Your processing logic here
    result = f"Processed: {text} with number {number}"
    status = True
    
    # Return tuple matching RETURN_TYPES order
    return (result, status)
```

## Real-Time Updates (rt_update)

The `rt_update` mechanism allows nodes to send live data to the frontend while executing. This is useful for:

- Progress indicators
- Live camera feeds
- Robot status updates
- Intermediate results
- Error messages

### Using rt_update

Your execute method can return a tuple with rt_update data:

```python
def execute_with_updates(self, input_data):
    # Regular processing
    result = process(input_data)
    
    # Real-time update data
    rt_update = {
        "progress": 75,
        "status": "Processing complete",
        "data": {"intermediate_result": result}
    }
    
    # Return: (regular_outputs..., rt_update)
    return (result, rt_update)
```

### rt_update Examples

#### Simple Text Update
```python
rt_update = "Processing started..."
return (result, rt_update)
```

#### Progress Information
```python
rt_update = {
    "progress": 50,
    "message": "Half way done",
    "time_remaining": "30 seconds"
}
return (result, rt_update)
```

#### Image Display
```python
rt_update = {
    "image_base64": base64_image_data,
    "image_format": "png"
}
return (result, rt_update)
```

#### Error Information
```python
rt_update = {
    "error": "Connection failed",
    "details": "Could not connect to robot"
}
return (result, rt_update)
```

## Adding Custom Nodes

### 1. Create Your Node File

Create a new Python file in the `custom_nodes/` directory:

```python
# my_custom_nodes.py
from core.node_base import NodeBase
from typing import Any, Dict, List

MODULE_TAG = "MyModule"

class MyCustomNode(NodeBase):
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "input_text": ("STRING", {"default": "Hello"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "output_text": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "execute"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "My Custom Node"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Does something with text"
    
    def execute(self, input_text: str) -> str:
        result = f"Processed: {input_text}"
        return result

# Required: Export your nodes
NODE_CLASS_MAPPINGS = {
    "MyCustomNode": MyCustomNode,
}
```

### 2. Node Registration

Nodes are automatically discovered in two ways:

#### Option 1: NODE_CLASS_MAPPINGS (Recommended)
Export your nodes in a `NODE_CLASS_MAPPINGS` dictionary:

```python
NODE_CLASS_MAPPINGS = {
    "MyCustomNode": MyCustomNode,
    "AnotherNode": AnotherNode,
}
```

#### Option 2: Auto-discovery
Any class inheriting from `NodeBase` will be automatically registered using its class name.

### 3. Restart the Backend

After adding new nodes:
1. Restart the backend server
2. Nodes will be automatically discovered and registered
3. They'll appear in the frontend node panel

## Simple Example: Text Reverser Node

Here's a complete example of a simple custom node:

```python
from core.node_base import NodeBase
from typing import Any, Dict, List

MODULE_TAG = "Example"

class TextReverserNode(NodeBase):
    """A simple node that reverses text input"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "text": ("STRING", {"default": "Hello World"})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "reversed_text": ("STRING", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "reverse_text"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return [MODULE_TAG]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Text Reverser"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Reverses the input text string"
    
    @classmethod
    def get_detailed_description(cls) -> str:
        return """
TextReverserNode

Purpose: Takes a text string and returns it in reverse character order.

Inputs:
  - text (STRING): The text to reverse (default: "Hello World")

Outputs:
  - reversed_text (STRING): The input text with characters in reverse order

Usage: Connect any text output to this node to reverse the character order. 
Useful for text processing workflows or testing string manipulation.

Example: "Hello World" becomes "dlroW olleH"
        """
    
    def reverse_text(self, text: str) -> str:
        """Reverse the input text"""
        reversed_result = text[::-1]
        
        # Optional: provide real-time update
        rt_update = {
            "original": text,
            "reversed": reversed_result,
            "length": len(text)
        }
        
        return (reversed_result, rt_update)

# Export the node
NODE_CLASS_MAPPINGS = {
    "TextReverserNode": TextReverserNode,
}
```

## Advanced Example: Counter with Progress

Here's a more complex example with real-time updates:

```python
import time
from core.node_base import NodeBase
from typing import Any, Dict, List

class CounterNode(NodeBase):
    """Counts from 1 to N with real-time progress updates"""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "count_to": ("INT", {"default": 5, "min": 1, "max": 20}),
                "delay_seconds": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 5.0})
            }
        }
    
    @classmethod
    def RETURN_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "final_count": ("INT", {}),
                "total_time": ("FLOAT", {})
            }
        }
    
    @classmethod
    def FUNCTION(cls) -> str:
        return "count_with_progress"
    
    @classmethod
    def TAGS(cls) -> List[str]:
        return ["Example", "Progress"]
    
    @classmethod
    def DISPLAY_NAME(cls) -> str:
        return "Counter with Progress"
    
    @classmethod
    def DESCRIPTION(cls) -> str:
        return "Counts from 1 to N with real-time progress updates"
    
    def count_with_progress(self, count_to: int, delay_seconds: float):
        """Count with real-time progress updates"""
        start_time = time.time()
        
        for i in range(1, count_to + 1):
            # Calculate progress
            progress = (i / count_to) * 100
            
            # Real-time update
            rt_update = {
                "current_count": i,
                "target_count": count_to,
                "progress_percent": round(progress, 1),
                "status": f"Counting: {i}/{count_to}",
                "elapsed_time": round(time.time() - start_time, 2)
            }
            
            # This would be sent to frontend during execution
            print(f"Count: {i}, Progress: {progress:.1f}%")
            
            # Simulate work
            time.sleep(delay_seconds)
        
        total_time = time.time() - start_time
        
        # Final rt_update
        rt_update = {
            "status": "Complete!",
            "final_count": count_to,
            "total_time": round(total_time, 2),
            "progress_percent": 100
        }
        
        return (count_to, total_time, rt_update)

NODE_CLASS_MAPPINGS = {
    "CounterNode": CounterNode,
}
```

## Best Practices

### 1. Error Handling
Always handle errors gracefully:

```python
def execute(self, input_data):
    try:
        result = process(input_data)
        return (result, None)
    except Exception as e:
        error_update = {"error": str(e)}
        return (None, error_update)
```

### 2. Input Validation
Validate inputs in your execute method:

```python
def execute(self, number: int):
    if number < 0:
        raise ValueError("Number must be positive")
    return (number * 2, None)
```

### 3. Progress Updates
For long-running operations, provide progress updates:

```python
def long_operation(self, data):
    total_steps = len(data)
    for i, item in enumerate(data):
        # Process item
        result = process(item)
        
        # Progress update
        progress = (i + 1) / total_steps * 100
        rt_update = {
            "progress": progress,
            "current_item": i + 1,
            "total_items": total_steps
        }
        
        # This would be sent in real execution
        yield (result, rt_update)
```

### 4. Type Hints
Use proper type hints for better debugging:

```python
def execute(self, text: str, count: int) -> tuple[str, dict]:
    return (text * count, {"length": len(text * count)})
```

## Debugging Nodes

### 1. Print Statements
Use print statements for debugging:

```python
def execute(self, input_data):
    print(f"[MyNode] Received input: {input_data}")
    result = process(input_data)
    print(f"[MyNode] Processed result: {result}")
    return (result, None)
```

### 2. Error Information
Include detailed error information:

```python
def execute(self, input_data):
    try:
        return (process(input_data), None)
    except Exception as e:
        import traceback
        error_info = {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "input_data": str(input_data)
        }
        print(f"[MyNode] Error: {error_info}")
        return (None, error_info)
```

### 3. Backend Logs
Check backend console output when nodes execute to see print statements and errors.

## Examples in This Directory

- `basic_nodes.py` - Collection of fundamental nodes (Input, Output, Math, etc.)
- `so101_nodes.py` - Robot-specific nodes for SO101 robot control
- `feetech-servo-sdk/` - External SDK for robot servo communication

Study these files for more examples of node implementation patterns and advanced features.