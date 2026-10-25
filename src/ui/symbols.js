// The six vault symbols. Each has its own shape AND colour, so colour-blind players can still tell them apart.
const P = {
  0: '<circle cx="12" cy="12" r="7.5"/>',
  1: '<path d="M12 4.5 20 19H4z"/>',
  2: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  3: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>',
  4: '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>',
  5: '<path d="M12 3.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.7l-5.1 2.8L8 13.8l-4.3-4 5.8-.7z"/>',
};
export const NAMES = ['circle', 'triangle', 'square', 'diamond', 'cross', 'star'];
export const sym = s => `<svg class="sym s${s}" viewBox="0 0 24 24" aria-hidden="true">${P[s]}</svg>`;
