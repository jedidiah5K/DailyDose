import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { lastStart, lastServe, lastAnswer, lastBank, lastPick, lastUse } from '../lib/cloud.js';
import { ROUNDS } from '../games/lastLogic.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';
import { shareDose } from '../ui/card.js';
import { friendsOn } from './friends.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
export const lastLine = r => r.perfect ? `All 10 · ${r.points} pts` : r.banked ? `Banked ${r.points} after round ${r.reached}` : `Out on round ${r.reached + 1} · ${r.points} pts`;
export const lastGrid = r => '🟢'.repeat(r.reached) + (r.banked ? '🏦' : r.perfect ? '' : '💀');
const pts = n => `${n} point${n === 1 ? '' : 's'}`;
const PERKS = {
  time: { name: '+5 seconds', tip: 'More time on one round', ic: '⏱' },
  fifty: { name: '50/50', tip: 'Remove two wrong answers', ic: '½' },
  skip: { name: 'Skip', tip: 'Pass one round, no points', ic: '⤼' },
};
const PADS = ['#FF4D6D', '#5CE1FF', '#FFC861', '#9B6BFF'];
const SPOT = ['#FF4D6D', '#5CE1FF', '#FFC861', '#9B6BFF'];

export function last(app) {
  const day = dayKey();
  let p = state.progress.last?.day === day ? state.progress.last : null;
  let gone = false, timer = 0, busy = false, alive = 100, st = { points: 0, perks: [] }, end = 0;

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
      <p>Each round you clear is worth its number in points. Between rounds, bank what you have or push on. Get one wrong and you keep only half.</p>
      <ul class="h-rules"><li><b>10</b> rounds</li><li><b>55</b> points max</li><li><b>2</b> perks</li></ul>
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
    st = s.state;
    if (Array.isArray(st.offer)) return offer();
    if (p.guesses.length && st.served?.k !== p.guesses.length) return pause(p.guesses.at(-1));
    round();
  }

  // Between rounds: the push-your-luck moment.
  function pause(g) {
    $('#step').textContent = `Round ${p.guesses.length} cleared`;
    const nextPts = p.guesses.length + 1;
    $('#body').innerHTML = `<div class="h-q rise ls-pause">
      <p class="eyebrow">${g?.skip ? 'Skipped' : `+${pts(g?.pts ?? 0)}`}</p>
      <h2 class="display"><em>${st.points}</em> point${st.points === 1 ? '' : 's'}</h2>
      <p class="muted">Round ${nextPts} is worth ${nextPts}. Miss it and you keep ${Math.floor(st.points / 2)}.</p>
      ${perkRow(false)}
    </div>
    <div class="h-bottom ls-choice"><button class="btn wide" id="push">Next round</button><button class="ls-bank" id="bank">Bank ${st.points} and stop</button></div>`;
    $('#push').addEventListener('click', () => { SOUNDS.tap(); buzz(); round(); });
    $('#bank').addEventListener('click', bank);
  }

  async function bank() {
    if (busy) return; busy = true;
    let r;
    try { r = await lastBank(); } catch (e) { busy = false; say('Couldn’t bank right now. Try again.'); return; }
    busy = false;
    SOUNDS.chime(); buzz(30);
    finish('last', r.result, day); summary(r.result, true);
  }

  // After rounds 3 and 6: choose one perk to hold.
  function offer() {
    $('#step').textContent = 'Pick a perk';
    $('#body').innerHTML = `<div class="h-q rise"><p class="eyebrow">You made it to round ${p.guesses.length + 1}</p>
      <h2 class="display">Take a <em>perk</em></h2><p class="muted">Hold up to two. Use one whenever a round gets tough.</p>
      <div class="ls-perks">${st.offer.map(k => `<button data-perk="${k}"><span>${PERKS[k].ic}</span><b>${PERKS[k].name}</b><small>${PERKS[k].tip}</small></button>`).join('')}</div>
    </div>`;
    app.querySelectorAll('[data-perk]').forEach(b => b.addEventListener('click', async () => {
      if (busy) return; busy = true;
      try { st = (await lastPick(b.dataset.perk)).state; } catch (e) { busy = false; say('Couldn’t take that perk. Try again.'); return; }
      busy = false; SOUNDS.ok(); buzz(15); pause(p.guesses.at(-1));
    }));
  }

  const perkRow = live => st.perks?.length ? `<div class="ls-held">${st.perks.map(k => `<button ${live ? '' : 'disabled'} data-use="${k}" title="${PERKS[k].tip}" aria-label="Use ${PERKS[k].name}">${PERKS[k].ic} ${PERKS[k].name}</button>`).join('')}</div>` : '';

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
    st.perks = s.perks; st.points = s.points;
    $('#body').innerHTML = `<div class="h-q rise ls-q">
      <p class="ls-prompt">${esc(q.prompt)}<span class="ls-worth">+${k + 1}</span></p>
      ${inner}
      <div class="m-timer ls-timer" aria-hidden="true"><i id="bar"></i></div>
      ${opts}
      ${perkRow(true)}
    </div>`;
    end = performance.now() + s.left_ms; let lim = s.limit_ms; const bar = $('#bar');
    const hide = idx => (idx || []).forEach(i => { const b = app.querySelector(`#opts [data-c="${i}"]`); if (b) { b.disabled = true; b.classList.add('gone'); } });
    hide(s.fifty);
    app.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', async () => {
      if (busy) return; busy = true; b.disabled = true;
      let u;
      try { u = await lastUse(b.dataset.use); } catch (e) { busy = false; b.disabled = false; say(/not on this round/.test(e.message) ? 'That perk doesn’t work on this round.' : 'Couldn’t use that right now.'); return; }
      busy = false; SOUNDS.ok(); buzz(15); b.remove();
      if (b.dataset.use === 'time') { end += 5000; lim += 5000; }
      if (b.dataset.use === 'fifty') hide(u.state.fifty);
      if (u.skipped) { clearInterval(timer); p.guesses.push({ k, ok: true, skip: true, pts: 0 }); save(); return next(u, { skip: true, pts: 0 }); }
      st = u.state;
    }));
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
    p.guesses.push({ k: a.k, ok: a.ok, pts: a.pts }); save();
    field(a.alive, a.started);
    if (a.ok) {
      btn?.classList.add('right'); SOUNDS.link(a.k + 1); buzz(12);
      await wait(650); next(a, { pts: a.pts });
    } else {
      btn?.classList.add('wrong');
      app.querySelector(`[data-c="${a.answer}"]`)?.classList.add('right');
      $('#field').classList.add('fallen'); SOUNDS.miss(); buzz(60);
      finish('last', a.result, day);
      await wait(1600);
      summary(a.result, true);
    }
  }

  function next(a, g) {
    if (a.result) { finish('last', a.result, day); return summary(a.result, true); }
    st = a.state;
    if (Array.isArray(st.offer)) return offer();
    pause(g);
  }

  function summary(r, fresh) {
    clearInterval(timer);
    $('#step').textContent = '';
    if (!r.perfect) $('#field').classList.add('fallen');
    $('#body').innerHTML = `<div class="result h-sum ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.perfect ? 'Last one standing' : r.banked ? `Banked after round ${r.reached}` : r.late ? `Out of time on round ${r.reached + 1}` : `Knocked out on round ${r.reached + 1}`}</p>
      <h2 class="display"><em>${r.points}</em> point${r.points === 1 ? '' : 's'}</h2>
      <p class="ls-grid">${lastGrid(r)}</p>
      <p class="muted">${r.beat != null ? `More than ${r.beat}% of players today` : 'You’re one of the first to play today'}${streak('last') > 1 ? ` · ${streak('last')} days in a row` : ''}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s rounds in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
    friendsOn($('#fr-on'), 'last');
  }

  if (resultFor('last')) summary(resultFor('last'), false);
  else if (p) load(); else intro();
  return () => { gone = true; clearInterval(timer); };
}
