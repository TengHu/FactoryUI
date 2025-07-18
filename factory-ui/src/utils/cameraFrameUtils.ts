/**
 * Utility functions for accessing camera frames without triggering React re-renders
 */

import { cameraManager } from '../components/camera/CameraManager';

/**
 * Get current camera frames for a specific node
 * Used by prepareWorkflowData to include latest frames without React state updates
 */
export function getCurrentCameraFramesForNode(nodeId: string): Record<string, string> {
  return cameraManager.getCameraFramesForNode(nodeId);
}

/**
 * Get current camera frames for all nodes
 * Returns a map of nodeId -> inputName -> frameData
 */
export function getAllCurrentCameraFrames(): Record<string, Record<string, string>> {
  const allFrames: Record<string, Record<string, string>> = {};
  
  // Get all stream keys and group by node
  const streamKeys = cameraManager.getActiveStreamKeys();
  for (const streamKey of streamKeys) {
    const [nodeId, ...inputParts] = streamKey.split(':');
    const inputName = inputParts.join(':');
    const currentFrame = cameraManager.getCurrentFrame(streamKey);
    
    if (currentFrame) {
      if (!allFrames[nodeId]) {
        allFrames[nodeId] = {};
      }
      allFrames[nodeId][inputName] = currentFrame;
    }
  }
  
  return allFrames;
}

/**
 * Check if a node has any active camera inputs
 */
export function nodeHasCameraInputs(nodeId: string): boolean {
  return cameraManager.nodeHasActiveStreams(nodeId);
}

/**
 * Merge camera frames into existing inputValues for a node
 */
export function mergeCameraFramesWithInputValues(
  nodeId: string, 
  inputValues: Record<string, string> = {}
): Record<string, string> {
  const cameraFrames = getCurrentCameraFramesForNode(nodeId);
  return {
    ...inputValues,
    ...cameraFrames
  };
}