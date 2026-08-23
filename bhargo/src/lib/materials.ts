// Catalog of things a house build actually consumes. `key` is what gets stored
// on a purchase row, so renaming a label is safe but renaming a key is not.
//
// `driftPct` is how much this material's price normally moves in a year, on its
// own, with nobody cheating anybody. Sand and steel move faster than tiles.
// The comparison engine uses it to separate "the market went up" from
// "this supplier is charging me more".

export interface MaterialDef {
  key: string;
  label: string;
  unit: string;
  driftPct: number;
  /** Billed as a lump sum (one "lot"), so the unit rate is really a total. */
  lumpSum?: boolean;
}

export const MATERIALS: MaterialDef[] = [
  { key: "cement", label: "Cement", unit: "bag (50kg)", driftPct: 5 },
  { key: "steel", label: "TMT steel", unit: "kg", driftPct: 7 },
  { key: "sand", label: "Sand", unit: "cft", driftPct: 8 },
  { key: "aggregate", label: "Aggregate / gravel", unit: "cft", driftPct: 7 },
  { key: "bricks", label: "Bricks", unit: "1000 nos", driftPct: 6 },
  { key: "blocks", label: "Concrete blocks", unit: "nos", driftPct: 5 },
  { key: "stone", label: "Stone / soling", unit: "cft", driftPct: 7 },
  { key: "timber", label: "Timber", unit: "cft", driftPct: 6 },
  { key: "tiles", label: "Floor tiles", unit: "sqft", driftPct: 4 },
  { key: "marble", label: "Marble / granite", unit: "sqft", driftPct: 4 },
  { key: "paint", label: "Paint", unit: "litre", driftPct: 5 },
  { key: "putty", label: "Wall putty", unit: "bag", driftPct: 5 },
  { key: "doors", label: "Doors", unit: "nos", driftPct: 5 },
  { key: "windows", label: "Windows", unit: "nos", driftPct: 5 },
  { key: "roofing", label: "Roofing sheets", unit: "sqft", driftPct: 5 },
  { key: "plumbing", label: "Plumbing (pipes + fittings)", unit: "lot", driftPct: 5, lumpSum: true },
  { key: "wiring", label: "Electrical wiring + fittings", unit: "lot", driftPct: 5, lumpSum: true },
  { key: "sanitary", label: "Sanitary ware", unit: "lot", driftPct: 5, lumpSum: true },
  { key: "glass", label: "Glass / glazing", unit: "sqft", driftPct: 4 },
  { key: "hardware", label: "Hardware (nails, binding wire, etc.)", unit: "lot", driftPct: 5, lumpSum: true },
  { key: "other", label: "Other", unit: "lot", driftPct: 5, lumpSum: true },
];

const BY_KEY = new Map(MATERIALS.map((m) => [m.key, m]));

export function material(key: string): MaterialDef {
  return BY_KEY.get(key) ?? { key, label: key, unit: "unit", driftPct: 5 };
}

export function materialLabel(key: string): string {
  return material(key).label;
}

/** Annual drift for a material, falling back to the account-wide setting. */
export function driftFor(key: string, fallbackPct: number): number {
  return BY_KEY.get(key)?.driftPct ?? fallbackPct;
}
