// The night city that ties Daily Dose together: stars, a moon, and a skyline where each game
// owns a building with its own neon sign. Everything is seeded, so it looks the same on every visit.

// Small seeded random, so the skyline doesn't reshuffle each time you open the app.
const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export function stars(n = 46, seed = 7) {
  const r = rnd(seed);
  return Array.from({ length: n }, () => {
    const big = r() > .88;
    return `<i class="star${big ? ' big' : ''}" style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 62).toFixed(1)}%;--tw:${(2 + r() * 4).toFixed(1)}s;--dl:${(-r() * 6).toFixed(1)}s"></i>`;
  }).join('');
}

// The neon icon for each game, drawn as strokes so it can glow in the game's colour.
export const ICONS = {
  rewire: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  hunch: '<path d="M2 19h20"/><path d="M3 18c3.5 0 4.5-11 9-11s5.5 11 9 11"/><path d="M12 7v12" stroke-dasharray="2 2.5"/>',
  drop: '<circle cx="18" cy="17" r="3"/><path d="M3 6c4-4 9-2 12 5" stroke-dasharray="2 2.5"/><path d="M14 21h8"/>',
  meld: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  last: '<path d="M7 21V9h10v12"/><path d="M9 9V5h6v4"/><path d="M11 5V2h2v3"/><path d="M4 21h16"/>',
};
export const icon = (k, cls = '') => `<svg class="gi ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;

// A skyline of `count` buildings. `signs` = [{ at, k, label, on, lit }]: a game's sign sits on the
// building at index `at`; `lit` turns that building's windows warm (you finished it today).
export function skyline(signs = [], count = 22, seed = 11) {
  const r = rnd(seed), bySpot = Object.fromEntries(signs.map(s => [s.at, s]));
  const far = Array.from({ length: 30 }, () => `<i style="height:${(18 + r() * 40).toFixed(0)}%;flex:${(1 + r() * 2).toFixed(2)}"></i>`).join('');
  const near = Array.from({ length: count }, (_, i) => {
    const s = bySpot[i], h = s ? 55 + r() * 25 : 22 + r() * 55, w = (1 + r() * 1.6).toFixed(2);
    const roof = r() > .86 ? '<b class="ant"></b>' : '';
    const sign = s ? `<span class="sign g-${s.k}${s.on ? '' : ' off'}">${icon(s.k)}${s.label}</span>` : '';
    return `<i class="bld${s?.lit || (!s && r() > .62) ? ' lit' : ''}${s ? ' has-sign' : ''}" style="height:${h.toFixed(0)}%;flex:${w}">${roof}${sign}</i>`;
  }).join('');
  return `<div class="city" aria-hidden="true"><div class="far">${far}</div><div class="near">${near}</div></div>`;
}
