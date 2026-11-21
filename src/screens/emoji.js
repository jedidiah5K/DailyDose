import { dayKey, countdown } from '../lib/day.js';
import { shareDose, resultButtons } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { emojiStart, emojiGuess } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst, esc, nice } from '../ui/shell.js';

// Emoji Decode (Job, 2026-11-21): five things written in emojis. You start with two; every miss or
// "Another emoji" shows one more, up to six. The server holds the hidden emojis and the answers.
const MAX = 6, START = 2;
export const CAT = { movie: ['🎬', 'Movie'], show: ['📺', 'TV show'], song: ['🎵', 'Song'], internet: ['💻', 'Internet'], celeb: ['⭐', 'Famous person'] };
// share line: each category's emoji and how many emojis it took (X = missed)
export const emojiLine = r => r.cats.map((c, k) => `${CAT[c]?.[0] || '❔'}${r.used[k] || 'X'}`).join(' ');

export function emoji(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false;

  app.innerHTML = `<main class="screen game emoji">
    ${gameHeader('emoji', 'Emoji Decode', '<span class="eyebrow mono" id="left"></span>')}
    <div class="g-play"><section id="body" class="em-body">
      <div class="h-intro g-intro rise">
        <img class="g-mug" src="/art/mugs/emoji-empty.webp" alt="" width="104" height="140">
        <h2 class="display">Read the <em>emojis</em></h2>
        <p>Five movies, shows, songs, memes and famous people, written in emojis. You start with two. Every miss shows one more. The fewer you need, the better.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <aside class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></aside>
  </main>`;
  wireHelp(app, 'emoji');
  const $ = q => app.querySelector(q);
  let toastT = 0;
  const say = t => { const m = $('#msg'); m.textContent = t; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); clearTimeout(toastT); if (t) toastT = setTimeout(() => { m.textContent = ''; }, 2800); };
  const shake = () => { const b = $('.em-card'); b?.classList.remove('nope'); void b?.offsetWidth; b?.classList.add('nope'); $('#w')?.select(); };
  const cur = () => s.puzzles.findIndex(p => !p.done);

  function draw(grew = false) {
    const i = cur();
    if (i < 0) { $('#left').textContent = ''; $('#body').innerHTML = ''; return; }
    const p = s.puzzles[i], [ic, label] = CAT[p.cat] || ['❔', ''];
    $('#left').textContent = `${i + 1}/${s.puzzles.length}`;
    $('#body').innerHTML = `<div class="em-card">
      <p class="eyebrow">${ic} ${label}</p>
      <p class="em-row" aria-label="${p.e.length} emojis shown">${Array.from({ length: MAX }, (_, k) => k < p.e.length ? `<span class="${grew && k === p.e.length - 1 ? 'new' : ''}">${p.e[k]}</span>` : '<span class="off">?</span>').join('')}</p>
      <form id="form" autocomplete="off"><input id="w" maxlength="40" autocorrect="on" autocapitalize="none" spellcheck="true" enterkeyhint="go" aria-label="Your guess" placeholder="Type your guess"></form>
      <div class="em-tools"><button class="hint-btn" id="more" type="button">${p.e.length < MAX ? 'Another emoji' : 'Give up'}</button></div>
    </div>
    <div class="em-dots">${s.puzzles.map((q, k) => `<i class="${q.done ? (q.solved ? 'ok' : 'x') : k === i ? 'now' : ''}"></i>`).join('')}</div>
    <div class="h-bottom"><button class="btn wide" id="go" type="button">Guess</button></div>`;
    const input = $('#w');
    setTimeout(() => input.focus(), 50);
    $('#form').addEventListener('submit', e => { e.preventDefault(); send(input.value); });
    $('#go').addEventListener('click', () => send(input.value));
    $('#more').addEventListener('click', () => send('+'));
  }

  async function send(w) {
    w = w.trim();
    if (busy || !w) return;
    const i = cur();
    busy = true;
    let r;
    try { r = await emojiGuess(i, w); }
    catch (e) { busy = false; say(navigator.onLine ? 'Couldn’t check that. Try again.' : 'You’re offline. Guesses need a connection.'); buzz(15); return; }
    if (gone) return;
    s = r;
    const p = s.puzzles[i];
    if (!p.done) {   // a miss or another emoji: one more appears
      busy = false;
      if (w === '+') SOUNDS.tap(); else { SOUNDS.miss(); buzz(10); shake(); }
      say(w === '+' ? '' : `Not ${w}.`);
      return draw(true);
    }
    if (p.solved) {
      // landing it early rings higher: two emojis is the dream
      SOUNDS.link(MAX + 2 - p.used); buzz(25);
      if (p.used <= START) burst('var(--c)');
      say(p.used <= START ? `On ${p.used}! It’s ${nice(p.answer)}.` : `Got it on ${p.used}. ${nice(p.answer)}.`);
    } else { SOUNDS.miss(); buzz(10); say(`It was ${nice(p.answer)}.`); }
    $('#w')?.setAttribute('disabled', '');
    // a beat on the answer before the next one, so it sinks in
    setTimeout(() => {
      busy = false;
      if (gone) return;
      draw();
      if (s.result) { finish('emoji', s.result, day); result(s.result, true); }
    }, 1400);
  }

  function result(r, fresh) {
    const beat = r.beat != null && r.players >= 10 ? `Better than ${r.beat}% of players today` : '';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <img class="g-mug" src="/art/mugs/emoji-${r.solved >= 3 ? 'full' : 'empty'}.webp" alt="" width="80" height="108">
      <p class="eyebrow">${r.solved === 5 ? 'All five' : `${r.solved} of 5`}</p>
      <h2 class="display"><em>${r.score}</em> of 25</h2>
      <p class="em-share">${emojiLine(r)}</p>
      <p class="muted">${r.answers.map((a, k) => `${r.used[k] ? '✓' : '✗'} ${esc(nice(a))}`).join('<br>')}</p>
      <p class="muted">${[beat, streak('emoji') > 1 ? `${streak('emoji')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      ${resultButtons('emoji')}
      <p class="next-in">Tomorrow’s emojis in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a>
    </div>`;
    if (fresh) { r.solved >= 4 ? SOUNDS.chime() : SOUNDS.drop(); buzz(25); if (r.solved === 5) burst('var(--c)'); }
    const share = (fmt, only) => async () => { SOUNDS.tap(); if (await shareDose(fmt, only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', share('story', 'emoji'));
    $('#all').addEventListener('click', share('story'));
    friendsOn($('#fr-on'), 'emoji');
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await emojiStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s emojis aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.emoji = { day }; save();
    draw();
    if (s.result) { finish('emoji', s.result, day); result(s.result, false); }
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('emoji') || state.progress.emoji?.day === day) load();
  return () => { gone = true; };
}
