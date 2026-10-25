// Copy of src/games/dropLogic.js (the server must run the exact same physics). Refresh with: cp src/games/dropLogic.js supabase/functions/dose-drop/
// Drop: one course a day, the same for everyone. Pull back, let go, land the ball in the cup. 3 shots.
// The physics only uses + - * / and sqrt in a fixed order with a fixed time step, so a shot gives the
// exact same result on every phone and on the server (which replays every shot to check it).
// A shot is stored as two whole numbers (dx, dy): how far you pulled back.

export const W = 360, H = 600, BALL = 9, MAX_PULL = 120, SHOTS = 3;
const G = 0.32, POWER = 0.125, WALL_E = 0.55, BUMP_E = 1.15, FRICTION = 0.015, MAX_STEPS = 1200;

// A shot's input is clamped to a whole-number pull inside the circle you can drag in.
export function cleanShot(dx, dy) {
  dx = Math.round(dx); dy = Math.round(dy);
  const d2 = dx * dx + dy * dy;
  if (d2 > MAX_PULL * MAX_PULL) { const k = MAX_PULL / Math.sqrt(d2); dx = Math.trunc(dx * k); dy = Math.trunc(dy * k); }
  return [dx, dy];
}

// Course: { ball: [x, y], cup: [x, y, r], walls: [[x1, y1, x2, y2], ...], bumpers: [[x, y, r], ...] }
// The edges of the play area are always walls.
const edges = [[0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]];

export function simulate(course, shot, keepPath = false) {
  const [dx, dy] = cleanShot(...shot);
  let x = course.ball[0], y = course.ball[1], vx = dx * POWER, vy = dy * POWER;
  const [cx, cy, cr] = course.cup, walls = edges.concat(course.walls), path = [];
  let still = 0;
  for (let step = 0; step < MAX_STEPS; step++) {
    vy += G; x += vx; y += vy;
    for (const [x1, y1, x2, y2] of walls) {
      // closest point on the wall to the ball
      const sx = x2 - x1, sy = y2 - y1, len2 = sx * sx + sy * sy;
      let t = ((x - x1) * sx + (y - y1) * sy) / len2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = x1 + sx * t, py = y1 + sy * t, ox = x - px, oy = y - py, d2 = ox * ox + oy * oy;
      if (d2 >= BALL * BALL || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = ox / d, ny = oy / d;
      x = px + nx * BALL; y = py + ny * BALL;
      const vn = vx * nx + vy * ny;
      if (vn < 0) { vx -= (1 + WALL_E) * vn * nx; vy -= (1 + WALL_E) * vn * ny; vx *= 1 - FRICTION; vy *= 1 - FRICTION; }
    }
    for (const [bx, by, br] of course.bumpers) {
      const ox = x - bx, oy = y - by, d2 = ox * ox + oy * oy, rr = br + BALL;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = ox / d, ny = oy / d;
      x = bx + nx * rr; y = by + ny * rr;
      const vn = vx * nx + vy * ny;
      if (vn < 0) { vx -= (1 + BUMP_E) * vn * nx; vy -= (1 + BUMP_E) * vn * ny; }
    }
    if (keepPath && step % 2 === 0) path.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    const ox = x - cx, oy = y - cy, sp2 = vx * vx + vy * vy;
    // into the cup: close enough to its middle and slow enough to drop in
    if (ox * ox + oy * oy < (cr - 2) * (cr - 2) && sp2 < 49) { if (keepPath) path.push([cx, cy]); return { landed: true, miss: 0, steps: step, path, end: [cx, cy] }; }
    still = sp2 < .01 ? still + 1 : 0;
    if (still > 30) break;
  }
  const ox = x - cx, oy = y - cy;
  return { landed: false, miss: Math.max(0, Math.round(Math.sqrt(ox * ox + oy * oy) - cr)), steps: MAX_STEPS, path, end: [x, y] };
}

// ---- making courses (only the generator script uses this) ----
const rng = seed => { let a = 0; for (const c of seed) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// How many of a grid of possible shots land: a rough difficulty measure (lower = harder).
export function landRate(course, stepSize = 8) {
  let hit = 0, all = 0;
  for (let dx = -MAX_PULL; dx <= MAX_PULL; dx += stepSize) for (let dy = -MAX_PULL; dy <= MAX_PULL; dy += stepSize) {
    if (dx * dx + dy * dy > MAX_PULL * MAX_PULL) continue;
    all++; if (simulate(course, [dx, dy]).landed) hit++;
  }
  return hit / all;
}

export function makeCourse(day, salt = '') {
  for (let attempt = 0; ; attempt++) {
    const r = rng(`drop:${salt}:${day}:${attempt}`), n = (a, b) => Math.round(a + r() * (b - a));
    const left = r() < .5;
    const ball = [left ? n(40, 90) : n(270, 320), n(90, 160)];
    const cupOnLedge = r() < .45, cupX = left ? n(220, 320) : n(40, 140), cupY = cupOnLedge ? n(330, 470) : H - 14;
    const cup = [cupX, cupY, 16], walls = [], bumpers = [];
    if (cupOnLedge) walls.push([cupX - n(40, 70), cupY + 14, cupX + n(40, 70), cupY + 14]);
    // a few obstacles between the ball and the cup
    const k = n(2, 4);
    for (let i = 0; i < k; i++) {
      const kind = r();
      if (kind < .45) { const x = n(110, 250), y = n(200, 480), len = n(50, 110), tilt = n(-40, 40); walls.push([x - len / 2, y - tilt / 2, x + len / 2, y + tilt / 2]); }
      else if (kind < .8) bumpers.push([n(90, 270), n(180, 450), n(14, 24)]);
      else { const x = n(140, 220); walls.push([x, n(330, 470), x, H]); }   // a wall up from the floor
    }
    const c = { ball, cup, walls, bumpers };
    // keep obstacles off the ball and the cup
    const near = ([ax, ay], [bx, by], d) => (ax - bx) ** 2 + (ay - by) ** 2 < d * d;
    if (bumpers.some(b => near(b, ball, b[2] + 40) || near(b, cup, b[2] + 40))) continue;
    const rate = landRate(c);
    if (rate > .006 && rate < .06) return { ...c, rate: Math.round(rate * 1000) / 1000 };
  }
}
