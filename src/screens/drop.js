import { dayKey, countdown } from '../lib/day.js';
import { shareDose, resultButtons } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { hiloStart, hiloOpen, hiloCall, hiloBank } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst, toaster, roll, esc, timerBar } from '../ui/shell.js';

const K = 'hilo';   // the old "drop" key belongs to the retired game
export const dropTiles = r => '🟩'.repeat(r.rights) + (r.bust ? '💀' : '💰');
export const dropLine = r => `${dropTiles(r)} ${r.bust ? `Busted at ${r.rights + 1}` : `Banked ${r.banked.toLocaleString()}`}`;
const LIMIT = 7000;

// Drop: a chain of cards with hidden numbers. Call the next one higher or lower in 7 seconds; every right
// call doubles the pot. Bank between cards, or push your luck. One wrong call and the pot is gone.
// The server holds the numbers and the clock; a card's number shows only after you call it.
export function drop(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false, stop = () => {};

  app.innerHTML = `<main class="screen game drop">
    ${gameHeader(K, 'Drop', '<span class="eyebrow mono" id="step"></span>')}
    <div class="g-play"><section id="body" class="bl-body">
      <div class="h-intro g-intro rise">
        <img class="g-mug" src="/art/mugs/hilo-empty.webp" alt="" width="104" height="85">
        <h2 class="display">Bank it,<br>or <em>let it ride.</em></h2>
        <p>Higher or lower, 7 seconds a card. Every right call doubles your pot. Stop whenever you like. One wrong call and you lose it all.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Order up</button></div>
    </section></div>
    <div class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></div>
  </main>`;
  wireHelp(app, K);
  const $ = q => app.querySelector(q);
  const say = toaster($('#msg'));
  const fail = () => say(navigator.onLine ? 'Couldn’t reach the server. Try again.' : 'You’re offline. Drop needs a connection.');

  function draw(flash) {
    stop();
    if (s.result) return done(s.result, flash);
    const last = s.chain.at(-1), step = s.calls.length;
    $('#step').textContent = `${step}/${s.len - 1}`;
    const head = `<p class="bl-mode">${esc(s.theme)}</p>
      <p class="dr-pot">Pot <b id="pot">${flash === 'ok' ? s.pot / 2 : s.pot}</b></p>
      <div class="dr-card ${flash || ''}"><span>${esc(last.n)}</span><b>${esc(last.s)}</b></div>`;
    if (s.next) {
      $('#body').innerHTML = `<div class="bl-now dr">${head}
        <div class="dr-card next"><span>${esc(s.next.n)}</span><b>?</b></div>
        <div class="bl-clock" aria-hidden="true"><i id="bar"></i></div><p class="bl-secs mono" id="secs"></p>
        <div class="dr-calls"><button class="btn" data-c="hi">${esc(s.hi)}</button><button class="btn" data-c="lo">${esc(s.lo)}</button></div></div>`;
      app.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => call(b.dataset.c)));
      if (s.next.left_ms <= 0) return call('out');
      stop = timerBar($('#bar'), $('#secs'), Date.now() + s.next.left_ms, LIMIT, () => call('out'));
    } else {
      $('#body').innerHTML = `<div class="bl-now dr">${head}</div>
        <div class="h-bottom dr-next"><button class="btn wide" id="next">${step ? 'Next card' : 'Turn the first card'}</button>
        ${step ? `<button class="dr-bank" id="bank"><b>Bank ${s.pot.toLocaleString()}</b><span>and stop</span></button>` : ''}</div>`;
      $('#next').addEventListener('click', next);
      $('#bank')?.addEventListener('click', bank);
    }
    if (flash === 'ok') roll($('#pot'), s.pot); else $('#pot').textContent = s.pot.toLocaleString();
  }

  async function next() {
    if (busy) return; busy = true; SOUNDS.tap();
    try { s = await hiloOpen(); } catch (e) { busy = false; fail(); return; }
    busy = false; if (!gone) draw();
  }

  async function call(dir) {
    if (busy) return; busy = true; stop();
    let r;
    for (let i = 0; i < 3 && !r; i++) { try { r = await hiloCall(dir); } catch (e) { if (/no card open/.test(e.message)) break; await new Promise(t => setTimeout(t, 500)); } }
    busy = false;
    if (gone) return;
    if (!r) { fail(); try { s = await hiloStart(); draw(); } catch (e) {} return; }
    s = r;
    const ok = s.calls.at(-1)?.ok;
    if (ok) { SOUNDS.ok(); buzz(12); } else { SOUNDS.miss(); buzz([30, 40, 30]); app.querySelector('.dr-pot')?.classList.add('shatter'); }
    if (dir === 'out') say('Time’s up.');
    // let the pot shatter first; taps stay locked until the result shows
    if (ok) draw('ok'); else { busy = true; setTimeout(() => { busy = false; if (!gone) draw('bust'); }, 450); }
  }

  async function bank() {
    if (busy) return; busy = true; SOUNDS.tap();
    try { s = await hiloBank(); } catch (e) { busy = false; fail(); return; }
    busy = false; if (!gone) draw('banked');
  }

  // The end: what you banked, where most people stopped, and the whole chain (the "one more" sting).
  function done(r, fresh) {
    finish(K, r, day);
    if (fresh && !r.bust) burst('var(--c-hilo)');
    $('#step').textContent = r.bust ? 'bust' : r.banked.toLocaleString();
    $('#body').innerHTML = `<div class="bl-reveal"><p class="bl-mode">${esc(s.theme)}</p>
      <ol class="dr-chain">${r.chain.map((x, i) => `<li class="${i <= r.rights ? 'seen' : ''}${i === r.rights + 1 ? (r.bust ? ' bust' : ' stop') : ''}"><span>${esc(x.n)}</span><b>${esc(x.s)}</b></li>`).join('')}</ol></div>`;
    const crowd = r.crowd != null ? `Most people stopped after ${r.crowd} right call${r.crowd === 1 ? '' : 's'}` : 'You’re one of the first to play today';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <img class="g-mug" src="/art/mugs/hilo-${r.bust ? 'empty' : 'full'}.webp" alt="" width="80" height="66">
      <p class="eyebrow">${r.cleared ? 'Cleared the whole chain' : r.bust ? `Busted on card ${r.rights + 2}` : `Banked after ${r.rights} right call${r.rights === 1 ? '' : 's'}`}</p>
      <h2 class="display"><em>${r.banked.toLocaleString()}</em> banked</h2>
      <p class="bl-tiles">${dropTiles(r)}</p>
      <p class="muted">${[crowd, r.beat != null ? `better than ${r.beat}%` : '', streak(K) > 1 ? `${streak(K)} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      ${resultButtons('hilo')}
      <p class="next-in">Tomorrow’s chain in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a>
    </div>`;
    const send = only => async () => { SOUNDS.tap(); if (await shareDose('story', only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send(K));
    $('#all').addEventListener('click', send());
    friendsOn($('#fr-on'), K);
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await hiloStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s chain isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress[K] = { day }; save();
    draw();
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor(K) || state.progress[K]?.day === day) load();
  return () => { gone = true; stop(); };
}
