import { ComponentQCStatus } from './types';

/**
 * Multiplier Engine: dynamically derives Expected Component Counts.
 * Formula: targetQty * piecesPerGarment
 */
export function calculateExpectedCount(targetQty: number, piecesPerGarment: number): number {
  if (targetQty <= 0 || piecesPerGarment <= 0) return 0;
  return Math.round(targetQty * piecesPerGarment);
}

/**
 * Traffic-Light Status Matrix Evaluation:
 * - GREEN (MATCH): Actual == Expected (Exact component match. Satisfies verification requirement.)
 * - YELLOW (EXCESS): Actual > Expected (Surplus pieces recorded. Flagged for return or safety margin; batch may proceed.)
 * - RED (SHORTAGE): Actual < Expected (DEFECT SHORTAGE. Garment assembly incomplete. Approve action blocked.)
 */
export function evaluateComponentStatus(actualQty: number, expectedQty: number): ComponentQCStatus {
  if (actualQty === expectedQty) return 'GREEN';
  if (actualQty > expectedQty) return 'YELLOW';
  return 'RED';
}

/**
 * Wastage Calculation:
 * Fabric Wastage % = [ (Actual Fabric Used - Expected Fabric) / Expected Fabric ] * 100
 * where Expected Fabric = targetQty * stdFabricYards
 */
export function calculateFabricWastage(
  actualFabricYds: number,
  targetQty: number,
  stdFabricYards: number
): { expectedFabricYds: number; wastagePct: number } {
  const expectedFabricYds = Number((targetQty * stdFabricYards).toFixed(2));
  if (expectedFabricYds <= 0) {
    return { expectedFabricYds: 0, wastagePct: 0 };
  }
  const wastage = ((actualFabricYds - expectedFabricYds) / expectedFabricYds) * 100;
  return {
    expectedFabricYds,
    wastagePct: Number(wastage.toFixed(2)),
  };
}

/**
 * Server-Side Hard-Stop Gatekeeper Rule:
 * If ANY single component is flagged RED, missing, or uncounted, approval is strictly blocked.
 */
export function validateApprovalEligibility(
  items: Array<{
    componentName?: string;
    expectedQty: number;
    actualQty: number | null | undefined;
  }>
): { canApprove: boolean; shortageComponents: string[]; uncountedComponents: string[] } {
  const shortageComponents: string[] = [];
  const uncountedComponents: string[] = [];

  if (!items || items.length === 0) {
    return { canApprove: false, shortageComponents: [], uncountedComponents: ['No components found'] };
  }

  for (const item of items) {
    const name = item.componentName || 'Unknown Component';
    if (item.actualQty === null || item.actualQty === undefined || isNaN(item.actualQty)) {
      uncountedComponents.push(name);
      continue;
    }
    const status = evaluateComponentStatus(item.actualQty, item.expectedQty);
    if (status === 'RED') {
      shortageComponents.push(`${name} (Shortage: counted ${item.actualQty} of ${item.expectedQty} expected)`);
    }
  }

  const canApprove = shortageComponents.length === 0 && uncountedComponents.length === 0;

  return {
    canApprove,
    shortageComponents,
    uncountedComponents,
  };
}
