import type { ComponentQCStatus } from '@/types';

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

/** Validate all request-controlled manufacturing inputs before touching storage. */
export function validateOrderInput(input: {
  targetQty: unknown;
  fabricRollId: unknown;
  actualFabricYds: unknown;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof input.targetQty !== 'number' || !Number.isSafeInteger(input.targetQty) || input.targetQty <= 0) {
    errors.push('Target quantity must be a positive whole number.');
  }
  if (typeof input.fabricRollId !== 'string' || input.fabricRollId.trim().length === 0) {
    errors.push('Fabric roll ID is required.');
  }
  if (typeof input.actualFabricYds !== 'number' || !Number.isFinite(input.actualFabricYds) || input.actualFabricYds <= 0) {
    errors.push('Actual fabric used must be a positive number.');
  }
  return { valid: errors.length === 0, errors };
}

/** Parse strict, non-negative integer physical piece counts; empty is uncounted. */
export function validateComponentCounts(
  items: Array<{ componentName?: string; expectedQty: number; actualQty: unknown }>,
): { valid: boolean; items: Array<{ componentName?: string; expectedQty: number; actualQty: number | null }>; errors: string[] } {
  const errors: string[] = [];
  const normalized = items.map((item) => {
    const valid = typeof item.actualQty === 'number' && Number.isSafeInteger(item.actualQty) && item.actualQty >= 0;
    if (!valid) errors.push(`${item.componentName || 'Component'} must have a whole number count of zero or greater.`);
    return { ...item, actualQty: valid ? item.actualQty as number : null };
  });
  const eligibility = validateApprovalEligibility(normalized);
  errors.push(...eligibility.uncountedComponents.map((name) => `${name} has not been counted.`));
  errors.push(...eligibility.shortageComponents);
  return { valid: errors.length === 0, items: normalized, errors };
}

/** Production state transitions accepted by the application domain. */
export function canTransitionOrder(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    CUTTING_IN_PROGRESS: ['PENDING_VERIFICATION'],
    PENDING_VERIFICATION: ['VERIFIED', 'REJECTED'],
    REJECTED: ['PENDING_VERIFICATION'],
    VERIFIED: ['SEWING_STARTED'],
    SEWING_STARTED: [],
  };
  return transitions[from]?.includes(to) ?? false;
}

export function validateRejectionNote(note: unknown) {
  const valid = typeof note === 'string' && note.trim().length >= 3;
  return { valid, error: valid ? null : 'A meaningful rejection note is required.' };
}
