import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { NodeProps } from '@xyflow/react';
import { NodeInfo } from '../services/api';
import './CustomNode.css';
import './NoteNode.css';

export interface NoteNodeProps extends NodeProps {
  onContextMenu?: (event: React.MouseEvent, nodeId: string, nodeInfo: NodeInfo) => void;
  onInputValueChange?: (nodeId: string, inputName: string, value: string) => void;
}

interface NoteNodeData {
  label: string;
  nodeInfo: NodeInfo;
  type: string;
  inputValues?: Record<string, string>;
  bypassed?: boolean;
}

const NoteNode = ({ id, data, selected, ...props }: NoteNodeProps) => {
  const nodeData = data as unknown as NoteNodeData;
  const { nodeInfo, inputValues = {}, bypassed = false } = nodeData;
  const onContextMenu = (props as any).onContextMenu;
  const onInputValueChange = (props as any).onInputValueChange;
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(inputValues['note'] || '');
  
  // Resize functionality
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  
  // Handle ResizeObserver errors
  useEffect(() => {
    const handleResizeObserverError = (e: ErrorEvent) => {
      if (e.message.includes('ResizeObserver loop completed with undelivered notifications')) {
        e.stopImmediatePropagation();
        return false;
      }
      return true;
    };

    window.addEventListener('error', handleResizeObserverError);
    return () => window.removeEventListener('error', handleResizeObserverError);
  }, []);
  
  // Resize handle functionality
  const handleResizeStart = useCallback((direction: string) => (e: React.MouseEvent) => {
    // Completely prevent all event propagation
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    e.nativeEvent.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    setIsResizing(true);
    setResizeDirection(direction);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const node = nodeRef.current;
    if (!node) return;
    
    const startWidth = node.offsetWidth;
    const startHeight = node.offsetHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!node) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      if (direction.includes('e')) {
        newWidth = Math.max(150, startWidth + deltaX);
      }
      if (direction.includes('w')) {
        newWidth = Math.max(150, startWidth - deltaX);
      }
      if (direction.includes('s')) {
        newHeight = Math.max(80, startHeight + deltaY);
      }
      if (direction.includes('n')) {
        newHeight = Math.max(80, startHeight - deltaY);
      }
      
      node.style.width = `${newWidth}px`;
      node.style.height = `${newHeight}px`;
      
      // Also update textarea size when resizing
      if (textareaRef.current) {
        textareaRef.current.style.width = '100%';
        textareaRef.current.style.height = `${newHeight - 16}px`; // Account for padding
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection('');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Re-trigger auto-resize for textarea after manual resize
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);
  
  // Auto-resize textarea
  const handleTextChange = useCallback((value: string) => {
    setText(value);
    if (onInputValueChange) {
      onInputValueChange(id, 'note', value);
    }
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [id, onInputValueChange]);

  // Initial resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onContextMenu) {
      onContextMenu(event, id, nodeInfo);
    }
  };

  return (
    <div className="node-container">
      <div 
        ref={nodeRef}
        className={`note-node ${selected ? 'selected' : ''} ${bypassed ? 'bypassed' : ''} ${isResizing ? `resizing resizing-${resizeDirection}` : ''}`}
        onContextMenu={handleContextMenu}
      >
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={text}
          placeholder="Add your note here..."
          onChange={(e) => handleTextChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          rows={1}
        />
      </div>
      
      {/* Custom resize handles - only show when selected */}
      {(selected || false) && (
        <>
          {/* Corner handles */}
          <div 
            className="resize-handle nw" 
            onMouseDownCapture={handleResizeStart('nw')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle ne" 
            onMouseDownCapture={handleResizeStart('ne')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle sw" 
            onMouseDownCapture={handleResizeStart('sw')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle se" 
            onMouseDownCapture={handleResizeStart('se')}
            onDragStart={(e) => e.preventDefault()}
          />
          
          {/* Edge handles */}
          <div 
            className="resize-handle n" 
            onMouseDownCapture={handleResizeStart('n')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle s" 
            onMouseDownCapture={handleResizeStart('s')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle e" 
            onMouseDownCapture={handleResizeStart('e')}
            onDragStart={(e) => e.preventDefault()}
          />
          <div 
            className="resize-handle w" 
            onMouseDownCapture={handleResizeStart('w')}
            onDragStart={(e) => e.preventDefault()}
          />
        </>
      )}
    </div>
  );
};

export default memo(NoteNode);