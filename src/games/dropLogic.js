// Drop: one course a day, the same for everyone. Pull back, let go, land the ball in the cup. 3 shots.
// The physics only uses + - * / and sqrt in a fixed order with a fixed time step, so a shot gives the
// exact same result on every phone and on the server (which replays every shot to check it).
// A shot is stored as whole numbers: how far you pulled back (dx, dy), plus where you put your own
// bumper (px, py) if you placed one. Stars collected on the way count on the shot that lands.

export const W = 360, H = 600, BALL = 9, MAX_PULL = 120, SHOTS = 3, PIECE = 16, STAR = 11;
const G = 0.32, POWER = 0.125, WALL_E = 0.55, BUMP_E = 1.15, FRICTION = 0.015, MAX_STEPS = 1200;

// A shot's input is clamped to a whole-number pull inside the circle you can drag in.
export function cleanShot(dx, dy) {
  dx = Math.round(dx); dy = Math.round(dy);
  const d2 = dx * dx + dy * dy;
  if (d2 > MAX_PULL * MAX_PULL) { const k = MAX_PULL / Math.sqrt(d2); dx = Math.trunc(dx * k); dy = Math.trunc(dy * k); }
  return [dx, dy];
}

// Your bumper can't sit on top of the ball or the cup, or outside the course.
export function piecePlace(course, px, py) {
  px = Math.round(px); py = Math.round(py);
  const far = ([x, y], d) => (px - x) ** 2 + (py - y) ** 2 >= d * d;
  if (px < PIECE + 4 || px > W - PIECE - 4 || py < PIECE + 4 || py > H - PIECE - 4) return null;
  if (!far(course.ball, PIECE + BALL + 30) || !far(course.cup, PIECE + course.cup[2] + 24)) return null;
  return [px, py];
}

// Course: { ball: [x, y], cup: [x, y, r], walls: [[x1, y1, x2, y2], ...], bumpers: [[x, y, r], ...], stars: [[x, y], ...] }
// The edges of the play area are always walls.
const edges = [[0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]];

export function simulate(course, shot, keepPath = false) {
  const [dx, dy] = cleanShot(shot[0], shot[1]);
  const piece = shot[2] != null ? piecePlace(course, shot[2], shot[3]) : null;
  const bumpers = piece ? course.bumpers.concat([[piece[0], piece[1], PIECE]]) : course.bumpers;
  let x = course.ball[0], y = course.ball[1], vx = dx * POWER, vy = dy * POWER;
  const [cx, cy, cr] = course.cup, walls = edges.concat(course.walls), path = [], stars = course.stars || [], got = [];
  let still = 0;
  for (let step = 0; step < MAX_STEPS; step++) {
    vy += G;
    // a fast ball moves in small hops, so it can't skip through a wall or the floor in one step
    const hops = Math.ceil(Math.sqrt(vx * vx + vy * vy) / (BALL / 2)) || 1;
    for (let h = 0; h < hops; h++) {
      x += vx / hops; y += vy / hops;
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
      for (const [bx, by, br] of bumpers) {
        const ox = x - bx, oy = y - by, d2 = ox * ox + oy * oy, rr = br + BALL;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = ox / d, ny = oy / d;
        x = bx + nx * rr; y = by + ny * rr;
        const vn = vx * nx + vy * ny;
        if (vn < 0) { vx -= (1 + BUMP_E) * vn * nx; vy -= (1 + BUMP_E) * vn * ny; }
      }
      for (let i = 0; i < stars.length; i++) {
        if (!got.includes(i) && (x - stars[i][0]) ** 2 + (y - stars[i][1]) ** 2 < (STAR + BALL) ** 2) got.push(i);
      }
    }
    if (keepPath && step % 2 === 0) path.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, got.length]);
    const ox = x - cx, oy = y - cy, sp2 = vx * vx + vy * vy;
    // into the cup: close enough to its middle and slow enough to drop in
    if (ox * ox + oy * oy < (cr - 2) * (cr - 2) && sp2 < 49) { if (keepPath) path.push([cx, cy, got.length]); return { landed: true, miss: 0, steps: step, path, end: [cx, cy], stars: got, piece }; }
    still = sp2 < .01 ? still + 1 : 0;
    if (still > 30) break;
  }
  const ox = x - cx, oy = y - cy;
  return { landed: false, miss: Math.max(0, Math.round(Math.sqrt(ox * ox + oy * oy) - cr)), steps: MAX_STEPS, path, end: [x, y], stars: got, piece };
}

// ---- making courses (only the generator script uses this) ----
const rng = seed => { let a = 0; for (const c of seed) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// How many of a grid of possible shots land: a rough difficulty measure (lower = harder).
export function landRate(course, stepSize = 8, hits = []) {
  let hit = 0, all = 0;
  for (let dx = -MAX_PULL; dx <= MAX_PULL; dx += stepSize) for (let dy = -MAX_PULL; dy <= MAX_PULL; dy += stepSize) {
    if (dx * dx + dy * dy > MAX_PULL * MAX_PULL) continue;
    all++; if (simulate(course, [dx, dy]).landed) { hit++; hits.push([dx, dy]); }
  }
  return hit / all;
}

// Three stars: two on one landing route, one on a different route, so all three in one shot takes
// a clever bumper placement (or isn't possible), while one or two is a fair stretch.
function placeStars(course, hits, r) {
  if (hits.length < 2) return null;
  const a = hits[Math.floor(r() * hits.length)];
  const pa = simulate(course, a, true).path, others = hits.filter(h => Math.hypot(h[0] - a[0], h[1] - a[1]) > 40);
  const b = others.length ? others[Math.floor(r() * others.length)] : hits[(hits.indexOf(a) + 1) % hits.length];
  const pb = simulate(course, b, true).path;
  const at = (path, f) => { const [x, y] = path[Math.floor(path.length * f)]; return [Math.round(x), Math.round(y)]; };
  const stars = [at(pa, .35), at(pa, .7), at(pb, .55)];
  const clear = ([x, y]) => (x - course.ball[0]) ** 2 + (y - course.ball[1]) ** 2 > 50 ** 2 && (x - course.cup[0]) ** 2 + (y - course.cup[1]) ** 2 > 40 ** 2;
  return stars.every(clear) ? stars : null;
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
    const hits = [], rate = landRate(c, 8, hits);
    if (!(rate > .006 && rate < .06)) continue;
    const stars = placeStars(c, hits, r);
    if (stars) return { ...c, stars, rate: Math.round(rate * 1000) / 1000 };
  }
}
