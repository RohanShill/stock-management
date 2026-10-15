import { convertLength } from './units.js';

export type PipeTrackingMethod = 'aggregate' | 'segment';

export type SegmentStatus = 'available' | 'consumed' | 'damaged' | 'discarded';

export interface PipeSegment {
  id: string;
  storeId: string;
  variantId: string;
  originalLengthMm: number;
  currentLengthMm: number;
  batchNumber?: string;
  purchaseId?: string;
  status: SegmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CutPlanItem {
  segmentId: string;
  lengthUsedMm: number;
  remnantRemainingMm: number;
  statusAfter: SegmentStatus;
}

export interface PipeCuttingPlan {
  feasible: boolean;
  requestedLengthMm: number;
  cuts: CutPlanItem[];
  unfulfilledLengthMm: number;
  reason?: string;
}

/**
 * Calculates a cutting plan for individual pipe segments.
 * Uses Best-Fit strategy: prefers cutting an existing remnant that is closest in length
 * to the requested cut (to minimize wasteful small remnants), or a full piece if no remnant fits.
 */
export function calculateSegmentCuttingPlan(
  availableSegments: PipeSegment[],
  requestedLengthMm: number
): PipeCuttingPlan {
  if (requestedLengthMm <= 0) {
    return {
      feasible: false,
      requestedLengthMm,
      cuts: [],
      unfulfilledLengthMm: 0,
      reason: 'Requested cut length must be greater than zero',
    };
  }

  // Filter to only available segments with positive length
  const eligible = availableSegments
    .filter((s) => s.status === 'available' && s.currentLengthMm > 0)
    .sort((a, b) => a.currentLengthMm - b.currentLengthMm);

  const totalAvailableMm = eligible.reduce((sum, s) => sum + s.currentLengthMm, 0);
  if (totalAvailableMm < requestedLengthMm) {
    return {
      feasible: false,
      requestedLengthMm,
      cuts: [],
      unfulfilledLengthMm: requestedLengthMm - totalAvailableMm,
      reason: `Insufficient total segment length (${totalAvailableMm} mm available vs ${requestedLengthMm} mm requested)`,
    };
  }

  // Check if a single segment can satisfy the cut (Best-fit single piece)
  const singleCandidate = eligible.find((s) => s.currentLengthMm >= requestedLengthMm);
  if (singleCandidate) {
    const remnant = singleCandidate.currentLengthMm - requestedLengthMm;
    return {
      feasible: true,
      requestedLengthMm,
      cuts: [
        {
          segmentId: singleCandidate.id,
          lengthUsedMm: requestedLengthMm,
          remnantRemainingMm: remnant,
          statusAfter: remnant > 0 ? 'available' : 'consumed',
        },
      ],
      unfulfilledLengthMm: 0,
    };
  }

  // If no single segment is long enough, multi-piece cut across largest available pieces
  const multiCuts: CutPlanItem[] = [];
  let remainingNeeded = requestedLengthMm;
  // Sort descending for multi-piece fulfilment
  const descCandidates = [...eligible].sort((a, b) => b.currentLengthMm - a.currentLengthMm);

  for (const seg of descCandidates) {
    if (remainingNeeded <= 0) break;
    const use = Math.min(seg.currentLengthMm, remainingNeeded);
    const remnant = seg.currentLengthMm - use;
    multiCuts.push({
      segmentId: seg.id,
      lengthUsedMm: use,
      remnantRemainingMm: remnant,
      statusAfter: remnant > 0 ? 'available' : 'consumed',
    });
    remainingNeeded -= use;
  }

  if (remainingNeeded > 0) {
    return {
      feasible: false,
      requestedLengthMm,
      cuts: [],
      unfulfilledLengthMm: remainingNeeded,
      reason: 'Could not fulfill cut across available segments',
    };
  }

  return {
    feasible: true,
    requestedLengthMm,
    cuts: multiCuts,
    unfulfilledLengthMm: 0,
  };
}

/**
 * Method A: Aggregate length calculation.
 * Verifies if sufficient aggregate stock exists and calculates remaining stock.
 */
export function calculateAggregateCut(
  currentTotalStockMm: number,
  requestedCutMm: number
): {
  feasible: boolean;
  remainingStockMm: number;
  reason?: string;
} {
  if (requestedCutMm <= 0) {
    return { feasible: false, remainingStockMm: currentTotalStockMm, reason: 'Cut length must be positive' };
  }
  if (currentTotalStockMm < requestedCutMm) {
    return {
      feasible: false,
      remainingStockMm: currentTotalStockMm,
      reason: `Insufficient aggregate stock (${currentTotalStockMm} mm vs ${requestedCutMm} mm required)`,
    };
  }
  return {
    feasible: true,
    remainingStockMm: currentTotalStockMm - requestedCutMm,
  };
}
