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

const graphId = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const diagramNodeSchema = z.object({
  id: graphId,
  label: z.string().trim().min(1).max(20),
  x: z.number().finite().min(0.12).max(0.88),
  y: z.number().finite().min(0.15).max(0.85),
}).strict();

const diagramEdgeSchema = z.object({
  id: graphId,
  from: graphId,
  to: graphId,
  label: z.string().trim().min(1).max(24).optional(),
}).strict();

const diagramPacketSchema = z.object({
  id: graphId,
  edgeId: graphId,
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  reverse: z.boolean().optional(),
}).strict();

const diagramAnnotationSchema = z.object({
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  text: z.string().trim().min(1).max(95),
}).strict();

export const diagramPropsSchema = z.object({
  title: nonemptyTitle,
  subtitle,
  accentColor,
  nodes: z.array(diagramNodeSchema).min(2).max(8),
  edges: z.array(diagramEdgeSchema).min(1).max(12),
  packets: z.array(diagramPacketSchema).min(1).max(20),
  annotations: z.array(diagramAnnotationSchema).min(1).max(8),
}).strict();

export type TitleSceneProps = z.infer<typeof titlePropsSchema>;
export type StatSceneProps = z.infer<typeof statPropsSchema>;
export type ComparisonSceneProps = z.infer<typeof comparisonPropsSchema>;
export type DiagramSceneProps = z.infer<typeof diagramPropsSchema>;

const sceneBaseSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/, 'Use lowercase identifiers with hyphens'),
  durationInFrames: z.number().int().min(1).max(1800),
});

const sceneBlockSchema = z.discriminatedUnion('type', [
  sceneBaseSchema.extend({type: z.literal('metrics'), props: sceneSchema}).strict(),
  sceneBaseSchema.extend({type: z.literal('title'), props: titlePropsSchema}).strict(),
  sceneBaseSchema.extend({type: z.literal('stat'), props: statPropsSchema}).strict(),
  sceneBaseSchema.extend({type: z.literal('comparison'), props: comparisonPropsSchema}).strict(),
  sceneBaseSchema.extend({type: z.literal('diagram'), props: diagramPropsSchema}).strict(),
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
    if (scene.type === 'diagram') {
      const {nodes, edges, packets, annotations} = scene.props;
      const nodeIds = new Set<string>();
      for (const [nodeIndex, node] of nodes.entries()) {
        if (nodeIds.has(node.id)) {
          context.addIssue({code: 'custom', message: 'Duplicate node id',
            path: ['scenes', index, 'props', 'nodes', nodeIndex, 'id']});
        }
        nodeIds.add(node.id);
        for (let earlier = 0; earlier < nodeIndex; earlier++) {
          const other = nodes[earlier];
          if (Math.abs(node.x - other.x) < 0.17 && Math.abs(node.y - other.y) < 0.24) {
            context.addIssue({code: 'custom', message: 'Diagram node boxes overlap',
              path: ['scenes', index, 'props', 'nodes', nodeIndex]});
            break;
          }
        }
      }

      const edgeIds = new Set<string>();
      for (const [edgeIndex, edge] of edges.entries()) {
        if (edgeIds.has(edge.id)) {
          context.addIssue({code: 'custom', message: 'Duplicate edge id',
            path: ['scenes', index, 'props', 'edges', edgeIndex, 'id']});
        }
        edgeIds.add(edge.id);
        for (const endpoint of ['from', 'to'] as const) {
          if (!nodeIds.has(edge[endpoint])) {
            context.addIssue({code: 'custom', message: 'Edge endpoint references a missing node',
              path: ['scenes', index, 'props', 'edges', edgeIndex, endpoint]});
          }
        }
        if (edge.from === edge.to) {
          context.addIssue({code: 'custom', message: 'Self-edges are not supported',
            path: ['scenes', index, 'props', 'edges', edgeIndex]});
        }
      }

      const packetIds = new Set<string>();
      for (const [packetIndex, packet] of packets.entries()) {
        const path = ['scenes', index, 'props', 'packets', packetIndex];
        if (packetIds.has(packet.id)) {
          context.addIssue({code: 'custom', message: 'Duplicate packet id',
            path: [...path, 'id']});
        }
        packetIds.add(packet.id);
        if (!edgeIds.has(packet.edgeId)) {
          context.addIssue({code: 'custom', message: 'Packet references a missing edge',
            path: [...path, 'edgeId']});
        }
        if (packet.startFrame >= packet.endFrame || packet.endFrame > scene.durationInFrames) {
          context.addIssue({code: 'custom', message: 'Packet frame interval is invalid or outside the scene',
            path: [...path, 'endFrame']});
        }
      }

      let previousEnd = 0;
      for (const [annotationIndex, annotation] of annotations.entries()) {
        if (annotation.startFrame < previousEnd ||
            annotation.startFrame >= annotation.endFrame ||
            annotation.endFrame > scene.durationInFrames) {
          context.addIssue({code: 'custom', message: 'Step annotations must be ordered, nonoverlapping and inside the scene',
            path: ['scenes', index, 'props', 'annotations', annotationIndex]});
        }
        previousEnd = annotation.endFrame;
      }
    }

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
