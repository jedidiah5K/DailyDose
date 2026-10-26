import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = f => JSON.parse(readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8'));

test('Missing Link content: five links a day, three clues each, no answer given away', () => {
  const { days } = read('link.json');
  for (const links of days) {
    expect(links).toHaveLength(5);
    for (const l of links) {
      expect(l.clues).toHaveLength(3);
      expect(l.answer).toMatch(/^[a-z]+$/);
      for (const c of l.clues) expect(c.toLowerCase()).not.toContain(l.answer);
    }
  }
});

test('Anagram content: five words a day, short to long, no repeats', () => {
  const { days } = read('anagram.json'), seen = new Set();
  for (const words of days) {
    expect(words).toHaveLength(5);
    words.forEach((w, i) => { expect(w).toMatch(/^[a-z]{5,8}$/); if (i) expect(w.length).toBeGreaterThanOrEqual(words[i - 1].length); expect(seen.has(w)).toBe(false); seen.add(w); });
  }
});
