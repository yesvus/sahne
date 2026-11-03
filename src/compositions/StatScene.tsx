import React from 'react';
import {useCurrentFrame} from 'remotion';
import {SceneCanvas} from '../components/SceneCanvas';
import {SceneHeader} from '../components/SceneHeader';
import {getMetricBarProgress} from '../design/motion';
import {tokens} from '../design/tokens';
import type {StatSceneProps} from '../manifest';

type Props = {scene: StatSceneProps; sceneDurationInFrames: number};

export const StatScene: React.FC<Props> = ({scene, sceneDurationInFrames}) => {
  const frame = useCurrentFrame();
  const progress = getMetricBarProgress(frame, sceneDurationInFrames, 0, 1);
  const displayValue = Math.round(scene.value * progress);

  return (
    <SceneCanvas>
      <SceneHeader
        title={scene.title}
        subtitle={scene.subtitle}
        accentColor={scene.accentColor}
        frame={frame}
        durationInFrames={sceneDurationInFrames}
      />
      <section style={{marginTop: 65}}>
        <div style={{fontSize: 34, fontWeight: 600, color: tokens.colors.muted}}>{scene.label}</div>
        <div style={{
          color: scene.accentColor,
          fontSize: 188,
          fontWeight: 800,
          lineHeight: 1.13,
          fontVariantNumeric: 'tabular-nums',
        }}>{displayValue}%</div>
        <div style={{
          width: '100%',
          height: 28,
          marginTop: 32,
          borderRadius: 14,
          background: tokens.colors.track,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${scene.value * progress}%`,
            height: '100%',
            borderRadius: 14,
            background: scene.accentColor,
          }} />
        </div>
      </section>
    </SceneCanvas>
  );
};
