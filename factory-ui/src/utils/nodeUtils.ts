import { NodeInfo } from '../services/api';

/**
 * Determines if a node should use the specialized CameraNode component
 * based on its input types or return types
 */
export function shouldUseCameraNode(nodeInfo: NodeInfo): boolean {
  const requiredInputs = nodeInfo.input_types.required || {};
  const optionalInputs = nodeInfo.input_types.optional || {};
  
  // Check that optional inputs are empty
  if (Object.keys(optionalInputs).length > 0) {
    return false;
  }
  
  // Count CAMERA types in required inputs
  let cameraInputCount = 0;
  for (const [, typeInfo] of Object.entries(requiredInputs)) {
    const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
    if (typeName === 'CAMERA') {
      cameraInputCount++;
    }
  }
  
  // Count CAMERA types in required outputs
  let cameraOutputCount = 0;
  if (typeof nodeInfo.return_types === 'object' && !Array.isArray(nodeInfo.return_types)) {
    const requiredReturnTypes = nodeInfo.return_types.required || {};
    const optionalReturnTypes = nodeInfo.return_types.optional || {};
    
    // Check that optional outputs are empty
    if (Object.keys(optionalReturnTypes).length > 0) {
      return false;
    }
    
    for (const [, typeInfo] of Object.entries(requiredReturnTypes)) {
      const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
      if (typeName === 'IMAGE') {
        cameraOutputCount++;
      }
    }
  }
  
  // Return true if there is exactly one CAMERA input and one CAMERA output
  return cameraInputCount === 1 && cameraOutputCount === 1;
}

/**
 * Determines if a node should use the specialized ThreeDNode component
 * based on its input types - returns true if there is exactly one required input of type ThreeDConfig
 */
export function shouldUseThreeDNode(nodeInfo: NodeInfo): boolean {

  if (nodeInfo.name === 'ThreeDVisualizationNode') {
    return true;
  }

  const requiredInputs = nodeInfo.input_types.required || {};
  const optionalInputs = nodeInfo.input_types.optional || {};
  
  // Check that optional inputs are empty
  if (Object.keys(optionalInputs).length > 0) {
    return false;
  }
  
  // Count ThreeDConfig types in required inputs
  let threeDConfigInputCount = 0;
  for (const [, typeInfo] of Object.entries(requiredInputs)) {
    const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
    if (typeName === 'THREE_D_CONFIG') {
      threeDConfigInputCount++;
    }
  }
  
  // Return true if there is exactly one ThreeDConfig input
  return threeDConfigInputCount === 1;
}

/**
 * Determines if a node should use the specialized NoteNode component
 * based on its name - returns true if the name is exactly 'note'
 */
export function shouldUseNoteNode(nodeInfo: NodeInfo): boolean {
  return nodeInfo.name === 'NoteNode';
}