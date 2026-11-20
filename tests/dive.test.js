import { test, expect } from 'vitest';
import { depth, tonight, landmark, passed } from '../src/lib/dive.js';

test('every game turns into 0-100 m, and a miss still sinks you a little', () => {
  expect(depth('shot', { ok: true, ms: 0 })).toBe(100);
  expect(depth('shot', { ok: true, ms: 7000 })).toBe(60);
  expect(depth('shot', { ok: false, close: true })).toBe(30);
  expect(depth('shot', { ok: false })).toBe(10);
  expect(depth('rush', { points: 6 })).toBe(30);
  expect(depth('rush', { points: 99 })).toBe(100);
  expect(depth('blend', { score: 300 })).toBe(60);
  expect(depth('hilo', { bust: true, rights: 3 })).toBe(15);
  expect(depth('hilo', { bust: true, rights: 20 })).toBe(30);
  expect(depth('hilo', { banked: 80, rights: 6, len: 12 })).toBe(65);
  expect(depth('link', { score: 9 })).toBe(60);
  expect(depth('ladder', { solved: true, steps: 4, par: 4 })).toBe(100);
  expect(depth('ladder', { solved: true, steps: 12, par: 4 })).toBe(50);
  expect(depth('ladder', { solved: false })).toBe(15);
  expect(depth('ladder', undefined)).toBe(0);
});

test('tonight adds up the games played today; landmarks follow the depth', () => {
  const d = '2026-11-20';
  expect(tonight({ blend: { [d]: { score: 500 } }, rush: { [d]: { points: 4 }, '2026-11-19': { points: 20 } } }, d)).toBe(120);
  expect(landmark(0)).toBe('the foam');
  expect(landmark(85)).toBe('the crema line');
  expect(landmark(600)).toBe('the bottom of the cup');
  expect(passed(20, 140)).toEqual(['a wonky latte-art heart', 'the crema line', 'a sugar cube having a bath']);
  expect(passed(140, 150)).toEqual([]);
});
