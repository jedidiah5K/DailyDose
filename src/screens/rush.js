import { dayKey, countdown } from '../lib/day.js';
import { shareDose, resultButtons } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { rushStart, rushOpen, rushAdd, rushFinish } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst, toaster, roll, esc, timerBar } from '../ui/shell.js';

export const rushLine = r => `${r.found} found · ${r.points} pts${r.rare ? ` · ${r.rare} rare 💎` : ''}`;
const LIMIT = 30000;

// Rush: one category, 30 seconds, type as many as you can. Each answer is checked on the server as you
// go (the list never reaches the phone); rarer answers score more. Typing never waits for the server.
export function rush(app) {
  const day = dayKey();
  let s = null, gone = false, done = false, stop = () => {}, queue = Promise.resolve();

  app.innerHTML = `<main class="screen game rush">
    ${gameHeader('rush', 'Rush', '<span class="eyebrow mono" id="step"></span>')}
    <div class="g-play"><section id="body" class="bl-body">
      <div class="h-intro g-intro rise">
        <img class="g-mug" src="/art/mugs/rush-empty.webp" alt="" width="104" height="98">
        <h2 class="display">Thirty seconds.<br><em>Go.</em></h2>
        <p>One category. Type as many as you can, one at a time. Rare ones are worth more.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Order up</button></div>
    </section></div>
    <div class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></div>
  </main>`;
  wireHelp(app, 'rush');
  const $ = q => app.querySelector(q);
  const say = toaster($('#msg'));
  const chips = f => f.map(x => `<li class="p${x.p}">${esc(x.a)}${x.p > 1 ? `<b>+${x.p}</b>` : ''}</li>`).join('');

  function play() {
    if (s.left_ms <= 0) { end(); return; }
    $('#body').innerHTML = `<div class="bl-now">
      <h2 class="display bl-q">${esc(s.q)}</h2>
      <div class="bl-clock" aria-hidden="true"><i id="bar"></i></div><p class="bl-secs mono" id="secs"></p>
      <form id="form" class="bl-form ru-form" autocomplete="off"><input id="w" maxlength="30" autocorrect="on" autocapitalize="none" spellcheck="true" enterkeyhint="send" placeholder="Type one, press enter" aria-label="Your answer"><button class="btn">Add</button></form>
      <ul class="ru-found" id="found">${chips(s.found)}</ul>
    </div>`;
    $('#step').innerHTML = `<b id="pts">${s.points}</b> pts`;
    const input = $('#w');
    setTimeout(() => input.focus(), 30);
    stop = timerBar($('#bar'), $('#secs'), Date.now() + s.left_ms, LIMIT, end);
    $('#form').addEventListener('submit', e => {
      e.preventDefault();
      const w = input.value.trim(); input.value = ''; input.focus();
      if (!w || done) return;
      // one at a time, in order, without blocking the next word
      queue = queue.then(() => add(w));
    });
  }

  async function add(w) {
    let r;
    try { r = await rushAdd(w); } catch (e) { if (/time up/.test(e.message)) return; say('Couldn’t check that one.'); return; }
    if (gone || done) return;
    s = r;
    if (r.last.p) { SOUNDS.tap(); buzz(8); $('#found').innerHTML = chips(s.found); roll($('#pts'), s.points); if (r.last.p === 3) say(`💎 ${r.last.a}: rare, +3`); }
    else { SOUNDS.miss(); say(r.last.a ? `Already got ${r.last.a}.` : `“${w}” isn’t on our list.`); }
  }

  async function end() {
    if (done) return; done = true; stop();
    $('#w')?.setAttribute('disabled', '');
    await queue;
    let r;
    for (let i = 0; i < 3 && !r; i++) { try { r = await rushFinish(); } catch (e) { await new Promise(t => setTimeout(t, 600)); } }
    if (gone) return;
    if (!r) { say('Couldn’t finish. Check your connection and reopen Rush.'); return; }
    s = r;
    finish('rush', s.result, day);
    if (s.result.points >= 20) burst('var(--c-rush)');
    draw();
  }

  function draw() {
    const r = s.result;
    $('#step').textContent = `${r.points} pts`;
    $('#body').innerHTML = `<div class="bl-reveal"><p class="bl-mode">${esc(s.q)}</p><ul class="ru-found">${chips(s.found)}</ul></div>`;
    $('#bottom').innerHTML = `<div class="result rise">
      <img class="g-mug" src="/art/mugs/rush-full.webp" alt="" width="80" height="75">
      <p class="eyebrow">${r.found} found${r.rare ? ` · ${r.rare} rare 💎` : ''}</p>
      <h2 class="display"><em>${r.points}</em> points</h2>
      ${r.missed.length ? `<p class="muted ru-missed">You missed <b>${r.missed.map(esc).join(', ')}</b></p>` : ''}
      <p class="muted">${[r.beat != null ? `Better than ${r.beat}% of players today` : 'You’re one of the first to play today', streak('rush') > 1 ? `${streak('rush')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      ${resultButtons('rush')}
      <p class="next-in">Tomorrow’s category in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a>
    </div>`;
    const send = only => async () => { SOUNDS.tap(); if (await shareDose('story', only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('rush'));
    $('#all').addEventListener('click', send());
    friendsOn($('#fr-on'), 'rush');
  }

  async function load(open) {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await rushStart(); if (open && !s.opened) s = await rushOpen(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s category isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.rush = { day }; save();
    if (s.result) { done = true; finish('rush', s.result, day); draw(); }
    else if (s.opened) play();
    else $('#body').innerHTML = '';
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(true); });
  if (resultFor('rush') || state.progress.rush?.day === day) load(false);
  return () => { gone = true; stop(); };
}
