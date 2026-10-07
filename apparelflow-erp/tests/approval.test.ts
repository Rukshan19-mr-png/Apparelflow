import { describe, expect, it } from 'vitest';
import { calculateExpectedCount, calculateFabricWastage, canTransitionOrder, evaluateComponentStatus, validateApprovalEligibility, validateComponentCounts, validateOrderInput } from '../src/lib/verification';

describe('ApparelFlow production engine', () => {
  it('derives expected pieces from recipe multipliers', () => {
    expect(calculateExpectedCount(50, 2)).toBe(100);
    expect(calculateExpectedCount(0, 2)).toBe(0);
  });

  it('allows exact component matches and blocks a shortage', () => {
    const exact = validateComponentCounts([{ componentName: 'Front panel', expectedQty: 50, actualQty: 50 }, { componentName: 'Sleeve cuffs', expectedQty: 100, actualQty: 100 }]);
    expect(exact.valid).toBe(true);
    expect(validateApprovalEligibility(exact.items).canApprove).toBe(true);
    const shortage = validateComponentCounts([{ componentName: 'Sleeve cuff', expectedQty: 100, actualQty: 99 }]);
    expect(shortage.valid).toBe(false);
    expect(shortage.errors.join(' ')).toMatch(/Shortage/);
  });

  it('rejects missing, negative, decimal and non-numeric component counts', () => {
    for (const actualQty of [null, -1, 1.2, 'five']) {
      expect(validateComponentCounts([{ expectedQty: 2, actualQty }]).valid).toBe(false);
    }
  });

  it('accepts zero as an integer count but the approval gate still rejects resulting shortage', () => {
    const result = validateComponentCounts([{ expectedQty: 2, actualQty: 0 }]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Shortage/);
  });

  it('accepts surplus counts and gives the yellow traffic-light state', () => {
    expect(evaluateComponentStatus(105, 100)).toBe('YELLOW');
    expect(validateComponentCounts([{ expectedQty: 100, actualQty: 105 }]).valid).toBe(true);
  });

  it('enforces complete, valid positive whole-number order inputs', () => {
    expect(validateOrderInput({ targetQty: 50, fabricRollId: 'FAB-1', actualFabricYds: 91 }).valid).toBe(true);
    for (const targetQty of [-1, 1.5, '50', Number.NaN]) {
      expect(validateOrderInput({ targetQty, fabricRollId: 'FAB-1', actualFabricYds: 91 }).valid).toBe(false);
    }
    expect(validateOrderInput({ targetQty: 50, fabricRollId: '', actualFabricYds: 91 }).valid).toBe(false);
  });

  it('only permits verified batches to enter the sewing state', () => {
    expect(canTransitionOrder('PENDING_VERIFICATION', 'VERIFIED')).toBe(true);
    expect(canTransitionOrder('PENDING_VERIFICATION', 'SEWING_STARTED')).toBe(false);
    expect(canTransitionOrder('REJECTED', 'VERIFIED')).toBe(false);
    expect(canTransitionOrder('REJECTED', 'PENDING_VERIFICATION')).toBe(true);
    expect(canTransitionOrder('VERIFIED', 'SEWING_STARTED')).toBe(true);
  });

  it('calculates fabric overage against recipe yield', () => {
    expect(calculateFabricWastage(189, 100, 1.8)).toEqual({ expectedFabricYds: 180, wastagePct: 5 });
  });
});
