export type MeasurementType = 'count' | 'length' | 'weight' | 'volume' | 'pack';

export type StandardUnit =
  // Count
  | 'piece'
  | 'set'
  | 'box'
  | 'pack'
  // Length
  | 'mm'
  | 'cm'
  | 'm'
  | 'ft'
  | 'inch'
  // Weight
  | 'g'
  | 'kg'
  // Volume
  | 'ml'
  | 'l';

export interface UnitConversionRule {
  fromUnit: StandardUnit;
  toUnit: StandardUnit;
  ratio: number; // e.g., 1 m = 1000 mm, 1 box = 12 pieces
}

// Canonical base units:
// count -> piece
// length -> mm
// weight -> g
// volume -> ml

export const LENGTH_CONVERSIONS_TO_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  inch: 25.4,
  ft: 304.8,
};

export const WEIGHT_CONVERSIONS_TO_GRAM: Record<string, number> = {
  g: 1,
  kg: 1000,
};

export const VOLUME_CONVERSIONS_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
};

/**
 * Converts length from one unit to another via millimetres.
 */
export function convertLength(
  value: number,
  fromUnit: 'mm' | 'cm' | 'm' | 'ft' | 'inch',
  toUnit: 'mm' | 'cm' | 'm' | 'ft' | 'inch'
): number {
  if (fromUnit === toUnit) return value;
  const mm = value * (LENGTH_CONVERSIONS_TO_MM[fromUnit] ?? 1);
  const result = mm / (LENGTH_CONVERSIONS_TO_MM[toUnit] ?? 1);
  // Round to 4 decimal places to avoid floating point artifacts
  return Math.round(result * 10000) / 10000;
}

/**
 * Converts weight from one unit to another via grams.
 */
export function convertWeight(
  value: number,
  fromUnit: 'g' | 'kg',
  toUnit: 'g' | 'kg'
): number {
  if (fromUnit === toUnit) return value;
  const grams = value * (WEIGHT_CONVERSIONS_TO_GRAM[fromUnit] ?? 1);
  const result = grams / (WEIGHT_CONVERSIONS_TO_GRAM[toUnit] ?? 1);
  return Math.round(result * 10000) / 10000;
}

/**
 * Converts volume from one unit to another via millilitres.
 */
export function convertVolume(
  value: number,
  fromUnit: 'ml' | 'l',
  toUnit: 'ml' | 'l'
): number {
  if (fromUnit === toUnit) return value;
  const ml = value * (VOLUME_CONVERSIONS_TO_ML[fromUnit] ?? 1);
  const result = ml / (VOLUME_CONVERSIONS_TO_ML[toUnit] ?? 1);
  return Math.round(result * 10000) / 10000;
}

/**
 * Canonical base unit converter for any product measurement type.
 */
export function toCanonicalBaseQuantity(
  quantity: number,
  unit: StandardUnit,
  measurementType: MeasurementType,
  packMultiplier: number = 1
): number {
  switch (measurementType) {
    case 'length':
      return Math.round(quantity * (LENGTH_CONVERSIONS_TO_MM[unit] ?? 1));
    case 'weight':
      return Math.round(quantity * (WEIGHT_CONVERSIONS_TO_GRAM[unit] ?? 1));
    case 'volume':
      return Math.round(quantity * (VOLUME_CONVERSIONS_TO_ML[unit] ?? 1));
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
export function fromCanonicalBaseQuantity(
  baseQuantity: number,
  toUnit: StandardUnit,
  measurementType: MeasurementType,
  packMultiplier: number = 1
): number {
  switch (measurementType) {
    case 'length':
      return Math.round((baseQuantity / (LENGTH_CONVERSIONS_TO_MM[toUnit] ?? 1)) * 1000) / 1000;
    case 'weight':
      return Math.round((baseQuantity / (WEIGHT_CONVERSIONS_TO_GRAM[toUnit] ?? 1)) * 1000) / 1000;
    case 'volume':
      return Math.round((baseQuantity / (VOLUME_CONVERSIONS_TO_ML[toUnit] ?? 1)) * 1000) / 1000;
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
 * Normalizes common unit alias strings (e.g. 'liter', 'litres', 'pcs', 'kgs') to their canonical StandardUnit.
 */
export function normalizeUnit(rawUnit?: string): StandardUnit {
  if (!rawUnit) return 'piece';
  const u = rawUnit.trim().toLowerCase();
  if (u === 'l' || u === 'liter' || u === 'litre' || u === 'liters' || u === 'litres') return 'l';
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre' || u === 'milliliters') return 'ml';
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms' || u === 'kgs') return 'kg';
  if (u === 'g' || u === 'gram' || u === 'grams' || u === 'gm') return 'g';
  if (u === 'm' || u === 'meter' || u === 'metre' || u === 'meters' || u === 'metres' || u === 'mtr') return 'm';
  if (u === 'mm' || u === 'millimeter' || u === 'millimetre') return 'mm';
  if (u === 'cm' || u === 'centimeter' || u === 'centimetre') return 'cm';
  if (u === 'ft' || u === 'feet' || u === 'foot') return 'ft';
  if (u === 'inch' || u === 'inches' || u === 'in') return 'inch';
  if (u === 'piece' || u === 'pcs' || u === 'pc' || u === 'pieces' || u === 'unit' || u === 'units') return 'piece';
  if (u === 'box' || u === 'boxes') return 'box';
  if (u === 'pack' || u === 'packs' || u === 'pkt') return 'pack';
  if (u === 'set' || u === 'sets') return 'set';
  return (u as StandardUnit) || 'piece';
}

/**
 * Convert quantity from a transaction unit (e.g. 'l', 'ml', 'box') into the product's native stock unit (e.g. 'l', 'piece').
 */
export function convertQuantityToProductUnit(
  quantity: number,
  fromUnit?: string,
  productBaseUnit?: string,
  measurementType?: MeasurementType,
  packMultiplier: number = 1
): number {
  const normFrom = normalizeUnit(fromUnit);
  const normBase = normalizeUnit(productBaseUnit);

  if (!fromUnit || normFrom === normBase) {
    return quantity;
  }

  // Volume conversions (ml <-> l)
  if ((normFrom === 'ml' || normFrom === 'l') && (normBase === 'ml' || normBase === 'l')) {
    const ml = normFrom === 'l' ? quantity * 1000 : quantity;
    return normBase === 'l' ? Math.round((ml / 1000) * 10000) / 10000 : ml;
  }

  // Weight conversions (g <-> kg)
  if ((normFrom === 'g' || normFrom === 'kg') && (normBase === 'g' || normBase === 'kg')) {
    const g = normFrom === 'kg' ? quantity * 1000 : quantity;
    return normBase === 'kg' ? Math.round((g / 1000) * 10000) / 10000 : g;
  }

  // Length conversions (mm, cm, m, ft, inch)
  const lengthUnits = ['mm', 'cm', 'm', 'ft', 'inch'];
  if (lengthUnits.includes(normFrom) && lengthUnits.includes(normBase)) {
    return convertLength(quantity, normFrom as any, normBase as any);
  }

  // Pack / Count conversions (box/pack <-> piece)
  if ((normFrom === 'box' || normFrom === 'pack') && normBase === 'piece') {
    return quantity * (packMultiplier || 1);
  }
  if (normFrom === 'piece' && (normBase === 'box' || normBase === 'pack')) {
    return packMultiplier > 0 ? quantity / packMultiplier : quantity;
  }

  return quantity;
}
