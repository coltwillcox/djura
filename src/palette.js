// Sega Mega Drive / Genesis: 9-bit boja (3 bita po kanalu), nelinearni DAC nivoi.
export const MD_LEVELS = [0, 52, 87, 116, 144, 172, 206, 255];

// md(r, g, b) — svaki kanal 0..7, vraća hex broj za three.js
export function md(r, g, b) {
  return (MD_LEVELS[r] << 16) | (MD_LEVELS[g] << 8) | MD_LEVELS[b];
}

export function mdCss(r, g, b) {
  return `rgb(${MD_LEVELS[r]},${MD_LEVELS[g]},${MD_LEVELS[b]})`;
}

export const C = {
  black: md(0, 0, 0),
  white: md(7, 7, 7),
  grayD: md(2, 2, 2),
  gray: md(4, 4, 4),
  grayL: md(6, 6, 6),
  floorA: md(6, 6, 5),
  floorB: md(4, 4, 5),
  wall: md(5, 5, 6),
  wallD: md(3, 3, 5),
  glass: md(3, 5, 7),
  tarmac: md(2, 2, 3),
  grass: md(1, 4, 1),
  sky: md(2, 4, 7),
  police: md(0, 1, 4),
  policeL: md(1, 2, 6),
  skin: md(7, 5, 3),
  skinD: md(5, 3, 2),
  hair: md(2, 1, 0),
  mustache: md(1, 0, 0),
  red: md(7, 0, 0),
  redD: md(4, 0, 0),
  orange: md(7, 4, 0),
  yellow: md(7, 7, 0),
  gold: md(7, 5, 0),
  green: md(0, 5, 0),
  greenD: md(0, 3, 1),
  blue: md(0, 2, 7),
  cyan: md(0, 6, 7),
  purple: md(4, 0, 5),
  pink: md(7, 3, 5),
  brown: md(4, 2, 0),
  brownD: md(2, 1, 0),
  wood: md(5, 3, 1),
  money: md(2, 6, 2),
};
