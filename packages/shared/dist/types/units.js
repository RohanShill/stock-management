"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOLUME_CONVERSIONS_TO_ML = exports.WEIGHT_CONVERSIONS_TO_GRAM = exports.LENGTH_CONVERSIONS_TO_MM = void 0;
exports.convertLength = convertLength;
exports.convertWeight = convertWeight;
exports.convertVolume = convertVolume;
exports.toCanonicalBaseQuantity = toCanonicalBaseQuantity;
exports.fromCanonicalBaseQuantity = fromCanonicalBaseQuantity;
exports.convertQuantityToProductUnit = convertQuantityToProductUnit;
// Canonical base units:
// count -> piece
// length -> mm
// weight -> g
// volume -> ml
exports.LENGTH_CONVERSIONS_TO_MM = {
    mm: 1,
    cm: 10,
    m: 1000,
    inch: 25.4,
    ft: 304.8,
};
exports.WEIGHT_CONVERSIONS_TO_GRAM = {
    g: 1,
    kg: 1000,
};
exports.VOLUME_CONVERSIONS_TO_ML = {
    ml: 1,
    l: 1000,
};
/**
 * Converts length from one unit to another via millimetres.
 */
function convertLength(value, fromUnit, toUnit) {
    if (fromUnit === toUnit)
        return value;
    const mm = value * (exports.LENGTH_CONVERSIONS_TO_MM[fromUnit] ?? 1);
    const result = mm / (exports.LENGTH_CONVERSIONS_TO_MM[toUnit] ?? 1);
    // Round to 4 decimal places to avoid floating point artifacts
    return Math.round(result * 10000) / 10000;
}
/**
 * Converts weight from one unit to another via grams.
 */
function convertWeight(value, fromUnit, toUnit) {
    if (fromUnit === toUnit)
        return value;
    const grams = value * (exports.WEIGHT_CONVERSIONS_TO_GRAM[fromUnit] ?? 1);
    const result = grams / (exports.WEIGHT_CONVERSIONS_TO_GRAM[toUnit] ?? 1);
    return Math.round(result * 10000) / 10000;
}
/**
 * Converts volume from one unit to another via millilitres.
 */
function convertVolume(value, fromUnit, toUnit) {
    if (fromUnit === toUnit)
        return value;
    const ml = value * (exports.VOLUME_CONVERSIONS_TO_ML[fromUnit] ?? 1);
    const result = ml / (exports.VOLUME_CONVERSIONS_TO_ML[toUnit] ?? 1);
    return Math.round(result * 10000) / 10000;
}
/**
 * Canonical base unit converter for any product measurement type.
 */
function toCanonicalBaseQuantity(quantity, unit, measurementType, packMultiplier = 1) {
    switch (measurementType) {
        case 'length':
            return Math.round(quantity * (exports.LENGTH_CONVERSIONS_TO_MM[unit] ?? 1));
        case 'weight':
            return Math.round(quantity * (exports.WEIGHT_CONVERSIONS_TO_GRAM[unit] ?? 1));
        case 'volume':
            return Math.round(quantity * (exports.VOLUME_CONVERSIONS_TO_ML[unit] ?? 1));
        case 'pack':
            if (unit === 'box' || unit === 'pack') {
                return Math.round(quantity * packMultiplier);
            }
            return quantity;
        case 'count':
        default:
            if (unit === 'box' || unit === 'pack') {
                return Math.round(quantity * packMultiplier);
            }
            return quantity;
    }
}
/**
 * Convert canonical base quantity to a requested display unit.
 */
function fromCanonicalBaseQuantity(baseQuantity, toUnit, measurementType, packMultiplier = 1) {
    switch (measurementType) {
        case 'length':
            return Math.round((baseQuantity / (exports.LENGTH_CONVERSIONS_TO_MM[toUnit] ?? 1)) * 1000) / 1000;
        case 'weight':
            return Math.round((baseQuantity / (exports.WEIGHT_CONVERSIONS_TO_GRAM[toUnit] ?? 1)) * 1000) / 1000;
        case 'volume':
            return Math.round((baseQuantity / (exports.VOLUME_CONVERSIONS_TO_ML[toUnit] ?? 1)) * 1000) / 1000;
        case 'pack':
        case 'count':
            if (toUnit === 'box' || toUnit === 'pack') {
                return packMultiplier > 0 ? baseQuantity / packMultiplier : baseQuantity;
            }
            return baseQuantity;
        default:
            return baseQuantity;
    }
}
/**
 * Convert quantity from a transaction unit (e.g. 'l', 'ml', 'box') into the product's native stock unit (e.g. 'l', 'piece').
 */
function convertQuantityToProductUnit(quantity, fromUnit, productBaseUnit, measurementType, packMultiplier = 1) {
    const baseUnit = productBaseUnit || 'piece';
    if (!fromUnit || fromUnit === baseUnit) {
        return quantity;
    }
    // Volume conversions (ml <-> l)
    if ((fromUnit === 'ml' || fromUnit === 'l') && (baseUnit === 'ml' || baseUnit === 'l')) {
        const ml = fromUnit === 'l' ? quantity * 1000 : quantity;
        return baseUnit === 'l' ? Math.round((ml / 1000) * 10000) / 10000 : ml;
    }
    // Weight conversions (g <-> kg)
    if ((fromUnit === 'g' || fromUnit === 'kg') && (baseUnit === 'g' || baseUnit === 'kg')) {
        const g = fromUnit === 'kg' ? quantity * 1000 : quantity;
        return baseUnit === 'kg' ? Math.round((g / 1000) * 10000) / 10000 : g;
    }
    // Length conversions (mm, cm, m, ft, inch)
    const lengthUnits = ['mm', 'cm', 'm', 'ft', 'inch'];
    if (lengthUnits.includes(fromUnit) && lengthUnits.includes(baseUnit)) {
        return convertLength(quantity, fromUnit, baseUnit);
    }
    // Pack / Count conversions (box/pack <-> piece)
    if ((fromUnit === 'box' || fromUnit === 'pack') && baseUnit === 'piece') {
        return quantity * (packMultiplier || 1);
    }
    if (fromUnit === 'piece' && (baseUnit === 'box' || baseUnit === 'pack')) {
        return packMultiplier > 0 ? quantity / packMultiplier : quantity;
    }
    return quantity;
}
//# sourceMappingURL=units.js.map