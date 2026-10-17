"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSku = generateSku;
/**
 * Generates an auditable, formatted SKU for a hardware product variant.
 * Example: PLUM-CPVC-ELB-25-1049
 */
function generateSku(categoryName, productName, variantSize) {
    const catCode = categoryName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'ITEM';
    const prodCode = productName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'PROD';
    const sizeCode = (variantSize || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'STD';
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${catCode}-${prodCode}-${sizeCode}-${randSuffix}`;
}
//# sourceMappingURL=sku.js.map