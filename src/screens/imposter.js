import { dayKey, countdown } from '../lib/day.js';
import { shareDose, resultButtons } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { imposterStart, imposterPick } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst, esc } from '../ui/shell.js';

// Imposter (Job, 2026-11-21): four names, three share something. One tap picks the one that doesn't belong;
// the server says who it was and reveals the link. Five rounds.
export const imposterLine = r => r.right.map(x => x ? '🟩' : '🟥').join('');

export function imposter(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false, open = -1;   // open = the round just answered, still showing its reveal

  app.innerHTML = `<main class="screen game imposter">
    ${gameHeader('imposter', 'Imposter', '<span class="eyebrow mono" id="left"></span>')}
    <div class="g-play"><section id="body" class="im-body">
      <div class="h-intro g-intro rise">
        <img class="g-mug" src="/art/mugs/imposter-empty.webp" alt="" width="104" height="98">
        <h2 class="display">Spot the <em>imposter</em></h2>
        <p>Four names. Three have something in common. Tap the one that doesn’t belong. Five rounds, one tap each.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <aside class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></aside>
  </main>`;
  wireHelp(app, 'imposter');
  const $ = q => app.querySelector(q);
  const say = t => { $('#msg').textContent = t; };

  function draw() {
    const k = open >= 0 ? open : s.rounds.findIndex(r => r.picked == null);
    if (k < 0) { $('#left').textContent = ''; $('#body').innerHTML = ''; return; }
    const q = s.rounds[k], done = q.picked != null;
    $('#left').textContent = `${k + 1}/${s.rounds.length}`;
    $('#body').innerHTML = `<div class="im-card">
      <p class="eyebrow">Which one doesn’t belong?</p>
      <div class="im-grid">${q.names.map(n => `<button class="im-name ${done ? (n === q.odd ? 'odd' : n === q.picked ? 'wrong' : 'same') : ''}" ${done ? 'disabled' : ''} data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      ${done ? `<p class="im-link rise"><b>${q.right ? 'Spotted it.' : 'Not quite.'}</b> ${esc(q.link)}</p>` : ''}
    </div>
    <div class="em-dots">${s.rounds.map((r, j) => `<i class="${r.picked != null ? (r.right ? 'ok' : 'x') : j === k ? 'now' : ''}"></i>`).join('')}</div>
    ${done ? `<div class="h-bottom"><button class="btn wide" id="next">${s.result ? 'See how you did' : 'Next'}</button></div>` : ''}`;
    if (done) return $('#next').addEventListener('click', () => { SOUNDS.tap(); open = -1; draw(); if (s.result) result(s.result, true); });
    app.querySelectorAll('.im-name').forEach(b => b.addEventListener('click', () => pick(k, b.dataset.n)));
  }

  async function pick(k, n) {
    if (busy) return;
    busy = true;
    app.querySelectorAll('.im-name').forEach(b => { b.disabled = true; if (b.dataset.n === n) b.classList.add('picked'); });
    let r;
    try { r = await imposterPick(k, n); }
    catch (e) { busy = false; say(navigator.onLine ? 'Couldn’t send that. Try again.' : 'You’re offline. Picks need a connection.'); return draw(); }
    busy = false;
    if (gone) return;
    s = r; open = k; say('');
    if (s.rounds[k].right) { SOUNDS.ok(); buzz(20); } else { SOUNDS.miss(); buzz(12); }
    if (s.result) finish('imposter', s.result, day);
    draw();
  }

  function result(r, fresh) {
    const beat = r.beat != null && r.players >= 10 ? `Better than ${r.beat}% of players today` : '';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <img class="g-mug" src="/art/mugs/imposter-${r.score >= 3 ? 'full' : 'empty'}.webp" alt="" width="80" height="75">
      <p class="eyebrow">${r.score === 5 ? 'Nobody fooled you' : r.score >= 3 ? 'Sharp' : 'They got you'}</p>
      <h2 class="display"><em>${r.score}</em> of 5</h2>
      <p class="em-share">${imposterLine(r)}</p>
      <p class="muted">${[beat, streak('imposter') > 1 ? `${streak('imposter')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      ${resultButtons('imposter')}
      <p class="next-in">Tomorrow’s imposters in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a>
    </div>`;
    if (fresh) { r.score >= 4 ? SOUNDS.chime() : SOUNDS.drop(); buzz(25); if (r.score === 5) burst('var(--c)'); }
    const share = (fmt, only) => async () => { SOUNDS.tap(); if (await shareDose(fmt, only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', share('story', 'imposter'));
    $('#all').addEventListener('click', share('story'));
    friendsOn($('#fr-on'), 'imposter');
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await imposterStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s imposters aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.imposter = { day }; save();
    draw();
    if (s.result) { finish('imposter', s.result, day); result(s.result, false); }
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('imposter') || state.progress.imposter?.day === day) load();
  return () => { gone = true; };
}
