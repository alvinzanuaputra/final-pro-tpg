"""Buat assets/font/sandtilt-5x7.ttf dari glyph 5x7 di js/font.js.

Modal HTML (kotak nama, KREDIT) memakai font ini supaya hurufnya PERSIS sama dengan teks di kanvas.
Satu titik glyph = 100 unit, 1 em = 800 unit (8 titik). Dengan font-size = 8 x ukuran titik (lihat
main.js, --mpx), setiap titik jatuh tepat di piksel layar → tajam, sama seperti kanvas.

Pemakaian (perlu Python + fontTools: pip install fonttools):
    python tools/make-font.py
Jalankan ulang setiap kali glyph di js/font.js (blok TEXT 5x7) diubah.
"""
import re
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "js" / "font.js"
OUT = ROOT / "assets" / "font" / "sandtilt-5x7.ttf"
UNIT, W, H = 100, 5, 7   # unit per titik, lebar & tinggi glyph (titik)


def read_glyphs():
    src = SRC.read_text(encoding="utf-8")
    block = src[src.index("const TEXT = compile({"):]
    block = block[: block.index("}, 5);")]
    pat = re.compile(r"""(?:'(.)'|"(.)"|([A-Za-z0-9])):\s*'([01 ]+)'""")
    glyphs = {}
    for m in pat.finditer(block):
        ch = m.group(1) or m.group(2) or m.group(3)
        rows = m.group(4).split()
        if len(rows) == H and all(len(r) == W for r in rows):
            glyphs[ch] = rows
    return glyphs


def draw(rows):
    """Titik-titik glyph → kotak (baris yang bersebelahan digabung per baris)."""
    pen = TTGlyphPen(None)
    for r, row in enumerate(rows):
        y0 = (H - 1 - r) * UNIT          # baris 0 = paling atas; baseline di bawah baris terakhir
        c = 0
        while c < W:
            if row[c] != "1":
                c += 1
                continue
            start = c
            while c < W and row[c] == "1":
                c += 1
            x0, x1, y1 = start * UNIT, c * UNIT, y0 + UNIT
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    return pen.glyph()


def main():
    glyphs = read_glyphs()
    names, cmap, outlines, metrics = [".notdef", "space"], {32: "space"}, {}, {}
    adv = (W + 1) * UNIT
    empty = TTGlyphPen(None).glyph()
    outlines[".notdef"] = draw(glyphs["?"])
    outlines["space"] = empty
    for ch, rows in glyphs.items():
        if ch == " ":
            continue
        name = f"uni{ord(ch):04X}"
        names.append(name)
        cmap[ord(ch)] = name
        outlines[name] = draw(rows)
        # huruf kecil memakai bentuk kapital (teks game selalu kapital)
        if ch.isalpha() and ch.isupper():
            cmap[ord(ch.lower())] = name
    for n in names:
        metrics[n] = (adv, 0)

    fb = FontBuilder(8 * UNIT, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(outlines)
    fb.setupHorizontalMetrics(metrics)
    asc, desc = (H + 1) * UNIT, -2 * UNIT   # 1 titik ruang di atas, 2 titik di bawah → baris 10 titik
    fb.setupHorizontalHeader(ascent=asc, descent=desc)
    fb.setupNameTable({"familyName": "SandTilt Pixel", "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0, usWinAscent=asc, usWinDescent=-desc,
                sxHeight=H * UNIT, sCapHeight=H * UNIT)
    fb.setupPost()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fb.save(str(OUT))
    print(f"{OUT.relative_to(ROOT)}: {len(glyphs)} glyph dari js/font.js, {OUT.stat().st_size} byte")


if __name__ == "__main__":
    main()
