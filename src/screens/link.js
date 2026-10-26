import { dayKey, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { linkStart, linkGuess } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst } from '../ui/shell.js';

export const linkLine = r => `${r.score}/15 · ${r.solved} of 5 links`;
const WHY = { 'already tried': 'You’ve tried that one.', 'type a word': 'Type a word first.' };

// Missing Link: three clue words, one hidden word that goes with all of them. Three tries per link,
// five links a day; the server checks every guess and only reveals an answer once that link is over.
export function link(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false;

  app.innerHTML = `<main class="screen game mlink">
    ${gameHeader('link', 'Missing Link', '<span class="eyebrow mono" id="step"></span>')}
    <div class="g-play"><section id="body" class="lk-body">
      <div class="h-intro rise">
        <h2 class="display">Find the <em>link</em></h2>
        <p>Three words, one hidden word that goes with all of them. Three tries for each, five links today.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <div class="g-side"><p class="v-msg" id="msg" role="status"></p><section id="bottom"></section></div>
  </main>`;
  wireHelp(app, 'link');
  const $ = q => app.querySelector(q);
  const say = t => { $('#msg').textContent = t; };

  function draw() {
    const cur = s.links[s.links.length - 1], done = !!s.result, k = s.links.length;
    $('#step').textContent = done ? `${s.result.score}/15` : `${k}/${s.n}`;
    const past = s.links.slice(0, done ? k : k - 1);
    $('#body').innerHTML = `
      ${past.length ? `<ol class="lk-past">${past.map(l => `<li class="${l.solved ? 'ok' : 'miss'}"><span>${l.clues.join(' · ')}</span><b>${l.answer.toUpperCase()}</b></li>`).join('')}</ol>` : ''}
      ${done ? '' : `<div class="lk-now">
        <p class="eyebrow">Link ${k} of ${s.n}</p>
        <ul class="lk-clues">${cur.clues.map((c, i) => `<li style="--i:${i}">${c}</li>`).join('')}</ul>
        <form id="form" class="lk-form" autocomplete="off"><input id="w" maxlength="20" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Your answer" placeholder="Type the link"><button class="btn" id="go">Guess</button></form>
        <p class="lk-tries">${[0, 1, 2].map(i => `<i class="${cur.tries[i] ? 'used' : ''}" title="${cur.tries[i] ? cur.tries[i].toUpperCase() : ''}"></i>`).join('')}<span>${cur.tries.length ? `Not ${cur.tries.map(t => t.toUpperCase()).join(', ')}` : '3 tries'}</span></p>
        <button class="link-quiet" id="skip">Skip this one</button>
      </div>`}`;
    if (done) return;
    const input = $('#w');
    setTimeout(() => input.focus(), 50);
    input.addEventListener('input', () => { input.value = input.value.replace(/[^a-z ]/gi, '').toUpperCase(); });
    $('#form').addEventListener('submit', e => { e.preventDefault(); guess(input.value); });
    $('#skip').addEventListener('click', () => guess('?'));
  }

  async function guess(w) {
    if (busy) return;
    if (w !== '?' && !w.trim()) { say('Type a word first.'); return; }
    busy = true;
    const before = s.links.length;
    let r;
    try { r = await linkGuess(w); }
    catch (e) { busy = false; const why = Object.keys(WHY).find(k => e.message.includes(k)); say(why ? WHY[why] : navigator.onLine ? 'Couldn’t check that. Try again.' : 'You’re offline. Guesses need a connection.'); buzz(10); return; }
    busy = false;
    if (gone) return;
    const was = r.links[before - 1];
    if (was.solved) { say(`${was.answer.toUpperCase()}. ${['First try!', 'Got it.', 'Just in time.'][was.tries.length - 1] || ''}`); SOUNDS.ok(); buzz(12); }
    else if (was.done) { say(`It was ${was.answer.toUpperCase()}.`); SOUNDS.miss(); buzz(15); }
    else { say(`Not ${w.toUpperCase()}. ${3 - was.tries.length} ${3 - was.tries.length === 1 ? 'try' : 'tries'} left.`); SOUNDS.miss(); buzz(15); }
    s = r;
    draw();
    if (!was.done) $('.lk-now').classList.add('nope');
    if (r.result) { finish('link', r.result, day); if (r.result.solved) burst('var(--c-link)'); result(r.result, true); }
  }

  function result(r, fresh) {
    const beat = r.beat != null ? `Better than ${r.beat}% of players today` : 'You’re one of the first to finish today';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.solved === 5 ? 'All five linked' : `${r.solved} of 5 linked`}</p>
      <h2 class="display"><em>${r.score}</em> of 15</h2>
      <p class="lk-dots">${r.tries.map(t => `<i class="t${t}" title="${t ? `try ${t}` : 'missed'}"></i>`).join('')}</p>
      <p class="muted">${[beat, `in ${clock(r.ms)}`, streak('link') > 1 ? `${streak('link')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share your results</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s links in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    if (fresh) { SOUNDS.chime(); }
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
    friendsOn($('#fr-on'), 'link');
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await linkStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s links aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.link = { day }; save();
    draw();
    if (s.result) { finish('link', s.result, day); result(s.result, false); }
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('link') || state.progress.link?.day === day) load();
  return () => { gone = true; };
}
