import { dayKey, countdown } from '../lib/day.js';
import { shareDose, resultButtons } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { shotStart, shotOpen, shotAnswer } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst, toaster, esc, timerBar } from '../ui/shell.js';

const secs = ms => `${(ms / 1000).toFixed(1)}s`;
export const shotLine = r => `${r.ok ? `✅ ${secs(r.ms)}` : '❌ missed'} · ${r.pct}% got it`;
const LIMIT = 7000;

// The Shot: one question a day, 7 seconds, one typed answer. The server opens the question, runs the
// clock and holds the answer; the shape (letters per word) is the only hint.
export function shot(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false, stop = () => {}, ticks = [], late = false;
  const hush = () => { ticks.forEach(clearTimeout); ticks = []; };

  app.innerHTML = `<main class="screen game shot">
    ${gameHeader('shot', 'The Shot')}
    <div class="g-play"><section id="body" class="bl-body">
      <div class="h-intro g-intro rise">
        <img class="g-mug" src="/art/mugs/shot-empty.webp" alt="" width="104" height="140">
        <h2 class="display">One question. <br><em>Seven seconds.</em></h2>
        <p>No options to pick from, no second try. Type the answer before the clock runs out.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Order up</button></div>
    </section></div>
    <div class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></div>
  </main>`;
  wireHelp(app, 'shot');
  const $ = q => app.querySelector(q);
  const say = toaster($('#msg'));

  function play() {
    if (s.left_ms <= 0) { answer(''); return; }
    const shape = s.shape.map(n => `<span>${'<i></i>'.repeat(Math.min(n, 14))}</span>`).join('');
    $('#body').innerHTML = `<div class="bl-now">
      <h2 class="display bl-q">${esc(s.q)}</h2>
      <p class="sh-shape" aria-label="${s.shape.join(' and ')} letters">${shape}</p>
      <div class="bl-clock" aria-hidden="true"><i id="bar"></i></div><p class="bl-secs mono" id="secs"></p>
      <form id="form" class="bl-form" autocomplete="off"><input id="w" maxlength="30" autocorrect="on" autocapitalize="none" spellcheck="true" enterkeyhint="go" placeholder="Type it…" aria-label="Your answer"><button class="btn">Fire</button></form>
    </div>`;
    const input = $('#w');
    setTimeout(() => input.focus(), 30);
    stop = timerBar($('#bar'), $('#secs'), Date.now() + s.left_ms, LIMIT, () => { late = true; answer(input.value); });
    // the last three seconds tick out loud, and the clock throbs with each one
    [3000, 2000, 1000].forEach(t => { if (s.left_ms > t) ticks.push(setTimeout(() => { SOUNDS.turn(); buzz(6); const c = $('.bl-clock'); c?.classList.remove('throb'); void c?.offsetWidth; c?.classList.add('throb'); }, s.left_ms - t)); });
    // each letter you type clicks into the next box
    const boxes = [...app.querySelectorAll('.sh-shape i')];
    input.addEventListener('input', () => { const t = input.value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
      boxes.forEach((b, i) => { const was = b.textContent; b.textContent = t[i] || ''; b.classList.toggle('on', !!t[i]); if (t[i] && !was) { b.classList.remove('in'); void b.offsetWidth; b.classList.add('in'); } });
      SOUNDS.tick(); });
    $('#form').addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) answer(input.value); });
  }

  async function answer(w) {
    if (busy) return; busy = true; stop(); hush();
    let r;
    for (let i = 0; i < 3 && !r; i++) { try { r = await shotAnswer(w); } catch (e) { await new Promise(t => setTimeout(t, 600)); } }
    busy = false;
    if (gone) return;
    if (!r) { say('Couldn’t send that. Check your connection.'); return; }
    s = r;
    finish('shot', s.result, day);
    if (s.result.ok) { SOUNDS.ok(); burst('var(--c-shot)'); } else { SOUNDS.miss(); buzz(20); }
    $('#body').innerHTML = '';
    result(s.result, true);
  }

  function result(r, fresh) {
    const beat = r.ok && r.beat != null && r.players >= 10 ? `Faster than ${r.beat}% who got it` : '';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <img class="g-mug" src="/art/mugs/shot-${r.ok ? 'full' : 'empty'}.webp" alt="" width="80" height="108">
      <p class="eyebrow">${r.ok ? `Got it in ${secs(r.ms)}` : late && fresh ? 'Out of time. It was' : r.close ? 'So close! It was' : 'Missed'}</p>
      <h2 class="display"><em>${esc(r.answer)}</em></h2>
      ${r.ok ? `<div class="sh-track" aria-hidden="true"><i style="--x:${Math.min(1, r.ms / LIMIT)}"></i><span>0s</span><span>${LIMIT / 1000}s</span></div>` : ''}
      <p class="muted">${[r.players >= 10 ? `${r.pct}% got today’s shot` : 'You’re one of the first to play today', beat, streak('shot') > 1 ? `${streak('shot')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      ${resultButtons('shot')}
      <p class="next-in">Tomorrow’s shot in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a>
    </div>`;
    const send = only => async () => { SOUNDS.tap(); if (await shareDose('story', only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('shot'));
    $('#all').addEventListener('click', send());
    friendsOn($('#fr-on'), 'shot');
  }

  async function load(open) {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await shotStart(); if (open && !s.opened) s = await shotOpen(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s shot isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.shot = { day }; save();
    if (s.result) { $('#body').innerHTML = ''; finish('shot', s.result, day); result(s.result, false); }
    else if (s.opened) play();
    else $('#body').innerHTML = '';
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(true); });
  // coming back to a shot you already opened: the clock kept running on the server
  if (resultFor('shot') || state.progress.shot?.day === day) load(false);
  return () => { gone = true; stop(); hush(); };
}
