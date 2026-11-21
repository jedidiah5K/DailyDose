import { describe, it, expect } from 'vitest';
import { matches, emojiDay, imposterDay } from '../src/games/partyLogic.js';

describe('party games', () => {
  it('forgives small typos, accents and "the"', () => {
    expect(matches(['beyonce'], 'Beyoncé')).toBe(true);
    expect(matches(['lion king'], 'The Lion Kng')).toBe(true);
    expect(matches(['titanic'], 'jaws')).toBe(false);
    expect(matches(['got'], 'goat')).toBe(false);
  });
  it('every day has five full puzzles', () => {
    for (let d = 21; d <= 30; d++) {
      const day = `2026-11-${d}`;
      expect(emojiDay(day).every(p => p.e.length === 6 && p.a.length)).toBe(true);
      const im = imposterDay(day);
      expect(im).toHaveLength(5);
      expect(im.every(q => q.names.length === 4 && q.names.includes(q.odd))).toBe(true);
    }
  });
});
