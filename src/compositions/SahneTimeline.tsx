import React from 'react';
import {Series} from 'remotion';
import type {TimelineManifest} from '../manifest';
import {ComparisonScene} from './ComparisonScene';
import {DiagramScene} from './DiagramScene';
import {SahneDemo} from './SahneDemo';
import {StatScene} from './StatScene';
import {TitleScene} from './TitleScene';

type Props = {manifest: TimelineManifest};
type SceneBlock = TimelineManifest['scenes'][number];

const renderScene = (scene: SceneBlock): React.ReactNode => {
  switch (scene.type) {
    case 'metrics':
      return <SahneDemo scene={scene.props} sceneDurationInFrames={scene.durationInFrames} />;
    case 'title':
      return <TitleScene scene={scene.props} sceneDurationInFrames={scene.durationInFrames} />;
    case 'stat':
      return <StatScene scene={scene.props} sceneDurationInFrames={scene.durationInFrames} />;
    case 'comparison':
      return <ComparisonScene scene={scene.props} sceneDurationInFrames={scene.durationInFrames} />;
    case 'diagram':
      return <DiagramScene scene={scene.props} sceneDurationInFrames={scene.durationInFrames} />;
  }
};

/** Series.Sequence resets each child to local frame zero; no overlaps in v1. */
export const SahneTimeline: React.FC<Props> = ({manifest}) => (
  <Series>
    {manifest.scenes.map((scene) => (
      <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
        {renderScene(scene)}
      </Series.Sequence>
    ))}
  </Series>
);
