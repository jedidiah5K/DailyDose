import { dayKey, puzzleNo, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { rewireStart, rewireSubmit, rewireHint } from '../lib/cloud.js';
import { rot, trace, countSolutions, plantsOf } from '../games/rewireLogic.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { icon } from '../ui/icons.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst } from '../ui/shell.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
export { clock };
const starRow = n => '★'.repeat(n) + '☆'.repeat(3 - n);
export const rewireLine = r => `⚡ ${clock(r.ms)}${r.stars ? ` ${starRow(r.stars)}` : ''}${r.beat != null ? ` · beat ${r.beat}%` : ''}`;

// One tile, drawn facing its starting way; turning is a CSS rotation on the wire layer.
const ARM = { 1: 'M50 50V0', 2: 'M50 50H100', 4: 'M50 50V100', 8: 'M50 50H0' };
const BOLT = '<path class="bolt" d="M54 30 40 54h10l-4 16 14-24H50z"/>';
function tileSvg(m, kind) {
  const arms = [1, 2, 4, 8].filter(b => m & b).map(b => ARM[b]).join('');
  const hub = kind?.startsWith('plant') ? `<circle class="${kind}" cx="50" cy="50" r="24"/>${BOLT}`
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
    ${gameHeader('rewire', 'Rewire', '<span class="eyebrow mono" id="time">0:00</span>')}
    <div class="g-play">
    <div class="rw-stage">
      <div class="grid" id="grid" style="--w:6">${'<span class="tl"></span>'.repeat(36)}</div>
      <div class="rw-cover" id="cover">
        <h2 class="display">Wire up the city</h2>
        <p>Turn the tiles so every building connects to a power plant. No loose ends, and two plants’ wires never touch.</p>
        <button class="btn" id="start">Start</button>
        <p class="eyebrow">The clock starts when you tap Start</p>
      </div>
    </div>
    <div class="rw-tools"><span class="taps mono" id="taps" hidden></span><button class="hint-btn" id="hint" hidden>Hint <span>+30s</span></button></div>
    </div>
    <aside class="g-side">    <p class="v-msg" id="msg" role="status"></p>
    <section id="bottom"></section></aside>
  </main>`;
  wireHelp(app, 'rewire');
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };

  const mask = i => rot(p.tiles[i], p.r[i]);
  const current = () => p.tiles.map((_, i) => mask(i));
  const plants = () => p.plants || [p.plant];
  // Par: the fewest taps that solve it. Shown as you go: 3 stars at par, 2 within 1.5x.
  const showTaps = () => { const t = $('#taps'); if (p.par == null) return; t.hidden = false; t.textContent = `${p.taps || 0} taps · par ${p.par}`; t.classList.toggle('over', (p.taps || 0) > p.par); };

  function draw() {
    const g = $('#grid'), bl = new Set(p.buildings);
    g.style.setProperty('--w', p.w);
    g.innerHTML = p.tiles.map((m, i) => `<button class="tl${p.locked?.includes(i) ? ' locked' : ''}" data-i="${i}" style="--r:${p.r[i]}" aria-label="Tile ${i % p.w + 1}, ${Math.floor(i / p.w) + 1}">${tileSvg(m, plants().includes(i) ? (plants().length > 1 ? `plant p${plants().indexOf(i)}` : 'plant') : bl.has(i) ? 'bld' : '')}</button>`).join('');
    g.querySelectorAll('.tl').forEach(t => t.addEventListener('click', () => turn(+t.dataset.i)));
    power(false);
  }

  let litBefore = 0;
  function power(sound = true) {
    const { lit, solved, depth, owner } = trace(current(), p.w, plants());
    $('#grid').querySelectorAll('.tl').forEach((t, i) => { t.classList.toggle('on', lit.has(i)); t.classList.toggle('b', owner[i] === 1); t.style.setProperty('--d', depth[i] ?? 0); });
    const n = p.buildings.filter(b => lit.has(b)).length;
    if (sound && n > litBefore) SOUNDS.link(n);
    litBefore = n;
    return solved;
  }

  function turn(i) {
    if (busy || !p || p.done) return;
    if (p.locked?.includes(i)) { const t = $('#grid').children[i]; t.classList.remove('nope'); void t.offsetWidth; t.classList.add('nope'); buzz(8); return; }
    p.r[i]++; p.taps = (p.taps || 0) + 1; save(); showTaps();
    const t = $('#grid').children[i]; t.style.setProperty('--r', p.r[i]);
    SOUNDS.turn(); buzz(5);
    if (power()) solved();
  }

  // A hint needs two taps (it costs 30 seconds): the first arms it, the second asks the server.
  let armed = 0;
  async function hint() {
    const b = $('#hint');
    if (busy || !p || p.done) return;
    if (Date.now() - armed > 3000) { armed = Date.now(); b.classList.add('armed'); b.innerHTML = 'Tap again for a hint <span>+30s</span>'; SOUNDS.tap(); setTimeout(() => { if (Date.now() - armed >= 3000) { b.classList.remove('armed'); b.innerHTML = 'Hint <span>+30s</span>'; } }, 3100); return; }
    armed = 0; b.classList.remove('armed'); b.innerHTML = 'Hint <span>+30s</span>'; b.disabled = true;
    let h;
    try { h = await rewireHint(current()); } catch (e) { b.disabled = false; say('Couldn’t get a hint right now. Try again.'); return; }
    b.disabled = false;
    if (!h || gone) return;
    lockTile(h.i, h.m);
    base += 30000; tick();
    SOUNDS.link(6); buzz(20);
    if (power()) solved();
  }
  function lockTile(i, m) {
    p.r[i] = [0, 1, 2, 3].find(k => rot(p.tiles[i], k) === m) ?? p.r[i];
    (p.locked ||= []).includes(i) || p.locked.push(i); save();
    const t = $('#grid').children[i]; t.style.setProperty('--r', p.r[i]); t.classList.add('locked', 'hinted');
  }

  async function solved() {
    busy = true; clearInterval(timer); $('#hint').hidden = true; $('#taps').hidden = true;
    let res;
    try { res = await rewireSubmit(current(), p.taps || 0); }
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
    $('.rewire').classList.add('won'); SOUNDS.hum(); burst('var(--c-rewire)');
    await wait(900);
  }

  function result(r, fresh) {
    const beat = r.beat != null ? `Faster than ${r.beat}% of players today` : 'You’re one of the first to finish today';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">Solved</p>
      <h2 class="display">In <em>${clock(r.ms)}</em></h2>
      ${r.stars ? `<p class="dr-stars">${starRow(r.stars)}</p><p class="muted">${r.taps} taps · par ${r.par}</p>` : ''}
      <p class="muted">${beat}${r.hints ? ` · ${r.hints} hint${r.hints > 1 ? 's' : ''}` : ''}${streak('rewire') > 1 ? ` · ${streak('rewire')} days in a row` : ''}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share your results</button>
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
    friendsOn($('#fr-on'), 'rewire');
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
    if (!p) { p = state.progress.rewire = { day, w: s.w, plants: s.plants, par: s.par, taps: 0, tiles: s.tiles, buildings: s.buildings, r: s.tiles.map(() => 0) }; save(); }
    $('#cover').classList.add('gone'); SOUNDS.tap();
    draw();
    if (s.result) return showDone(s.result);   // finished on another phone
    for (const h of s.hints || []) lockTile(h.i, h.m);   // hints already taken (maybe on another phone)
    base = s.elapsed_ms + 30000 * (s.hints || []).length; t0 = performance.now(); tick(); timer = setInterval(tick, 250);
    $('#hint').hidden = false; showTaps();
    if (power(false)) solved();
  }

  // Already done today: show the solved board and the result.
  function showDone(r) {
    const sol = []; countSolutions(p.tiles, p.w, plants(), 400000, sol);
    p.r = p.tiles.map((m, i) => [0, 1, 2, 3].find(k => rot(m, k) === sol[i]) ?? 0); p.done = true; save();
    finish('rewire', r, day);
    draw(); $('#cover').classList.add('gone'); $('.rewire').classList.add('won', 'still');
    $('#time').textContent = clock(r.ms);
    result(r, false);
  }

  $('#hint').addEventListener('click', hint);
  const done = resultFor('rewire');
  if (done && p) showDone(done);
  else if (p || done) begin();  // resume straight away (or fetch the finished board)
  else $('#start').addEventListener('click', begin);

  return () => { gone = true; clearInterval(timer); };
}
