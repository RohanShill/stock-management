import { bulkImportProductRowSchema } from '../schemas/index.js';
import { z } from 'zod';
export type BulkImportProductRow = z.infer<typeof bulkImportProductRowSchema>;
export interface CsvValidationRowError {
    rowNumber: number;
    sku?: string;
    field?: string;
    message: string;
}
export interface CsvParseResult {
    totalRows: number;
    validRows: BulkImportProductRow[];
    errors: CsvValidationRowError[];
    duplicateSkus: string[];
}
export declare const SAMPLE_CSV_TEMPLATE = "categoryName,subcategoryName,productName,brand,measurementType,baseUnit,variantName,sku,size,purchasePriceRs,sellingPriceRs,taxRatePercent,openingStock,minStockLevel,rackLocation,barcode\nPlumbing,CPVC Pipes,CPVC Pipe,Astral,length,mm,25mm Standard,PLUM-CPVC-25M-101,25mm,120,160,18,20,5,Rack A-1,\nPlumbing,Pipe Fittings,CPVC Elbow 90 Deg,Astral,count,piece,25mm 90 Elbow,PLUM-ELB-25M-102,25mm,25,35,18,50,10,Bin 4,\nPaints,Enamel Paint,Premium Gloss Enamel,Asian Paints,volume,ml,1 Litre White,PNT-GLS-1LW-104,1 L,280,350,18,15,3,Shelf P-1,\nFasteners,Screws,Drywall Screw,Hilti,count,piece,1.5 inch Box,FST-SCRW-15B-105,1.5 inch,180,240,18,30,5,Box Bay 2,\n";
/**
 * Parses CSV text into array of rows and validates them.
 */
export declare function parseAndValidateProductCsv(csvContent: string): CsvParseResult;
//# sourceMappingURL=csvImport.d.ts.map