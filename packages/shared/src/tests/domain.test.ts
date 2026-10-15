import { describe, it, expect } from 'vitest';
import {
  convertLength,
  convertWeight,
  convertVolume,
  toCanonicalBaseQuantity,
  fromCanonicalBaseQuantity,
} from '../types/units.js';
import {
  calculateAggregateCut,
  calculateSegmentCuttingPlan,
  PipeSegment,
} from '../types/pipe.js';
import {
  rupeeToPaise,
  paiseToRupee,
  calculateLineItemTotals,
  calculateInvoiceTotals,
} from '../types/money.js';
import { generateSku } from '../utils/sku.js';

describe('Unit Conversions', () => {
  it('converts metres to mm and back', () => {
    const mm = convertLength(3, 'm', 'mm');
    expect(mm).toBe(3000);
    const m = convertLength(3000, 'mm', 'm');
    expect(m).toBe(3);
  });

  it('converts feet and inches to mm deterministically', () => {
    const feetMm = convertLength(1, 'ft', 'mm');
    expect(feetMm).toBe(304.8);
    const inchMm = convertLength(1, 'inch', 'mm');
    expect(inchMm).toBe(25.4);
  });

  it('handles canonical base conversions for count, weight, and volume', () => {
    expect(toCanonicalBaseQuantity(2, 'box', 'count', 12)).toBe(24);
    expect(fromCanonicalBaseQuantity(24, 'box', 'count', 12)).toBe(2);

    expect(toCanonicalBaseQuantity(2.5, 'kg', 'weight')).toBe(2500);
    expect(fromCanonicalBaseQuantity(2500, 'kg', 'weight')).toBe(2.5);

    expect(toCanonicalBaseQuantity(1.5, 'l', 'volume')).toBe(1500);
    expect(fromCanonicalBaseQuantity(1500, 'l', 'volume')).toBe(1.5);
  });
});

