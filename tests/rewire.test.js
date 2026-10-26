import { test, expect } from 'vitest';
import { generate, countSolutions, trace, rot, turns, par, tapsTo } from '../src/games/rewireLogic.js';

test('rotation turns a mask clockwise', () => {
  expect(rot(1)).toBe(2);       // N -> E
  expect(rot(8)).toBe(1);       // W -> N
  expect(rot(5, 1)).toBe(10);   // N+S -> E+W
  expect(turns(5).length).toBe(2);
  expect(tapsTo(1, 8)).toBe(3); // N -> W takes three clockwise taps
});

test('two-plant puzzles: one solution, unsolved at the start, colours never touch', () => {
  for (const day of ['2026-10-26', '2026-10-28', '2026-10-31', '2026-11-01']) {
    const p = generate(day, undefined, 'test');
    expect(p.plants.length).toBe(2);
    expect(trace(p.tiles, p.w, p.plants).solved).toBe(false);
    const t = trace(p.solution, p.w, p.plants);
    expect(t.solved).toBe(true);
    expect(new Set(t.owner)).toEqual(new Set([0, 1]));
    expect(countSolutions(p.tiles, p.w, p.plants)).toBe(1);
    expect(p.par).toBe(par(p.tiles, p.solution));
    expect(p.par).toBeGreaterThan(0);
  }
});

test('joining the two plants is not a solution', () => {
  // 1x3 strip: plant - wire - plant, all connected: both plants on one network
  expect(trace([2, 10, 8], 3, [0, 2]).solved).toBe(false);
});

test('old single-plant puzzles still work', () => {
  const p = generate('2026-10-27', 5, 'old', 1);
  expect(countSolutions(p.tiles, p.w, p.plants[0])).toBe(1);
});

test('same day, same puzzle', () => {
  expect(generate('2026-10-27', undefined, 's')).toEqual(generate('2026-10-27', undefined, 's'));
});
