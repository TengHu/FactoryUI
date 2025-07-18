import { NodeInfo } from '../services/api';

/**
 * Determines if a node should use the specialized CameraNode component
 * based on its input types
 */
export function shouldUseCameraNode(nodeInfo: NodeInfo): boolean {
  // Check if any input is of type 'CAMERA'
  const requiredInputs = nodeInfo.input_types.required || {};
  const optionalInputs = nodeInfo.input_types.optional || {};
  
  // Check required inputs
  for (const [, typeInfo] of Object.entries(requiredInputs)) {
    const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
    if (typeName === 'CAMERA') {
      return true;
    }
  }
  
  // Check optional inputs
  for (const [, typeInfo] of Object.entries(optionalInputs)) {
    const typeName = Array.isArray(typeInfo) ? typeInfo[0] : typeInfo;
    if (typeName === 'CAMERA') {
      return true;
    }
  }
  
  return false;
}