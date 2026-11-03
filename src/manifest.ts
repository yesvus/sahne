import {z} from 'zod';
import {sceneSchema} from './schema';

const nonemptyTitle = z.string().trim().min(1).max(72);
const subtitle = z.string().trim().max(180);
const accentColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const titlePropsSchema = z.object({
  title: nonemptyTitle,
  subtitle,
  eyebrow: z.string().trim().min(1).max(40),
  accentColor,
}).strict();

export const statPropsSchema = z.object({
  title: nonemptyTitle,
  subtitle,
  label: z.string().trim().min(1).max(50),
  value: z.number().finite().min(0).max(100),
  accentColor,
}).strict();

const comparisonItemSchema = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.number().finite().min(0).max(100),
}).strict();

export const comparisonPropsSchema = z.object({
  title: nonemptyTitle,
  subtitle,
  accentColor,
  left: comparisonItemSchema,
  right: comparisonItemSchema,
}).strict();

export type TitleSceneProps = z.infer<typeof titlePropsSchema>;
export type StatSceneProps = z.infer<typeof statPropsSchema>;
export type ComparisonSceneProps = z.infer<typeof comparisonPropsSchema>;

const sceneBaseSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/, 'Use lowercase identifiers with hyphens'),
  durationInFrames: z.number().int().min(1).max(1800),
});

const sceneBlockSchema = z.discriminatedUnion('type', [
  sceneBaseSchema.extend({type: z.literal('metrics'), props: sceneSchema}).strict(),
  sceneBaseSchema.extend({type: z.literal('title'), props: titlePropsSchema}).strict(),
  sceneBaseSchema.extend({type: z.literal('stat'), props: statPropsSchema}).strict(),
  sceneBaseSchema.extend({type: z.literal('comparison'), props: comparisonPropsSchema}).strict(),
]);

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  scenes: z.array(sceneBlockSchema).min(1).max(60),
}).strict().superRefine(({scenes}, context) => {
  const seen = new Map<string, number>();
  let total = 0;

  for (const [index, scene] of scenes.entries()) {
    const existing = seen.get(scene.id);
    if (existing !== undefined) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate scene id "${scene.id}" (first used by scene ${existing + 1})`,
        path: ['scenes', index, 'id'],
      });
    }
    seen.set(scene.id, index);
    total += scene.durationInFrames;
  }

  if (total > 18000) {
    context.addIssue({
      code: 'custom',
      message: 'The total manifest duration cannot exceed 18,000 frames (10 min at 30 fps)',
      path: ['scenes'],
    });
  }
});

export type TimelineManifest = z.infer<typeof manifestSchema>;

export type SceneWindow = {
  id: string;
  startFrame: number;
  endFrameExclusive: number;
};

/** Scene windows use half-open [start, end) frame intervals. */
export const getSceneWindows = (manifest: TimelineManifest): SceneWindow[] => {
  let nextFrame = 0;
  return manifest.scenes.map((scene) => {
    const startFrame = nextFrame;
    nextFrame += scene.durationInFrames;
    return {id: scene.id, startFrame, endFrameExclusive: nextFrame};
  });
};

export const getTotalFrames = (manifest: TimelineManifest): number =>
  getSceneWindows(manifest).at(-1)?.endFrameExclusive ?? 0;
