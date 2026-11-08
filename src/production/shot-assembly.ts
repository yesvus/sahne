import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {lstat, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {z} from 'zod';
import {storyboardSchema, type Storyboard} from './storyboard';

const safeRelativePath = z.string().trim().min(1).max(4096).refine(
  (value) => !isAbsolute(value) && !value.startsWith('\\') &&
    !/^[A-Za-z]:/.test(value) && !/[\\\r\n\0]/.test(value) &&
    !value.split('/').includes('..'),
  'Use a local relative path without traversal, backslashes or line breaks',
);
const shotId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80);

/**
 * A shot is an already rendered *silent* local H.264 MP4.
 * Renderer invocation and shot-level caching are separate follow-on work.
 */
export const shotFilesSchema = z.object({
  schemaVersion: z.literal(1),
  shots: z.array(z.object({
    beatId: shotId,
    visualPath: safeRelativePath,
  }).strict()).min(1).max(120),
}).strict();
export type ShotFiles = z.infer<typeof shotFilesSchema>;

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  profile?: string;
  level?: number;
  r_frame_rate?: string;
  time_base?: string;
  nb_read_frames?: string;
};
type Probe = {
  streams?: ProbeStream[];
  format?: {duration?: string};
};

const execFile = async (name: string, args: string[]): Promise<string> =>
  new Promise((ok, fail) => {
    const child = spawn(name, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: AbortSignal.timeout(120_000),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (data: string) => {
      stdout += data;
      if (stdout.length > 1_000_000) {
        child.kill();
        fail(new Error(name + ' output exceeded size limit'));
      }
    });
    child.stderr.setEncoding('utf8').on('data', (data: string) => {
      stderr = (stderr + data).slice(-16_384);
    });
    child.once('error', fail);
    child.once('close', (code) => {
      if (code === 0) ok(stdout);
      else fail(new Error(name + ' failed: ' + stderr.trim()));
    });
  });

const probe = async (path: string): Promise<Probe> => {
  const data = await execFile('ffprobe', [
    '-v', 'error', '-count_frames',
    '-show_entries',
    'format=duration:stream=codec_type,codec_name,width,height,pix_fmt,profile,level,r_frame_rate,time_base,nb_read_frames',
    '-of', 'json', path,
  ]);
  return JSON.parse(data) as Probe;
};

const sha256 = async (path: string): Promise<string> =>
  new Promise((ok, fail) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (data) => { hash.update(data); });
    stream.once('error', fail);
    stream.once('end', () => ok(hash.digest('hex')));
  });

const within = (root: string, file: string): boolean => {
  const path = relative(root, file);
  return path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
};

const frame = (milliseconds: number, fps: number) =>
  Math.round(milliseconds * fps / 1000);

type PlannedShot = {
  beatId: string;
  sourcePath: string;
  sha256: string;
  firstFrame: number;
  endFrame: number;
  frames: number;
};

const verifyClip = (info: Probe, expectedFrames: number, fps: number, name: string) => {
  const streams = info.streams ?? [];
  const video = streams.filter((stream) => stream.codec_type === 'video');
  if (video.length !== 1 || streams.some((stream) => stream.codec_type === 'audio')) {
    throw new Error(name + ': expected exactly one silent video stream');
  }
  const v = video[0];
  if (v.codec_name !== 'h264' || v.width !== 1920 || v.height !== 1080 ||
      v.pix_fmt !== 'yuv420p' || v.r_frame_rate !== fps + '/1') {
    throw new Error(name + ': requires silent H.264 yuv420p 1920x1080 at ' + fps + 'fps');
  }
  const frames = Number(v.nb_read_frames);
  if (!Number.isSafeInteger(frames) || frames !== expectedFrames) {
    throw new Error(name + ': expected ' + expectedFrames + ' frames, got ' + v.nb_read_frames);
  }
  const milliseconds = Number(info.format?.duration) * 1000;
  if (!Number.isFinite(milliseconds) ||
      Math.abs(milliseconds - expectedFrames * 1000 / fps) > 1000 / fps) {
    throw new Error(name + ': duration does not match frame count');
  }
  return [v.profile, v.level, v.pix_fmt, v.time_base].join(':');
};

/**
 * Assemble pre-rendered shots on the storyboard's ordered frame timeline.
 * This is a video-only handoff for pnpm audio:mix and pnpm video:assemble.
 * No silent trims, no audio replacement, no renderer and no implicit shot generation.
 */
