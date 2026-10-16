/**
 * The backend has no destination categories, so the icon is picked from keywords in the name.
 * Icons are Material Icons (Outlined) ligatures — the font is loaded in index.html.
 */
export interface PlaceIcon {
  icon: string;
  color: string;
}

const RULES: { pattern: RegExp; icon: PlaceIcon }[] = [
  { pattern: /pharm|chemist|dispens|medicine/i, icon: { icon: 'local_pharmacy', color: '#12A150' } },
  { pattern: /emergency|casualty|\ber\b|trauma/i, icon: { icon: 'emergency', color: '#E53935' } },
  { pattern: /cardi|heart/i, icon: { icon: 'favorite', color: '#E53935' } },
  { pattern: /cafe|canteen|food|restaurant|coffee|dining|court/i, icon: { icon: 'restaurant', color: '#F39C12' } },
  { pattern: /radiol|x-?ray|mri|\bct\b|scan|imaging/i, icon: { icon: 'biotech', color: '#7C4DFF' } },
  { pattern: /lab/i, icon: { icon: 'science', color: '#1E88E5' } },
  { pattern: /nurs/i, icon: { icon: 'medical_services', color: '#D81B60' } },
  { pattern: /doctor|clinic|opd|consult|ward|icu|surg/i, icon: { icon: 'local_hospital', color: '#E53935' } },
  { pattern: /lift|elevator/i, icon: { icon: 'elevator', color: '#5C6BC0' } },
  { pattern: /stair|escalator/i, icon: { icon: 'stairs', color: '#F39C12' } },
  { pattern: /toilet|restroom|washroom|\bwc\b|bathroom/i, icon: { icon: 'wc', color: '#00897B' } },
  { pattern: /wait|lounge|seat/i, icon: { icon: 'event_seat', color: '#64748B' } },
  { pattern: /recep|info|help|desk|counter/i, icon: { icon: 'support_agent', color: '#2F6BFF' } },
  { pattern: /entr|exit|gate|door|lobby/i, icon: { icon: 'meeting_room', color: '#2F6BFF' } },
  { pattern: /park/i, icon: { icon: 'local_parking', color: '#1E88E5' } },
  { pattern: /atm|bank|cash/i, icon: { icon: 'local_atm', color: '#12A150' } },
  { pattern: /shop|store|mart|boutique/i, icon: { icon: 'storefront', color: '#F39C12' } },
];

const DEFAULT_ICON: PlaceIcon = { icon: 'place', color: '#2F6BFF' };

export function placeIcon(name: string): PlaceIcon {
  return RULES.find((rule) => rule.pattern.test(name))?.icon ?? DEFAULT_ICON;
}

/** Short floor code for labels: 0 → G, -1 → B1, 2 → 2. */
export function floorCode(floorNumber: number): string {
  if (floorNumber === 0) return 'G';
  return floorNumber < 0 ? `B${-floorNumber}` : String(floorNumber);
}

/** Same walking pace the backend uses for its route ETA (~80 plan units per minute). */
export const UNITS_PER_MINUTE = 80;

export function minutesFor(distanceUnits: number): number {
  return Math.max(1, Math.ceil(distanceUnits / UNITS_PER_MINUTE));
}
