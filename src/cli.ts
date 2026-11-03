import {spawn} from 'node:child_process';
import {mkdir, readFile, stat} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {getTotalFrames, manifestSchema, type TimelineManifest} from './manifest';

const manifestPropsSchema = z.object({manifest: manifestSchema}).strict();
const MAX_MANIFEST_BYTES = 2_000_000;

export type FrameRange = {start: number; end: number};
export type CliCommand =
  | {kind: 'help'}
  | {kind: 'validate'; file: string}
  | {kind: 'render'; file: string; output: string; frames?: FrameRange};

export const USAGE = `Sahne — deterministic code-to-video CLI

Usage:
  pnpm sahne validate <manifest.json>
  pnpm sahne render <manifest.json> [--output <video.mp4>] [--frames <start-end>]
  pnpm sahne --help

Input format: a JSON object with a validated "manifest" property, e.g.
  examples/two-scenes.json

Default output: out/sahne.mp4 (1920x1080, 30fps, H.264)
`;

function parseFrameRange(raw: string): FrameRange {
  const match = /^(\d+)-(\d+)$/.exec(raw);
  if (!match) {
    throw new Error('--frames must be a zero-based inclusive range, e.g. 0-29');
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
    throw new Error('--frames must contain safe, ascending integer boundaries');
  }
  return {start, end};
}

export function parseCliArgs(argv: string[]): CliCommand {
  if (argv.length === 0 || (argv.length === 1 && ['-h', '--help', 'help'].includes(argv[0]))) {
    return {kind: 'help'};
  }

  const [operation, file, ...options] = argv;
  if (operation !== 'validate' && operation !== 'render') {
    throw new Error(`Unknown command: ${operation ?? '(none)'}\n\n${USAGE}`);
  }
  if (!file || file.startsWith('-')) {
    throw new Error(`Missing manifest file.\n\n${USAGE}`);
  }

  if (operation === 'validate') {
    if (options.length > 0) {
      throw new Error('validate accepts only a manifest file');
    }
    return {kind: 'validate', file};
  }

  let output = 'out/sahne.mp4';
  let frames: FrameRange | undefined;
  const seen = new Set<string>();

  for (let index = 0; index < options.length; index += 2) {
    const option = options[index];
    const value = options[index + 1];
    if (!['--output', '-o', '--frames'].includes(option) || !value || value.startsWith('-')) {
      throw new Error(`Invalid render option: ${option ?? '(missing)'}\n\n${USAGE}`);
    }

    const normalized = option === '-o' ? '--output' : option;
    if (seen.has(normalized)) {
      throw new Error(`Repeated option: ${option}`);
    }
    seen.add(normalized);

    if (normalized === '--output') {
      if (!value.toLowerCase().endsWith('.mp4')) {
        throw new Error('--output must end in .mp4');
      }
      output = value;
    } else {
      frames = parseFrameRange(value);
    }
  }

  return {kind: 'render', file, output, frames};
}

function formatPath(path: PropertyKey[]): string {
  return path.map(String).join('.') || '(root)';
}

export async function loadManifestProps(file: string): Promise<{manifest: TimelineManifest}> {
  const filename = resolve(file);
  const info = await stat(filename);
  if (!info.isFile()) {
    throw new Error(`Not a regular file: ${filename}`);
  }
  if (info.size > MAX_MANIFEST_BYTES) {
    throw new Error(`Manifest exceeds the ${MAX_MANIFEST_BYTES}-byte limit: ${filename}`);
  }

  const content = await readFile(filename, 'utf8');
  let input: unknown;
  try {
    input = JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filename}: ${error.message}`);
    }
    throw error;
  }

  const parsed = manifestPropsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid manifest:\n${parsed.error.issues.map(
      (issue) => `  - ${formatPath(issue.path)}: ${issue.message}`,
    ).join('\n')}`);
  }
  return parsed.data;
}

export function remotionArgs(file: string, output: string, frames?: FrameRange): string[] {
  const entryPoint = fileURLToPath(new URL('./index.ts', import.meta.url));
  const argumentsList = [
    'exec', 'remotion', 'render', entryPoint, 'SahneTimeline', resolve(output),
    `--props=${resolve(file)}`, '--codec=h264',
  ];
  if (frames) {
    argumentsList.push(`--frames=${frames.start}-${frames.end}`);
  }
  return argumentsList;
}

function spawnRenderer(args: string[]): Promise<number> {
  return new Promise((resolveExitCode, reject) => {
    const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const child = spawn(command, args, {stdio: 'inherit', shell: false});
    child.once('error', reject);
    child.once('close', (code) => resolveExitCode(code ?? 1));
  });
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    const command = parseCliArgs(argv);
    if (command.kind === 'help') {
      console.log(USAGE);
      return 0;
    }

    const props = await loadManifestProps(command.file);
    const totalFrames = getTotalFrames(props.manifest);
    if (command.kind === 'validate') {
      console.log(`Valid v${props.manifest.schemaVersion} manifest: ${props.manifest.scenes.length} scene(s), ${totalFrames} frames at 30fps.`);
      return 0;
    }

    if (command.frames && command.frames.end >= totalFrames) {
      throw new Error(`Requested frames ${command.frames.start}-${command.frames.end} exceed the manifest (0-${totalFrames - 1})`);
    }

    await mkdir(dirname(resolve(command.output)), {recursive: true});
    return await spawnRenderer(remotionArgs(command.file, command.output, command.frames));
  } catch (error) {
    console.error(`sahne: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
