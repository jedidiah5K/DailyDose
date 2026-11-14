// Shared drawing helpers for the three café hub directions (mockups only).
import { MOCK, MOCK_DONE } from './mock.js';

const q = new URLSearchParams(location.search);
export const data = q.get('done') ? MOCK_DONE : MOCK;
// Time of day follows the player's clock; ?t=day|night forces it for screenshots.
export const night = q.get('t') ? q.get('t') === 'night' : (h => h < 7 || h >= 18)(new Date().getHours());
document.documentElement.dataset.time = night ? 'night' : 'day';
if (q.get('done')) document.documentElement.dataset.done = '1';

// ---------- pixel people ----------
const LOOKS = [
  { hair: '#2B1B12', skin: '#8D5524', shirt: '#E4572E', pants: '#2E3A59' },
  { hair: '#120C08', skin: '#5C3A21', shirt: '#F3C94B', pants: '#3B3B3B' },
  { hair: '#B5651D', skin: '#F1C27D', shirt: '#4C9F70', pants: '#24304A' },
  { hair: '#6B4226', skin: '#C68642', shirt: '#7FA7D9', pants: '#4A3B2A' },
  { hair: '#D9C9A8', skin: '#FFDBAC', shirt: '#B85C8A', pants: '#2F2F3A' },
  { hair: '#1E1E1E', skin: '#A0663C', shirt: '#F28C38', pants: '#1F4E5F' },
  { hair: '#4A2C1A', skin: '#E0AC69', shirt: '#5B6CC2', pants: '#3A2E2A' },
];
export function person(look, px = 4, extra = '') {
  const c = LOOKS[look % LOOKS.length];
  const r = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
  return `<svg class="px-person ${extra}" width="${7 * px}" height="${12 * px}" viewBox="0 0 7 12" shape-rendering="crispEdges" aria-hidden="true">
    ${r(1, 0, 5, 1, c.hair)}${r(0, 1, 7, 1, c.hair)}${r(0, 2, 1, 2, c.hair)}${r(6, 2, 1, 2, c.hair)}
    ${r(1, 2, 5, 3, c.skin)}${r(2, 3, 1, 1, '#1A1110')}${r(4, 3, 1, 1, '#1A1110')}
    ${r(0, 5, 7, 4, c.shirt)}${r(0, 8, 1, 1, c.skin)}${r(6, 8, 1, 1, c.skin)}
    <g class="px-legs">${r(1, 9, 2, 2, c.pants)}${r(4, 9, 2, 2, c.pants)}${r(1, 11, 2, 1, '#1A1110')}${r(4, 11, 2, 1, '#1A1110')}</g>
  </svg>`;
}

// Regulars hanging out inside: a café table with two people, one sipping, one on a laptop.
export function table(a, b, { px = 3, top = '#C98A50', edge = '#7A4524' } = {}) {
  const r = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
  const bust = (ox, look) => { // head and shoulders above the table top
    const c = LOOKS[look % LOOKS.length];
    return `${r(ox + 1, 0, 5, 1, c.hair)}${r(ox, 1, 7, 1, c.hair)}${r(ox, 2, 1, 2, c.hair)}${r(ox + 6, 2, 1, 2, c.hair)}
      ${r(ox + 1, 2, 5, 3, c.skin)}${r(ox + 2, 3, 1, 1, '#1A1110')}${r(ox + 4, 3, 1, 1, '#1A1110')}${r(ox, 5, 7, 4, c.shirt)}`;
  };
  return `<svg class="px-table" width="${30 * px}" height="${16 * px}" viewBox="0 0 30 16" shape-rendering="crispEdges" aria-hidden="true">
    <g>${bust(1, a)}</g>
    <g class="px-nod">${bust(22, b)}</g>
    <g class="px-sip">${r(8, 6, 3, 3, '#FFF6E6')}${r(11, 7, 1, 1, '#FFF6E6')}${r(8, 6, 3, 1, '#7A4A2A')}</g>
    ${r(15, 4, 6, 5, '#B9C0CA')}${r(17, 6, 2, 1, '#FFFFFF')}
    ${r(0, 9, 30, 1, top)}${r(0, 10, 30, 1, edge)}${r(14, 11, 2, 4, edge)}${r(10, 15, 10, 1, edge)}
  </svg>`;
}

