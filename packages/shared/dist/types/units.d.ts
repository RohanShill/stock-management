export type MeasurementType = 'count' | 'length' | 'weight' | 'volume' | 'pack';
export type StandardUnit = 'piece' | 'set' | 'box' | 'pack' | 'mm' | 'cm' | 'm' | 'ft' | 'inch' | 'g' | 'kg' | 'ml' | 'l';
export interface UnitConversionRule {
    fromUnit: StandardUnit;
    toUnit: StandardUnit;
    ratio: number;
}
export declare const LENGTH_CONVERSIONS_TO_MM: Record<string, number>;
export declare const WEIGHT_CONVERSIONS_TO_GRAM: Record<string, number>;
export declare const VOLUME_CONVERSIONS_TO_ML: Record<string, number>;
/**
 * Converts length from one unit to another via millimetres.
 */
export declare function convertLength(value: number, fromUnit: 'mm' | 'cm' | 'm' | 'ft' | 'inch', toUnit: 'mm' | 'cm' | 'm' | 'ft' | 'inch'): number;
/**
 * Converts weight from one unit to another via grams.
 */
export declare function convertWeight(value: number, fromUnit: 'g' | 'kg', toUnit: 'g' | 'kg'): number;
/**
 * Converts volume from one unit to another via millilitres.
 */
export declare function convertVolume(value: number, fromUnit: 'ml' | 'l', toUnit: 'ml' | 'l'): number;
/**
 * Canonical base unit converter for any product measurement type.
 */
export declare function toCanonicalBaseQuantity(quantity: number, unit: StandardUnit, measurementType: MeasurementType, packMultiplier?: number): number;
/**
 * Convert canonical base quantity to a requested display unit.
 */
export declare function fromCanonicalBaseQuantity(baseQuantity: number, toUnit: StandardUnit, measurementType: MeasurementType, packMultiplier?: number): number;
/**
 * Normalizes common unit alias strings (e.g. 'liter', 'litres', 'pcs', 'kgs') to their canonical StandardUnit.
 */
export declare function normalizeUnit(rawUnit?: string): StandardUnit;
/**
 * Convert quantity from a transaction unit (e.g. 'l', 'ml', 'box') into the product's native stock unit (e.g. 'l', 'piece').
 */
export declare function convertQuantityToProductUnit(quantity: number, fromUnit?: string, productBaseUnit?: string, measurementType?: MeasurementType, packMultiplier?: number): number;
//# sourceMappingURL=units.d.ts.map