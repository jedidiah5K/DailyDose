// Last Stand: ten quick rounds a day, harder as you go. One wrong answer or a timeout and you're out.
// Every round is made here from numbers, shapes and word lists, so there are no facts to get wrong.
// Each round: { type, prompt, options, data?, answer } where answer is the index of the right option.
// Only the generator script sees answers; players get rounds from the server without them.

export const ROUNDS = 10;
// seconds per round: 15 for round 1 down to 8 for round 10
export const limitFor = r => Math.round(15 - (r * 7) / (ROUNDS - 1));

const rng = seed => { let a = 0; for (const c of seed) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// Put the right answer among the wrong ones at a random spot.
function choices(r, right, wrong) {
  const opts = [...wrong]; const at = Math.floor(r() * (wrong.length + 1));
  opts.splice(at, 0, right);
  return { options: opts.map(String), answer: at };
}
// Distinct wrong numbers near the right one.
// Distinct wrong numbers near the right one (never negative; the range widens if it runs out of room).
export function near(r, right, spread, count = 3) {
  const out = new Set();
  for (let tries = 0; out.size < count; tries++) {
    const s = spread + Math.floor(tries / 20), d = Math.floor(r() * (s * 2 + 1)) - s;
    if (d !== 0 && right + d >= 0) out.add(right + d);
  }
  return [...out];
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const shuffle = (r, list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Word groups for "odd one out": no word appears in two groups (no orange the fruit vs orange the colour).
export const GROUPS = {
  fruit: ['apple', 'banana', 'mango', 'cherry', 'grape', 'pear', 'kiwi', 'peach', 'plum', 'lemon'],
  animal: ['tiger', 'zebra', 'otter', 'camel', 'horse', 'panda', 'whale', 'eagle', 'koala', 'llama'],
  instrument: ['piano', 'violin', 'flute', 'drums', 'cello', 'harp', 'trumpet', 'guitar', 'banjo', 'tuba'],
  planet: ['Mars', 'Venus', 'Saturn', 'Jupiter', 'Neptune', 'Mercury', 'Uranus', 'Earth'],
  colour: ['purple', 'yellow', 'green', 'scarlet', 'teal', 'beige', 'navy', 'magenta', 'crimson', 'indigo'],
  sport: ['tennis', 'soccer', 'rugby', 'golf', 'hockey', 'boxing', 'cricket', 'karate', 'rowing', 'skiing'],
  body: ['elbow', 'knee', 'ankle', 'wrist', 'shoulder', 'thumb', 'chin', 'heel', 'spine', 'lung'],
  weather: ['rain', 'snow', 'hail', 'fog', 'thunder', 'sleet', 'drizzle', 'breeze', 'storm', 'frost'],
};

const MAKERS = {
  // 2, 4, 8, ?
  seq(r, lvl) {
    const kind = pick(r, lvl < 3 ? ['add', 'add', 'mul'] : lvl < 7 ? ['add', 'mul', 'square', 'alt'] : ['mul', 'square', 'alt', 'fib']);
    let s;
    if (kind === 'add') { const a = 1 + Math.floor(r() * 9), d = 2 + Math.floor(r() * (3 + lvl * 2)); s = [0, 1, 2, 3, 4].map(i => a + d * i); }
    else if (kind === 'mul') { const a = 1 + Math.floor(r() * 4), m = 2 + Math.floor(r() * 2); s = [0, 1, 2, 3, 4].map(i => a * m ** i); }
    else if (kind === 'square') { const a = 1 + Math.floor(r() * 5); s = [0, 1, 2, 3, 4].map(i => (a + i) ** 2); }
    else if (kind === 'alt') { const a = 10 + Math.floor(r() * 20), u = 3 + Math.floor(r() * 6), d = 1 + Math.floor(r() * (u - 1)); s = [a]; for (let i = 1; i < 5; i++) s.push(s[i - 1] + (i % 2 ? u : -d)); }
    else { const a = 1 + Math.floor(r() * 3), b = a + 1 + Math.floor(r() * 3); s = [a, b]; for (let i = 2; i < 5; i++) s.push(s[i - 1] + s[i - 2]); }
    const right = s[4];
    return { type: 'seq', prompt: 'What comes next?', data: s.slice(0, 4), ...choices(r, right, near(r, right, Math.max(3, Math.round(right * .25)))) };
  },
  // three from one group, one from another
  odd(r) {
    const keys = Object.keys(GROUPS), main = pick(r, keys); let other = pick(r, keys); while (other === main) other = pick(r, keys);
    const three = shuffle(r, GROUPS[main]).slice(0, 3), odd = pick(r, GROUPS[other]);
    return { type: 'odd', prompt: 'Which one doesn’t belong?', ...choices(r, odd, three) };
  },
  math(r, lvl) {
    const op = pick(r, lvl < 4 ? ['+', '-'] : ['+', '-', '×']);
    let a, b, right;
    if (op === '×') { a = 3 + Math.floor(r() * (6 + lvl)); b = 3 + Math.floor(r() * 9); right = a * b; }
    else { a = 10 + Math.floor(r() * (20 + lvl * 15)); b = 5 + Math.floor(r() * (10 + lvl * 10)); if (op === '-' && b > a) [a, b] = [b, a]; right = op === '+' ? a + b : a - b; }
    return { type: 'math', prompt: `${a} ${op} ${b} = ?`, ...choices(r, right, near(r, right, op === '×' ? 12 : 10)) };
  },
  // which is bigger: two sums that land close together
  bigger(r, lvl) {
    const make = () => { const x = 3 + Math.floor(r() * (8 + lvl)), y = 3 + Math.floor(r() * 9); return r() < .5 ? [`${x} × ${y}`, x * y] : [`${x * y + Math.floor(r() * 10)} − ${Math.floor(r() * 12)}`, null]; };
    let A, B;
    do { A = make(); B = make(); A[1] ??= eval2(A[0]); B[1] ??= eval2(B[0]); } while (A[1] === B[1] || Math.abs(A[1] - B[1]) > 6 + lvl * 2);
    return { type: 'bigger', prompt: 'Which is bigger?', options: [A[0], B[0]], answer: A[1] > B[1] ? 0 : 1 };
  },
  // count one shape in a grid of shapes
  count(r, lvl) {
    const shapes = ['●', '▲', '■', '◆'], target = pick(r, shapes), n = 16 + lvl * 2;
    const grid = Array.from({ length: n }, () => pick(r, shapes));
    const right = grid.filter(s => s === target).length;
    return { type: 'count', prompt: `How many ${target}?`, data: grid, ...choices(r, right, near(r, right, 3)) };
  },
  // a pattern of lights is shown once, then pick it out
  echo(r, lvl) {
    const len = 3 + Math.min(4, Math.floor(lvl / 2)), seq = Array.from({ length: len }, () => Math.floor(r() * 4));
    const wrong = new Set();
    while (wrong.size < 3) { const w = [...seq]; const i = Math.floor(r() * len); w[i] = (w[i] + 1 + Math.floor(r() * 3)) % 4; if (r() < .4 && len > 3) { const j = (i + 1) % len; [w[i], w[j]] = [w[j], w[i]]; } const k = w.join(''); if (k !== seq.join('')) wrong.add(k); }
    return { type: 'echo', prompt: 'Watch the lights, then pick the pattern', data: seq, ...choices(r, seq.join(''), [...wrong]) };
  },
  // two grids, one square changed colour: tap it
  spot(r, lvl) {
    const size = lvl < 5 ? 4 : 5, cols = 3 + (lvl > 6 ? 1 : 0), cells = Array.from({ length: size * size }, () => Math.floor(r() * cols));
    const at = Math.floor(r() * cells.length), changed = [...cells]; changed[at] = (changed[at] + 1 + Math.floor(r() * (cols - 1))) % cols;
    return { type: 'spot', prompt: 'Tap the square that changed', data: { size, before: cells, after: changed }, options: cells.map((_, i) => String(i)), answer: at };
  },
};
function eval2(expr) { const [a, , b] = expr.split(' '); return Number(a) - Number(b); }

// Easy round types first, the trickier ones later; the same ten for everyone that day.
export function makeRounds(day, salt = '') {
  const r = rng(`last:${salt}:${day}`);
  const early = shuffle(r, ['odd', 'math', 'seq', 'count']), late = shuffle(r, ['echo', 'spot', 'bigger', 'seq', 'math', 'odd']);
  const order = [...early.slice(0, 4), ...late];
  return order.slice(0, ROUNDS).map((type, lvl) => MAKERS[type](r, lvl));
}
