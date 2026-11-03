import React from 'react';
import {useCurrentFrame} from 'remotion';
import {SceneCanvas} from '../components/SceneCanvas';
import {easeOutCubic, getEnterExitMotion, normalizedFrameProgress} from '../design/motion';
import {tokens} from '../design/tokens';
import type {TitleSceneProps} from '../manifest';

type Props = {scene: TitleSceneProps; sceneDurationInFrames: number};

/** Individual words are revealed from the local frame index; random access is safe. */
export const TitleScene: React.FC<Props> = ({scene, sceneDurationInFrames}) => {
  const frame = useCurrentFrame();
  const motion = getEnterExitMotion(frame, sceneDurationInFrames);
  const words = scene.title.split(/\s+/);

  return (
    <SceneCanvas>
      <div style={{
        display: 'flex',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'center',
        opacity: motion.opacity,
        transform: `translateY(${motion.translateY}px)`,
      }}>
        <div style={{
          color: scene.accentColor,
          fontSize: tokens.fontSizes.eyebrow,
          fontWeight: 700,
          letterSpacing: 5,
          marginBottom: 25,
        }}>
          {scene.eyebrow}
        </div>
        <h1 style={{
          margin: 0,
          fontSize: scene.title.length > 42 ? 86 : 106,
          lineHeight: 1.16,
          letterSpacing: -2,
          maxWidth: 1560,
        }}>
          {words.map((word, index) => {
            const start = Math.min(index * 3, Math.floor(sceneDurationInFrames * 0.35));
            const intro = sceneDurationInFrames < 4
              ? 1
              : easeOutCubic(normalizedFrameProgress(
                frame,
                start,
                Math.max(1, Math.min(12, Math.floor(sceneDurationInFrames * 0.2))),
              ));
            return (
              <span key={index} style={{
                display: 'inline-block',
                marginRight: 21,
                opacity: intro,
                transform: `translateY(${(1 - intro) * 38}px)`,
              }}>{word}</span>
            );
          })}
        </h1>
        <p style={{
          maxWidth: 1400,
          marginTop: 30,
          fontSize: 34,
          lineHeight: 1.3,
          color: tokens.colors.muted,
          overflowWrap: 'anywhere',
        }}>
          {scene.subtitle}
        </p>
      </div>
    </SceneCanvas>
  );
};
