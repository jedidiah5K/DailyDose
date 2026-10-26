// One line icon per game, drawn as strokes in the game's colour square.
export const ICONS = {
  rewire: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  hunch: '<path d="M2 20h20"/><path d="M2.5 19c4 0 5.5-9 9.5-9s5.5 9 9.5 9"/><circle cx="16.5" cy="4.5" r="2"/><path d="M16.5 6.5V19" stroke-dasharray="1.5 2"/>',
  tangle: '<circle cx="5" cy="5.5" r="2"/><circle cx="19" cy="5.5" r="2"/><circle cx="5" cy="18.5" r="2"/><circle cx="19" cy="18.5" r="2"/><path d="M6.6 7 17.4 17M17.4 7 6.6 17"/>',
  ladder: '<path d="M7 3v18M17 3v18M7 7.5h10M7 12h10M7 16.5h10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3.5-3.5a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.5 3.5a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  anagram: '<rect x="2.5" y="8" width="8" height="8" rx="1.5"/><rect x="13.5" y="8" width="8" height="8" rx="1.5"/><path d="M6.5 5.5c2-3 9-3 11 0M17.5 18.5c-2 3-9 3-11 0"/>',
};
export const icon = (k, cls = '') => `<svg class="gi ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ''}</svg>`;

// The moon fills as you play: f = share of today's games done (0 = new moon, 1 = full moon).
export function moonPath(f, cx, cy, r) {
  if (f <= 0) return '';
  if (f >= 1) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}Z`;
  const rx = Math.abs(r * (1 - 2 * f)).toFixed(2);
  return `M${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx} ${cy + r}A${rx} ${r} 0 0 ${f > .5 ? 1 : 0} ${cx} ${cy - r}Z`;
}
