import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const FPS = 60;
export const sec = (s: number) => Math.round(s * FPS);

// Warna diambil dari palet game
export const C = {
  bg: '#13111d',
  bgLine: '#1d1a2b',
  text: '#f4f1ff',
  dim: '#8a84a8',
  red: '#e8505b',
  yellow: '#f2c14e',
  green: '#3fbf9b',
  blue: '#5b8def',
  purple: '#a070e0',
};
export const LOGO_COLORS = [C.red, C.yellow, C.green, C.blue, C.yellow, C.red, C.green, C.blue];

export const PIXEL_FONT = 'KenneyPixel';
loadFont({ family: PIXEL_FONT, url: staticFile('game/font/kenney-pixel.ttf') });
