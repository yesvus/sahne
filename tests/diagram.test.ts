import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getEdgeGeometry, packetPosition} from '../src/diagram/geometry';
import {manifestSchema} from '../src/manifest';

const source = JSON.parse(readFileSync('examples/diagram.json', 'utf8')) as {manifest: unknown};

test('accepts 12-second client-gateway-server diagram', () => {
  const parsed = manifestSchema.parse(source.manifest);
  assert.equal(parsed.scenes[0].type, 'diagram');
  assert.equal(parsed.scenes[0].durationInFrames, 360);
});

test('rejects duplicate node IDs and unknown edge endpoints', () => {
  const original = manifestSchema.parse(source.manifest);
  const scene = original.scenes[0];
  assert.equal(scene.type, 'diagram');
  if (scene.type !== 'diagram') return;
  const duplicate: unknown = {...original, scenes: [{
    ...scene, props: {...scene.props, nodes: [...scene.props.nodes, {...scene.props.nodes[1], id: 'client'}]},
  }]};
  const badEdge: unknown = {...original, scenes: [{
    ...scene, props: {...scene.props, edges: [{id: 'bad', from: 'missing', to: 'server'}]},
  }]};
  assert.equal(manifestSchema.safeParse(duplicate).success, false);
  const invalid = manifestSchema.safeParse(badEdge);
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.equal(invalid.error.issues[0].path.join('.'), 'scenes.0.props.edges.0.from');
});

test('rejects packet edges, inverted intervals and scene overflow', () => {
  const original = manifestSchema.parse(source.manifest);
  const scene = original.scenes[0];
  if (scene.type !== 'diagram') return;
  for (const item of [
    {...scene.props.packets[0], edgeId: 'missing'},
    {...scene.props.packets[0], startFrame: 95, endFrame: 35},
    {...scene.props.packets[0], endFrame: 361},
  ]) {
    const bad: unknown = {...original, scenes: [{
      ...scene, props: {...scene.props, packets: [item]},
    }]};
    assert.equal(manifestSchema.safeParse(bad).success, false);
  }
});

test('clips horizontal and vertical edges to node boundaries', () => {
  assert.deepEqual(getEdgeGeometry({x: 0, y: 0}, {x: 500, y: 0}, 100, 50), {
    start: {x: 100, y: 0}, end: {x: 400, y: 0},
  });
  assert.deepEqual(getEdgeGeometry({x: 0, y: 0}, {x: 0, y: 500}, 100, 50), {
    start: {x: 0, y: 50}, end: {x: 0, y: 450},
  });
});

test('packet geometry clamps before/after timeline and rejects invalid points', () => {
  assert.deepEqual(packetPosition({x: 0, y: 10}, {x: 100, y: 30}, 0.5), {x: 50, y: 20});
  assert.deepEqual(packetPosition({x: 0, y: 10}, {x: 100, y: 30}, 2), {x: 100, y: 30});
  assert.throws(() => getEdgeGeometry({x: 0, y: 0}, {x: 0, y: 0}), RangeError);
});
