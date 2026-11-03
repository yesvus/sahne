import React from 'react';
import {useCurrentFrame} from 'remotion';
import {SceneCanvas} from '../components/SceneCanvas';
import {SceneHeader} from '../components/SceneHeader';
import {getMetricBarProgress} from '../design/motion';
import {tokens} from '../design/tokens';
import type {ComparisonSceneProps} from '../manifest';

type Props = {scene: ComparisonSceneProps; sceneDurationInFrames: number};

export const ComparisonScene: React.FC<Props> = ({scene, sceneDurationInFrames}) => {
  const frame = useCurrentFrame();

  return (
    <SceneCanvas>
      <SceneHeader
        title={scene.title}
        subtitle={scene.subtitle}
        accentColor={scene.accentColor}
        frame={frame}
        durationInFrames={sceneDurationInFrames}
      />
      <section style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 36,
        marginTop: 54,
      }}>
        {[scene.left, scene.right].map((item, index) => {
          const progress = getMetricBarProgress(frame, sceneDurationInFrames, index, 2);
          return (
            <article key={index} style={{
              padding: 46,
              minWidth: 0,
              borderRadius: 26,
              background: '#111f33',
              border: '2px solid #293b55',
            }}>
              <div style={{
                color: tokens.colors.muted,
                fontSize: 36,
                fontWeight: 600,
                overflowWrap: 'anywhere',
              }}>{item.label}</div>
              <div style={{
                color: scene.accentColor,
                fontSize: 112,
                fontWeight: 800,
                marginTop: 20,
                fontVariantNumeric: 'tabular-nums',
              }}>{Math.round(item.value * progress)}%</div>
              <div style={{
                background: tokens.colors.track,
                borderRadius: 13,
                height: 26,
                overflow: 'hidden',
                marginTop: 25,
              }}>
                <div style={{
                  background: scene.accentColor,
                  width: `${item.value * progress}%`,
                  height: '100%',
                  borderRadius: 13,
                }} />
              </div>
            </article>
          );
        })}
      </section>
    </SceneCanvas>
  );
};
