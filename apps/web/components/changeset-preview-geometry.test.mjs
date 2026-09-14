import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildGeometryDiff, formatGeometryTuple } from './changeset-preview-geometry.ts';

const objects = [
  { archonId: 'south', parameters: { label: 'South wall', positionMm: [0, 0, 10000], sizeMm: [12000, 3000, 200] } },
  { archonId: 'north', parameters: { label: 'North wall', positionMm: [0, 0, 0], sizeMm: [12000, 3000, 200] } },
  { archonId: 'kitchen', parameters: { label: 'Kitchen', positionMm: [1000, 0, 2000], sizeMm: [5000, 3000, 6000] } }
];
const move = (targetId, deltaZmm) => ({ type: 'MOVE', targetId, payload: { deltaZmm } });
const resize = (targetId, payload) => ({ type: 'UPDATE', targetId, payload });

function freeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return value;
}

test('reviewed move recalculates from canonical geometry and reset does not accumulate', () => {
  const initial = buildGeometryDiff(objects, [move('south', 500)]).rows[0];
  const edited = buildGeometryDiff(objects, [move('south', 750)]).rows[0];
  const reset = buildGeometryDiff(objects, [move('south', 500)]).rows[0];
  assert.deepEqual(initial.before.position, [0, 0, 10000]);
  assert.deepEqual(initial.after.position, [0, 0, 10500]);
  assert.deepEqual(edited.after.position, [0, 0, 10750]);
  assert.deepEqual(reset, initial);
  assert.deepEqual(edited.fields, ['Z']);
});

test('reviewed target changes replace the diff target and baseline', () => {
  const { rows, unavailableTargetIds } = buildGeometryDiff(objects, [move('north', -250)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].object.archonId, 'north');
  assert.deepEqual(rows[0].before.position, [0, 0, 0]);
  assert.deepEqual(rows[0].after.position, [0, 0, -250]);
  assert.deepEqual(unavailableTargetIds, []);
});

test('UPDATE edits dimensions without changing canonical position', () => {
  const row = buildGeometryDiff(objects, [resize('kitchen', { widthMm: 7200, heightMm: 3200, depthMm: 6400 })]).rows[0];
  assert.deepEqual(row.before.size, [5000, 3000, 6000]);
  assert.deepEqual(row.after.size, [7200, 3200, 6400]);
  assert.deepEqual(row.after.position, row.before.position);
  assert.deepEqual(row.fields, ['W', 'H', 'D']);
});

test('multiple operations compose in order per target and preserve all inputs', () => {
  const input = freeze(structuredClone(objects));
  const operations = freeze([
    move('south', 500), resize('kitchen', { widthMm: 7000 }), move('south', -125),
    resize('kitchen', { widthMm: 7200 }), { type: 'MOVE', targetId: 'south', payload: { deltaXmm: 20, deltaYmm: 30 } }
  ]);
  const snapshot = JSON.stringify({ input, operations });
  const { rows } = buildGeometryDiff(input, operations);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].after.position, [20, 30, 10375]);
  assert.deepEqual(rows[0].fields, ['X', 'Y', 'Z']);
  assert.equal(rows[1].after.size[0], 7200);
  rows[0].after.position[0] = 999;
  rows[0].before.size[0] = 999;
  assert.equal(JSON.stringify({ input, operations }), snapshot);
});

test('missing geometry, unknown targets and unsupported operations are explicit', () => {
  const input = [...objects, { archonId: 'label', parameters: { label: 'Label only' } }];
  const result = buildGeometryDiff(input, [
    move('missing', 500), move('label', 500), move('label', 250),
    { type: 'DELETE', targetId: 'south', payload: {} }
  ]);
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.unavailableTargetIds, ['missing', 'label', 'south']);
});

test('nonfinite geometry and overflow never become a numeric preview', () => {
  assert.equal(buildGeometryDiff([{ archonId: 'bad', parameters: { positionMm: [0, NaN, 0], sizeMm: [1, 1, 1] } }], [move('bad', 1)]).rows.length, 0);
  assert.deepEqual(buildGeometryDiff(objects, [move('south', Infinity)]).unavailableTargetIds, ['south']);
  const input = [{ archonId: 'huge', parameters: { positionMm: [0, 0, Number.MAX_VALUE], sizeMm: [1, 1, 1] } }];
  assert.equal(buildGeometryDiff(input, [move('huge', Number.MAX_VALUE)]).rows.length, 0);
});

test('empty operations, no-op moves and blank optional axes are handled', () => {
  assert.deepEqual(buildGeometryDiff(objects, []), { rows: [], unavailableTargetIds: [] });
  const row = buildGeometryDiff(objects, [{ type: 'MOVE', targetId: 'south', payload: { deltaXmm: undefined, deltaZmm: 0 } }]).rows[0];
  assert.deepEqual(row.fields, []);
  assert.deepEqual(row.before, row.after);
});

test('fractional millimeters remain visible instead of rounding edits away', () => {
  const row = buildGeometryDiff(objects, [move('north', 0.25)]).rows[0];
  assert.deepEqual(row.fields, ['Z']);
  assert.equal(formatGeometryTuple(row.after.position), '0 mm / 0 mm / 0.25 mm');
});

// Verify the JSX wiring as well as the pure geometry calculation without a browser dependency.
function sourceFile(name) {
  return ts.createSourceFile(name, readFileSync(new URL(name, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function findAll(root, predicate) {
  const matches = [];
  function visit(node) { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); }
  visit(root);
  return matches;
}

test('Command Center binds the live panel and submit body to reviewed operations', () => {
  const source = sourceFile('./command-prompt-center.tsx');
  const panels = findAll(source, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'ChangeSetPreviewPanel');
  assert.equal(panels.length, 1);
  const attr = name => panels[0].attributes.properties.find(item => item.name?.getText(source) === name);
  assert.equal(attr('operations').initializer.expression.getText(source), 'reviewedOperations');
  assert.equal(attr('objects').initializer.expression.getText(source), 'objects');
  assert.equal(attr('variant').initializer.text, 'reviewed');
  assert.equal(attr('findings'), undefined);
  assert.match(panels[0].parent.getText(source), /reviewErrors.length > 0/);
  const submits = findAll(source, node => ts.isCallExpression(node) && node.expression.getText(source) === 'JSON.stringify' && node.arguments[0]?.getText(source).includes('intentSummary:'));
  assert.equal(submits.length, 1);
  assert.match(submits[0].arguments[0].getText(source), /operations: reviewedOperations/);
});

test('reviewed and active diffs retain different anchors and validation labels', () => {
  const source = sourceFile('./changeset-preview-panel.tsx');
  const id = findAll(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === 'id')[0];
  assert.equal(id.initializer.condition.getText(source), 'reviewed');
  assert.equal(id.initializer.whenTrue.text, 'command-reviewed-preview');
  assert.equal(id.initializer.whenFalse.text, 'changeset-preview');
  assert.ok(source.text.includes('Validation pending'));
  assert.ok(source.text.includes('No approval or APS/DWG execution.'));
});