export const assemblePreRenderedShots = async ({
  projectDirectory, storyboardInput, shotFilesInput, outputPath,
}: {
  projectDirectory: string;
  storyboardInput: unknown;
  shotFilesInput: unknown;
  outputPath: string;
}) => {
  const storyboard: Storyboard = storyboardSchema.parse(storyboardInput);
  const fileMap = shotFilesSchema.parse(shotFilesInput);
  const root = await realpath(projectDirectory);
  const shots = fileMap.shots;
  const beats = storyboard.beats;
  if (shots.length !== beats.length) {
    throw new Error('Each storyboard beat needs exactly one pre-rendered shot');
  }
  if (frame(storyboard.durationMs, storyboard.fps) < 1) {
    throw new Error('Storyboard is shorter than one video frame');
  }

  const output = resolve(outputPath);
  if (!output.toLowerCase().endsWith('.mp4')) {
    throw new Error('Shot output must be an MP4');
  }
  try {
    await lstat(output);
    throw new Error('Refusing to overwrite existing output: ' + output);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  const plan: PlannedShot[] = [];
  let previousFrame = 0;
  let referenceCodec: string | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const shot = shots[i];
    if (shot.beatId !== beat.id || seen.has(shot.beatId)) {
      throw new Error('Shot list must match ordered storyboard beat IDs exactly');
    }
    seen.add(shot.beatId);
    const firstFrame = frame(beat.startMs, storyboard.fps);
    const endFrame = frame(beat.endMs, storyboard.fps);
    if (firstFrame !== previousFrame || endFrame <= firstFrame) {
      throw new Error('Shot boundaries must cover the full frame timeline without gaps or overlaps');
    }
    const path = await realpath(resolve(root, shot.visualPath));
    if (!within(root, path) || !(await stat(path)).isFile()) {
      throw new Error('Shot source must be a regular file inside project directory');
    }
    if (path === output) throw new Error('Output cannot replace a source clip');
    const currentCodec = verifyClip(
      await probe(path), endFrame - firstFrame, storyboard.fps, shot.beatId,
    );
    if (referenceCodec !== undefined && currentCodec !== referenceCodec) {
      throw new Error('Pre-rendered H.264 shots must share encoding parameters; normalize upstream');
    }
    referenceCodec = currentCodec;
    plan.push({
      beatId: beat.id,
      sourcePath: path,
      sha256: await sha256(path),
      firstFrame, endFrame, frames: endFrame - firstFrame,
    });
    previousFrame = endFrame;
  }
  const totalFrames = frame(storyboard.durationMs, storyboard.fps);
  if (previousFrame !== totalFrames) {
    throw new Error('Storyboard shots do not cover full video duration');
  }

  const work = await mkdtemp(join(tmpdir(), 'sahne-shots-'));
  try {
    const concatFile = join(work, 'files.txt');
    const escapeName = (value: string) => value.replace(/'/g, "'\\''");
    await writeFile(concatFile, plan.map((shot) =>
      "file '" + escapeName(shot.sourcePath) + "'",
    ).join('\n') + '\n', 'utf8');
    await mkdir(dirname(output), {recursive: true});
    await execFile('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
      '-f', 'concat', '-safe', '0', '-i', concatFile,
      '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart',
      output,
    ]);

    const merged = await probe(output);
    verifyClip(merged, totalFrames, storyboard.fps, 'assembled output');
    if (Math.abs(Number(merged.format?.duration) * 1000 - storyboard.durationMs) >
        1000 / storyboard.fps) {
      throw new Error('Assembled MP4 duration differs from storyboard');
    }
    return {
      outputPath: output,
      fps: storyboard.fps,
      totalFrames,
      durationMs: storyboard.durationMs,
      videoCodec: 'h264',
      mode: storyboard.narration ? 'narrated' : 'sfx-only',
      shots: plan,
      note: 'Visual-only shot assembly. Requires separate audio mix, final mux and human video QA.',
    };
  } catch (error) {
    await rm(output, {force: true});
    throw error;
  } finally {
    await rm(work, {recursive: true, force: true});
  }
};

export const assembleShotsFromFiles = async ({
  projectDirectory, storyboardPath, shotsPath, outputPath,
}: {
  projectDirectory: string;
  storyboardPath: string;
  shotsPath: string;
  outputPath: string;
}) => {
  const [storyboard, shots] = await Promise.all([
    readFile(storyboardPath, 'utf8').then((text) => JSON.parse(text) as unknown),
    readFile(shotsPath, 'utf8').then((text) => JSON.parse(text) as unknown),
  ]);
  return assemblePreRenderedShots({
    projectDirectory, storyboardInput: storyboard, shotFilesInput: shots, outputPath,
  });
};
