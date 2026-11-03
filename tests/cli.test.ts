import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {loadManifestProps, parseCliArgs, remotionArgs} from '../src/cli';

test('parses strict CLI commands and default output', () => {
  assert.deepEqual(parseCliArgs(['validate', 'examples/two-scenes.json']), {
    kind: 'validate',
    file: 'examples/two-scenes.json',
  });
  assert.deepEqual(parseCliArgs(['render', 'examples/two-scenes.json']), {
    kind: 'render',
    file: 'examples/two-scenes.json',
    output: 'out/sahne.mp4',
    frames: undefined,
  });
  assert.deepEqual(parseCliArgs([
    'render', 'examples/two-scenes.json', '--frames', '60-89',
    '--output', 'out/my clip.mp4',
  ]), {
    kind: 'render',
    file: 'examples/two-scenes.json',
    output: 'out/my clip.mp4',
    frames: {start: 60, end: 89},
  });
});

test('rejects unknown commands, duplicated flags and invalid frame ranges', () => {
  for (const argv of [
    ['wat', 'example.json'],
    ['render'],
    ['validate', 'example.json', '--output', 'out/test.mp4'],
    ['render', 'example.json', '--frames', '9-3'],
    ['render', 'example.json', '--frames', '-1-4'],
    ['render', 'example.json', '--frames', '2.5-4'],
    ['render', 'example.json', '--output', 'bad.mov'],
    ['render', 'example.json', '--output', 'one.mp4', '-o', 'two.mp4'],
  ]) {
    assert.throws(() => parseCliArgs(argv));
  }
});

test('loads and validates checked-in two-scene manifest', async () => {
  const props = await loadManifestProps('examples/two-scenes.json');
  assert.equal(props.manifest.scenes.length, 2);
  assert.equal(props.manifest.scenes[0].durationInFrames, 75);
});

test('reports invalid JSON and precise scene validation paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sahne-cli-'));
  const broken = join(directory, 'broken.json');
  await writeFile(broken, '{"manifest":');
  await assert.rejects(loadManifestProps(broken), /Invalid JSON/);

  const invalid = join(directory, 'invalid.json');
  const original = await loadManifestProps('examples/two-scenes.json');
  const value = {manifest: {
    ...original.manifest,
    scenes: [
      {...original.manifest.scenes[0], durationInFrames: 0},
    ],
  }};
  await writeFile(invalid, JSON.stringify(value));
  await assert.rejects(loadManifestProps(invalid), /manifest\.scenes\.0\.durationInFrames/);
});

test('passes renderer arguments as separate argv values', () => {
  const args = remotionArgs('examples/two-scenes.json', 'out/my clip.mp4', {start: 0, end: 29});
  assert.ok(args.includes('SahneTimeline'));
  assert.ok(args.some((item) => item.endsWith('out/my clip.mp4')));
  assert.ok(args.includes('--frames=0-29'));
  assert.ok(args.some((item) => item.startsWith('--props=')));
  assert.equal(args.includes('sh'), false);
});
