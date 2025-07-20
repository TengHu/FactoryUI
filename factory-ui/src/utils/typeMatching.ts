// Type matching utilities for node connections

export interface TypeCompatibility {
  [outputType: string]: string[];
}

// Define type compatibility rules
export const TYPE_COMPATIBILITY: TypeCompatibility = {
  // Basic types
  'STRING': ['STRING', 'ANY'],
  'INT': ['INT', 'FLOAT', 'NUMBER', 'ANY'],
  'FLOAT': ['FLOAT', 'NUMBER', 'ANY'],
  'BOOLEAN': ['BOOLEAN', 'ANY'],
  'ANY': ['ANY', 'STRING', 'INT', 'FLOAT', 'BOOLEAN', 'NUMBER', 'SCSSERVOSDK', 'DICT'],
  'IMAGE': ['IMAGE', 'ANY'],
  
  // Generic types that can connect to their own type
  'NUMBER': ['NUMBER', 'INT', 'FLOAT', 'ANY'],
  
  
  // Robot SDK types
  'SCSSERVOSDK': ['SCSSERVOSDK', 'ANY'], // Feetech servo SDK instance
  'DICT': ['DICT', 'ANY'], // Dictionary/object data
  
  // Unknown types can connect to anything (fallback)
  'unknown': ['unknown', 'ANY', 'STRING', 'INT', 'FLOAT', 'BOOLEAN', 'NUMBER', 'SCSSERVOSDK', 'DICT'],
};

/**
 * Check if an output type can connect to an input type
 * @param outputType - The type of the output handle
 * @param inputType - The type of the input handle
 * @returns true if connection is valid, false otherwise
 */
export function canConnect(outputType: string, inputType: string): boolean {
  // Normalize types to uppercase for comparison
  const normalizedOutputType = outputType.toUpperCase();
  const normalizedInputType = inputType.toUpperCase();
  
  // Same type always matches
  if (normalizedOutputType === normalizedInputType) {
    return true;
  }
  
  // Check if input type accepts this output type
  const compatibleTypes = TYPE_COMPATIBILITY[normalizedOutputType] || [];
  return compatibleTypes.includes(normalizedInputType);
}

/**
 * Get a human-readable error message for incompatible types
 * @param outputType - The type of the output handle
 * @param inputType - The type of the input handle
 * @returns Error message string
 */
export function getConnectionError(outputType: string, inputType: string): string {
  return `Cannot connect ${outputType} output to ${inputType} input. Types are incompatible.`;
}

/**
 * Get compatible input types for a given output type
 * @param outputType - The output type to check
 * @returns Array of compatible input types
 */
export function getCompatibleTypes(outputType: string): string[] {
  const normalizedType = outputType.toUpperCase();
  return TYPE_COMPATIBILITY[normalizedType] || [];
}

/**
 * Check if a type is a "universal" type that can connect to anything
 * @param type - The type to check
 * @returns true if it's a universal type
 */
export function isUniversalType(type: string): boolean {
  const normalizedType = type.toUpperCase();
  return normalizedType === 'ANY' || normalizedType === 'unknown';
}