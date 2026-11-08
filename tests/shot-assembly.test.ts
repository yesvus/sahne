import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const run = (name: string, args: string[]) => {
  const result = spawnSync(name, args, {encoding: 'utf8', timeout: 120_000});
  assert.equal(result.status, 0, name + ' failed: ' + result.stderr);
  return result.stdout;
};

const shot = (file: string, color: string, fps = 30) => run('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
  '-f', 'lavfi', '-i', 'color=c=' + color + ':s=1920x1080:r=' + fps + ':d=1',
  '-frames:v', String(fps), '-c:v', 'libx264', '-preset', 'ultrafast',
  '-pix_fmt', 'yuv420p', '-an', file,
]);

const storyboard = {
  schemaVersion: 1, language: 'en', fps: 30, durationMs: 3000,
  beats: [
    {id: 'intro', startMs: 0, endMs: 1000, treatment: 'overlay',
      cueText: 'A title', source: {kind: 'generate', brief: 'An opening title to test shot assembly'}},
    {id: 'middle', startMs: 1000, endMs: 2000, treatment: 'cutaway',
      cueText: 'A still', source: {kind: 'generate', brief: 'A still-image shot encoded to an MP4'}},
    {id: 'outro', startMs: 2000, endMs: 3000, treatment: 'overlay',
      cueText: 'An end', source: {kind: 'generate', brief: 'An animated ending shot for the video'}},
  ],
  soundCues: [{id: 'test-click', assetId: 'synthetic-click-v1',
    atMs: 100, durationMs: 200, gainDb: -24, visualBeatId: 'intro'}],
};

const manifest = {
  schemaVersion: 1,
  shots: [
    {beatId: 'intro', visualPath: 'renders/intro.mp4'},
    {beatId: 'middle', visualPath: 'renders/middle.mp4'},
    {beatId: 'outro', visualPath: 'renders/outro.mp4'},
  ],
};

const cli = (project: string, storyboardPath: string, shotsPath: string, output: string) =>
  spawnSync(process.execPath, [
    '--import', 'tsx', 'scripts/assemble-shots.ts',
    project, storyboardPath, shotsPath, output,
  ], {encoding: 'utf8', timeout: 120_000});

test('assembles three silent H264 shots without reencoding and refuses overwrites', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-join-'));
  try {
    await mkdir(join(root, 'renders'));
    for (const [name, color] of [['intro', 'red'], ['middle', 'blue'], ['outro', 'green']]) {
      shot(join(root, 'renders', name + '.mp4'), color);
    }
    const board = join(root, 'storyboard.json');
    const map = join(root, 'shots.json');
    const output = join(root, 'joined.mp4');
    await writeFile(board, JSON.stringify(storyboard));
    await writeFile(map, JSON.stringify(manifest));
    const result = cli(root, board, map, output);
    assert.equal(result.status, 0, result.stderr);
    const info = JSON.parse(result.stdout) as {
      totalFrames: number; durationMs: number; shots: Array<{beatId: string; sha256: string}>;
    };
    assert.equal(info.totalFrames, 90);
    assert.equal(info.durationMs, 3000);
    assert.deepEqual(info.shots.map((x) => x.beatId), ['intro', 'middle', 'outro']);
    assert.match(info.shots[1].sha256, /^[a-f0-9]{64}$/);
    const bytes = await stat(output);
    assert.ok(bytes.size > 1000);
    const probe = JSON.parse(run('ffprobe', [
      '-v', 'error', '-count_frames', '-of', 'json',
      '-show_entries', 'format=duration:stream=codec_type,codec_name,nb_read_frames',
      output,
    ])) as {
      format: {duration: string};
      streams: Array<{codec_type: string; codec_name: string; nb_read_frames: string}>;
    };
    assert.ok(Math.abs(Number(probe.format.duration) - 3) < 0.05);
    assert.equal(probe.streams.length, 1);
    assert.equal(probe.streams[0].nb_read_frames, '90');
    assert.equal(probe.streams[0].codec_name, 'h264');

    const again = cli(root, board, map, output);
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /Refusing to overwrite/);
  } finally {
    await rm(root, {force: true, recursive: true});
  }
});

test('fail-closed: reject missing, unordered, gapped and outside-root shot files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-join-bad-'));
  const outside = await mkdtemp(join(tmpdir(), 'sahne-join-outside-'));
  try {
    await mkdir(join(root, 'renders'));
    for (const name of ['intro', 'middle', 'outro']) {
      shot(join(root, 'renders', name + '.mp4'), 'black');
    }
    const board = join(root, 'storyboard.json');
    const map = join(root, 'shots.json');
    await writeFile(board, JSON.stringify(storyboard));
    const bad = async (input: unknown, expected: RegExp) => {
      await writeFile(map, JSON.stringify(input));
      const output = join(root, 'failed.mp4');
      const result = cli(root, board, map, output);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, expected);
      await assert.rejects(stat(output), {code: 'ENOENT'});
    };
    await bad({...manifest, shots: manifest.shots.slice(0, 2)}, /exactly one/);
    await bad({...manifest, shots: [manifest.shots[1], manifest.shots[0], manifest.shots[2]]},
      /ordered storyboard/);
    await bad({...manifest, shots: [
      {...manifest.shots[0], visualPath: '../external.mp4'},
      ...manifest.shots.slice(1),
    ]}, /relative path/);
    const outsideClip = join(outside, 'outside.mp4');
    shot(outsideClip, 'yellow');
    await symlink(outsideClip, join(root, 'renders', 'escape.mp4'));
    await bad({...manifest, shots: [
      {...manifest.shots[0], visualPath: 'renders/escape.mp4'},
      ...manifest.shots.slice(1),
    ]}, /inside project directory/);
    await writeFile(board, JSON.stringify({...storyboard, beats: [
      storyboard.beats[0],
      {...storyboard.beats[1], startMs: 1100},
      storyboard.beats[2],
    ]}));
    await bad(manifest, /without gaps or overlaps/);
  } finally {
    await rm(root, {force: true, recursive: true});
    await rm(outside, {force: true, recursive: true});
  }
});
