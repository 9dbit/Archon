import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBuildingGraphV2Preview,
  classifySketchUpEntity
} from './building-graph.ts';

test('explicit ARCHON metadata wins over lexical signals', () => {
  const result = classifySketchUpEntity({
    name: 'Door-looking object',
    archon: { type: 'joinery' }
  });

  assert.equal(result.kind, 'JOINERY');
  assert.equal(result.source, 'EXPLICIT_METADATA');
  assert.equal(result.confidence, 1);
  assert.equal(result.reviewRequired, false);
});

test('classifies common Indonesian and English SketchUp naming signals', () => {
  assert.equal(classifySketchUpEntity({ tag: 'A-WALL' }).kind, 'WALL');
  assert.equal(classifySketchUpEntity({ name: 'Pintu Utama' }).kind, 'DOOR');
  assert.equal(classifySketchUpEntity({ definition: 'Jendela 1200' }).kind, 'WINDOW');
  assert.equal(classifySketchUpEntity({ tag: 'RCP - Plafon' }).kind, 'CEILING');
  assert.equal(classifySketchUpEntity({ name: 'Banquette Built In' }).kind, 'JOINERY');
});

test('geometry-only hints are flagged for human review', () => {
  const result = classifySketchUpEntity({
    type: 'Group',
    bounds_mm: { size: { x: 5000, y: 150, z: 3000 } }
  });

  assert.equal(result.kind, 'WALL');
  assert.equal(result.source, 'GEOMETRY_HINT');
  assert.equal(result.reviewRequired, true);
  assert.ok(result.confidence < 0.7);
});

test('unknown entities remain unresolved instead of being guessed', () => {
  const result = classifySketchUpEntity({
    type: 'ComponentInstance',
    name: 'Object 23',
    bounds_mm: { size: { x: 900, y: 900, z: 900 } }
  });

  assert.equal(result.kind, 'UNKNOWN');
  assert.equal(result.reviewRequired, true);
});

test('Building Graph v2 prefers recursive semantic inventory when available', () => {
  const graph = buildBuildingGraphV2Preview({
    schema: 'archon.sketchup.manifest.v1',
    project_id: 'archon_project_demo',
    semantic_hash: 'abc123',
    model: { guid: 'model-guid-1' },
    root_entities: [
      { persistent_id: 1, name: 'Root Unknown', type: 'Group' }
    ],
    semantic_inventory: [
      {
        persistent_id: 10,
        depth: 0,
        path: [10],
        name: 'Wall East',
        type: 'Group'
      },
      {
        persistent_id: 11,
        parent_persistent_id: 10,
        depth: 1,
        path: [10, 11],
        definition: 'Door D01',
        type: 'ComponentInstance'
      },
      {
        persistent_id: 12,
        depth: 0,
        path: [12],
        name: 'Mystery Object',
        type: 'Group'
      }
    ]
  });

  assert.equal(graph.schema, 'archon.building-graph.v2');
  assert.equal(graph.generatedFrom, 'semantic_inventory');
  assert.equal(graph.summary.nodeCount, 3);
  assert.equal(graph.summary.byKind.WALL, 1);
  assert.equal(graph.summary.byKind.DOOR, 1);
  assert.equal(graph.summary.byKind.UNKNOWN, 1);
  assert.equal(graph.summary.unresolvedCount, 1);
  assert.equal(graph.mutation, 'none');
  assert.deepEqual(graph.nodes[1].sourcePath, ['10', '11']);
});
