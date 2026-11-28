import React from 'react';
import { Composition } from 'remotion';
import { Trailer, TRAILER_FRAMES } from './Trailer';
import { Short, SHORT_FRAMES, SHORT_H, SHORT_W } from './Short';
import { FPS } from './theme';

// Trailer utama (1920x1080) dan versi vertikal 15 dtk untuk sosmed (1080x1920), masing-masing Inggris + Indonesia.
export const Root: React.FC = () => (
  <>
    <Composition id="Trailer" component={Trailer} defaultProps={{ lang: 'en' as const }}
      durationInFrames={TRAILER_FRAMES.en} fps={FPS} width={1920} height={1080} />
    <Composition id="TrailerID" component={Trailer} defaultProps={{ lang: 'id' as const }}
      durationInFrames={TRAILER_FRAMES.id} fps={FPS} width={1920} height={1080} />
    <Composition id="Short" component={Short} defaultProps={{ lang: 'en' as const }}
      durationInFrames={SHORT_FRAMES.en} fps={FPS} width={SHORT_W} height={SHORT_H} />
    <Composition id="ShortID" component={Short} defaultProps={{ lang: 'id' as const }}
      durationInFrames={SHORT_FRAMES.id} fps={FPS} width={SHORT_W} height={SHORT_H} />
  </>
);