// ---------- pixel sprites from text maps ('.' = empty, each other letter = a palette colour) ----------
export function pixel(rows, pal, cls = '', extra = '') {
  let out = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x]; let w = 1;
      while (row[x + w] === ch) w++;
      if (ch !== '.') out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${pal[ch]}"/>`;
      x += w;
    }
  });
  const W = Math.max(...rows.map(r => r.length));
  return `<svg class="px ${cls}" viewBox="0 0 ${W} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${out}${extra}</svg>`;
}
const SIAMESE = [
  '...D........D....',
  '..DDD......DDD...',
  '..DCCCCCCCCCCD...',
  '..CCCDDDDDDCCC...',
  '..CCDD....DDCC...',
  '..CCDDDDDDDDCC...',
  '...CCDDNNDDCC....',
  '....CTTTTTTC.....',
  '...CCCCYCCCCC....',
  '..CCCCCCCCCCCC...',
  '..CCCCCCCCCCCC...',
  '..CCCCCCCCCCCC...',
  '..CCCCCCCCCCCC...',
  '..DDCCCCCCCCDD...',
];
export function siamese() {
  const pal = { D: '#4A2E22', C: '#F1E2C6', N: '#24150F', T: '#2FA7A0', Y: '#F2C94C' };
  // eyes and tail sit in their own groups so they can blink and flick
  return pixel(SIAMESE, pal, 'px-cat',
    `<g class="cat-eyes"><rect x="4" y="4" width="2" height="1" fill="#5BC8F0"/><rect x="10" y="4" width="2" height="1" fill="#5BC8F0"/></g>
     <g class="cat-tail2"><rect x="14" y="9" width="1" height="4" fill="#4A2E22"/><rect x="15" y="7" width="1" height="3" fill="#4A2E22"/><rect x="13" y="12" width="2" height="1" fill="#4A2E22"/></g>`);
}
const MALTESE = [
  '..WWW......WWW..',
  '.WWWWWWWWWWWWWW.',
  'GWWWWWWWWWWWWWWG',
  'GWWWKWWWWWWKWWWG',
  'GWWWWWWWWWWWWWWG',
  '.GWWWWWKKWWWWWG.',
  '.GWWWWWPPWWWWWG.',
  '..GWWWWWWWWWWG..',
  '..WWWWWWWWWWWW..',
  '.WWWWWWWWWWWWWW.',
  '.WWWWWWWWWWWWWWG',
  'GWWWWWWWWWWWWWWG',
  'GWWWGWWWWWWGWWWG',
  '.GWWWG....GWWWG.',
];
export function maltese() {
  return pixel(MALTESE, { W: '#FFFDF8', G: '#D9D2C7', K: '#1D1714', P: '#E77A8B' }, 'px-dog');
}
// A drink in pixels: empty with a dark inside until played, then full with latte art and a tick.
export function pxCup(g) {
  const rows = [
    'OOOOOOOOOOO...',
    'OFFFFFFFFFO...',
    'OWWWWWWWWWOOO.',
    'OSSSSSSSSSO.O.',
    'OSSSSSSSSSO.O.',
    'OSSSSSSSSSOOO.',
    'OWWWWWWWWWO...',
    '.OWWWWWWWO....',
    '..OOOOOOO.....',
  ];
  const pal = { O: '#5A3A24', W: '#FFFDF6', S: g.colour, F: g.done ? '#B9773F' : '#3A2A1E' };
  const extra = g.done
    ? `<rect x="4" y="1" width="3" height="1" fill="#F6E3C6"/><rect x="3" y="4" width="1" height="1" fill="${g.ink}"/><rect x="4" y="5" width="1" height="1" fill="${g.ink}"/><rect x="5" y="4" width="1" height="1" fill="${g.ink}"/><rect x="6" y="3" width="1" height="1" fill="${g.ink}"/>`
    : '';
  return pixel(rows, pal, `px-cup ${g.done ? 'is-done' : 'is-open'}`, extra);
}

