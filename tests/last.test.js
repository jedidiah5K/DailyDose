import { test, expect } from 'vitest';
import { makeRounds, limitFor, GROUPS, ROUNDS } from '../src/games/lastLogic.js';

const check = round => {
  const { type, options, answer, data, prompt } = round;
  expect(answer).toBeGreaterThanOrEqual(0);
  expect(answer).toBeLessThan(options.length);
  expect(new Set(options).size).toBe(options.length);   // no duplicate choices
  if (type === 'math') { const [a, op, b] = prompt.split(' '); const v = op === '+' ? +a + +b : op === '-' ? a - b : a * b; expect(+options[answer]).toBe(v); }
  if (type === 'count') { const target = prompt.match(/How many (.)/)[1]; expect(+options[answer]).toBe(data.filter(s => s === target).length); }
  if (type === 'echo') expect(options[answer]).toBe(data.join(''));
  if (type === 'spot') expect(data.before[answer]).not.toBe(data.after[answer]);
  if (type === 'odd') { const groupOf = w => Object.keys(GROUPS).find(k => GROUPS[k].includes(w)); const g = options.map(groupOf); expect(g.filter(x => x === g[answer]).length).toBe(1); }
  if (type === 'bigger') { const val = e => e.includes('×') ? e.split(' × ').reduce((x, y) => x * y) : e.split(' − ').reduce((x, y) => x - y); const v = options.map(val); expect(v[answer]).toBeGreaterThan(v[1 - answer]); }
};

test('ten rounds a day, every answer actually right', () => {
  for (let d = 1; d <= 300; d++) {
    const day = `2026-11-${String((d % 28) + 1).padStart(2, '0')}`;
    const rounds = makeRounds(day, 's' + d);
    expect(rounds.length).toBe(ROUNDS);
    rounds.forEach(check);
  }
});

test('no word sits in two odd-one-out groups', () => {
  const all = Object.values(GROUPS).flat();
  expect(new Set(all.map(w => w.toLowerCase())).size).toBe(all.length);
});

test('the timer shrinks from 15s to 8s', () => {
  expect(limitFor(0)).toBe(15);
  expect(limitFor(ROUNDS - 1)).toBe(8);
});

test('same day, same rounds', () => {
  expect(makeRounds('2026-11-02', 'x')).toEqual(makeRounds('2026-11-02', 'x'));
});

test('wrong answers can always be found, even when the right one is 0', async () => {
  const { near } = await import('../src/games/lastLogic.js');
  let s = 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const right of [0, 1, 2, 50]) {
    const w = near(r, right, 3);
    expect(w.length).toBe(3);
    expect(w.every(v => v >= 0 && v !== right)).toBe(true);
  }
});
