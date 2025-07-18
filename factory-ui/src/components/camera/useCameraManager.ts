import { useState, useCallback, useEffect } from 'react';
import { cameraManager, CameraDevice } from './CameraManager';

export interface UseCameraManagerOptions {
  nodeId: string;
  onFrameCapture?: (nodeId: string, inputName: string, frameData: string) => void;
}

export interface CameraInputState {
  devices: CameraDevice[];
  activeStreams: Record<string, boolean>;
  showMenus: Record<string, boolean>;
}

export function useCameraManager({ nodeId, onFrameCapture }: UseCameraManagerOptions) {
  const [cameraState, setCameraState] = useState<CameraInputState>({
    devices: [],
    activeStreams: {},
    showMenus: {}
  });

  // Create unique stream key combining nodeId and inputName
  const createStreamKey = useCallback((inputName: string) => {
    return `${nodeId}:${inputName}`;
  }, [nodeId]);

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

  // Start camera for input
  const startCamera = useCallback(async (inputName: string, deviceId?: string) => {
    try {
      const streamKey = createStreamKey(inputName);
      await cameraManager.startCamera(streamKey, deviceId);
      
      // Setup frame processing if callback provided
      if (onFrameCapture) {
        cameraManager.setupFrameProcessing(
          streamKey,
          (streamKey, frameData) => {
            // Extract inputName from streamKey (format: "nodeId:inputName")
            const inputName = streamKey.split(':').slice(1).join(':');
            onFrameCapture(nodeId, inputName, frameData);
          },
          {
            width: 320,
            height: 240,
            quality: 0.7,
            displayFps: 30,
            backendFps: 30
          }
        );
      }

      setCameraState(prev => ({
        ...prev,
        activeStreams: { ...prev.activeStreams, [inputName]: true },
        showMenus: { ...prev.showMenus, [inputName]: false }
      }));

    } catch (error) {
      console.error('Failed to start camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  }, [nodeId, onFrameCapture, createStreamKey]);

  // Stop camera for input
  const stopCamera = useCallback((inputName: string) => {
    const streamKey = createStreamKey(inputName);
    cameraManager.stopCamera(streamKey);
    setCameraState(prev => ({
      ...prev,
      activeStreams: { ...prev.activeStreams, [inputName]: false },
      showMenus: { ...prev.showMenus, [inputName]: false }
    }));
  }, [createStreamKey]);

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
    const streamKey = createStreamKey(inputName);
    cameraManager.setCanvasRef(streamKey, canvas);
    if (canvas) {
      cameraManager.initializeCanvas(canvas, !cameraState.activeStreams[inputName]);
    }
  }, [createStreamKey, cameraState.activeStreams]);

  // Setup video references
  const setupVideo = useCallback((inputName: string, video: HTMLVideoElement | null) => {
    const streamKey = createStreamKey(inputName);
    cameraManager.setVideoRef(streamKey, video);
  }, [createStreamKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop all active cameras for this node
      Object.keys(cameraState.activeStreams).forEach(inputName => {
        if (cameraState.activeStreams[inputName]) {
          const streamKey = createStreamKey(inputName);
          cameraManager.stopCamera(streamKey);
        }
      });
    };
  }, [cameraState.activeStreams, createStreamKey]);

  // Note: Regular camera manager doesn't need auto-sync since it uses normal state flow

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