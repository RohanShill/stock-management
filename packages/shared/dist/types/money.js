"use strict";
/**
 * Monetary utilities using integer paise (₹ 1 = 100 paise)
 * to avoid floating-point arithmetic errors in financial calculations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rupeeToPaise = rupeeToPaise;
exports.paiseToRupee = paiseToRupee;
exports.formatPaiseToINR = formatPaiseToINR;
exports.calculateLineItemTotals = calculateLineItemTotals;
exports.calculateInvoiceTotals = calculateInvoiceTotals;
/**
 * Converts Rupees (e.g. 150.50) to integer Paise (15050).
 */
function rupeeToPaise(rupees) {
    return Math.round(rupees * 100);
}
/**
 * Converts integer Paise (15050) to Rupees (150.50).
 */
function paiseToRupee(paise) {
    return Math.round(paise) / 100;
}
/**
 * Formats paise into Indian Rupee display string, e.g. "₹1,50,000.50"
 */
function formatPaiseToINR(paise) {
    const rupees = paiseToRupee(paise);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(rupees);
}
/**
 * Computes line item financials accurately with integer rounding.
 */
function calculateLineItemTotals(input) {
    const { quantity, unitPricePaise, discountPercent = 0, discountPaise: directDiscountPaise = 0, taxRatePercent = 0, isInterState = false, } = input;
    // Base gross
    const grossAmountPaise = Math.round(quantity * unitPricePaise);
    // Discount
    let discountPaise = directDiscountPaise;
    if (discountPercent > 0) {
        discountPaise = Math.round((grossAmountPaise * discountPercent) / 100);
    }
    discountPaise = Math.min(discountPaise, grossAmountPaise);
    const taxableAmountPaise = grossAmountPaise - discountPaise;
    // Tax calculation
    let totalTaxPaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    if (taxRatePercent > 0) {
        totalTaxPaise = Math.round((taxableAmountPaise * taxRatePercent) / 100);
        if (isInterState) {
            igstPaise = totalTaxPaise;
        }
        else {
            // Split evenly into CGST and SGST
            cgstPaise = Math.floor(totalTaxPaise / 2);
            sgstPaise = totalTaxPaise - cgstPaise;
        }
    }
    const finalAmountPaise = taxableAmountPaise + totalTaxPaise;
    return {
        grossAmountPaise,
        discountPaise,
        taxableAmountPaise,
        taxRatePercent,
        cgstPaise,
        sgstPaise,
        igstPaise,
        totalTaxPaise,
        finalAmountPaise,
    };
}
/**
 * Recalculates whole invoice summary given multiple line item results and an optional invoice discount.
 */
function calculateInvoiceTotals(lines, invoiceDiscountPaise = 0, roundOffEnabled = true) {
    let subtotalGrossPaise = 0;
    let totalLineDiscountsPaise = 0;
    let totalTaxablePaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;
    let totalTaxPaise = 0;
    for (const line of lines) {
        subtotalGrossPaise += line.grossAmountPaise;
        totalLineDiscountsPaise += line.discountPaise;
        totalTaxablePaise += line.taxableAmountPaise;
        totalCgstPaise += line.cgstPaise;
        totalSgstPaise += line.sgstPaise;
        totalIgstPaise += line.igstPaise;
        totalTaxPaise += line.totalTaxPaise;
    }
    const unroundedTotalPaise = totalTaxablePaise + totalTaxPaise - invoiceDiscountPaise;
    let roundOffPaise = 0;
    let grandTotalPaise = unroundedTotalPaise;
    if (roundOffEnabled) {
        // Round to nearest Rupee (100 paise)
        const roundedRupees = Math.round(unroundedTotalPaise / 100);
        grandTotalPaise = roundedRupees * 100;
        roundOffPaise = grandTotalPaise - unroundedTotalPaise;
    }
    return {
        subtotalGrossPaise,
        totalLineDiscountsPaise,
        invoiceDiscountPaise,
        totalTaxablePaise,
        totalCgstPaise,
        totalSgstPaise,
        totalIgstPaise,
        totalTaxPaise,
        unroundedTotalPaise,
        roundOffPaise,
        grandTotalPaise,
    };
}
//# sourceMappingURL=money.js.map