// The Siamese curled up asleep (eyes shut), for the windowsill.
export function siameseAsleep() {
  return pixel([
    '.D..D.............',
    '.DDDD.............',
    'DDDDDD.CCCCCCC....',
    'DKDDKDCCCCCCCCC...',
    'DDNNDDCCCCCCCCCC..',
    '.TTTTCCCCCCCCCCCDD',
    '.CCCCCCCCCCCCCCC.D',
    'CDDCCCCCCCCCCDDCDD',
  ], { D: '#4A2E22', C: '#F1E2C6', K: '#24150F', N: '#24150F', T: '#2FA7A0' }, 'px-cat-asleep');
}

// The espresso machine, centre of the counter. The gap under the spout is where a shot glass slides in.
export function espressoMachine() {
  return pixel([
    '....SSSSSSSSSSSSSSSSSS....',
    '...SMMMMMMMMMMMMMMMMMMS...',
    '..RRRRRRRRRRRRRRRRRRRRRR..',
    '..RHHHHHHHHHHHHHHHHHHHHR..',
    '..RRRRRRRRRRRRRRRRRRRRRR..',
    '..RRRGGRRRRRRRRRRRRGGRRR..',
    '..RRRGGRRRRRRRRRRRRGGRRR..',
    '..RRRRRRRRRRRRRRRRRRRRRR..',
    '..RRRRRRRRMMMMMMRRRRRRRR..',
    '..RRRRRRRRRMMMMBBBBBRRRR..',
    '..RRRRRRRRRRMMRRRRRRRRRR..',
    '..RRXXXXXXXXXXXXXXXXXXRR..',
    '..RRXXXXXXXXXXXXXXXXXXRR..',
    '..RRXXXXXXXXXXXXXXXXXXRR..',
    '..RRXXXXXXXXXXXXXXXXXXRR..',
    '..RRXXXXXXXXXXXXXXXXXXRR..',
    '..RRXXXXXXXXXXXXXXXXXXRR..',
    '..RRSSSSSSSSSSSSSSSSSSRR..',
    '..DDDDDDDDDDDDDDDDDDDDDD..',
    '.KKKKKKKKKKKKKKKKKKKKKKKK.',
  ], { S: '#B9B4AA', M: '#E6E2DA', R: '#7E9A78', H: '#A3BC9C', G: '#FFF4DE', B: '#6B4226', X: '#3E4B3A', D: '#5F7A5A', K: '#3A2A1E' }, 'px-machine');
}

// A shot glass: empty glass with the game's colour band until played, then full of espresso with crema.
export function shotGlass(g) {
  const full = g.done;
  return pixel([
    'OGGGGGO',
    'OCCCCCO',
    full ? 'OAAAAAO' : 'OGGGGGO',
    full ? 'OEEEEEO' : 'OGGGGGO',
    full ? 'OEEEEEO' : 'OGGGGGO',
    full ? 'OEEEEEO' : 'OGGGGGO',
    full ? '.OEEEO.' : '.OGGGO.',
    '.OOOOO.',
    'OOOOOOO',
  ], { O: '#6B5442', G: 'rgba(255,255,255,.55)', C: g.colour, A: '#C98A50', E: '#4A2A18' }, `px-shot ${full ? 'is-done' : 'is-open'}`);
}

