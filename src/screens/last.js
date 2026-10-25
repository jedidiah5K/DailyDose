import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { lastStart, lastServe, lastAnswer } from '../lib/cloud.js';
import { ROUNDS } from '../games/lastLogic.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';
import { shareDose } from '../ui/card.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
export const lastLine = r => r.perfect ? 'Survived all 10' : `Out on round ${r.reached + 1}`;
export const lastGrid = r => '🟢'.repeat(r.reached) + (r.perfect ? '' : '💀');
const PADS = ['#FF4D6D', '#5CE1FF', '#FFC861', '#9B6BFF'];
const SPOT = ['#FF4D6D', '#5CE1FF', '#FFC861', '#9B6BFF'];

export function last(app) {
  const day = dayKey();
  let p = state.progress.last?.day === day ? state.progress.last : null;
  let gone = false, timer = 0, busy = false, alive = 100;

  app.innerHTML = `<main class="screen game laststand">
    <div class="stars" aria-hidden="true">${stars(24, 21)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-last">${icon('last')}Last Stand <span>No. ${puzzleNo()}</span></p>
      <span class="eyebrow mono" id="step"></span>
    </header>
    <div class="field" id="field" aria-hidden="true">${Array.from({ length: 100 }, (_, i) => `<i style="--i:${i};--r:${(i * 37) % 100}"></i>`).join('')}</div>
    <p class="field-cap" id="cap"></p>
    <section id="body" class="h-body"></section>
    <p class="v-msg" id="msg" role="status"></p>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };
  const dots = [...$('#field').children];
  dots[44].classList.add('you');   // your dot sits near the middle

  // Each dot is 1% of today's players. Dots past the share still standing drop away, in a scattered order.
  function field(pct, started) {
    alive = pct;
    const keep = Math.round(pct);
    dots.forEach(d => { const r = +d.style.getPropertyValue('--r'); d.classList.toggle('down', !d.classList.contains('you') && r >= keep); });
    $('#cap').textContent = started > 1 ? `${pct === 100 ? 'Everyone' : `${Math.round(pct)}% of players`} still standing${started < 20 ? ' · early' : ''}` : '';
  }

  function intro() {
    $('#body').innerHTML = `<div class="h-intro rise">
      <h2 class="display">Ten rounds.<br><em>One life.</em></h2>
      <p>Quick puzzles that get harder and faster. One wrong answer or a timeout and you’re out. Same rounds for everyone today.</p>
      <ul class="h-rules"><li><b>10</b> rounds</li><li><b>15s</b> to <b>8s</b></li><li><b>1</b> life</li></ul>
    </div>
    <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>`;
    $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    let s;
    try { s = await lastStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s rounds aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    p = state.progress.last = { day, guesses: s.guesses || [] }; save();
    if (s.result) { finish('last', s.result, day); return summary(s.result, false); }
    round();
  }

  async function round() {
    let s;
    try { s = await lastServe(); }
    catch (e) { say('Couldn’t reach the server. Try again.'); $('#body').innerHTML = '<div class="h-bottom"><button class="btn wide" id="retry">Try again</button></div>'; $('#retry').addEventListener('click', round); return; }
    if (gone) return;
    const q = s.round, k = s.k;
    $('#step').textContent = `Round ${k + 1} / ${ROUNDS}`;
    let inner = '';
    if (q.type === 'seq') inner = `<p class="ls-seq">${q.data.join(', ')}, <b>?</b></p>`;
    if (q.type === 'count') inner = `<div class="ls-count">${q.data.map(c => `<span>${c}</span>`).join('')}</div>`;
    if (q.type === 'echo') inner = `<div class="ls-pads" id="pads">${PADS.map((c, i) => `<i style="--c:${c}" data-p="${i}"></i>`).join('')}</div>`;
    if (q.type === 'spot') inner = `<div class="ls-spot"><div class="g" style="--n:${q.data.size}">${q.data.before.map(v => `<i style="--c:${SPOT[v]}"></i>`).join('')}</div>
      <div class="g tap" style="--n:${q.data.size}">${q.data.after.map((v, i) => `<button style="--c:${SPOT[v]}" data-c="${i}" aria-label="Square ${i + 1}"></button>`).join('')}</div></div>`;
    const opts = q.type === 'spot' ? '' : q.type === 'echo'
      ? `<div class="ls-opts echo" id="opts" hidden>${q.options.map((o, i) => `<button data-c="${i}">${[...o].map(n => `<i style="--c:${PADS[n]}"></i>`).join('')}</button>`).join('')}</div>`
      : `<div class="ls-opts ${q.options.length === 2 ? 'two' : ''}" id="opts">${q.options.map((o, i) => `<button data-c="${i}">${esc(o)}</button>`).join('')}</div>`;
    $('#body').innerHTML = `<div class="h-q rise ls-q">
      <p class="ls-prompt">${esc(q.prompt)}</p>
      ${inner}
      <div class="m-timer ls-timer" aria-hidden="true"><i id="bar"></i></div>
      ${opts}
    </div>`;
    const end = performance.now() + s.left_ms, lim = s.limit_ms, bar = $('#bar');
    let warned = false;
    const tick = () => {
      const left = Math.max(0, end - performance.now());
      bar.style.transform = `scaleX(${left / lim})`;
      bar.classList.toggle('low', left < 3000);
      if (left < 3000 && !warned) { warned = true; SOUNDS.tick(); buzz(6); }
      if (left <= 0) answer(-1);
    };
    clearInterval(timer); timer = setInterval(tick, 100); tick();
    // the light pattern plays once, then the choices appear
    if (q.type === 'echo') {
      const pads = [...$('#pads').children];
      await wait(400);
      for (const n of q.data) { if (gone) return; pads[n].classList.add('on'); SOUNDS.light(n * 2); await wait(420); pads[n].classList.remove('on'); await wait(180); }
      $('#opts').hidden = false;
    }
    app.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => answer(+b.dataset.c, b)));
  }

  async function answer(choice, btn) {
    if (busy) return; busy = true; clearInterval(timer);
    app.querySelectorAll('[data-c]').forEach(b => { b.disabled = true; });
    btn?.classList.add('picked');
    let a;
    try { a = await lastAnswer(choice); }
    catch (e) { busy = false; say('Couldn’t send that. Check your connection.'); app.querySelectorAll('[data-c]').forEach(b => { b.disabled = false; }); return; }
    busy = false;
    if (gone) return;
    p.guesses.push({ k: a.k, ok: a.ok }); save();
    field(a.alive, a.started);
    if (a.ok) {
      btn?.classList.add('right'); SOUNDS.link(a.k + 1); buzz(12);
      if (a.result) { finish('last', a.result, day); await wait(700); return summary(a.result, true); }
      await wait(650); round();
    } else {
      btn?.classList.add('wrong');
      app.querySelector(`[data-c="${a.answer}"]`)?.classList.add('right');
      $('#field').classList.add('fallen'); SOUNDS.miss(); buzz(60);
      finish('last', a.result, day);
      await wait(1600);
      summary(a.result, true);
    }
  }

  function summary(r, fresh) {
    clearInterval(timer);
    $('#step').textContent = '';
    if (!r.perfect) $('#field').classList.add('fallen');
    $('#body').innerHTML = `<div class="result h-sum ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.perfect ? 'Last one standing' : r.late ? 'Out of time' : 'Knocked out'}</p>
      <h2 class="display">${r.perfect ? 'All <em>10</em> survived' : `Out on round <em>${r.reached + 1}</em>`}</h2>
      <p class="ls-grid">${lastGrid(r)}</p>
      <p class="muted">${r.beat != null ? `Outlasted ${r.beat}% of players today` : 'You’re one of the first to play today'}${streak('last') > 1 ? ` · ${streak('last')} days in a row` : ''}</p>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s rounds in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
  }

  if (resultFor('last')) summary(resultFor('last'), false);
  else if (p) load(); else intro();
  return () => { gone = true; clearInterval(timer); };
}
