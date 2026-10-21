// Ručno crtan 5x7 pikselni font za natpise u 3D sceni (sa č, ć, š, ž, đ).
// Na 224 linije antialiasovan tekst se raspadne, ovaj ostaje oštar.
const G = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  Đ: '####. .#..# .#..# ###.# .#..# .#..# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.',
  1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  2: '.###. #...# ....# ...#. ..#.. .#... #####',
  3: '####. ....# ....# .###. ....# ....# ####.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  5: '##### #.... ####. ....# ....# #...# .###.',
  6: '.###. #.... #.... ####. #...# #...# .###.',
  7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.',
  9: '.###. #...# #...# .#### ....# ....# .###.',
  ' ': '..... ..... ..... ..... ..... ..... .....',
  ':': '..... ..#.. ..#.. ..... ..#.. ..#.. .....',
  '-': '..... ..... ..... .###. ..... ..... .....',
  '.': '..... ..... ..... ..... ..... ..... ..#..',
  ',': '..... ..... ..... ..... ..... ..#.. .#...',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  '/': '....# ....# ...#. ..#.. .#... #.... #....',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
};
// znaci sa kvačicom/akcentom: osnovno slovo + dva reda iznad
const ACCENTED = { Č: ['C', '.#.#. ..#..'], Ć: ['C', '...#. ..#..'], Š: ['S', '.#.#. ..#..'], Ž: ['Z', '.#.#. ..#..'] };

function glyph(ch) {
  if (ACCENTED[ch]) {
    const [base, acc] = ACCENTED[ch];
    return { rows: G[base].split(' '), accent: acc.split(' ') };
  }
  return { rows: (G[ch] ?? G['?']).split(' '), accent: null };
}

const CW = 6; // 5 + razmak

/**
 * Crta linije teksta u canvas. lines: [{ text, color }], vraća canvas.
 * Ako linija ima slova sa kvačicom, dobija dva reda više za akcente.
 */
export function drawPixelText(lines, { bg, border, pad = 2, gap = 2, align = 'center' } = {}) {
  const prepared = lines.map((l) => {
    const chars = [...l.text.toUpperCase()].map(glyph);
    const tall = chars.some((c) => c.accent);
    return { ...l, chars, h: tall ? 9 : 7, w: chars.length * CW - 1 };
  });
  const innerW = Math.max(...prepared.map((l) => l.w));
  const innerH = prepared.reduce((s, l) => s + l.h, 0) + gap * (prepared.length - 1);
  const b = border ? 1 : 0;
  const cv = document.createElement('canvas');
  cv.width = innerW + 2 * (pad + b);
  cv.height = innerH + 2 * (pad + b);
  const x = cv.getContext('2d');
  if (border) { x.fillStyle = border; x.fillRect(0, 0, cv.width, cv.height); }
  x.fillStyle = bg;
  x.fillRect(b, b, cv.width - 2 * b, cv.height - 2 * b);

  let y = pad + b;
  for (const l of prepared) {
    let cx = pad + b + (align === 'center' ? Math.floor((innerW - l.w) / 2) : 0);
    x.fillStyle = l.color;
    const top = y + (l.h - 7);
    for (const g of l.chars) {
      g.rows.forEach((row, ry) => [...row].forEach((p, rx) => { if (p === '#') x.fillRect(cx + rx, top + ry, 1, 1); }));
      if (g.accent) g.accent.forEach((row, ry) => [...row].forEach((p, rx) => { if (p === '#') x.fillRect(cx + rx, top - 2 + ry, 1, 1); }));
      cx += CW;
    }
    y += l.h + gap;
  }
  return cv;
}
