// Game stickers: a rounded square with a squiggly, hand-cut edge, in the game's colour, with its line icon
// and a worn finish (paper grain, a few rubbed-off spots, slightly faded ink). The same drawing is used on
// the home screen (inline SVG) and on the share image (rasterised onto the canvas).
import { ICONS } from './icons.js';

const FLAME = '<path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.5 2-3.3C17.5 10.6 19 13 19 15.5A7 7 0 0 1 5 15.5C5 10 10 8 12 2z"/>';
export const STICKER = {  // colour, seed for its scuffs
  rewire: ['#3F7FC4', 3], hunch: ['#C99A1E', 8], link: ['#2C9A88', 14], tangle: ['#DD7444', 21],
  anagram: ['#CF4F7D', 30], ladder: ['#7D5FC6', 41], streak: ['#E9A13B', 52],
};
const iconOf = k => k === 'streak' ? FLAME : ICONS[k];

// Ink that has sat in the sun a little: mixed 10% towards the paper colour.
const fade = hex => '#' + [1, 3, 5].map((i, n) => {
  const c = parseInt(hex.slice(i, i + 2), 16), p = [0xF4, 0xEF, 0xE3][n];
  return Math.round(c + (p - c) * 0.1).toString(16).padStart(2, '0');
}).join('');

// Outline of a rounded square whose edge wobbles unevenly (two waves of unrelated lengths), like scissors.
function squiggle(half = 46.5, r = 15, amp = 1.6, wave = 8.5, steps = 320) {
  const s = half - r, straight = 2 * s, arc = Math.PI * r / 2, per = 4 * (straight + arc), pts = [];
  for (let i = 0; i < steps; i++) {
    const L = per * i / steps, side = Math.floor(L / (straight + arc)), t = L - side * (straight + arc);
    const a0 = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][side];
    let x, y, nx, ny;
    if (t < straight) {
      const u = -s + t; nx = Math.cos(a0); ny = Math.sin(a0);
      x = nx * half - ny * u; y = ny * half + nx * u;
    } else {
      const a = a0 + (t - straight) / r; nx = Math.cos(a); ny = Math.sin(a);
      x = Math.cos(a0) * s + Math.cos(a0 + Math.PI / 2) * s + nx * r;
      y = Math.sin(a0) * s + Math.sin(a0 + Math.PI / 2) * s + ny * r;
    }
    const off = amp * (0.65 * Math.sin(2 * Math.PI * L / (wave * 2.9) + 0.7) + 0.35 * Math.sin(2 * Math.PI * L / (wave * 1.13) + 2.1));
    pts.push(`${(50 + x + nx * off).toFixed(1)} ${(50 + y + ny * off).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}
export const EDGE = squiggle();
const INNER = 'x="9" y="9" width="82" height="82" rx="12"';

// The shared filters and clips, with ids prefixed by p so several copies can live on one page.
function defs(p) {
  return `<filter id="${p}sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0.5" dy="1.6" stdDeviation="1.1" flood-color="#3A2A1A" flood-opacity=".26"/></filter>
    <filter id="${p}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 .55  0 0 0 0 .5  0 0 0 0 .44  0 0 0 -1.6 1.15"/></filter>
    <clipPath id="${p}in"><rect ${INNER}/></clipPath><clipPath id="${p}out"><path d="${EDGE}"/></clipPath>
    ${Object.entries(STICKER).map(([k, [, seed]]) => `<filter id="${p}scuff-${k}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 .98  0 0 0 0 .96  0 0 0 0 .92  -18 0 0 0 5.5"/></filter>`).join('')}`;
}

// One sticker's drawing in a 100x100 box. withText: leave room for a result line under a smaller icon.
function body(p, k, withText) {
  const [c] = STICKER[k], [x, y, s] = withText ? [31, 20, 38] : [24, 24, 52];
  return `<path d="${EDGE}" fill="#F7F3EA" filter="url(#${p}sh)"/>
    <rect ${INNER} fill="${fade(c)}"/>
    <svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#FFFDF7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconOf(k)}</svg>
    <rect x="0" y="0" width="100" height="100" fill="#fff" filter="url(#${p}scuff-${k})" opacity=".45" clip-path="url(#${p}in)"/>
    <path d="M9 40 L40 9 H52 L9 52 Z" fill="#fff" opacity=".1" clip-path="url(#${p}in)"/>
    <rect x="0" y="0" width="100" height="100" filter="url(#${p}grain)" opacity=".55" clip-path="url(#${p}out)" style="mix-blend-mode: multiply"/>`;
}

// On the page: the symbols live once in a hidden <svg>; each sticker is a small <svg><use>.
export function ensureStickerDefs() {
  if (document.getElementById('dd-stickers')) return;
  const holder = document.createElement('div');
  holder.innerHTML = `<svg id="dd-stickers" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defs('dd-')}
    ${Object.keys(STICKER).map(k => `<symbol id="dd-st-${k}" viewBox="0 0 100 100" overflow="visible">${body('dd-', k, false)}</symbol>`).join('')}</defs></svg>`;
  document.body.appendChild(holder.firstElementChild);
}
export const sticker = (k, size, cls = '', style = '') =>
  `<svg class="sticker ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" style="${style}" aria-hidden="true"><use href="#dd-st-${k}"/></svg>`;

// For the share image: one sticker as a standalone SVG document (no text; the result is drawn on top).
export const stickerSvgDoc = (k, px) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="-6 -6 112 112"><defs>${defs('s-')}</defs>${body('s-', k, true)}</svg>`;
