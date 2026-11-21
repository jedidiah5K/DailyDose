import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { gameHeader, wireHelp, burst, esc } from '../ui/shell.js';
import { imposterDay } from '../games/partyLogic.js';

// Imposter (PROTOTYPE, only at #imposter): four names, three share something. Tap the one that doesn't
// belong; the link is revealed either way. Five rounds. Saved on this phone only for now.
const KEY = 'dose:imposter';

export function imposter(app) {
  const day = dayKey(), set = imposterDay(day);
  let s = { day, picks: [] };
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v?.day === day) s = v; } catch {}
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const right = k => s.picks[k] === set[k].odd;

  app.innerHTML = `<main class="screen game imposter">
    ${gameHeader('imposter', 'Imposter', '<span class="eyebrow mono" id="left"></span>')}
    <div class="g-play"><section id="body" class="im-body">
      <div class="h-intro g-intro rise">
        <h2 class="display">Spot the <em>imposter</em></h2>
        <p>Four names. Three have something in common. Tap the one that doesn’t belong. Five rounds, one tap each.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <aside class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></aside>
  </main>`;
  wireHelp(app, 'imposter');
  const $ = q => app.querySelector(q);

  // `open` = the round just answered, still showing its reveal
  function draw(open = -1) {
    const k = open >= 0 ? open : s.picks.length;
    if (k >= set.length) return result();
    const q = set[k], done = open >= 0;
    $('#left').textContent = `${k + 1}/${set.length}`;
    $('#body').innerHTML = `<div class="im-card">
      <p class="eyebrow">Which one doesn’t belong?</p>
      <div class="im-grid">${q.names.map(n => `<button class="im-name ${done ? (n === q.odd ? 'odd' : n === s.picks[k] ? 'wrong' : 'same') : ''}" ${done ? 'disabled' : ''} data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      ${done ? `<p class="im-link rise"><b>${right(k) ? 'Spotted it.' : 'Not quite.'}</b> ${esc(q.link)}</p>` : ''}
    </div>
    <div class="em-dots">${set.map((_, j) => `<i class="${j < s.picks.length ? (right(j) ? 'ok' : 'x') : j === k ? 'now' : ''}"></i>`).join('')}</div>
    ${done ? `<div class="h-bottom"><button class="btn wide" id="next">${k === set.length - 1 ? 'See how you did' : 'Next'}</button></div>` : ''}`;
    if (done) return $('#next').addEventListener('click', () => { SOUNDS.tap(); draw(); });
    app.querySelectorAll('.im-name').forEach(b => b.addEventListener('click', () => pick(k, b.dataset.n)));
  }

  function pick(k, n) {
    s.picks[k] = n; store();
    if (right(k)) { SOUNDS.ok(); buzz(20); } else { SOUNDS.miss(); buzz(12); }
    draw(k);
  }

  function result() {
    const n = set.filter((_, k) => right(k)).length, grid = set.map((_, k) => right(k) ? '🟩' : '🟥').join('');
    $('#left').textContent = '';
    $('#body').innerHTML = '';
    $('#bottom').innerHTML = `<div class="result rise">
      <p class="eyebrow">${n === 5 ? 'Nobody fooled you' : n >= 3 ? 'Sharp' : 'They got you'}</p>
      <h2 class="display"><em>${n}</em>/5</h2>
      <p class="em-share">${grid}</p>
      <button class="btn wide" id="share">Share</button>
      <p class="next-in">Tomorrow’s imposters in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a></div>`;
    if (n === 5) burst('var(--c)');
    $('#share').addEventListener('click', async () => {
      SOUNDS.tap();
      const text = `Daily Dose · Imposter No. ${puzzleNo()}  ${n}/5\n${grid}\n${location.origin}`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); $('#msg').textContent = 'Copied. Paste it anywhere.'; } } catch {}
    });
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); draw(); });
  if (s.picks.length) draw();
  return () => {};
}
