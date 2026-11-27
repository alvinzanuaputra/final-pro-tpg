import React from 'react';
import { Composition } from 'remotion';
import { Trailer, TRAILER_FRAMES } from './Trailer';
import { FPS } from './theme';

// Dua bahasa dari timeline yang sama: Trailer (Inggris) dan TrailerID (Indonesia).
export const Root: React.FC = () => (
  <>
    <Composition id="Trailer" component={Trailer} defaultProps={{ lang: 'en' as const }}
      durationInFrames={TRAILER_FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="TrailerID" component={Trailer} defaultProps={{ lang: 'id' as const }}
      durationInFrames={TRAILER_FRAMES} fps={FPS} width={1920} height={1080} />
  </>
);
