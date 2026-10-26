import { test, expect } from 'vitest';
import { generate, tangles } from '../src/games/tangleLogic.js';

test('crossing lines, dots on lines and stacked dots all count', () => {
  const edges = [[0, 1], [2, 3]];
  expect(tangles([[0, 0], [1, 1], [0, 1], [1, 0]], edges).solved).toBe(false);          // an X
  expect(tangles([[0, 0], [1, 0], [0, 1], [1, 1]], edges).solved).toBe(true);           // two parallel lines
  expect(tangles([[0, 0], [1, 0], [0.5, 0.005], [0.5, 1]], edges).badDots.has(2)).toBe(true);  // dot sitting on a line
  expect(tangles([[0, 0], [0.01, 0], [0, 1], [1, 1]], edges).badDots.size).toBe(2);     // dots on top of each other
});

test('every knot starts tangled and has an untangled answer', () => {
  for (const day of ['2026-10-26', '2026-10-31', '2026-11-01', '2026-11-04']) {
    const p = generate(day, 'test');
    expect(p.start.length).toBe(p.n);
    expect(tangles(p.start, p.edges).solved).toBe(false);
    expect(tangles(p.solution, p.edges).solved).toBe(true);
    expect(p.edges.length).toBeGreaterThanOrEqual(p.n);
  }
});
