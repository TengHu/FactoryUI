import React, { useState, useCallback, useEffect } from 'react';
import { Tree } from 'react-arborist';
import './WorkflowExplorer.css';

// Type declarations for File System Access API
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }): Promise<FileSystemDirectoryHandle>;
  }
  
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }
  
  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  }
  
  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    createWritable(): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
  }
  
  interface FileSystemWritableFileStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }
}

interface WorkflowTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'workflow';
  file?: File;
  children?: WorkflowTreeNode[];
}

interface WorkflowExplorerProps {
  onWorkflowSelect: (workflowData: any, workflowName: string) => void;
}

const WorkflowExplorer: React.FC<WorkflowExplorerProps> = ({ onWorkflowSelect }) => {
  const [treeData, setTreeData] = useState<WorkflowTreeNode[]>([]);
  const [copiedWorkflow, setCopiedWorkflow] = useState<{name: string; data: any} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [useLocalFiles, setUseLocalFiles] = useState(true); // Use local files by default
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Helper function to get stored directory handle
  const getStoredDirectoryHandle = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    try {
      // Use IndexedDB to store/retrieve directory handle
      return new Promise((resolve) => {
        const request = indexedDB.open('WorkflowExplorer', 1);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('directories')) {
            db.createObjectStore('directories');
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['directories'], 'readonly');
          const store = transaction.objectStore('directories');
          const getRequest = store.get('workflows');
          
          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };
          
          getRequest.onerror = () => {
            resolve(null);
          };
        };
        
        request.onerror = () => {
          resolve(null);
        };
      });
    } catch {
      return null;
    }
  }, []);

  // Helper function to store directory handle
  const storeDirectoryHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    try {
      return new Promise<void>((resolve) => {
        const request = indexedDB.open('WorkflowExplorer', 1);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('directories')) {
            db.createObjectStore('directories');
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['directories'], 'readwrite');
          const store = transaction.objectStore('directories');
          store.put(handle, 'workflows');
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        };
        
        request.onerror = () => {
          resolve();
        };
      });
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Load workflows from local directory using File System Access API
  const loadWorkflowsFromLocal = useCallback(async (dirHandle: FileSystemDirectoryHandle) => {
    try {
      const workflowNodes: WorkflowTreeNode[] = [];
      
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && name.endsWith('.json')) {
          const fileHandle = handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          workflowNodes.push({
            id: `workflow-${name}`,
            name: name.replace('.json', ''),
            type: 'workflow' as const,
            file: file
          });
        }
      }

      const rootStructure: WorkflowTreeNode[] = [
        {
          id: 'workflows-folder',
          name: 'Workflows',
          type: 'folder' as const,
          children: workflowNodes
        }
      ];

      setTreeData(rootStructure);
      setError(null);
      return true; // Success
    } catch (error) {
      console.error('Error loading workflows from local directory:', error);
      setError('Failed to read workflow files');
      return false; // Failed
    }
  }, []);



  // Internal function for directory selection (without loading state management)
  const selectWorkflowDirectoryInternal = useCallback(async () => {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      setError('File System Access API not supported in this browser. Use Chrome/Edge.');
      return;
    }

    try {
      // Ask user to select the backend/user/workflows directory
      const dirHandle = await window.showDirectoryPicker({
        id: 'workflow-directory',
        mode: 'readwrite',
        startIn: 'documents'
      });

      setDirectoryHandle(dirHandle);
      await storeDirectoryHandle(dirHandle);
      await loadWorkflowsFromLocal(dirHandle);
      setError(null); // Clear any previous errors
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setError('Please select the backend/user/workflows directory to continue');
      } else {
        console.error('Error selecting directory:', error);
        setError('Failed to access directory. Please try again.');
      }
    }
  }, [storeDirectoryHandle, loadWorkflowsFromLocal]);

  // Automatically try to load workflows on mount
  useEffect(() => {
    const autoLoadWorkflows = async () => {
      setIsLoading(true);

      try {
        // Check if File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
          setError('File System Access API not supported in this browser. Use Chrome/Edge.');
          setIsLoading(false);
          return;
        }

        // Try to get stored directory handle from IndexedDB
        const storedHandle = await getStoredDirectoryHandle();
        if (storedHandle) {
          // Verify permission
          const permission = await storedHandle.queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            setDirectoryHandle(storedHandle);
            await loadWorkflowsFromLocal(storedHandle);
            setIsLoading(false);
            return;
          }
        }

        // If no stored handle or permission denied, automatically prompt for directory
        await selectWorkflowDirectoryInternal();
      } catch (error) {
        console.log('Auto-load failed, will require manual selection');
        setError('Click the button below to select your workflows directory');
      }
      
      setIsLoading(false);
    };

    autoLoadWorkflows();
  }, [loadWorkflowsFromLocal, getStoredDirectoryHandle, selectWorkflowDirectoryInternal]);

  const selectWorkflowDirectory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await selectWorkflowDirectoryInternal();
    } catch (error) {
      console.error('Error in selectWorkflowDirectory:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectWorkflowDirectoryInternal]);

  const handleWorkflowClick = useCallback(async (node: WorkflowTreeNode) => {
    if (node.type === 'workflow' && node.file) {
      try {
        setSelectedId(node.id);
        const text = await node.file.text();
        const workflowData = JSON.parse(text);
        onWorkflowSelect(workflowData, node.name);
        console.log(`✓ Workflow "${node.name}" loaded`);
      } catch (error) {
        console.error('Failed to load workflow:', error);
        alert('Failed to load workflow file');
      }
    }
  }, [onWorkflowSelect]);

  const handleCopyWorkflow = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const workflowData = JSON.parse(text);
      setCopiedWorkflow({ name: file.name, data: workflowData });
      console.log(`✓ Workflow "${file.name}" copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy workflow:', error);
      alert('Failed to copy workflow');
    }
  }, []);

  const handlePasteWorkflow = useCallback(async () => {
    if (!copiedWorkflow || !directoryHandle) return;

    const newFilename = prompt('Enter name for the copied workflow:', `${copiedWorkflow.name.replace('.json', '')}_copy`);
    if (!newFilename) return;

    const filename = newFilename.endsWith('.json') ? newFilename : `${newFilename}.json`;

    try {
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(copiedWorkflow.data, null, 2));
      await writable.close();
      
      console.log(`✓ Workflow pasted as "${filename}"`);
      await loadWorkflowsFromLocal(directoryHandle); // Refresh the tree
    } catch (error) {
      console.error('Failed to paste workflow:', error);
      alert('Failed to paste workflow');
    }
  }, [copiedWorkflow, directoryHandle, loadWorkflowsFromLocal]);

  const handleDeleteWorkflow = useCallback(async (file: File, workflowName: string) => {
    if (!directoryHandle) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${workflowName}"?`);
    if (!confirmed) return;

    try {
      await directoryHandle.removeEntry(file.name);
      console.log(`✓ Workflow "${file.name}" deleted`);
      await loadWorkflowsFromLocal(directoryHandle); // Refresh the tree
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      alert('Failed to delete workflow');
    }
  }, [directoryHandle, loadWorkflowsFromLocal]);

  const Node = ({ node, style, dragHandle }: any) => {
    const handleClick = () => {
      if (node.data.type === 'workflow') {
        handleWorkflowClick(node.data);
      }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      
      if (node.data.type === 'workflow') {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'workflow-context-menu';
        contextMenu.innerHTML = `
          <div class="context-menu-item" data-action="copy">📋 Copy</div>
          <div class="context-menu-item" data-action="paste" ${!copiedWorkflow ? 'data-disabled="true"' : ''}>📄 Paste</div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item danger" data-action="delete">🗑️ Delete</div>
        `;
        
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.zIndex = '1000';
        
        document.body.appendChild(contextMenu);

        const handleContextClick = (event: MouseEvent) => {
          const target = event.target as HTMLElement;
          const action = target.getAttribute('data-action');
          
          if (action && !target.getAttribute('data-disabled')) {
            switch (action) {
              case 'copy':
                if (node.data.file) {
                  handleCopyWorkflow(node.data.file);
                }
                break;
              case 'paste':
                handlePasteWorkflow();
                break;
              case 'delete':
                if (node.data.file) {
                  handleDeleteWorkflow(node.data.file, node.data.name);
                }
                break;
            }
          }
          
          document.body.removeChild(contextMenu);
          document.removeEventListener('click', handleContextClick);
        };

        contextMenu.addEventListener('click', handleContextClick);
        
        // Remove menu when clicking elsewhere
        setTimeout(() => {
          document.addEventListener('click', handleContextClick, { once: true });
        }, 0);
      }
    };

    const isSelected = selectedId === node.data.id;
    const icon = node.data.type === 'folder' ? (node.isOpen ? '📂' : '📁') : '📄';

    return (
      <div
        ref={dragHandle}
        style={style}
        className={`workflow-tree-node ${node.data.type} ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="node-icon">{icon}</span>
        <span className="node-name">{node.data.name}</span>
      </div>
    );
  };

  if (!directoryHandle) {
    return (
      <div className="workflow-explorer">
        <div className="workflow-explorer-header">
          <h3>Workflows</h3>
        </div>
        <div className="directory-selection">
          <p>Select the workflows directory to get started</p>
          <button onClick={selectWorkflowDirectory} disabled={isLoading}>
            📁 Select backend/user/workflows/ folder
          </button>
          {error && <div className="error-message">{error}</div>}
          {isLoading && <div className="loading">Selecting directory...</div>}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="workflow-explorer">
        <div className="workflow-explorer-header">
          <h3>Workflows</h3>
        </div>
        <div className="loading">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="workflow-explorer">
      <div className="workflow-explorer-header">
        <h3>Workflows</h3>
        <div className="header-buttons">
          <button 
            className="paste-btn" 
            onClick={handlePasteWorkflow}
            disabled={!copiedWorkflow}
            title={copiedWorkflow ? `Paste "${copiedWorkflow.name}"` : 'No workflow copied'}
          >
            📄
          </button>
          <button 
            className="refresh-btn" 
            onClick={() => loadWorkflowsFromLocal(directoryHandle)} 
            title="Refresh"
          >
            🔄
          </button>
          <button 
            className="folder-btn" 
            onClick={selectWorkflowDirectory} 
            title="Change directory"
          >
            📁
          </button>
        </div>
      </div>
      <div className="workflow-tree-container">
        {treeData.length > 0 ? (
          <Tree
            data={treeData}
            openByDefault={true}
            width="100%"
            height={300}
            indent={16}
          >
            {Node}
          </Tree>
        ) : (
          <div className="empty-state">
            <p>No workflow files found</p>
            <button onClick={() => loadWorkflowsFromLocal(directoryHandle)}>
              Refresh
            </button>
          </div>
        )}
      </div>
      {copiedWorkflow && (
        <div className="status-bar">
          Copied: {copiedWorkflow.name}
        </div>
      )}
    </div>
  );
};

export default WorkflowExplorer;