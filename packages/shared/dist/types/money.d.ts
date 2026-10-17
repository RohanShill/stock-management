/**
 * Monetary utilities using integer paise (₹ 1 = 100 paise)
 * to avoid floating-point arithmetic errors in financial calculations.
 */
export interface TaxCalculationResult {
    taxableAmountPaise: number;
    taxRatePercent: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalTaxPaise: number;
    totalAmountPaise: number;
}
export interface LineItemTotalInput {
    quantity: number;
    unitPricePaise: number;
    discountPercent?: number;
    discountPaise?: number;
    taxRatePercent?: number;
    isInterState?: boolean;
}
export interface LineItemTotalResult {
    grossAmountPaise: number;
    discountPaise: number;
    taxableAmountPaise: number;
    taxRatePercent: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalTaxPaise: number;
    finalAmountPaise: number;
}
/**
 * Converts Rupees (e.g. 150.50) to integer Paise (15050).
 */
export declare function rupeeToPaise(rupees: number): number;
/**
 * Converts integer Paise (15050) to Rupees (150.50).
 */
export declare function paiseToRupee(paise: number): number;
/**
 * Formats paise into Indian Rupee display string, e.g. "₹1,50,000.50"
 */
export declare function formatPaiseToINR(paise: number): string;
/**
 * Computes line item financials accurately with integer rounding.
 */
export declare function calculateLineItemTotals(input: LineItemTotalInput): LineItemTotalResult;
/**
 * Recalculates whole invoice summary given multiple line item results and an optional invoice discount.
 */
export declare function calculateInvoiceTotals(lines: LineItemTotalResult[], invoiceDiscountPaise?: number, roundOffEnabled?: boolean): {
    subtotalGrossPaise: number;
    totalLineDiscountsPaise: number;
    invoiceDiscountPaise: number;
    totalTaxablePaise: number;
    totalCgstPaise: number;
    totalSgstPaise: number;
    totalIgstPaise: number;
    totalTaxPaise: number;
    unroundedTotalPaise: number;
    roundOffPaise: number;
    grandTotalPaise: number;
};
//# sourceMappingURL=money.d.ts.map