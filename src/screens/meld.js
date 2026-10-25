import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { meldStart, meldServe, meldAnswer } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';
import { shareDose } from '../ui/card.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
export const MARKS = { g: '🟩', y: '🟨', x: '⬛', p: '🟪', c: '⬜' };
export const meldLine = r => `Herd ${[...r.herd].map(m => MARKS[m]).join('')} · Odd ${[...r.odd].map(m => MARKS[m]).join('')}`;
const ROUND = {
  herd: { name: 'Herd round', tip: 'Say what most people would say.' },
  odd: { name: 'Odd round', tip: 'Say something real that few people would say.' },
};
const VERDICT = {
  g: 'With the crowd', y: 'Real, but not a top answer', x: 'Not on the list', p: 'Rare. Nicely done.', c: 'Too popular for the Odd round',
};

export function meld(app) {
  const day = dayKey();
  let p = state.progress.meld?.day === day ? state.progress.meld : null;
  let gone = false, timer = 0, busy = false;

  app.innerHTML = `<main class="screen game meld">
    <div class="stars" aria-hidden="true">${stars(36, 17)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-meld">${icon('meld')}Mind Meld <span>No. ${puzzleNo()}</span></p>
      <span class="eyebrow mono" id="step"></span>
    </header>
    <section id="body" class="h-body"></section>
    <p class="v-msg" id="msg" role="status"></p>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };

  function intro() {
    $('#body').innerHTML = `<div class="h-intro rise">
      <div class="orbs" aria-hidden="true"><i></i><i></i></div>
      <h2 class="display">Think like <em>everyone.</em><br>Then like no one.</h2>
      <p>Five prompts, twice. First say what most people would say. Then say something real that hardly anyone would.</p>
      <ul class="h-rules"><li><b>5</b> prompts</li><li><b>2</b> rounds</li><li><b>20s</b> each</li></ul>
    </div>
    <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>`;
    $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    let s;
    try { s = await meldStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s prompts aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    p = state.progress.meld = { day, prompts: s.prompts, guesses: s.guesses || [] }; save();
    if (s.result) { finish('meld', s.result, day); return summary(s.result, false); }
    next();
  }

  // Between the rounds: a short pause that explains the switch.
  function next() {
    const k = p.guesses.length;
    if (k === 5 && !p.oddIntro) {
      p.oddIntro = true; save();
      $('#step').textContent = '';
      $('#body').innerHTML = `<div class="h-intro rise"><p class="eyebrow">Round 2</p><h2 class="display">Now go <em>odd.</em></h2>
        <p>Same five prompts. This time, give a real answer that hardly anyone else will. Made-up answers don’t count.</p></div>
        <div class="h-bottom"><button class="btn wide" id="go">I’m ready</button></div>`;
      $('#go').addEventListener('click', () => { SOUNDS.tap(); ask(); });
      return;
    }
    ask();
  }

  async function ask() {
    let s;
    try { s = await meldServe(); }
    catch (e) { say('Couldn’t reach the server. Try again.'); $('#body').innerHTML = '<div class="h-bottom"><button class="btn wide" id="retry">Try again</button></div>'; $('#retry').addEventListener('click', ask); return; }
    if (gone) return;
    const r = ROUND[s.round], q = p.prompts[s.i];
    $('#step').textContent = `${s.round === 'herd' ? s.i + 1 : s.i + 6} / 10`;
    $('#body').innerHTML = `<div class="h-q rise">
      <p class="m-round m-${s.round}">${r.name}<span>${r.tip}</span></p>
      <h2 class="display m-prompt">${esc(q)}</h2>
      <form class="m-form" id="form" autocomplete="off">
        <input id="ans" maxlength="40" placeholder="Type your answer" autocapitalize="sentences" enterkeyhint="send" aria-label="Your answer">
        <button class="btn" id="send">Send</button>
      </form>
      <div class="m-timer" aria-hidden="true"><i id="bar"></i></div>
    </div>`;
    const input = $('#ans'), bar = $('#bar');
    setTimeout(() => input.focus(), 50);
    const end = performance.now() + s.left_ms;
    let warned = false;
    const tick = () => {
      const left = Math.max(0, end - performance.now());
      bar.style.transform = `scaleX(${left / 20000})`;
      bar.classList.toggle('low', left < 5000);
      if (left < 5000 && !warned) { warned = true; SOUNDS.tick(); buzz(6); }
      if (left <= 0) submit();
    };
    clearInterval(timer); timer = setInterval(tick, 100); tick();
    $('#form').addEventListener('submit', e => { e.preventDefault(); submit(); });
    async function submit() {
      if (busy) return; busy = true; clearInterval(timer);
      $('#send').disabled = true; input.disabled = true;
      let g;
      try { g = await meldAnswer(input.value.trim()); }
      catch (e) { busy = false; $('#send').disabled = false; input.disabled = false; say('Couldn’t send that. Try again.'); return; }
      busy = false;
      if (gone) return;
      p.guesses.push(g); save();
      if (g.result) finish('meld', g.result, day);
      reveal(g, q);
    }
  }

  // The reveal: the top answers fill in, and yours pulls toward its match.
  function reveal(g, q) {
    const top = g.top || [], max = Math.max(...top.map(t => t.share), 1);
    const yours = g.label ? `“${esc(g.label)}”` : g.late ? 'Out of time' : `“${esc(g.t || '…')}”`;
    const line = !g.a ? (g.late ? 'The timer ran out.' : 'That one isn’t on the list for this prompt.')
      : g.of > 1 ? `${g.said} of ${g.of} people ${g.r === 'odd' ? 'went odd with' : 'said'} ${esc(g.label)}` : 'You’re the first to say it today';
    $('#body').innerHTML = `<div class="h-q">
      <p class="m-round m-${g.r}">${ROUND[g.r].name}</p>
      <h2 class="display h-small">${esc(q)}</h2>
      <div class="m-meet ${calm() ? '' : 'play'} mk-${g.mark}"><span class="m-you">${yours}</span><span class="m-verdict">${MARKS[g.mark]} ${VERDICT[g.mark]}</span></div>
      <p class="muted">${line}${g.share != null ? ` · about ${Math.round(g.share)}% of people` : ''}</p>
      <ol class="m-top">${top.map((t, n) => `<li class="${t.label === g.label ? 'mine' : ''}" style="--w:${t.share / max};--n:${n}"><span>${esc(t.label)}</span><b>${Math.round(t.share)}%</b></li>`).join('')}</ol>
      <p class="eyebrow">Top answers so far${g.of < 30 ? ' · early, mostly our estimates' : ''}</p>
    </div>
    <div class="h-bottom"><button class="btn wide" id="next">${p.guesses.length >= 10 ? 'See your meld' : 'Next prompt'}</button></div>`;
    ({ g: SOUNDS.chime, p: SOUNDS.chime, y: SOUNDS.ok, c: SOUNDS.ok, x: SOUNDS.miss })[g.mark]?.(); buzz(g.mark === 'x' ? 10 : 20);
    $('#next').addEventListener('click', () => { SOUNDS.tap(); p.guesses.length >= 10 ? summary(resultFor('meld'), true) : next(); });
  }

  function summary(r, fresh) {
    $('#step').textContent = '';
    const row = (name, marks) => `<div class="m-row"><span>${name}</span><b>${[...marks].map(m => `<i class="mk mk-${m}"></i>`).join('')}</b></div>`;
    $('#body').innerHTML = `<div class="result h-sum ${fresh ? 'rise' : ''}">
      <p class="eyebrow">Today’s meld</p>
      <h2 class="display"><em>${r.score}</em> of 10 landed</h2>
      <div class="m-rows">${row('Herd', r.herd)}${row('Odd', r.odd)}</div>
      <p class="muted">Green: with the crowd. Purple: rare and real.${streak('meld') > 1 ? ` · ${streak('meld')} days in a row` : ''}</p>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s prompts in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
  }

  if (resultFor('meld')) summary(resultFor('meld'), false);
  else if (p) load(); else intro();
  return () => { gone = true; clearInterval(timer); };
}