describe('Pipe Length and Cutting Requirements (Critical Spec Test)', () => {
  it('Method A: 40 pipes of 3 metres = 120 metres, selling 7.5 metres leaves 112.5 metres', () => {
    const totalPipes = 40;
    const lengthPerPipeM = 3;
    const totalOpeningStockMm = totalPipes * convertLength(lengthPerPipeM, 'm', 'mm'); // 120,000 mm

    expect(totalOpeningStockMm).toBe(120000);

    const saleLengthM = 7.5;
    const saleLengthMm = convertLength(saleLengthM, 'm', 'mm'); // 7,500 mm

    const result = calculateAggregateCut(totalOpeningStockMm, saleLengthMm);
    expect(result.feasible).toBe(true);
    expect(result.remainingStockMm).toBe(112500);

    const remainingM = convertLength(result.remainingStockMm, 'mm', 'm');
    expect(remainingM).toBe(112.5);
  });

  it('Method B: Segment remnant tracking selects best-fit remnant', () => {
    const segments: PipeSegment[] = [
      {
        id: 'pipe-1',
        storeId: 'store-1',
        variantId: 'var-1',
        originalLengthMm: 3000,
        currentLengthMm: 1000, // remnant of 1m
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'pipe-2',
        storeId: 'store-1',
        variantId: 'var-1',
        originalLengthMm: 3000,
        currentLengthMm: 3000, // full pipe of 3m
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Customer requests 800 mm. Should pick pipe-1 (1000 mm) leaving a 200 mm remnant, preserving pipe-2 whole!
    const plan = calculateSegmentCuttingPlan(segments, 800);
    expect(plan.feasible).toBe(true);
    expect(plan.cuts).toHaveLength(1);
    expect(plan.cuts[0].segmentId).toBe('pipe-1');
    expect(plan.cuts[0].lengthUsedMm).toBe(800);
    expect(plan.cuts[0].remnantRemainingMm).toBe(200);
    expect(plan.cuts[0].statusAfter).toBe('available');
  });

  it('Method B: Multi-piece cutting when cut exceeds any single piece', () => {
    const segments: PipeSegment[] = [
      {
        id: 'pipe-1',
        storeId: 'store-1',
        variantId: 'var-1',
        originalLengthMm: 3000,
        currentLengthMm: 2000,
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'pipe-2',
        storeId: 'store-1',
        variantId: 'var-1',
        originalLengthMm: 3000,
        currentLengthMm: 2500,
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Customer needs 3500 mm. Can fulfill with pipe-2 (2500) + pipe-1 (1000, leaves 1000 remnant)
    const plan = calculateSegmentCuttingPlan(segments, 3500);
    expect(plan.feasible).toBe(true);
    expect(plan.cuts.length).toBeGreaterThan(1);
    const totalCut = plan.cuts.reduce((s, c) => s + c.lengthUsedMm, 0);
    expect(totalCut).toBe(3500);
  });
});

describe('Monetary Precision and Financial Calculations', () => {
  it('converts rupees to paise without floating-point errors', () => {
    expect(rupeeToPaise(150.75)).toBe(15075);
    expect(paiseToRupee(15075)).toBe(150.75);
    expect(rupeeToPaise(0.1 + 0.2)).toBe(30); // handles classic 0.30000000000000004 cleanly
  });

  it('calculates line item with discount and 18% GST (CGST/SGST 50/50)', () => {
    // 2 items at ₹100 each (10000 paise each), 10% discount, 18% GST
    const line = calculateLineItemTotals({
      quantity: 2,
      unitPricePaise: 10000,
      discountPercent: 10,
      taxRatePercent: 18,
      isInterState: false,
    });

    expect(line.grossAmountPaise).toBe(20000); // ₹200.00
    expect(line.discountPaise).toBe(2000); // ₹20.00
    expect(line.taxableAmountPaise).toBe(18000); // ₹180.00
    expect(line.totalTaxPaise).toBe(3240); // 18% of 18000 = 3240 paise (₹32.40)
    expect(line.cgstPaise).toBe(1620); // 9% = 1620
    expect(line.sgstPaise).toBe(1620); // 9% = 1620
    expect(line.finalAmountPaise).toBe(21240); // ₹212.40
  });

  it('calculates invoice totals with round off', () => {
    const line = calculateLineItemTotals({
      quantity: 1,
      unitPricePaise: 12345, // ₹123.45
      taxRatePercent: 18,
    });
    const inv = calculateInvoiceTotals([line]);
    // Rounded to nearest Rupee (multiple of 100 paise)
    expect(inv.grandTotalPaise % 100).toBe(0);
    expect(inv.unroundedTotalPaise + inv.roundOffPaise).toBe(inv.grandTotalPaise);
  });
});

describe('SKU Generation', () => {
  it('generates well-formatted SKU', () => {
    const sku = generateSku('Plumbing Materials', 'CPVC Elbow', '25mm');
    expect(sku).toMatch(/^PLUM-CPVC-25M-\d{4}$/);
  });
});

describe('Dynamic Custom Fields & Specifications', () => {
  it('validates custom field definitions for categories, subcategories, products and variants', async () => {
    const { customFieldSchema } = await import('../schemas/index.js');
    const validField = {
      name: 'pressure_rating',
      label: 'Pressure Rating',
      targetLevel: 'subcategory',
      fieldType: 'dropdown',
      unit: 'bar',
      required: true,
      options: ['PN 10', 'PN 16', 'PN 20'],
      displayOrder: 1,
    };
    const res = customFieldSchema.safeParse(validField);
    expect(res.success).toBe(true);
  });
});

describe('Bulk CSV Catalogue Import', () => {
  it('parses and validates sample CSV rows successfully', async () => {
    const { parseAndValidateProductCsv, SAMPLE_CSV_TEMPLATE } = await import('../utils/csvImport.js');
    const result = parseAndValidateProductCsv(SAMPLE_CSV_TEMPLATE);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows.length).toBe(4);
    expect(result.validRows[0].productName).toBe('CPVC Pipe');
    expect(result.validRows[0].sku).toBe('PLUM-CPVC-25M-101');
    expect(result.validRows[0].measurementType).toBe('length');
  });

  it('detects duplicate SKUs and invalid numbers in CSV', async () => {
    const { parseAndValidateProductCsv } = await import('../utils/csvImport.js');
    const duplicateCsv = `categoryName,subcategoryName,productName,variantName,sku,purchasePriceRs,sellingPriceRs
Plumbing,Pipes,Pipe A,20mm,SKU-001,100,150
Plumbing,Pipes,Pipe B,25mm,SKU-001,120,170
`;
    const result = parseAndValidateProductCsv(duplicateCsv);
    expect(result.duplicateSkus).toContain('SKU-001');
    expect(result.errors.some((e) => e.message.includes('Duplicate SKU'))).toBe(true);
  });
});

