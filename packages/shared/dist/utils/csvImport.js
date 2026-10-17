"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_CSV_TEMPLATE = void 0;
exports.parseAndValidateProductCsv = parseAndValidateProductCsv;
const index_js_1 = require("../schemas/index.js");
exports.SAMPLE_CSV_TEMPLATE = `categoryName,subcategoryName,productName,brand,measurementType,baseUnit,variantName,sku,size,purchasePriceRs,sellingPriceRs,taxRatePercent,openingStock,minStockLevel,rackLocation,barcode
Plumbing,CPVC Pipes,CPVC Pipe,Astral,length,mm,25mm Standard,PLUM-CPVC-25M-101,25mm,120,160,18,20,5,Rack A-1,
Plumbing,Pipe Fittings,CPVC Elbow 90 Deg,Astral,count,piece,25mm 90 Elbow,PLUM-ELB-25M-102,25mm,25,35,18,50,10,Bin 4,
Paints,Enamel Paint,Premium Gloss Enamel,Asian Paints,volume,ml,1 Litre White,PNT-GLS-1LW-104,1 L,280,350,18,15,3,Shelf P-1,
Fasteners,Screws,Drywall Screw,Hilti,count,piece,1.5 inch Box,FST-SCRW-15B-105,1.5 inch,180,240,18,30,5,Box Bay 2,
`;
/**
 * Parses CSV text into array of rows and validates them.
 */
function parseAndValidateProductCsv(csvContent) {
    const lines = csvContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    if (lines.length < 2) {
        return {
            totalRows: 0,
            validRows: [],
            errors: [{ rowNumber: 1, message: 'CSV file is empty or missing data rows' }],
            duplicateSkus: [],
        };
    }
    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim());
    const validRows = [];
    const errors = [];
    const seenSkus = new Set();
    const duplicateSkus = [];
    for (let i = 1; i < lines.length; i++) {
        const rawValues = lines[i].split(',').map((v) => v.trim());
        if (rawValues.length === 0 || (rawValues.length === 1 && rawValues[0] === '')) {
            continue;
        }
        const rowObj = {};
        headers.forEach((header, colIdx) => {
            rowObj[header] = rawValues[colIdx] ?? '';
        });
        // Type coercion for numbers
        if (rowObj.purchasePriceRs)
            rowObj.purchasePriceRs = parseFloat(rowObj.purchasePriceRs);
        if (rowObj.sellingPriceRs)
            rowObj.sellingPriceRs = parseFloat(rowObj.sellingPriceRs);
        if (rowObj.taxRatePercent)
            rowObj.taxRatePercent = parseFloat(rowObj.taxRatePercent);
        if (rowObj.openingStock)
            rowObj.openingStock = parseFloat(rowObj.openingStock);
        if (rowObj.minStockLevel)
            rowObj.minStockLevel = parseFloat(rowObj.minStockLevel);
        const parseResult = index_js_1.bulkImportProductRowSchema.safeParse(rowObj);
        if (!parseResult.success) {
            for (const issue of parseResult.error.issues) {
                errors.push({
                    rowNumber: i + 1,
                    sku: rowObj.sku,
                    field: issue.path.join('.'),
                    message: issue.message,
                });
            }
        }
        else {
            const data = parseResult.data;
            if (seenSkus.has(data.sku.toUpperCase())) {
                duplicateSkus.push(data.sku);
                errors.push({
                    rowNumber: i + 1,
                    sku: data.sku,
                    field: 'sku',
                    message: `Duplicate SKU '${data.sku}' found within file`,
                });
            }
            else {
                seenSkus.add(data.sku.toUpperCase());
                validRows.push(data);
            }
        }
    }
    return {
        totalRows: lines.length - 1,
        validRows,
        errors,
        duplicateSkus,
    };
}
//# sourceMappingURL=csvImport.js.map