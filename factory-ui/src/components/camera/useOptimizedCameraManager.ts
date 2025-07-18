import { useState, useCallback, useEffect, useRef } from 'react';
import { cameraManager, CameraDevice } from './CameraManager';
import { websocketService } from '../../services/websocket';

export interface UseOptimizedCameraManagerOptions {
  nodeId: string;
  onFrameCapture?: (nodeId: string, inputName: string, frameData: string) => void;
}

export interface CameraInputState {
  devices: CameraDevice[];
  activeStreams: Record<string, boolean>;
  showMenus: Record<string, boolean>;
}

export function useOptimizedCameraManager({ nodeId, onFrameCapture }: UseOptimizedCameraManagerOptions) {
  const [cameraState, setCameraState] = useState<CameraInputState>({
    devices: [],
    activeStreams: {},
    showMenus: {}
  });

  // Use refs to store callback and nodeId to prevent re-renders
  const callbackRef = useRef(onFrameCapture);
  const nodeIdRef = useRef(nodeId);

  // Update refs when values change
  useEffect(() => {
    callbackRef.current = onFrameCapture;
    nodeIdRef.current = nodeId;
  }, [onFrameCapture, nodeId]);

  // Optimized frame handler that bypasses React state updates for camera frames
  const optimizedFrameHandler = useCallback((inputName: string, frameData: string) => {
    // Check if this is a camera frame (base64 image data)
    const isCameraFrame = frameData.startsWith('data:image/') && frameData.length > 1000;
    
    if (isCameraFrame) {
      // Send directly to WebSocket, bypassing React state update
      if (websocketService.isConnected()) {
        websocketService.sendInputUpdate(nodeIdRef.current, inputName, frameData);
      }
    } else {
      // For non-camera data, use the regular callback if provided
      if (callbackRef.current) {
        callbackRef.current(nodeIdRef.current, inputName, frameData);
      }
    }
  }, []);

  // Enumerate camera devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await cameraManager.enumerateDevices();
      setCameraState(prev => ({ ...prev, devices }));
      return devices;
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      return [];
    }
  }, []);

  // Start camera for input with optimized frame processing
  const startCamera = useCallback(async (inputName: string, deviceId?: string) => {
    try {
      await cameraManager.startCamera(inputName, deviceId);
      
      // Setup frame processing with optimized handler
      cameraManager.setupFrameProcessing(
        inputName,
        optimizedFrameHandler,
        {
          width: 320,
          height: 240,
          quality: 0.7,
          displayFps: 30,
          backendFps: 30
        }
      );

      setCameraState(prev => ({
        ...prev,
        activeStreams: { ...prev.activeStreams, [inputName]: true },
        showMenus: { ...prev.showMenus, [inputName]: false }
      }));

    } catch (error) {
      console.error('Failed to start camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  }, [optimizedFrameHandler]);

  // Stop camera for input
  const stopCamera = useCallback((inputName: string) => {
    cameraManager.stopCamera(inputName);
    setCameraState(prev => ({
      ...prev,
      activeStreams: { ...prev.activeStreams, [inputName]: false },
      showMenus: { ...prev.showMenus, [inputName]: false }
    }));
  }, []);

  // Toggle camera menu
  const toggleCameraMenu = useCallback(async (inputName: string) => {
    if (cameraState.activeStreams[inputName]) {
      stopCamera(inputName);
      return;
    }

    if (cameraState.devices.length === 0) {
      await enumerateDevices();
    }

    setCameraState(prev => ({
      ...prev,
      showMenus: { ...prev.showMenus, [inputName]: !prev.showMenus[inputName] }
    }));
  }, [cameraState.activeStreams, cameraState.devices.length, enumerateDevices, stopCamera]);

  // Select camera device
  const selectDevice = useCallback(async (inputName: string, deviceId: string) => {
    await startCamera(inputName, deviceId);
  }, [startCamera]);

  // Close camera menu
  const closeCameraMenu = useCallback((inputName?: string) => {
    if (inputName) {
      setCameraState(prev => ({
        ...prev,
        showMenus: { ...prev.showMenus, [inputName]: false }
      }));
    } else {
      // Close all menus
      setCameraState(prev => ({
        ...prev,
        showMenus: {}
      }));
    }
  }, []);

  // Setup canvas references
  const setupCanvas = useCallback((inputName: string, canvas: HTMLCanvasElement | null) => {
    cameraManager.setCanvasRef(inputName, canvas);
    if (canvas) {
      cameraManager.initializeCanvas(canvas, !cameraState.activeStreams[inputName]);
    }
  }, [cameraState.activeStreams]);

  // Setup video references
  const setupVideo = useCallback((inputName: string, video: HTMLVideoElement | null) => {
    cameraManager.setVideoRef(inputName, video);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop all active cameras
      Object.keys(cameraState.activeStreams).forEach(inputName => {
        if (cameraState.activeStreams[inputName]) {
          cameraManager.stopCamera(inputName);
        }
      });
    };
  }, [cameraState.activeStreams]);

  // Handle clicks outside camera menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.camera-controls')) {
        closeCameraMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeCameraMenu]);

  return {
    cameraState,
    enumerateDevices,
    startCamera,
    stopCamera,
    toggleCameraMenu,
    selectDevice,
    closeCameraMenu,
    setupCanvas,
    setupVideo,
    isCameraActive: (inputName: string) => cameraState.activeStreams[inputName] || false,
    isCameraMenuOpen: (inputName: string) => cameraState.showMenus[inputName] || false
  };
}