// The street crowd grows in tiers with today's player count: it never tries to draw everyone.
export function crowdSize(players) {
  return players < 500 ? 3 : players < 5000 ? 6 : players < 25000 ? 9 : 13;
}
export function walkers(n, { px = 3, seed = 7 } = {}) {
  let s = seed, out = '';
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const dur = 16 + rnd() * 18, delay = -rnd() * dur, left = rnd() < 0.4, lane = Math.floor(rnd() * 3);
    out += `<div class="walker lane${lane} ${left ? 'to-left' : ''}" style="animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s">${person(Math.floor(rnd() * 7), px - (lane === 0 ? 1 : 0))}</div>`;
  }
  return out;
}

// ---------- cups ----------
// Open cups are empty and their sleeve plays the game's little idle animation.
// Finished cups are full, with latte art in the foam and the result on the sleeve.
const MOTIF = {
  shot: `<circle class="m-blink" cx="28" cy="42" r="4.5" fill="currentColor"/><path d="M28 34 L22 50 H34 Z" fill="currentColor" opacity=".25" class="m-blink"/>`,
  blend: `<circle cx="20" cy="40" r="2.6" fill="currentColor"/><circle cx="25" cy="44" r="2.6" fill="currentColor"/><circle cx="19" cy="46" r="2.6" fill="currentColor"/><circle class="m-drift" cx="34" cy="42" r="2.6" fill="currentColor"/>`,
  rush: `<rect class="m-shrink" x="15" y="40" width="26" height="5" rx="2.5" fill="currentColor"/>`,
  drop: `<ellipse class="m-flip" cx="28" cy="42" rx="6" ry="6" fill="currentColor"/><text x="28" y="44.5" text-anchor="middle" font-size="7" font-weight="800" fill="rgba(0,0,0,.45)" class="m-flip">$</text>`,
  link: `<circle class="m-linkL" cx="23" cy="42" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle class="m-linkR" cx="33" cy="42" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/>`,
  ladder: `<text class="m-swapA" x="28" y="46" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor">CAT</text><text class="m-swapB" x="28" y="46" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor">COT</text>`,
};
const ART = { // latte art in the foam once served
  shot: `<circle cx="28" cy="15" r="3" fill="#FFF4DE"/>`,
  blend: `<path d="M20 15 q8 -6 16 0 q-8 5 -16 0z" fill="#FFF4DE"/>`,
  rush: `<path d="M22 13 l6 4 l6 -4" stroke="#FFF4DE" stroke-width="2" fill="none"/>`,
  drop: `<circle cx="28" cy="15" r="3.5" fill="none" stroke="#FFF4DE" stroke-width="1.6"/>`,
  link: `<circle cx="25" cy="15" r="2.6" fill="none" stroke="#FFF4DE" stroke-width="1.4"/><circle cx="31" cy="15" r="2.6" fill="none" stroke="#FFF4DE" stroke-width="1.4"/>`,
  ladder: `<path d="M24 12v6M32 12v6M24 14h8M24 16.5h8" stroke="#FFF4DE" stroke-width="1.2"/>`,
};
export function cup(g, { body = '#FFFFFF', line = 'none', lw = 0, w = 56 } = {}) {
  const st = lw ? `stroke="${line}" stroke-width="${lw}" stroke-linejoin="round"` : '';
  const foam = g.done
    ? `<ellipse cx="28" cy="15" rx="17" ry="5.5" fill="#B9773F"/><ellipse cx="28" cy="15.5" rx="13" ry="3.8" fill="#D9A26A"/>${ART[g.key]}`
    : `<ellipse cx="28" cy="15" rx="17" ry="5.5" fill="rgba(0,0,0,.28)"/>`;
  const sleeve = g.done
    ? `<path d="M11.2 33 H44.8 L43.3 51 H12.7 Z" fill="${g.colour}" ${st}/><path d="M22 42 l4 4 l8 -8" stroke="${g.ink}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M11.2 33 H44.8 L43.3 51 H12.7 Z" fill="${g.colour}" ${st}/><g style="color:${g.ink}">${MOTIF[g.key]}</g>`;
  return `<svg class="cup ${g.done ? 'is-done' : 'is-open'}" width="${w}" height="${w * 1.25}" viewBox="0 0 56 70" aria-hidden="true">
    <path d="M44 24 q11 2 9 14 q-2 9 -11 9" fill="none" stroke="${body}" stroke-width="5" ${lw ? '' : ''}/>
    ${lw ? `<path d="M44 24 q11 2 9 14 q-2 9 -11 9" fill="none" stroke="${line}" stroke-width="${lw}" opacity=".9"/>` : ''}
    <path d="M9 15 L47 15 L42 63 Q28 68 14 63 Z" fill="${body}" ${st}/>
    ${sleeve}
    <ellipse cx="28" cy="15" rx="19" ry="6.5" fill="${body}" ${st}/>
    ${foam}
    ${g.done ? '' : '<g class="steam-none"></g>'}
  </svg>`;
}

