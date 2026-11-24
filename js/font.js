// Bitmap font pixel 3x5 buatan sendiri (tanpa file font eksternal).
// Setiap glyph = 5 baris x 3 kolom, ditulis berurutan sebagai 15 karakter '0'/'1'.
const G = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  ' ': '000000000000000', '.': '000000000000010', ',': '000000000010100', ':': '000010000010000',
  '!': '010010010000010', '?': '110001010000010', '-': '000000111000000', '+': '000010111010000',
  '/': '001001010100100', '#': '101111101111101', '(': '010100100100010', ')': '010001001001010',
  "'": '010010000000000', '%': '101001010100101', '>': '100010001010100', '<': '001010100010001',
  '_': '000000000000111', '^': '010101000000000', '=': '000111000111000', '*': '000101010101000',
};

// Ubah string glyph jadi daftar titik supaya menggambar cepat.
const PTS = {};
for (const [ch, bits] of Object.entries(G)) {
  const pts = [];
  for (let i = 0; i < 15; i++) if (bits[i] === '1') pts.push(i % 3, (i / 3) | 0);
  PTS[ch] = pts;
}

export const CHAR_W = 4; // 3 piksel + 1 spasi

export function textWidth(str, scale = 1) {
  return str.length === 0 ? 0 : (str.length * CHAR_W - 1) * scale;
}

// align: 'left' | 'center' | 'right'
export function drawText(ctx, str, x, y, color, scale = 1, align = 'left') {
  str = String(str).toUpperCase();
  if (align === 'center') x -= Math.floor(textWidth(str, scale) / 2);
  else if (align === 'right') x -= textWidth(str, scale);
  ctx.fillStyle = color;
  for (let n = 0; n < str.length; n++) {
    const pts = PTS[str[n]] || PTS['?'];
    const ox = x + n * CHAR_W * scale;
    for (let k = 0; k < pts.length; k += 2) {
      ctx.fillRect(ox + pts[k] * scale, y + pts[k + 1] * scale, scale, scale);
    }
  }
}
