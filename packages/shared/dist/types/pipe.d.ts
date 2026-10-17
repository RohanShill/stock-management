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
export declare function calculateSegmentCuttingPlan(availableSegments: PipeSegment[], requestedLengthMm: number): PipeCuttingPlan;
/**
 * Method A: Aggregate length calculation.
 * Verifies if sufficient aggregate stock exists and calculates remaining stock.
 */
export declare function calculateAggregateCut(currentTotalStockMm: number, requestedCutMm: number): {
    feasible: boolean;
    remainingStockMm: number;
    reason?: string;
};
//# sourceMappingURL=pipe.d.ts.map