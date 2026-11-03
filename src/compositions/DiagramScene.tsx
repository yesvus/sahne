import React from 'react';
import {useCurrentFrame} from 'remotion';
import {SceneCanvas} from '../components/SceneCanvas';
import {SceneHeader} from '../components/SceneHeader';
import {getEnterExitMotion, normalizedFrameProgress} from '../design/motion';
import {tokens} from '../design/tokens';
import {getEdgeGeometry, packetPosition, type Point} from '../diagram/geometry';
import type {DiagramSceneProps} from '../manifest';

type Props = {scene: DiagramSceneProps; sceneDurationInFrames: number};
const VIEW_WIDTH = 1500;
const VIEW_HEIGHT = 450;

export const DiagramScene: React.FC<Props> = ({scene, sceneDurationInFrames}) => {
  const frame = useCurrentFrame();
  const motion = getEnterExitMotion(frame, sceneDurationInFrames);
  const nodePositions = new Map<string, Point>(
    scene.nodes.map((node) => [node.id, {x: node.x * VIEW_WIDTH, y: node.y * VIEW_HEIGHT}]),
  );

  const edgeGeometry = new Map(
    scene.edges.map((edge) => {
      const from = nodePositions.get(edge.from);
      const to = nodePositions.get(edge.to);
      if (!from || !to) throw new Error(`Invalid diagram edge ${edge.id}`);
      return [edge.id, getEdgeGeometry(from, to)] as const;
    }),
  );

  const annotationIndex = scene.annotations.findIndex(
    (item) => frame >= item.startFrame && frame < item.endFrame,
  );
  const annotation = annotationIndex < 0 ? undefined : scene.annotations[annotationIndex];
  const timelineProgress = (frame + 1) / sceneDurationInFrames;

  return (
    <SceneCanvas>
      <SceneHeader
        title={scene.title}
        subtitle={scene.subtitle}
        accentColor={scene.accentColor}
        frame={frame}
        durationInFrames={sceneDurationInFrames}
      />
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        height={450}
        style={{display: 'block', marginTop: 27, overflow: 'visible', opacity: motion.opacity}}
      >
        <defs>
          <marker id="sahne-diagram-arrow" markerWidth="15" markerHeight="15"
            refX="11" refY="7.5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 14 7.5 L 0 15 z" fill="#8495ad" />
          </marker>
        </defs>
        {scene.edges.map((edge) => {
          const geometry = edgeGeometry.get(edge.id);
          if (!geometry) return null;
          const {start, end} = geometry;
          return (
            <g key={edge.id}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                stroke="#8495ad" strokeWidth={5} markerEnd="url(#sahne-diagram-arrow)" />
              {edge.label ? (
                <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 22}
                  fill={tokens.colors.muted} textAnchor="middle" fontSize={24}>
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {scene.nodes.map((node) => {
          const center = nodePositions.get(node.id);
          if (!center) return null;
          return (
            <g key={node.id}>
              <rect x={center.x - 119} y={center.y - 58}
                width={238} height={116} rx={22}
                fill="#172841" stroke="#56708f" strokeWidth={3} />
              <text x={center.x} y={center.y} fill={tokens.colors.foreground}
                fontWeight={700} fontSize={node.label.length > 13 ? 25 : 31}
                textAnchor="middle" dominantBaseline="middle">
                {node.label}
              </text>
            </g>
          );
        })}
        {scene.packets.map((packet) => {
          if (frame < packet.startFrame || frame >= packet.endFrame) return null;
          const geometry = edgeGeometry.get(packet.edgeId);
          if (!geometry) return null;
          const start = packet.reverse ? geometry.end : geometry.start;
          const end = packet.reverse ? geometry.start : geometry.end;
          const travelFrames = Math.max(1, packet.endFrame - packet.startFrame - 1);
          const progress = normalizedFrameProgress(frame, packet.startFrame, travelFrames);
          const pos = packetPosition(start, end, progress);
          const color = packet.reverse ? '#d7a5ff' : scene.accentColor;
          return (
            <g key={packet.id}>
              <circle cx={pos.x} cy={pos.y} r={16} fill={color} stroke="#0b1220" strokeWidth={4} />
              <text x={pos.x} y={pos.y - 27} textAnchor="middle"
                fontSize={22} fontWeight={700} fill={color}>
                {packet.reverse ? 'RESPONSE' : 'REQUEST'}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{
        position: 'absolute',
        left: tokens.safeArea.horizontal,
        right: tokens.safeArea.horizontal,
        bottom: tokens.safeArea.vertical + 8,
      }}>
        <div style={{fontSize: 27, fontWeight: 600, minHeight: 36}}>
          {annotation ? `STEP ${annotationIndex + 1} · ${annotation.text}` : ' '}
        </div>
        <div style={{
          height: 9, background: tokens.colors.track, borderRadius: 6,
          marginTop: 18, position: 'relative',
        }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, timelineProgress * 100))}%`,
            height: '100%', background: scene.accentColor, borderRadius: 6,
          }} />
          {scene.annotations.map((item, index) => (
            <div key={index} style={{
              position: 'absolute', top: -6, height: 21, width: 3,
              left: `${item.startFrame / sceneDurationInFrames * 100}%`,
              background: tokens.colors.foreground, opacity: 0.7,
            }} />
          ))}
        </div>
      </div>
    </SceneCanvas>
  );
};
