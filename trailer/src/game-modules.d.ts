declare module '*/js/font.js' {
  export function drawBlockText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: string, scale?: number): void;
  export function blockTextWidth(str: string, scale?: number): number;
  export function drawText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: string, px: number, align?: 'left' | 'center' | 'right'): void;
  export function textWidthPx(str: string, px: number): number;
  export const GLYPH_H: number;
}
declare module '*/js/render.js' {
  export const PALETTES: Record<string, {
    bg: string; boardA: string; boardB: string; frame: string; text: string; dim: string;
    accent: string; danger: string; shadow: string; sand: string[];
  }>;
}
