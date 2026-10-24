import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReferencePlan, lockReferenceDimensions, REFERENCE_PLAN_JSON_SCHEMA } from './reference-image-plan.ts';

const fixture = () => ({
  version: '0.1',
  project_name: 'Sample tropical villa',
  units: 'm',
  building: {
    width: 12, depth: 16, floors: 2, floor_height: 3.5,
    wall_thickness: 0.2, roof_type: 'flat', roof_overhang: 0.45
  },
  facade: { glazing_ratio: 0.55, balcony: true, balcony_depth: 1.2, vertical_fins: 4 },
  materials: { walls: '#DFD6C6', slab: '#B5ADA4', roof: '#4B4B4B', glass: '#5F8EAB', timber: '#866040' },
  assumptions: ['Rear elevation unknown'],
  unknowns: ['No reliable floor plan available']
});

test('accepts a bounded review-only concept plan', () => {
  assert.deepEqual(validateReferencePlan(fixture()), []);
});
test('rejects unsupported roof types', () => {
  const plan = fixture(); plan.building.roof_type = 'hip';
  assert.ok(validateReferencePlan(plan).includes('ROOF_NOT_SUPPORTED'));
});
test('rejects structurally impossible front piers', () => {
  const plan = fixture(); plan.building.width = 3; plan.building.wall_thickness = 0.5; plan.facade.glazing_ratio = 0.85;
  assert.ok(validateReferencePlan(plan).includes('FRONT_PIERS_TOO_NARROW'));
});
test('rejects invalid units, floors, sizes and colors', () => {
  const plan = fixture(); plan.units = 'inch'; plan.building.floors = 9; plan.materials.glass = 'blue';
  const errors = validateReferencePlan(plan);
  assert.ok(errors.includes('UNITS_UNSUPPORTED'));
  assert.ok(errors.includes('FLOORS_INVALID'));
  assert.ok(errors.includes('COLOR_INVALID_GLASS'));
});
test('dimensions are overridden by user-provided measurements', () => {
  const plan = lockReferenceDimensions(fixture(), 18, 22);
  assert.equal(plan.building.width, 18);
  assert.equal(plan.building.depth, 22);
  assert.match(plan.assumptions.at(-1), /provided by the user/);
  assert.deepEqual(validateReferencePlan(plan), []);
});
test('rejects out-of-range user footprint', () => {
  assert.throws(() => lockReferenceDimensions(fixture(), 2.9, 22), /FOOTPRINT_OUT_OF_RANGE/);
});
test('structured output schema forbids unexpected top-level properties', () => {
  assert.equal(REFERENCE_PLAN_JSON_SCHEMA.additionalProperties, false);
  assert.deepEqual(REFERENCE_PLAN_JSON_SCHEMA.required,
    ['version','project_name','units','building','facade','materials','assumptions','unknowns']);
});
