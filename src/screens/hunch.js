import { dayKey, puzzleNo } from '../lib/day.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { hunchStart, hunchGuess } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
const BINS = 24;

// Slider position (0..1) <-> value. Log scale for things that span orders of magnitude.
const toV = (q, t) => q.log ? q.min * (q.max / q.min) ** t : q.min + t * (q.max - q.min);
const toT = (q, v) => Math.min(1, Math.max(0, q.log ? Math.log(v / q.min) / Math.log(q.max / q.min) : (v - q.min) / (q.max - q.min)));
const isYear = q => !q.unit && q.min >= 1000;
const tidy = (q, v) => isYear(q) || v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
const fmt = (q, v) => isYear(q) ? String(Math.round(v)) : Number(v).toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 0 : 2 });
const unit = q => q.unit ? ` <span class="h-unit">${q.unit}</span>` : '';

const off = (q, g) => g.v === g.a ? 'Spot on.' : isYear(q) ? `${Math.abs(g.v - g.a)} year${Math.abs(g.v - g.a) === 1 ? '' : 's'} off.` : g.err < 1 ? 'Spot on.' : `${Math.round(g.err)}% off.`;
const worldOff = (q, g) => isYear(q) ? `${Math.round(Math.abs(g.avg - g.a))} years` : `${Math.round(Math.abs(g.avg - g.a) / g.a * 100)}%`;

// Up to 40 falling dots, spread across the columns in proportion to the guesses in each.
function rain(bins) {
  const total = bins.reduce((a, b) => a + b, 0), out = [];
  if (!total) return '';
  bins.forEach((n, b) => { for (let k = 0; k < Math.round(n / total * Math.min(total, 40)); k++) out.push(`<i class="meteor" style="--x:${(b + .5) / bins.length};--d:${(out.length * 23) % 600}ms"></i>`); });
  return out.join('');
}

export const hunchLine = r => `🎯 ${r.rated ? `beat the world ${r.beat}/${r.rated} · ` : ''}avg error ${Math.round(r.err)}%`;
const shareText = r => `🎯 HUNCH #${puzzleNo()} · ${r.rated ? `beat the world ${r.beat}/${r.rated} · ` : ''}avg error ${Math.round(r.err)}%\nDAILY DOSE`;

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
    <section id="body" class="h-body"><div class="h-skel"><i></i><i></i><i></i></div></section>
    <p class="v-msg" id="msg" role="status"></p>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };

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
    </div>
    <div class="h-bottom"><button class="btn wide" id="go">Lock it in</button></div>`;
    const sl = $('#sl');
    sl.addEventListener('input', () => {
      t = sl.value / 1000; v = tidy(q, toV(q, t));
      $('#val').innerHTML = `${fmt(q, v)}${unit(q)}`;
      sl.setAttribute('aria-valuetext', `${fmt(q, v)} ${q.unit}`);
      sl.style.setProperty('--t', t);
      const notch = Math.round(t * 40); if (notch !== lastNotch) { lastNotch = notch; SOUNDS.tick(); buzz(3); }
    });
    sl.style.setProperty('--t', t);
    $('#go').addEventListener('click', async () => {
      if (busy) return; busy = true; $('#go').disabled = true; say('');
      SOUNDS.lock(); buzz(15);
      let g;
      try { g = await hunchGuess(i, v); }
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
        <span class="mark you" style="--x:${toT(q, g.v)}"><b>You</b></span>
        ${g.avg != null ? `<span class="mark avg" style="--x:${toT(q, g.avg)}"><b>World</b></span>` : ''}
        <span class="mark ans" style="--x:${toT(q, g.a)}"><b>${fmt(q, g.a)}${q.unit ? ' ' + q.unit : ''}</b></span>
      </div>
      <div class="h-ends"><span>${fmt(q, q.min)}</span><span>${early && g.n ? `Early guesses · ${g.n}` : ''}</span><span>${fmt(q, q.max)}</span></div>
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
    await wait(400); if (g.err < 10 || g.beat) SOUNDS.chime();
  }

  function summary(r, fresh) {
    $('#step').textContent = '';
    $('#body').innerHTML = `<div class="result h-sum ${fresh ? 'rise' : ''}">
      <p class="eyebrow">Today’s hunches</p>
      <h2 class="display">${r.rated ? `Beat the world <em>${r.beat}/${r.rated}</em>` : `<em>${Math.round(r.err)}%</em> off`}</h2>
      <p class="muted">${r.rated ? `Average error ${Math.round(r.err)}%` : 'Average error across your five guesses'}${streak('hunch') > 1 ? ` · ${streak('hunch')} days in a row` : ''}</p>
      <ol class="h-list">${p ? p.guesses.map((g, i) => `<li><span>${p.questions[i].q}</span><b>${isYear(p.questions[i]) ? `${Math.abs(g.v - g.a)} yr` : `${Math.round(g.err)}%`}</b></li>`).join('') : ''}</ol>
      <button class="btn wide" id="share">Share</button>
      <a class="link center" href="#">All games</a>
    </div>`;
    $('#share').addEventListener('click', () => {
      const text = shareText(r) + '\n' + location.origin;
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else navigator.clipboard?.writeText(text).then(() => { $('#share').textContent = 'Copied'; });
    });
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

  load();
  return () => { gone = true; };
}
