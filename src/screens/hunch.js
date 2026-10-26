import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { hunchStart, hunchBet } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon, sideBlurb } from '../ui/sky.js';
import { friendsOn } from './friends.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
const BINS = 24;

// Slider position (0..1) <-> value. Log scale for things that span orders of magnitude.
const toV = (q, t) => q.log ? q.min * (q.max / q.min) ** t : q.min + t * (q.max - q.min);
const toT = (q, v) => Math.min(1, Math.max(0, q.log ? Math.log(v / q.min) / Math.log(q.max / q.min) : (v - q.min) / (q.max - q.min)));
const isYear = q => !q.unit && q.min >= 1000;
const tidy = (q, v) => isYear(q) || v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
const fmt = (q, v) => isYear(q) ? String(Math.round(v)) : Number(v).toLocaleString(undefined, { maximumFractionDigits: v >= 10 ? 0 : v >= 1 ? 1 : 2 });
const unit = q => q.unit ? ` <span class="h-unit">${q.unit}</span>` : '';

// The three bets: tight, medium, wide. Same sizes as the server (dose_hunch_bet).
const BANDS = [{ name: 'Tight', pts: 100 }, { name: 'Medium', pts: 50 }, { name: 'Wide', pts: 20 }];
function band(q, v, b) {
  if (isYear(q)) { const h = [1, 3, 8][b]; return [v - h, v + h]; }
  if (q.log) { const f = [1.1, 1.3, 1.6][b]; return [v / f, v * f]; }
  const h = (q.max - q.min) * [.02, .06, .15][b]; return [v - h, v + h];
}

const off = (q, g) => g.v === g.a ? 'Spot on.' : isYear(q) ? `${Math.abs(g.v - g.a)} year${Math.abs(g.v - g.a) === 1 ? '' : 's'} off.` : g.err < 1 ? 'Spot on.' : `${Math.round(g.err)}% off.`;
const worldOff = (q, g) => isYear(q) ? `${Math.round(Math.abs(g.avg - g.a))} years` : `${Math.round(Math.abs(g.avg - g.a) / g.a * 100)}%`;

// Up to 40 falling dots, spread across the columns in proportion to the guesses in each.
function rain(bins) {
  const total = bins.reduce((a, b) => a + b, 0), out = [];
  if (!total) return '';
  bins.forEach((n, b) => { for (let k = 0; k < Math.round(n / total * Math.min(total, 40)); k++) out.push(`<i class="meteor" style="--x:${(b + .5) / bins.length};--d:${(out.length * 23) % 600}ms"></i>`); });
  return out.join('');
}

export const hunchLine = r => r.points != null ? `🎯 ${r.points} pts · ${r.hits}/5 in band${r.theme ? ` · ${r.theme}` : ''}` : `🎯 avg error ${Math.round(r.err)}%`;

