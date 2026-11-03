import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getSceneWindows, getTotalFrames, manifestSchema} from '../src/manifest';

const example = JSON.parse(readFileSync('examples/templates.json', 'utf8')) as unknown;

test('accepts the four template scenes and calculates exact durations', () => {
  const parsed = manifestSchema.parse((example as {manifest: unknown}).manifest);
  assert.deepEqual(parsed.scenes.map((scene) => scene.type), [
    'title', 'metrics', 'stat', 'comparison',
  ]);
  assert.equal(getTotalFrames(parsed), 390);
  assert.deepEqual(getSceneWindows(parsed).map((window) => window.startFrame), [0, 90, 180, 270]);
});

test('rejects missing title and excessively long title text', () => {
  const parsed = manifestSchema.parse((example as {manifest: unknown}).manifest);
  const titleScene = parsed.scenes[0];
  assert.equal(titleScene.type, 'title');
  if (titleScene.type !== 'title') return;
  for (const title of ['', 'A'.repeat(90)]) {
    const invalid: unknown = {...parsed, scenes: [{...titleScene, props: {...titleScene.props, title}}]};
    assert.equal(manifestSchema.safeParse(invalid).success, false);
  }
});

test('rejects stats outside the supported percentage range', () => {
  const parsed = manifestSchema.parse((example as {manifest: unknown}).manifest);
  const stat = parsed.scenes[2];
  assert.equal(stat.type, 'stat');
  if (stat.type !== 'stat') return;
  const invalid = {...parsed, scenes: [{...stat, props: {...stat.props, value: 135}}]};
  const result = manifestSchema.safeParse(invalid);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0].path.join('.'), 'scenes.0.props.value');
  }
});

test('rejects malformed comparison fields and unknown template types', () => {
  const parsed = manifestSchema.parse((example as {manifest: unknown}).manifest);
  const comparison = parsed.scenes[3];
  assert.equal(comparison.type, 'comparison');
  if (comparison.type !== 'comparison') return;
  const invalid = {
    ...parsed,
    scenes: [{...comparison, props: {...comparison.props, right: {label: '', value: -10}}}],
  };
  assert.equal(manifestSchema.safeParse(invalid).success, false);
  assert.equal(manifestSchema.safeParse({
    ...parsed,
    scenes: [{...comparison, type: 'video-generation'}],
  }).success, false);
});

test('keeps the legacy metrics-only timeline valid', () => {
  const input = JSON.parse(readFileSync('examples/two-scenes.json', 'utf8')) as {manifest: unknown};
  const parsed = manifestSchema.parse(input.manifest);
  assert.equal(parsed.scenes.length, 2);
  assert.ok(parsed.scenes.every((scene) => scene.type === 'metrics'));
});
