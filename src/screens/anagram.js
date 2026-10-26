import { dayKey, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { anagramStart, anagramGuess } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst } from '../ui/shell.js';

export const anagramLine = r => `${r.solved}/${r.n} in ${clock(r.ms)}`;

// Anagram: five scrambled words, short to long. Tap the letters (or type) to spell the word; it checks
// itself when every letter is placed. The server knows the words and keeps the clock.
export function anagram(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false, timer = 0, base = 0, t0 = 0, skipArmed = 0;
  let pool = [], picked = [];   // pool: letters with a used flag; picked: indexes into pool, in order

  app.innerHTML = `<main class="screen game anagram">
    ${gameHeader('anagram', 'Anagram', '<span class="eyebrow mono" id="time">0:00</span>')}
    <div class="g-play"><section id="body" class="an-body">
      <div class="h-intro rise">
        <h2 class="display">Unscramble <em>five</em></h2>
        <p>Five scrambled words, short to long. Tap the letters in order to spell each one. The clock runs until the last word.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <div class="g-side"><p class="v-msg" id="msg" role="status"></p><section id="bottom"></section></div>
  </main>`;
  wireHelp(app, 'anagram');
  const $ = q => app.querySelector(q);
  const say = t => { $('#msg').textContent = t; };
  const tick = () => { $('#time').textContent = clock(base + performance.now() - t0); };

  function setWord() {
    const k = s.outcomes.length;
    pool = [...s.scrambles[k]].map(ch => ({ ch, used: false })); picked = [];
  }

  function draw() {
    const k = s.outcomes.length, done = !!s.result;
    $('#body').innerHTML = `
      <ol class="an-done">${s.revealed.map((w, i) => `<li class="${s.outcomes[i]}"><b>${w.toUpperCase()}</b><span>${s.outcomes[i] === 'ok' ? '✓' : 'skipped'}</span></li>`).join('')}</ol>
      ${done ? '' : `<div class="an-now">
        <p class="eyebrow">Word ${k + 1} of ${s.n} · ${pool.length} letters</p>
        <div class="an-slots" id="slots">${pool.map((_, i) => `<span class="${picked[i] != null ? 'full' : ''}" data-s="${i}">${picked[i] != null ? pool[picked[i]].ch.toUpperCase() : ''}</span>`).join('')}</div>
        <div class="an-pool" id="pool">${pool.map((p, i) => `<button class="${p.used ? 'used' : ''}" data-p="${i}" ${p.used ? 'disabled' : ''} aria-label="${p.ch}">${p.ch.toUpperCase()}</button>`).join('')}</div>
        <div class="ld-tools"><button class="hint-btn" id="mix">Shuffle</button><button class="hint-btn" id="clear">Clear</button><button class="link-quiet" id="skip">Skip</button></div>
      </div>`}`;
    if (done) return;
    $('#pool').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) pick(+b.dataset.p); });
    $('#slots').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b && picked[+b.dataset.s] != null) unpickFrom(+b.dataset.s); });
    $('#mix').addEventListener('click', () => { SOUNDS.tap(); const free = pool.map((p, i) => i).filter(i => !pool[i].used); const letters = free.map(i => pool[i].ch).sort(() => Math.random() - .5); free.forEach((i, n) => { pool[i].ch = letters[n]; }); draw(); });
    $('#clear').addEventListener('click', () => { SOUNDS.tap(); unpickFrom(0); });
    $('#skip').addEventListener('click', e => {
      if (Date.now() - skipArmed > 3000) { skipArmed = Date.now(); e.target.textContent = 'Tap again to skip'; SOUNDS.tap(); return; }
      skipArmed = 0; send('?');
    });
  }

  function pick(i) {
    if (busy || pool[i].used) return;
    pool[i].used = true; picked.push(i); SOUNDS.tap(); buzz(4);
    draw();
    if (picked.length === pool.length) send(picked.map(j => pool[j].ch).join(''));
  }
  function unpickFrom(n) { picked.splice(n).forEach(j => { pool[j].used = false; }); draw(); }

  async function send(w) {
    if (busy) return;
    busy = true;
    let r;
    try { r = await anagramGuess(w); }
    catch (e) {
      busy = false;
      if (e.message.includes('not it')) { const right = +(e.message.match(/not it:(\d+)/)?.[1] || 0); say(right ? `Not ${w.toUpperCase()}, but ${right} letter${right === 1 ? ' is' : 's are'} already in the right spot.` : `${w.toUpperCase()} isn’t it. No letter is in the right spot yet.`); SOUNDS.miss(); buzz(15); unpickFrom(0); $('.an-now').classList.add('nope'); return; }
      say(navigator.onLine ? 'Couldn’t check that. Try again.' : 'You’re offline. Words need a connection.'); unpickFrom(0); return;
    }
    busy = false;
    if (gone) return;
    const ok = r.outcomes[r.outcomes.length - 1] === 'ok';
    say(ok ? '' : `It was ${r.revealed[r.revealed.length - 1].toUpperCase()}.`);
    ok ? SOUNDS.ok() : SOUNDS.miss(); buzz(ok ? 12 : 15);
    s = r;
    if (r.result) { clearInterval(timer); $('#time').textContent = clock(r.result.ms); draw(); finish('anagram', r.result, day); if (r.result.solved) burst('var(--c-anagram)'); result(r.result, true); return; }
    setWord(); draw();
  }

  function result(r, fresh) {
    const beat = r.beat != null ? `Better than ${r.beat}% of players today` : 'You’re one of the first to finish today';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.solved === r.n ? 'All unscrambled' : `${r.solved} of ${r.n} unscrambled`}</p>
      <h2 class="display">In <em>${clock(r.ms)}</em></h2>
      <p class="muted">${[beat, streak('anagram') > 1 ? `${streak('anagram')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share Anagram</button>
      <button class="link-quiet" id="all">Share today’s whole dose</button>
      <p class="next-in">Tomorrow’s words in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    if (fresh) SOUNDS.chime();
    const share = (fmt, only) => async () => { SOUNDS.tap(); if (await shareDose(fmt, only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', share('story', 'anagram'));
    $('#all').addEventListener('click', share('story'));
    friendsOn($('#fr-on'), 'anagram');
  }

  // Typing works too: letters pick from the pool, Backspace takes the last one back.
  const onKey = e => {
    if (!s || s.result || e.metaKey || e.ctrlKey || e.target.closest?.('input, dialog')) return;
    if (e.key === 'Backspace' && picked.length) { unpickFrom(picked.length - 1); return; }
    const ch = e.key.length === 1 && e.key.toLowerCase();
    const i = ch && pool.findIndex(p => !p.used && p.ch === ch);
    if (i >= 0 && i !== false) pick(i);
  };
  addEventListener('keydown', onKey);

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await anagramStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s words aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.anagram = { day }; save();
    if (s.result) { draw(); $('#time').textContent = clock(s.result.ms); finish('anagram', s.result, day); result(s.result, false); return; }
    setWord(); draw();
    base = s.elapsed_ms; t0 = performance.now(); tick(); timer = setInterval(tick, 250);
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('anagram') || state.progress.anagram?.day === day) load();
  return () => { gone = true; clearInterval(timer); removeEventListener('keydown', onKey); };
}
