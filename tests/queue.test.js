import { describe, it, expect } from 'vitest';
import { puzzleFor, marks } from '../src/games/queueLogic.js';

describe('queue', () => {
  it('marks right spots and the way to move', () => {
    const a = ['A', 'B', 'C'];
    expect(marks(['A', 'C', 'B'], a)).toEqual(['ok', 'down', 'up']);
  });
  it('makes a fair puzzle every day', () => {
    for (let d = 1; d <= 28; d++) {
      const p = puzzleFor(`2026-12-${String(d).padStart(2, '0')}`);
      expect(p.answer).toHaveLength(5);
      expect(new Set(p.answer.map(x => x[1])).size).toBe(5);          // no ties
      expect(p.start.every((x, i) => x === p.answer[i])).toBe(false);  // never starts solved
    }
  });
});
