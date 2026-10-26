import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { dropStart, dropShot } from '../lib/cloud.js';
import { simulate, cleanShot, piecePlace, W, H, BALL, MAX_PULL, SHOTS, PIECE, STAR } from '../games/dropLogic.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';
import { shareDose } from '../ui/card.js';
import { friendsOn } from './friends.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const starRow = n => '★'.repeat(n || 0) + '☆'.repeat(3 - (n || 0));
export const dropLine = r => r.landed ? `${r.shot === 1 ? 'Hole in one' : `Landed on shot ${r.shot}`}${r.stars != null ? ` · ${starRow(r.stars)}` : ''}` : `Missed by ${r.miss} px`;
const NEON = '#FFA53D', PINK = '#FF7AB0', CUP = '#5CE1FF';

export function drop(app) {
  const day = dayKey();
  let p = state.progress.drop?.day === day ? state.progress.drop : null;
  let busy = false, gone = false, aim = null, ball = null, trail = [], raf = 0, burst = null, piece = null, got = [];

  app.innerHTML = `<main class="screen game drop">
    <div class="stars" aria-hidden="true">${stars(30, 13)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-drop">${icon('drop')}Drop <span>No. ${puzzleNo()}</span></p>
      <span class="pips" id="pips" aria-label="Shots left"></span>
    </header>
    <div class="dr-stage" id="stage">
      <canvas id="cv" aria-label="Today's course. Drag back from anywhere and let go to shoot."></canvas>
      <div class="rw-cover${p ? ' gone' : ''}" id="cover">
        <h2 class="display">Land it in the <em>cup</em></h2>
        <p>Tap to place your own bumper anywhere. Pull back to aim, let go to shoot. Stars you grab on the shot that lands score extra. Three shots.</p>
        <button class="btn" id="start">Start</button>
      </div>
      <p class="dr-call" id="call" aria-live="polite"></p>
    </div>
    <p class="v-msg" id="msg" role="status"></p>
    <section id="bottom"><p class="dr-help" id="help">Tap to place your bumper · pull back to shoot</p></section>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };
  const cv = $('#cv'), cx = cv.getContext('2d');
  let scale = 1;

  function size() {
    const stage = $('#stage'), dpr = Math.min(2, devicePixelRatio || 1);
    stage.style.width = '';
    // fit the width, but never taller than the screen leaves room for
    scale = Math.min(stage.getBoundingClientRect().width / W, (innerHeight - 190) / H);
    stage.style.width = `${W * scale}px`;
    cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
    cv.style.width = `${W * scale}px`; cv.style.height = `${H * scale}px`;
    cx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  }

  function pips() {
    const used = p?.shots?.length || 0;
    $('#pips').innerHTML = Array.from({ length: SHOTS }, (_, i) => `<i class="${i < used ? (p.shots[i].landed ? 'hit' : 'used') : ''}"></i>`).join('');
  }

  // ---- drawing ----
  function glowLine(x1, y1, x2, y2, col, w = 5) {
    cx.save(); cx.strokeStyle = col; cx.lineWidth = w; cx.lineCap = 'round'; cx.shadowColor = col; cx.shadowBlur = 14;
    cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); cx.restore();
  }
  function drawStar(x, y) {
    cx.save(); cx.translate(x, y); cx.fillStyle = '#FFD45E'; cx.shadowColor = '#FFD45E'; cx.shadowBlur = 14; cx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? STAR * .45 : STAR, a = -Math.PI / 2 + k * Math.PI / 5; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    cx.closePath(); cx.fill(); cx.restore();
  }
  function draw() {
    cx.clearRect(0, 0, W, H);
    // the course floor: a faint grid, like a lit rooftop at night
    cx.fillStyle = '#0A0D1F'; cx.fillRect(0, 0, W, H);
    cx.strokeStyle = 'rgba(147,170,255,.06)'; cx.lineWidth = 1;
    for (let i = 30; i < W; i += 30) { cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i, H); cx.stroke(); }
    for (let i = 30; i < H; i += 30) { cx.beginPath(); cx.moveTo(0, i); cx.lineTo(W, i); cx.stroke(); }
    if (!p) return;
    const c = p.course;
    // ghosts of earlier shots
    for (const s of p.shots || []) {
      const path = simulate(c, s.s, true).path;
      cx.save(); cx.strokeStyle = s.landed ? 'rgba(92,225,255,.35)' : 'rgba(255,165,61,.22)'; cx.setLineDash([3, 6]); cx.lineWidth = 2;
      cx.beginPath(); path.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); cx.stroke(); cx.restore();
    }
    for (const [x1, y1, x2, y2] of c.walls) glowLine(x1, y1, x2, y2, NEON);
    (c.stars || []).forEach(([x, y], i) => { if (!got.includes(i)) drawStar(x, y); });
    if (piece) {
      cx.save(); cx.strokeStyle = PINK; cx.lineWidth = 3; cx.setLineDash([4, 4]); cx.shadowColor = PINK; cx.shadowBlur = 12;
      cx.beginPath(); cx.arc(piece[0], piece[1], PIECE - 1, 0, 7); cx.stroke(); cx.fillStyle = 'rgba(255,122,176,.25)'; cx.fill(); cx.restore();
    }
    for (const [x, y, r] of c.bumpers) {
      cx.save(); cx.strokeStyle = PINK; cx.lineWidth = 4; cx.shadowColor = PINK; cx.shadowBlur = 16;
      cx.beginPath(); cx.arc(x, y, r - 2, 0, 7); cx.stroke(); cx.fillStyle = 'rgba(255,122,176,.12)'; cx.fill(); cx.restore();
    }
    // the cup: a glowing ring with a little flag
    const [ux, uy, ur] = c.cup;
    cx.save(); cx.strokeStyle = CUP; cx.lineWidth = 3; cx.shadowColor = CUP; cx.shadowBlur = 18;
    cx.beginPath(); cx.arc(ux, uy, ur, 0, 7); cx.stroke(); cx.fillStyle = 'rgba(92,225,255,.14)'; cx.fill();
    cx.beginPath(); cx.moveTo(ux + 2, uy - ur); cx.lineTo(ux + 2, uy - ur - 34); cx.stroke();
    cx.fillStyle = CUP; cx.beginPath(); cx.moveTo(ux + 2, uy - ur - 34); cx.lineTo(ux + 20, uy - ur - 27); cx.lineTo(ux + 2, uy - ur - 20); cx.fill(); cx.restore();
    // trail and ball
    trail.forEach(([x, y], i) => { cx.fillStyle = `rgba(255,190,110,${(i + 1) / trail.length * .5})`; cx.beginPath(); cx.arc(x, y, BALL * (i + 1) / trail.length, 0, 7); cx.fill(); });
    const [bx, by] = ball || c.ball;
    cx.save(); cx.fillStyle = '#fff'; cx.shadowColor = '#FFD7A0'; cx.shadowBlur = 18; cx.beginPath(); cx.arc(bx, by, BALL, 0, 7); cx.fill(); cx.restore();
    // aiming: an arrow the way the ball will go, longer with more pull
    if (aim) {
      const [dx, dy] = aim, k = Math.hypot(dx, dy) / MAX_PULL;
      cx.save(); cx.strokeStyle = `rgba(255,255,255,${.35 + k * .5})`; cx.lineWidth = 3; cx.setLineDash([2, 7]); cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(bx, by); cx.lineTo(bx + dx * .9, by + dy * .9); cx.stroke(); cx.restore();
      cx.save(); cx.strokeStyle = NEON; cx.lineWidth = 2; cx.globalAlpha = .6; cx.beginPath(); cx.arc(bx, by, 14 + k * 26, 0, 7); cx.stroke(); cx.restore();
    }
    if (burst) for (const b of burst) { cx.fillStyle = b.c; cx.globalAlpha = b.a; cx.beginPath(); cx.arc(b.x, b.y, b.r, 0, 7); cx.fill(); cx.globalAlpha = 1; }
  }

  // ---- aiming with a drag (pull back like a slingshot) ----
  let from = null, moved = false;
  const world = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; };
  cv.addEventListener('pointerdown', e => {
    if (busy || !p || p.done) return;
    from = world(e); moved = false; cv.setPointerCapture?.(e.pointerId); aim = null;
  });
  let lastTick = 0;
  cv.addEventListener('pointermove', e => {
    if (!from) return;
    const [x, y] = world(e);
    if (!moved && Math.hypot(from[0] - x, from[1] - y) < 8) return;
    moved = true; $('#help').classList.add('gone');
    aim = cleanShot(from[0] - x, from[1] - y);
    const notch = Math.round(Math.hypot(...aim) / 12); if (notch !== lastTick) { lastTick = notch; SOUNDS.tick(); }
    draw();
  });
  const release = () => {
    if (!from) return;
    const at = from; from = null;
    if (!moved) return placePiece(at);
    const s = aim; aim = null;
    if (!s || Math.hypot(...s) < 10) { draw(); return; }   // too small a pull: treat as a cancel
    shoot(s);
  };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', () => { from = null; aim = null; draw(); });

  // Tap: put your bumper there, move it, or tap it again to take it away.
  function placePiece([x, y]) {
    if (piece && Math.hypot(piece[0] - x, piece[1] - y) < PIECE + 6) { piece = null; SOUNDS.tap(); draw(); return; }
    const ok = piecePlace(p.course, x, y);
    if (!ok) { say('Not there: too close to the ball, the cup or the edge.'); buzz(8); return; }
    say(''); piece = ok; SOUNDS.ok(); buzz(10); draw();
  }

  async function shoot(s) {
    busy = true; say(''); SOUNDS.lock(); buzz(18);
    const shot = piece ? [s[0], s[1], piece[0], piece[1]] : s;
    const local = simulate(p.course, shot, true);   // the same physics the server runs, so we can animate straight away
    const sent = dropShot(shot[0], shot[1], piece?.[0], piece?.[1]).catch(e => ({ error: e }));
    got = [];
    await fly(local);
    const res = await sent;
    if (gone) return;
    if (res.error) { busy = false; ball = null; trail = []; got = []; draw(); say(navigator.onLine ? 'That shot didn’t reach the server. Try it again.' : 'You’re offline. Shots need a connection.'); return; }
    p.shots = res.shots; save(); pips();
    if (res.shot.landed) await sink(); else await missed(res.shot.miss);
    if (res.result) { p.done = true; save(); finish('drop', res.result, day); result(res.result, true); }
    else { ball = null; trail = []; got = []; draw(); $('#help').textContent = `${SHOTS - p.shots.length} shot${SHOTS - p.shots.length === 1 ? '' : 's'} left`; $('#help').classList.remove('gone'); }
    busy = false;
  }

  // play back the path; slow motion when the ball gets near the cup
  function fly(sim) {
    return new Promise(done => {
      if (calm()) { ball = sim.end; trail = []; draw(); return done(); }
      const [ux, uy] = p.course.cup; let i = 0, last = performance.now();
      const frame = now => {
        if (gone) return done();
        const dt = Math.min(250, now - last) / (1000 / 60); last = now;   // frames' worth of time, so slow phones skip ahead
        const [x, y] = sim.path[Math.min(Math.floor(i), sim.path.length - 1)];
        const near = Math.hypot(x - ux, y - uy) < 70;
        i += (near ? .5 : 2) * dt;   // path points are every 2 physics steps: 2 per frame is 4x, slowed right down by the cup
        ball = [x, y]; trail.push([x, y]); if (trail.length > 14) trail.shift();
        (p.course.stars || []).forEach(([sx, sy], k) => { if (!got.includes(k) && (x - sx) ** 2 + (y - sy) ** 2 < (STAR + BALL) ** 2) { got.push(k); SOUNDS.light(4 + k * 2); buzz(8); } });
        draw();
        if (i >= sim.path.length) { trail = []; return done(); }
        raf = requestAnimationFrame(frame);
      };
      SOUNDS.launch(); raf = requestAnimationFrame(frame);
    });
  }
  async function sink() {
    const [ux, uy] = p.course.cup;
    burst = Array.from({ length: 26 }, (_, k) => ({ x: ux, y: uy, vx: Math.cos(k) * (2 + k % 4), vy: Math.sin(k) * (2 + k % 4) - 2, r: 2 + k % 3, a: 1, c: k % 2 ? CUP : '#fff' }));
    SOUNDS.sink(); buzz(40);
    $('#call').textContent = (p.shots.length === 1 ? 'Hole in one' : 'In!') + (got.length ? ` ${'★'.repeat(got.length)}` : ''); $('#call').className = 'dr-call on hit';
    for (let t0 = performance.now(), last = t0; !calm() && performance.now() - t0 < 700;) {
      const now = await new Promise(r => requestAnimationFrame(r)), dt = (now - last) / (1000 / 60); last = now;
      burst.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += .12 * dt; b.a *= .95 ** dt; }); draw();
    }
    burst = null; draw();
  }
  async function missed(px) {
    SOUNDS.miss(); buzz(10);
    $('#call').textContent = px <= 6 ? `Missed by ${px} px. So close.` : `Missed by ${px} px`; $('#call').className = 'dr-call on';
    await new Promise(r => setTimeout(r, calm() ? 400 : 1300));
    $('#call').className = 'dr-call';
  }

  function result(r, fresh) {
    $('#help')?.remove();
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.landed ? 'In the cup' : 'Out of shots'}</p>
      <h2 class="display">${r.landed ? (r.shot === 1 ? 'Hole in <em>one</em>' : `On shot <em>${r.shot}</em>`) : `<em>${r.miss} px</em> off`}</h2>
      ${r.landed && r.stars != null ? `<p class="dr-stars">${starRow(r.stars)}</p>` : ''}
      <p class="muted">${r.beat != null ? `Better than ${r.beat}% of players today` : 'You’re one of the first to play today'}${streak('drop') > 1 ? ` · ${streak('drop')} days in a row` : ''}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s course in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
    friendsOn($('#fr-on'), 'drop');
  }

  async function begin() {
    $('#start').disabled = true; say('');
    let s;
    try { s = await dropStart(); }
    catch (e) { $('#start').disabled = false; say(/no puzzle/.test(e.message) ? 'Today’s course isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    p = state.progress.drop = { day, course: s.course, shots: s.shots || [] }; save();
    $('#cover').classList.add('gone'); SOUNDS.tap();
    pips(); draw();
    if (s.result) { p.done = true; save(); finish('drop', s.result, day); result(s.result, false); }
  }

  addEventListener('resize', size);
  size(); pips();
  $('#start').addEventListener('click', begin);
  if (p) { $('#cover').classList.add('gone'); draw(); if (resultFor('drop')) result(resultFor('drop'), false); else begin(); }
  else if (resultFor('drop')) begin();

  return () => { gone = true; cancelAnimationFrame(raf); removeEventListener('resize', size); };
}
