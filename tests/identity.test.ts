import assert from 'node:assert/strict';
import test from 'node:test';
import {
  channelStyleSchema,
  templateManifestSchema,
  videoProjectSchema,
  validateVideoProjectIdentity,
} from '../src/production/identity';

const style = {
  schemaVersion: 1,
  channelId: 'systems-explained',
  revision: 1,
  displayName: 'Systems Explained',
  visual: {
    palette: {background: '#10191c', foreground: '#f0eee6', accent: '#efbd73'},
    typography: {
      displayFont: 'Georgia',
      bodyFont: 'Arial',
      minimumReadablePxAt1080p: 44,
    },
    motion: 'restrained',
    chromePolicy: 'only-when-demonstrating-ui',
  },
  characters: [
    {
      id: 'network-mascot',
      name: 'Network mascot',
      referenceAssetIds: ['mascot-reference-v1'],
      identityNotes: 'Always use the approved reference sheet; preserve proportions.',
    },
  ],
};
const template = {
  schemaVersion: 1,
  id: 'kinetic-text-highlight',
  version: '1.0.0',
  title: 'Kinetic text highlight',
  category: 'kinetic-type',
  renderer: 'hyperframes',
  entry: 'index.html',
  license: 'Apache-2.0',
  parameters: [
    {key: 'headline', kind: 'text', required: true},
    {key: 'highlight', kind: 'text', required: true},
  ],
  channelStyleInputs: ['accent', 'background', 'foreground', 'displayFont'],
};
const video = {
  schemaVersion: 1,
  id: 'how-http-works',
  title: 'How an HTTP request travels',
  style: {channelId: 'systems-explained', revision: 1},
  scriptPath: 'script.md',
  voicePath: 'audio/narration.wav',
  storyboardPath: 'storyboard.json',
  templatePins: [{id: 'kinetic-text-highlight', version: '1.0.0'}],
};

test('channel style, character reference and project pins validate', () => {
  const result = validateVideoProjectIdentity(video, style, [template]);
  assert.equal(result.style.visual.motion, 'restrained');
  assert.equal(result.project.style.revision, 1);
  assert.equal(result.style.characters[0].referenceAssetIds[0], 'mascot-reference-v1');
});

test('video cannot silently inherit a newer channel style revision', () => {
  assert.throws(
    () => validateVideoProjectIdentity(video, {...style, revision: 2}, [template]),
    /Video project references channel style/,
  );
  assert.throws(
    () => validateVideoProjectIdentity(video, {...style, channelId: 'different-channel'}, [template]),
    /Video project references channel style/,
  );
});

test('video cannot use an unavailable template version', () => {
  assert.throws(
    () => validateVideoProjectIdentity(video, style, [{...template, version: '2.0.0'}]),
    /Missing pinned template/,
  );
  assert.equal(videoProjectSchema.safeParse({
    ...video, templatePins: [video.templatePins[0], video.templatePins[0]],
  }).success, false);
});

test('style rejects duplicate characters or reference sheets', () => {
  assert.equal(channelStyleSchema.safeParse({
    ...style,
    characters: [style.characters[0], style.characters[0]],
  }).success, false);
  assert.equal(channelStyleSchema.safeParse({
    ...style,
    characters: [{...style.characters[0], referenceAssetIds: [
      'mascot-reference-v1', 'mascot-reference-v1',
    ]}],
  }).success, false);
});

test('template is declarative and needs valid input bindings and a safe entry path', () => {
  assert.equal(templateManifestSchema.safeParse({
    ...template, entry: '../../secrets/private.html',
  }).success, false);
  assert.equal(templateManifestSchema.safeParse({
    ...template,
    parameters: [template.parameters[0], template.parameters[0]],
  }).success, false);
  assert.equal(templateManifestSchema.safeParse({
    ...template,
    channelStyleInputs: ['accent', 'accent'],
  }).success, false);
});

test('all media paths remain local relative references', () => {
  assert.equal(videoProjectSchema.safeParse({
    ...video, voicePath: 'C:/Users/secret.wav',
  }).success, false);
  assert.equal(videoProjectSchema.safeParse({
    ...video, scriptPath: '../private/script.md',
  }).success, false);
  assert.equal(videoProjectSchema.safeParse({
    ...video, storyboardPath: '/etc/passwd',
  }).success, false);
});
