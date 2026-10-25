import { dayKey, puzzleNo, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { rewireStart, rewireSubmit } from '../lib/cloud.js';
import { rot, trace, countSolutions } from '../games/rewireLogic.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
export { clock };
export const rewireLine = r => `⚡ ${clock(r.ms)}${r.beat != null ? ` · beat ${r.beat}%` : ''}`;

// One tile, drawn facing its starting way; turning is a CSS rotation on the wire layer.
const ARM = { 1: 'M50 50V0', 2: 'M50 50H100', 4: 'M50 50V100', 8: 'M50 50H0' };
const BOLT = '<path class="bolt" d="M54 30 40 54h10l-4 16 14-24H50z"/>';
function tileSvg(m, kind) {
  const arms = [1, 2, 4, 8].filter(b => m & b).map(b => ARM[b]).join('');
  const hub = kind === 'plant' ? `<circle class="plant" cx="50" cy="50" r="24"/>${BOLT}`
    : kind === 'bld' ? '<rect class="bld" x="33" y="33" width="34" height="34" rx="4"/><path class="win" d="M40 41h6v6h-6zM54 41h6v6h-6zM40 53h6v6h-6zM54 53h6v6h-6z"/>'
    : '<circle class="node" cx="50" cy="50" r="8"/>';
  // the plant and building sit on top and don't spin, so they always look upright
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="wire"><path class="glow" d="${arms}"/><path class="core" d="${arms}"/>${kind ? '' : hub}</g>${kind ? hub : ''}</svg>`;
}

export function rewire(app) {
  const day = dayKey();
  let p = state.progress.rewire?.day === day ? state.progress.rewire : null;
  let busy = false, gone = false, timer = 0, base = 0, t0 = 0;

  app.innerHTML = `<main class="screen game rewire">
    <div class="stars" aria-hidden="true">${stars(34, 5)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-rewire">${icon('rewire')}Rewire <span>No. ${puzzleNo()}</span></p>
      <span class="eyebrow mono" id="time">0:00</span>
    </header>
    <div class="rw-stage">
      <div class="grid" id="grid" style="--w:6">${'<span class="tl"></span>'.repeat(36)}</div>
      <div class="rw-cover" id="cover">
        <h2 class="display">Light up the <em>city</em></h2>
        <p>Turn the tiles so every building connects to the power plant. No loose ends.</p>
        <button class="btn" id="start">Start</button>
        <p class="eyebrow">The clock starts when you tap Start</p>
      </div>
    </div>
    <div class="skyline" id="sky" aria-hidden="true"></div>
    <p class="v-msg" id="msg" role="status"></p>
    <section id="bottom"></section>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };

  const mask = i => rot(p.tiles[i], p.r[i]);
  const current = () => p.tiles.map((_, i) => mask(i));

  function draw() {
    const g = $('#grid'), bl = new Set(p.buildings);
    g.style.setProperty('--w', p.w);
    g.innerHTML = p.tiles.map((m, i) => `<button class="tl" data-i="${i}" style="--r:${p.r[i]}" aria-label="Tile ${i % p.w + 1}, ${Math.floor(i / p.w) + 1}">${tileSvg(m, i === p.plant ? 'plant' : bl.has(i) ? 'bld' : '')}</button>`).join('');
    // skyline: one tower per building, heights from the grid so it's the same for everyone
    $('#sky').innerHTML = p.buildings.map((b, k) => `<i style="--h:${30 + (b * 37 % 55)}%;--k:${k}"></i>`).join('');
    g.querySelectorAll('.tl').forEach(t => t.addEventListener('click', () => turn(+t.dataset.i)));
    power(false);
  }

  let litBefore = 0;
  function power(sound = true) {
    const { lit, solved, depth } = trace(current(), p.w, p.plant);
    $('#grid').querySelectorAll('.tl').forEach((t, i) => { t.classList.toggle('on', lit.has(i)); t.style.setProperty('--d', depth[i] ?? 0); });
    const n = p.buildings.filter(b => lit.has(b)).length;
    if (sound && n > litBefore) SOUNDS.link(n);
    litBefore = n;
    return solved;
  }

  function turn(i) {
    if (busy || !p || p.done) return;
    p.r[i]++; save();
    const t = $('#grid').children[i]; t.style.setProperty('--r', p.r[i]);
    SOUNDS.turn(); buzz(5);
    if (power()) solved();
  }

  async function solved() {
    busy = true; clearInterval(timer);
    let res;
    try { res = await rewireSubmit(current()); }
    catch (e) {
      busy = false; say(navigator.onLine ? 'Couldn’t reach the server. Turn any tile back and forth to try again.' : 'You’re offline. Your grid is saved; reconnect and turn a tile to finish.');
      return;
    }
    if (gone) return;
    p.done = true; save();
    finish('rewire', res, day);
    $('#time').textContent = clock(res.ms);
    await lightUp();
    result(res, true);
  }

  async function lightUp() {
    $('.rewire').classList.add('won'); SOUNDS.hum(); buzz(30);
    const sky = [...$('#sky').children];
    for (const [k, el] of sky.entries()) { await wait(Math.max(40, 500 / sky.length)); el.classList.add('lit'); SOUNDS.light(k); }
    await wait(500);
  }

  function result(r, fresh) {
    const beat = r.beat != null ? `Faster than ${r.beat}% of players today` : 'You’re one of the first to finish today';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">City lit</p>
      <h2 class="display">In <em>${clock(r.ms)}</em></h2>
      <p class="muted">${beat}${streak('rewire') > 1 ? ` · ${streak('rewire')} days in a row` : ''}</p>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s puzzle in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    const send = fmt => async () => {
      SOUNDS.tap();
      if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.');
    };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
  }

  function tick() { $('#time').textContent = clock(base + performance.now() - t0); }

  async function begin() {
    $('#start').disabled = true; say('');
    let s;
    try { s = await rewireStart(); }
    catch (e) {
      $('#start').disabled = false;
      say(/no puzzle/.test(e.message) ? 'Today’s puzzle isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.');
      return;
    }
    if (gone) return;
    if (!p) { p = state.progress.rewire = { day, w: s.w, plant: s.plant, tiles: s.tiles, buildings: s.buildings, r: s.tiles.map(() => 0) }; save(); }
    $('#cover').classList.add('gone'); SOUNDS.tap();
    draw();
    if (s.result) return showDone(s.result);   // finished on another phone
    base = s.elapsed_ms; t0 = performance.now(); tick(); timer = setInterval(tick, 250);
    if (power(false)) solved();
  }

  // Already done today: show the lit city and the result.
  function showDone(r) {
    const sol = []; countSolutions(p.tiles, p.w, p.plant, 400000, sol);
    p.r = p.tiles.map((m, i) => [0, 1, 2, 3].find(k => rot(m, k) === sol[i]) ?? 0); p.done = true; save();
    finish('rewire', r, day);
    draw(); $('#cover').classList.add('gone'); $('.rewire').classList.add('won', 'still');
    [...$('#sky').children].forEach(el => el.classList.add('lit'));
    $('#time').textContent = clock(r.ms);
    result(r, false);
  }

  const done = resultFor('rewire');
  if (done && p) showDone(done);
  else if (p || done) begin();  // resume straight away (or fetch the finished board)
  else $('#start').addEventListener('click', begin);

  return () => { gone = true; clearInterval(timer); };
}
