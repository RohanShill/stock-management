/**
 * Utility functions for user-friendly formatting of measurement units.
 */

/**
 * Returns a human-friendly label for units, avoiding single letter ambiguities (e.g. 'l' looking like '|').
 */
export function formatUnitLabel(unit?: string): string {
  if (!unit) return 'Piece';
  const u = unit.trim().toLowerCase();
  switch (u) {
    case 'l':
    case 'liter':
    case 'litre':
    case 'liters':
    case 'litres':
      return 'Liter';
    case 'ml':
    case 'milliliter':
    case 'millilitre':
      return 'ml';
    case 'kg':
    case 'kilogram':
    case 'kilograms':
    case 'kgs':
      return 'kg';
    case 'g':
    case 'gram':
    case 'grams':
    case 'gm':
      return 'g';
    case 'm':
    case 'meter':
    case 'metre':
    case 'meters':
    case 'metres':
      return 'Meter';
    case 'mm':
    case 'millimeter':
      return 'mm';
    case 'cm':
    case 'centimeter':
      return 'cm';
    case 'ft':
    case 'feet':
    case 'foot':
      return 'ft';
    case 'inch':
    case 'inches':
    case 'in':
      return 'inch';
    case 'piece':
    case 'pieces':
    case 'pcs':
    case 'pc':
      return 'Piece';
    case 'box':
    case 'boxes':
      return 'Box';
    case 'pack':
    case 'packs':
      return 'Pack';
    case 'set':
    case 'sets':
      return 'Set';
    default:
      return unit.charAt(0).toUpperCase() + unit.slice(1);
  }
}

/**
 * Returns a concise tag label for badges in product cards and list views.
 */
export function formatUnitBadge(unit?: string): string {
  if (!unit) return 'Pcs';
  const u = unit.trim().toLowerCase();
  switch (u) {
    case 'l':
    case 'liter':
    case 'litre':
    case 'liters':
    case 'litres':
      return 'Liter (L)';
    case 'ml':
      return 'ml';
    case 'kg':
    case 'kgs':
      return 'Kg';
    case 'g':
    case 'gm':
      return 'g';
    case 'm':
    case 'meter':
      return 'Meter';
    case 'mm':
      return 'mm';
    case 'cm':
      return 'cm';
    case 'ft':
      return 'ft';
    case 'inch':
      return 'in';
    case 'box':
      return 'Box';
    case 'pack':
      return 'Pack';
    case 'set':
      return 'Set';
    case 'piece':
    case 'pcs':
    case 'pc':
      return 'Pcs';
    default:
      return unit.charAt(0).toUpperCase() + unit.slice(1);
  }
}