// ---------- props ----------
export function machine({ body = '#C0392B', metal = '#D9D9D9', line = 'none', lw = 0, w = 120 } = {}) {
  const st = lw ? `stroke="${line}" stroke-width="${lw}" stroke-linejoin="round"` : '';
  return `<svg class="machine" width="${w}" height="${w * 0.95}" viewBox="0 0 120 114" aria-hidden="true">
    <g class="steam"><path d="M46 40 q-6 -10 0 -18 q6 -8 0 -18" /><path d="M60 42 q-6 -10 0 -18 q6 -8 0 -18" /><path d="M74 40 q-6 -10 0 -18 q6 -8 0 -18"/></g>
    <rect x="12" y="38" width="96" height="64" rx="14" fill="${body}" ${st}/>
    <rect x="22" y="30" width="76" height="14" rx="7" fill="${metal}" ${st}/>
    <circle cx="38" cy="58" r="8" fill="#FFF7E8" ${st}/><path d="M38 58 l4 -4" stroke="#222" stroke-width="1.6"/>
    <circle cx="82" cy="58" r="8" fill="#FFF7E8" ${st}/><path d="M82 58 l-3 -4" stroke="#222" stroke-width="1.6"/>
    <rect x="48" y="72" width="24" height="9" rx="3" fill="${metal}" ${st}/><rect x="56" y="80" width="8" height="8" fill="${metal}" ${st}/>
    <rect x="16" y="102" width="88" height="8" rx="3" fill="${metal}" ${st}/>
  </svg>`;
}
export function cat({ fur = '#E8A95B', stripe = '#C77D34', line = 'none', lw = 0, w = 74 } = {}) {
  const st = lw ? `stroke="${line}" stroke-width="${lw}" stroke-linejoin="round"` : '';
  return `<svg class="cat" width="${w}" height="${w * 0.75}" viewBox="0 0 80 60" aria-hidden="true">
    <path class="cat-tail" d="M64 50 q16 -2 12 -18 q-2 -6 -6 -4 q3 10 -8 14" fill="${fur}" ${st}/>
    <path d="M10 56 q-2 -26 22 -28 q26 -1 32 14 q4 14 -6 14 Z" fill="${fur}" ${st}/>
    <path d="M28 34 q4 6 0 12 M40 31 q4 6 0 12 M52 34 q3 6 0 10" stroke="${stripe}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M8 36 l2 -14 l8 8 q6 -3 12 0 l8 -8 l2 14 q0 14 -16 14 q-16 0 -16 -14z" fill="${fur}" ${st}/>
    <g class="cat-eyes"><path d="M15 38 q3 2 6 0 M27 38 q3 2 6 0" stroke="#2A1A10" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>
    <path d="M22.5 42 l1.5 1.5 l1.5 -1.5" stroke="#2A1A10" stroke-width="1.4" fill="none"/>
    <path d="M10 20 l3 5 M38 20 l-3 5" stroke="#F4B6A6" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}
export function dog({ line = 'none', lw = 0, w = 70 } = {}) {
  const st = lw ? `stroke="${line}" stroke-width="${lw}" stroke-linejoin="round"` : '';
  // A sitting Rottweiler: black coat, tan muzzle, brows and chest.
  return `<svg class="dog" width="${w}" height="${w * 1.15}" viewBox="0 0 70 80" aria-hidden="true">
    <path class="dog-tail" d="M54 66 q10 -4 10 -12" stroke="#1C1714" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M18 78 q-4 -30 12 -38 q20 -6 26 14 q4 14 2 24 Z" fill="#1C1714" ${st}/>
    <path d="M28 52 q6 6 12 0 q-2 12 -6 14 q-4 -2 -6 -14z" fill="#B5652B"/>
    <path d="M14 26 q0 -16 18 -16 q18 0 18 16 q0 16 -18 18 q-18 -2 -18 -18z" fill="#1C1714" ${st}/>
    <path d="M12 16 q-6 4 -4 14 q4 0 8 -8z M52 16 q6 4 4 14 q-4 0 -8 -8z" fill="#2A221D"/>
    <path d="M22 30 q10 14 20 0 q-2 12 -10 12 q-8 0 -10 -12z" fill="#B5652B"/>
    <ellipse cx="32" cy="31" rx="4" ry="3" fill="#0D0A09"/>
    <circle cx="25" cy="22" r="2" fill="#F5E6D3"/><circle cx="39" cy="22" r="2" fill="#F5E6D3"/>
    <circle cx="25" cy="22" r="1.1" fill="#0D0A09"/><circle cx="39" cy="22" r="1.1" fill="#0D0A09"/>
    <circle cx="25" cy="18.5" r="1.6" fill="#B5652B"/><circle cx="39" cy="18.5" r="1.6" fill="#B5652B"/>
    <path class="dog-tongue" d="M30 37 q2 6 4 0z" fill="#E77A8B"/>
  </svg>`;
}
export function flame(streak, size = 26) {
  const s = streak >= 100 ? 1.5 : streak >= 30 ? 1.3 : streak >= 7 ? 1.15 : 1;
  return `<svg class="flame" width="${size * s}" height="${size * s * 1.25}" viewBox="0 0 24 30" aria-hidden="true">
    <path d="M12 1 q3 7 8 11 q4 5 2 11 q-2 6 -10 6 q-8 0 -10 -6 q-2 -6 3 -11 q1 4 4 5 q-1 -9 3 -16z" fill="#FF6B2C"/>
    <path class="flame-core" d="M12 12 q2 4 4 6 q2 3 0 6 q-1 3 -4 3 q-3 0 -4 -3 q-1 -3 1 -5 q1 2 2 2 q-1 -5 1 -9z" fill="#FFC93C"/>
  </svg>`;
}

// ---------- rolling digits ----------
export function rollingClock(el) {
  const cols = [];
  el.innerHTML = '';
  el.setAttribute('aria-live', 'off');
  for (let i = 0; i < 8; i++) {
    if (i === 2 || i === 5) { const s = document.createElement('span'); s.className = 'roll-sep'; s.textContent = ':'; el.append(s); continue; }
    const c = document.createElement('span'); c.className = 'roll-col';
    c.innerHTML = '<span class="roll-strip">' + [...'0123456789'].map(d => `<span>${d}</span>`).join('') + '</span>';
    el.append(c); cols.push(c.firstChild);
  }
  const tick = () => {
    const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0);
    let s = Math.floor((m - n) / 1000);
    const str = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, '0')).join('');
    [...str].forEach((d, i) => { cols[i].style.transform = `translateY(${-d * 1.25}em)`; });
    el.setAttribute('aria-label', `New drinks in ${str.slice(0, 2)} hours ${str.slice(2, 4)} minutes`);
  };
  tick(); setInterval(tick, 1000);
}

// Shared CSS: animation keyframes, pixel walkers, reduced motion.
export const SHARED_CSS = `
html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}
button,a{touch-action:manipulation;-webkit-user-select:none;user-select:none}
.px-person,.px-table{display:block;image-rendering:pixelated}
.px-sip{animation:sip 7s ease-in-out infinite}
@keyframes sip{0%,80%,100%{transform:translate(0,0)}86%,94%{transform:translate(-2px,-3px)}}
.px-nod{animation:nod 3.4s ease-in-out infinite}
@keyframes nod{50%{transform:translateY(.4px)}}
.walker{position:absolute;left:0;animation:walk linear infinite}
.walker.to-left{animation-name:walkL}
.walker.to-left .px-person{transform:scaleX(-1)}
.walker .px-legs{animation:step .5s steps(2) infinite}
@keyframes walk{from{transform:translateX(-40px)}to{transform:translateX(430px)}}
@keyframes walkL{from{transform:translateX(430px)}to{transform:translateX(-40px)}}
@keyframes step{50%{transform:translateY(-.4px)}}
.steam path{fill:none;stroke:rgba(255,255,255,.75);stroke-width:3;stroke-linecap:round;animation:steam 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:bottom}
.steam path:nth-child(2){animation-delay:.9s}.steam path:nth-child(3){animation-delay:1.7s}
@keyframes steam{0%{opacity:0;transform:translateY(6px) scaleY(.7)}40%{opacity:.9}100%{opacity:0;transform:translateY(-10px) scaleY(1.1)}}
.cat-tail{transform-box:fill-box;transform-origin:0% 100%;animation:tail 3.2s ease-in-out infinite}
@keyframes tail{0%,100%{transform:rotate(0)}50%{transform:rotate(-12deg)}}
.cat-eyes{animation:blink 5s infinite;transform-box:fill-box;transform-origin:center}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
.dog-tail{transform-box:fill-box;transform-origin:0% 100%;animation:wag .5s ease-in-out infinite alternate}
@keyframes wag{to{transform:rotate(18deg)}}
.flame{transform-origin:50% 100%;animation:flick 1.8s ease-in-out infinite}
.flame-core{transform-box:fill-box;transform-origin:50% 100%;animation:flick 1.1s ease-in-out infinite reverse}
@keyframes flick{0%,100%{transform:scale(1,1)}50%{transform:scale(.96,1.05)}}
.m-blink{animation:blinkOn 1.6s steps(1) infinite}
@keyframes blinkOn{0%,60%{opacity:1}61%,100%{opacity:.2}}
.m-drift{animation:drift 2.4s ease-in-out infinite alternate}
@keyframes drift{to{transform:translateX(6px)}}
.m-shrink{transform-box:fill-box;transform-origin:left;animation:shrink 1.4s ease-in-out infinite alternate}
@keyframes shrink{to{transform:scaleX(.25)}}
.m-flip{transform-box:fill-box;transform-origin:center;animation:flip 1.2s ease-in-out infinite}
@keyframes flip{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.08)}}
.m-linkL{animation:linkL 1.8s cubic-bezier(.77,0,.175,1) infinite alternate}
.m-linkR{animation:linkR 1.8s cubic-bezier(.77,0,.175,1) infinite alternate}
@keyframes linkL{from{transform:translateX(-3px)}to{transform:translateX(1.5px)}}
@keyframes linkR{from{transform:translateX(3px)}to{transform:translateX(-1.5px)}}
.m-swapA{animation:swapA 3s infinite}.m-swapB{animation:swapA 3s infinite reverse;opacity:0}
@keyframes swapA{0%,45%{opacity:1}50%,95%{opacity:0}100%{opacity:1}}
.roll{display:inline-flex;font-variant-numeric:tabular-nums;line-height:1.25em;height:1.25em;overflow:hidden}
.roll-col{display:inline-block;height:1.25em;overflow:hidden}
.roll-strip{display:flex;flex-direction:column;transition:transform 250ms cubic-bezier(.23,1,.32,1)}
.roll-strip span{height:1.25em;line-height:1.25em}
.tap{transition:transform 140ms cubic-bezier(.23,1,.32,1)}
.tap:active{transform:scale(.96)}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none!important}
  .roll-strip{transition:none}
}`;
