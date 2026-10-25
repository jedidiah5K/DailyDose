import { test, expect } from 'vitest';
import { generate, countSolutions, trace, rot, turns } from '../src/games/rewireLogic.js';

test('rotation turns a mask clockwise', () => {
  expect(rot(1)).toBe(2);       // N -> E
  expect(rot(8)).toBe(1);       // W -> N
  expect(rot(5, 1)).toBe(10);   // N+S -> E+W
  expect(turns(5).length).toBe(2);
});

test('every generated puzzle has exactly one solution and starts unsolved', () => {
  for (const day of ['2026-10-26', '2026-10-28', '2026-10-31', '2026-11-01']) {
    const p = generate(day);
    expect(p.tiles.length).toBe(p.w * p.w);
    expect(trace(p.tiles, p.w, p.plant).solved).toBe(false);
    expect(countSolutions(p.tiles, p.w, p.plant)).toBe(1);
    expect(p.buildings.length).toBeGreaterThan(2);
  }
});

test('same day, same puzzle', () => {
  expect(generate('2026-10-27')).toEqual(generate('2026-10-27'));
});
