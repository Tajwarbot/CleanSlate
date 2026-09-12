/**
 * ID generation utilities.
 */

/** Generate a unique operation ID */
export function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Generate a unique item ID */
export function generateItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
