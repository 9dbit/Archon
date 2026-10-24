/**
 * ARCHON reference-image -> conceptual SketchUp plan contract.
 * This is NOT BIM, reconstruction of hidden geometry, or a drawing authorization.
 */
export type ReferencePlan = {
  version: '0.1';
  project_name: string;
  units: 'm';
  building: {
    width: number; depth: number; floors: number; floor_height: number;
    wall_thickness: number; roof_type: 'flat'; roof_overhang: number;
  };
  facade: {
    glazing_ratio: number; balcony: boolean; balcony_depth: number;
    vertical_fins: number;
  };
  materials: {
    walls: string; slab: string; roof: string; glass: string; timber: string;
  };
  assumptions: string[];
  unknowns: string[];
};

const number = { type: 'number' } as const;
const integer = { type: 'integer' } as const;
const string = { type: 'string' } as const;

export const REFERENCE_PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'project_name', 'units', 'building', 'facade', 'materials', 'assumptions', 'unknowns'],
  properties: {
    version: { type: 'string', enum: ['0.1'] },
    project_name: string,
    units: { type: 'string', enum: ['m'] },
    building: {
      type: 'object', additionalProperties: false,
      required: ['width', 'depth', 'floors', 'floor_height', 'wall_thickness', 'roof_type', 'roof_overhang'],
      properties: {
        width: number, depth: number, floors: integer, floor_height: number,
        wall_thickness: number, roof_type: { type: 'string', enum: ['flat'] },
        roof_overhang: number
      }
    },
    facade: {
      type: 'object', additionalProperties: false,
      required: ['glazing_ratio', 'balcony', 'balcony_depth', 'vertical_fins'],
      properties: {
        glazing_ratio: number, balcony: { type: 'boolean' }, balcony_depth: number,
        vertical_fins: integer
      }
    },
    materials: {
      type: 'object', additionalProperties: false,
      required: ['walls', 'slab', 'roof', 'glass', 'timber'],
      properties: { walls: string, slab: string, roof: string, glass: string, timber: string }
    },
    assumptions: { type: 'array', items: string },
    unknowns: { type: 'array', items: string }
  }
} as const;

const range = (v: unknown, min: number, max: number): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const whole = (v: unknown, min: number, max: number): boolean =>
  Number.isInteger(v) && range(v, min, max);
const hex = (v: unknown): boolean => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const textArray = (v: unknown): boolean =>
  Array.isArray(v) && v.length <= 20 &&
  v.every(x => typeof x === 'string' && x.length <= 500);

export function validateReferencePlan(plan: unknown): string[] {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return ['PLAN_NOT_OBJECT'];
  const p = plan as Record<string, unknown>;
  const b = p.building && typeof p.building === 'object' && !Array.isArray(p.building)
    ? p.building as Record<string, unknown> : {};
  const f = p.facade && typeof p.facade === 'object' && !Array.isArray(p.facade)
    ? p.facade as Record<string, unknown> : {};
  const m = p.materials && typeof p.materials === 'object' && !Array.isArray(p.materials)
    ? p.materials as Record<string, unknown> : {};
  const findings: string[] = [];
  const check = (ok: boolean, name: string) => { if (!ok) findings.push(name); };

  check(p.version === '0.1', 'VERSION_UNSUPPORTED');
  check(p.units === 'm', 'UNITS_UNSUPPORTED');
  check(typeof p.project_name === 'string' && p.project_name.trim().length > 0 && p.project_name.length <= 100, 'PROJECT_NAME_INVALID');
  check(range(b.width, 3, 50), 'WIDTH_INVALID');
  check(range(b.depth, 3, 50), 'DEPTH_INVALID');
  check(whole(b.floors, 1, 4), 'FLOORS_INVALID');
  check(range(b.floor_height, 2.5, 5), 'FLOOR_HEIGHT_INVALID');
  check(range(b.wall_thickness, 0.12, 0.5), 'WALL_THICKNESS_INVALID');
  check(b.roof_type === 'flat', 'ROOF_NOT_SUPPORTED');
  check(range(b.roof_overhang, 0, 1.5), 'OVERHANG_INVALID');
  check(range(f.glazing_ratio, 0.20, 0.85), 'GLAZING_INVALID');
  check(typeof f.balcony === 'boolean', 'BALCONY_INVALID');
  check(range(f.balcony_depth, 0.6, 2.4), 'BALCONY_DEPTH_INVALID');
  check(whole(f.vertical_fins, 0, 20), 'FINS_INVALID');
  if (range(b.width, 3, 50) && range(b.wall_thickness, 0.12, 0.5) && range(f.glazing_ratio, 0.20, 0.85)) {
    check((b.width as number) * (1 - (f.glazing_ratio as number)) / 2 > (b.wall_thickness as number) + 0.05, 'FRONT_PIERS_TOO_NARROW');
  }
  for (const key of ['walls', 'slab', 'roof', 'glass', 'timber']) check(hex(m[key]), 'COLOR_INVALID_' + key.toUpperCase());
  check(textArray(p.assumptions), 'ASSUMPTIONS_INVALID');
  check(textArray(p.unknowns), 'UNKNOWNS_INVALID');
  return findings;
}

export function lockReferenceDimensions(plan: ReferencePlan, widthM: number, depthM: number): ReferencePlan {
  if (!range(widthM, 3, 50) || !range(depthM, 3, 50)) throw new Error('FOOTPRINT_OUT_OF_RANGE');
  const assumptions = [
    ...plan.assumptions.filter(x => x !== 'Footprint dimensions are provided by the user (not recovered from the image).').slice(0, 19),
    'Footprint dimensions are provided by the user (not recovered from the image).'
  ];
  return {
    ...plan,
    building: { ...plan.building, width: widthM, depth: depthM },
    assumptions
  };
}
