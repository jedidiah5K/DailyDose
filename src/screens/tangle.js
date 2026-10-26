import { dayKey, puzzleNo, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { tangleStart, tangleSubmit } from '../lib/cloud.js';
import { tangles } from '../games/tangleLogic.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';
import { friendsOn } from './friends.js';

export const tangleLine = r => `Untangled in ${clock(r.ms)}`;

// Tangle: drag the dots until no lines cross. Tangled lines are dim; clear ones glow, so the board
// lights up as you go. The server times it and checks the final board.
export function tangle(app) {
  const day = dayKey();
  let p = state.progress.tangle?.day === day ? state.progress.tangle : null;
  let busy = false, gone = false, timer = 0, base = 0, t0 = 0, drag = null, lastBad = -1;

  app.innerHTML = `<main class="screen game tangle">
    <div class="stars" aria-hidden="true">${stars(32, 41)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-tangle">${icon('tangle')}Tangle <span>No. ${puzzleNo()}</span></p>
      <span class="eyebrow mono" id="time">0:00</span>
    </header>
    <div class="tg-stage">
      <svg class="tg-board" id="board" viewBox="0 0 100 100" aria-label="Tangle board"></svg>
      <div class="rw-cover" id="cover">
        <h2 class="display">Untie the <em>knot</em></h2>
        <p>Drag the dots until no two lines cross. Lines glow once they’re clear.</p>
        <button class="btn" id="start">Start</button>
        <p class="eyebrow">The clock starts when you tap Start</p>
      </div>
    </div>
    <p class="tg-count mono" id="count" aria-live="polite"></p>
    <p class="v-msg" id="msg" role="status"></p>
    <section id="bottom"></section>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };
  const svg = $('#board');

  function draw() {
    const { bad, badDots, solved } = tangles(p.pos, p.edges);
    const lines = p.edges.map(([a, b], i) => `<line class="${bad.has(i) ? 'knot' : 'clear'}" x1="${p.pos[a][0] * 100}" y1="${p.pos[a][1] * 100}" x2="${p.pos[b][0] * 100}" y2="${p.pos[b][1] * 100}"/>`).join('');
    const dots = p.pos.map(([x, y], i) => `<g class="dot${badDots.has(i) ? ' bad' : ''}" data-i="${i}"><circle class="hit" cx="${x * 100}" cy="${y * 100}" r="7"/><circle class="core" cx="${x * 100}" cy="${y * 100}" r="2.6"/></g>`).join('');
    svg.innerHTML = lines + dots;
    if (!p.done) $('#count').textContent = solved ? 'Untangled' : `${bad.size} line${bad.size === 1 ? '' : 's'} still crossing`;
    // a small rising note each time fewer lines are crossing
    if (lastBad >= 0 && bad.size < lastBad) SOUNDS.link(Math.max(0, 10 - bad.size));
    lastBad = bad.size;
    return solved;
  }

  // Dragging: pointer position to board units (0..1), kept off the very edge.
  const toBoard = e => { const r = svg.getBoundingClientRect(); const c = v => Math.min(0.97, Math.max(0.03, v)); return [c((e.clientX - r.left) / r.width), c((e.clientY - r.top) / r.height)]; };
  svg.addEventListener('pointerdown', e => {
    const g = e.target.closest('.dot'); if (!g || busy || !p || p.done) return;
    drag = { i: +g.dataset.i, moved: false }; svg.setPointerCapture(e.pointerId); buzz(5); e.preventDefault();
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    p.pos[drag.i] = toBoard(e).map(v => +v.toFixed(4)); drag.moved = true; draw();
  });
  const drop = () => {
    if (!drag) return;
    const moved = drag.moved; drag = null;
    if (!moved) return;
    p.moves = (p.moves || 0) + 1; save(); SOUNDS.turn();
    if (draw()) solved();
  };
  svg.addEventListener('pointerup', drop); svg.addEventListener('pointercancel', drop);

  async function solved() {
    busy = true; clearInterval(timer);
    let res;
    try { res = await tangleSubmit(p.pos, p.moves || 0); }
    catch (e) {
      busy = false; timer = setInterval(tick, 250);
      say(/not solved/.test(e.message) ? 'So close: something is still touching. Nudge the dots apart a little.' : navigator.onLine ? 'Couldn’t reach the server. Move any dot to try again.' : 'You’re offline. Your board is saved; reconnect and move a dot to finish.');
      return;
    }
    if (gone) return;
    p.done = true; save(); finish('tangle', res, day);
    $('#time').textContent = clock(res.ms); $('#count').textContent = '';
    $('.tangle').classList.add('won'); SOUNDS.hum(); buzz(30);
    result(res, true);
  }

  function result(r, fresh) {
    const beat = r.beat != null ? `Faster than ${r.beat}% of players today` : 'You’re one of the first to finish today';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">Knot untied</p>
      <h2 class="display">In <em>${clock(r.ms)}</em></h2>
      <p class="muted">${beat} · ${r.moves} move${r.moves === 1 ? '' : 's'}${streak('tangle') > 1 ? ` · ${streak('tangle')} days in a row` : ''}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s knot in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
    friendsOn($('#fr-on'), 'tangle');
  }

  function tick() { $('#time').textContent = clock(base + performance.now() - t0); }

  async function begin() {
    $('#start').disabled = true; say('');
    let s;
    try { s = await tangleStart(); }
    catch (e) { $('#start').disabled = false; say(/no puzzle/.test(e.message) ? 'Today’s knot isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    // a finished board on another phone is shown as it was left
    if (!p) { p = state.progress.tangle = { day, n: s.n, edges: s.edges, pos: s.start.map(q => [...q]), moves: 0 }; save(); }
    $('#cover').classList.add('gone'); SOUNDS.tap();
    if (s.result) { p.done = true; save(); finish('tangle', s.result, day); draw(); $('.tangle').classList.add('won', 'still'); $('#time').textContent = clock(s.result.ms); return result(s.result, false); }
    draw();
    base = s.elapsed_ms; t0 = performance.now(); tick(); timer = setInterval(tick, 250);
    if (tangles(p.pos, p.edges).solved) solved();
  }

  $('#start').addEventListener('click', begin);
  const done = resultFor('tangle');
  if (p && done) { $('#cover').classList.add('gone'); p.done = true; draw(); $('.tangle').classList.add('won', 'still'); $('#time').textContent = clock(done.ms); result(done, false); }
  else if (p || done) begin();

  return () => { gone = true; clearInterval(timer); };
}