export function hunch(app) {
  const day = dayKey();
  let p = state.progress.hunch?.day === day ? state.progress.hunch : null;
  let busy = false, gone = false;

  app.innerHTML = `<main class="screen game hunch">
    <div class="stars" aria-hidden="true">${stars(40, 9)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-hunch">${icon('hunch')}Hunch <span>No. ${puzzleNo()}</span></p>
      <span class="eyebrow mono" id="step"></span>
    </header>
    <div class="g-play"><section id="body" class="h-body"><div class="h-skel"><i></i><i></i><i></i></div></section></div>
    <aside class="g-side">${sideBlurb('hunch', 'Hunch', 'Five questions with a number for an answer. Slide to your guess, then bet on how close you are: a tight band scores big, a wide one plays it safe.')}
    <p class="v-msg" id="msg" role="status"></p></aside>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };
  const doubled = () => p?.guesses.some(g => g.dbl);

  function ask(i) {
    const q = p.questions[i];
    let t = .5, v = tidy(q, toV(q, t)), lastNotch = -1;
    $('#step').textContent = `${i + 1} / ${p.questions.length}`;
    $('#body').innerHTML = `<div class="h-q rise">
      <p class="eyebrow">Question ${i + 1}</p>
      <h2 class="display">${q.q}</h2>
      <p class="h-val" id="val" aria-live="polite">${fmt(q, v)}${unit(q)}</p>
      <input class="h-slider" id="sl" type="range" min="0" max="1000" value="500" aria-label="Your guess" aria-valuetext="${fmt(q, v)} ${q.unit}">
      <div class="h-ends"><span>${fmt(q, q.min)}</span><span>${fmt(q, q.max)}</span></div>
      <div class="h-bands" role="radiogroup" aria-label="How sure are you?">${BANDS.map((b, k) => `<button role="radio" data-b="${k}" aria-checked="${k === 1}"><b>${b.name}</b><span>${b.pts} pts</span></button>`).join('')}</div>
      <p class="h-band" id="bandtxt"></p>
      ${doubled() ? '' : '<button class="h-double" id="dbl" aria-pressed="false">Double down <span>×2 if inside, −30 if not · once a day</span></button>'}
    </div>
    <div class="h-bottom"><button class="btn wide" id="go">Lock it in</button></div>`;
    let bnd = 1, dbl = false;
    const showBand = () => {
      const [lo, hi] = band(q, v, bnd);
      $('#bandtxt').innerHTML = `Points if the answer is between <b>${fmt(q, Math.max(q.min, tidy(q, lo)))}</b> and <b>${fmt(q, Math.min(q.max, tidy(q, hi)))}</b>${q.unit ? ' ' + q.unit : ''}`;
      sl.style.setProperty('--lo', toT(q, Math.max(q.min, lo))); sl.style.setProperty('--hi', toT(q, Math.min(q.max, hi)));
    };
    app.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => {
      bnd = +b.dataset.b; app.querySelectorAll('[data-b]').forEach(x => x.setAttribute('aria-checked', x === b)); SOUNDS.tap(); buzz(5); showBand();
    }));
    $('#dbl')?.addEventListener('click', () => { dbl = !dbl; $('#dbl').setAttribute('aria-pressed', dbl); SOUNDS[dbl ? 'lock' : 'tap'](); buzz(dbl ? 20 : 5); });
    const sl = $('#sl');
    sl.addEventListener('input', () => {
      t = sl.value / 1000; v = tidy(q, toV(q, t));
      $('#val').innerHTML = `${fmt(q, v)}${unit(q)}`;
      sl.setAttribute('aria-valuetext', `${fmt(q, v)} ${q.unit}`);
      sl.style.setProperty('--t', t); showBand();
      const notch = Math.round(t * 40); if (notch !== lastNotch) { lastNotch = notch; SOUNDS.tick(); buzz(3); }
    });
    sl.style.setProperty('--t', t); showBand();
    $('#go').addEventListener('click', async () => {
      if (busy) return; busy = true; $('#go').disabled = true; say('');
      SOUNDS.lock(); buzz(15);
      let g;
      try { g = await hunchBet(i, v, bnd, dbl); }
      catch (e) { busy = false; $('#go').disabled = false; say(navigator.onLine ? 'Couldn’t reach the server. Try again.' : 'You’re offline. Your guess is still set; try again when you’re back.'); return; }
      if (gone) return;
      p.guesses.push(g); save();
      if (g.result) finish('hunch', g.result, day);
      busy = false;
      reveal(i, true);
    });
  }

  // The world's guesses rain onto the chart, then the true answer drops in.
  async function reveal(i, fresh) {
    const q = p.questions[i], g = p.guesses[i], max = Math.max(1, ...g.bins);
    const early = g.n < 30, last = i === p.questions.length - 1;
    const line = g.n === 0 ? 'You’re one of the first to answer. The world’s guesses fill in as people play.'
      : g.beat ? `You beat the world. Their average was ${worldOff(q, g)} off.`
      : `The world’s average was ${worldOff(q, g)} off.`;
    $('#step').textContent = `${i + 1} / ${p.questions.length}`;
    $('#body').innerHTML = `<div class="h-q">
      <p class="eyebrow">Question ${i + 1}</p>
      <h2 class="display h-small">${q.q}</h2>
      <div class="chart ${fresh ? 'play' : ''}" id="chart">
        ${g.bins.map((n, b) => `<i class="bar" style="--h:${n / max};--b:${b}"></i>`).join('')}
        ${fresh ? rain(g.bins) : ''}
        ${g.lo != null ? `<span class="hband ${g.in ? 'in' : 'out'}" style="--l:${toT(q, Math.max(q.min, g.lo))};--r:${toT(q, Math.min(q.max, g.hi))}"></span>` : ''}
        <span class="mark you" style="--x:${toT(q, g.v)}"><b>You</b></span>
        ${g.avg != null ? `<span class="mark avg" style="--x:${toT(q, g.avg)}"><b>World</b></span>` : ''}
        <span class="mark ans" style="--x:${toT(q, g.a)}"><b>${fmt(q, g.a)}${q.unit ? ' ' + q.unit : ''}</b></span>
      </div>
      <div class="h-ends"><span>${fmt(q, q.min)}</span><span>${early && g.n ? `Early guesses · ${g.n}` : ''}</span><span>${fmt(q, q.max)}</span></div>
      ${g.pts != null ? `<p class="h-pts ${g.in ? 'in' : 'out'}">${g.in ? `Inside your band <b>+${g.pts}</b>` : `Outside your band <b>${g.pts}</b>`}${g.dbl ? ' · doubled' : ''}</p>` : ''}
      <p class="h-off"><b>${off(q, g)}</b> You said ${fmt(q, g.v)}${q.unit ? ' ' + q.unit : ''}.</p>
      <p class="muted">${line}</p>
      ${g.source ? `<a class="h-src" href="${encodeURI(g.source)}" target="_blank" rel="noopener noreferrer">Source</a>` : ''}
    </div>
    <div class="h-bottom"><button class="btn wide" id="next">${last ? 'See your score' : 'Next question'}</button></div>`;
    $('#next').addEventListener('click', () => { SOUNDS.tap(); last ? summary(resultFor('hunch'), true) : ask(i + 1); });
    if (!fresh) return;
    const bars = g.bins.filter(Boolean).length;
    for (let k = 0; k < Math.min(bars, 8); k++) setTimeout(() => SOUNDS.tick(), k * 60);
    await wait(700); SOUNDS.drop(); buzz(20);
    await wait(400); if (g.in) SOUNDS.chime(); else SOUNDS.miss();
  }

  function summary(r, fresh) {
    $('#step').textContent = '';
    $('#body').innerHTML = `<div class="result h-sum ${fresh ? 'rise' : ''}">
      ${r.theme ? `<p class="h-theme"><span>Today’s theme</span><b>${r.theme}</b></p>` : '<p class="eyebrow">Today’s hunches</p>'}
      <h2 class="display">${r.points != null ? `<em>${r.points}</em> points` : `<em>${Math.round(r.err)}%</em> off`}</h2>
      <p class="muted">${r.points != null ? `${r.hits} of 5 inside your band · average error ${Math.round(r.err)}%` : 'Average error across your five guesses'}${streak('hunch') > 1 ? ` · ${streak('hunch')} days in a row` : ''}</p>
      <ol class="h-list">${p ? p.guesses.map((g, i) => `<li><span>${p.questions[i].q}</span><b class="${g.in ? 'in' : ''}">${g.pts != null ? `${g.pts > 0 ? '+' : ''}${g.pts}` : isYear(p.questions[i]) ? `${Math.abs(g.v - g.a)} yr` : `${Math.round(g.err)}%`}</b></li>`).join('') : ''}</ol>
      <div class="fr-on" id="fr-on"></div>
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
    friendsOn($('#fr-on'), 'hunch');
  }

  async function load() {
    let s;
    try { s = await hunchStart(); }
    catch (e) {
      if (p) return continueFrom(p);   // offline, but today's questions are already on the phone
      $('#body').innerHTML = '';
      say(/no puzzle/.test(e.message) ? 'Today’s questions aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.');
      return;
    }
    if (gone) return;
    p = state.progress.hunch = { day, questions: s.questions, guesses: s.guesses };
    if (s.result) finish('hunch', s.result, day);
    save(); continueFrom(p);
  }
  function continueFrom(p) {
    const r = resultFor('hunch');
    if (r) summary(r, false);
    else if (p.guesses.length) reveal(p.guesses.length - 1, false);
    else ask(0);
  }

  // First visit today: a short intro before anything starts. Coming back mid-game skips it.
  function intro() {
    $('#body').innerHTML = `<div class="h-intro rise">
      <div class="h-orbit" aria-hidden="true">${icon('hunch')}</div>
      <h2 class="display">How close can you <em>get?</em></h2>
      <p>Slide to your guess, then bet on it: a tight band scores big but only if you’re close. Five questions. Some nights hide a theme.</p>
      <ul class="h-rules"><li><b>5</b> questions</li><li><b>3</b> bets</li><li><b>1</b> double down</li></ul>
    </div>
    <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>`;
    $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>'; load(); });
  }

  if (p || resultFor('hunch')) load(); else intro();
  return () => { gone = true; };
}
