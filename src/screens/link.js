import { dayKey, countdown, clock } from '../lib/day.js';
import { shareDose, resultButtons } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { linkStart, linkGuess } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst } from '../ui/shell.js';

export const linkLine = r => `${r.score}/15 · ${r.solved} of 5 links`;
const WHY = { 'already tried': 'You’ve tried that one.', 'type a word': 'Type a word first.', 'link done': 'That link is finished.' };

// Missing Link: three clue words, one hidden word that goes with all of them, before or after each
// (GREEN + HOUSE, HOUSE + BOAT). Five links, any order: skip one and come back. Three tries each; the
// answer's length always shows, and its first letter after two misses. The server checks every guess.
export function link(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false, cur = 0, giveArmed = 0;

  app.innerHTML = `<main class="screen game mlink">
    ${gameHeader('link', 'Missing Link', '<span class="eyebrow mono" id="step"></span>')}
    <div class="g-play"><section id="body" class="lk-body">
      <div class="h-intro g-intro rise">
        <img class="g-mug" src="/art/mugs/link-empty.webp" alt="" width="104" height="97">
        <h2 class="display">Find the <em>link</em></h2>
        <p>One hidden word goes with every clue, before or after. You start with one clue: the fewer clues and wrong guesses you need, the more you score.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Order up</button></div>
    </section></div>
    <div class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></div>
  </main>`;
  wireHelp(app, 'link');
  const $ = q => app.querySelector(q);
  // messages pop up at the top, where the phone keyboard can't cover them, then fade
  let toastT = 0;
  const say = t => { const m = $('#msg'); m.textContent = t; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); clearTimeout(toastT); if (t) toastT = setTimeout(() => { m.textContent = ''; }, 2800); };
  const shake = () => { const b = $('.lk-now'); if (!b) return; b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); };
  const nextOpen = from => { for (let d = 1; d <= s.n; d++) { const k = (from + d) % s.n; if (!s.links[k].done) return k; } return -1; };

  function draw() {
    const done = !!s.result;
    $('#step').textContent = done ? `${s.result.score}/15` : `${s.links.filter(l => l.done).length}/${s.n}`;
    const l = s.links[cur];
    // the boxes are the answer field: a see-through input sits on top and each letter lands in its box
    const boxes = (v = '') => [...Array(l.len)].map((_, i) => `<i class="${i === v.length ? 'at' : ''}">${l.done ? l.answer[i].toUpperCase() : v[i] || (i === 0 && l.hint ? `<s>${l.hint}</s>` : '')}</i>`).join('');
    $('#body').innerHTML = `
      <ol class="lk-tabs" aria-label="Links">${s.links.map((x, k) => `<li><button class="${k === cur ? 'on ' : ''}${x.solved ? 'ok' : x.done ? 'miss' : x.tries.length ? 'tried' : ''}" data-k="${k}" aria-label="Link ${k + 1}${x.solved ? ', solved' : x.done ? ', missed' : ''}">${x.solved ? '✓' : x.done ? '✕' : k + 1}</button></li>`).join('')}</ol>
      <div class="lk-now">
        <ul class="lk-clues">${l.clues.map((c, i) => `<li style="--i:${i}">${c}</li>`).join('')}</ul>
        ${l.done ? `<p class="lk-boxes ${l.solved ? 'ok' : 'miss'}" aria-label="${l.len} letters">${boxes()}</p>
        <p class="lk-tries"><span>${l.solved ? ['First try.', 'Second try.', 'Third try.'][l.tries.length - 1] || 'Got it.' : `It was ${l.answer.toUpperCase()}.`}</span></p>` : `
        <form id="form" class="lk-form" autocomplete="off"><label class="lk-type"><p class="lk-boxes" id="boxes">${boxes()}</p><input id="w" maxlength="${l.len}" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-label="Your answer, ${l.len} letters"></label><button class="btn wide" id="go">Guess</button></form>
        <p class="lk-tries">${[0, 1, 2].map(i => `<i class="${l.tries[i] ? 'used' : ''}"></i>`).join('')}<span>${l.tries.length ? `Not ${l.tries.map(t => t.toUpperCase()).join(', ')}` : '3 tries'}</span></p>`}
        ${done ? '' : `<div class="ld-tools">${l.more ? '<button class="hint-btn" id="more">Show another clue</button>' : ''}${nextOpen(cur) >= 0 ? '<button class="hint-btn" id="skip">Next link ›</button>' : ''}${l.done ? '' : '<button class="link-quiet" id="give">Give up this one</button>'}</div>`}
      </div>`;
    app.querySelectorAll('.lk-tabs [data-k]').forEach(b => b.addEventListener('click', () => { cur = +b.dataset.k; SOUNDS.tap(); say(''); draw(); }));
    $('#more')?.addEventListener('click', () => { SOUNDS.tap(); guess('+'); });
    $('#skip')?.addEventListener('click', () => { cur = nextOpen(cur); SOUNDS.tap(); say(''); draw(); });
    $('#give')?.addEventListener('click', e => {
      if (Date.now() - giveArmed > 3000) { giveArmed = Date.now(); e.target.textContent = 'Tap again to give up'; SOUNDS.tap(); return; }
      giveArmed = 0; guess('?');
    });
    if (done || l.done) return;
    const input = $('#w');
    if (matchMedia('(hover: hover)').matches) setTimeout(() => input.focus(), 50);
    input.addEventListener('input', () => { input.value = input.value.replace(/[^a-z]/gi, '').toUpperCase(); $('#boxes').innerHTML = boxes(input.value);
      app.querySelectorAll('#boxes i')[input.value.length - 1]?.classList.add('in'); SOUNDS.tick(); });
    $('#form').addEventListener('submit', e => { e.preventDefault(); guess(input.value); });
  }

  async function guess(w) {
    if (busy) return;
    if (w !== '?' && w !== '+' && !w.trim()) { say('Type a word first.'); shake(); return; }
    busy = true;
    const k = cur;
    let r;
    try { r = await linkGuess(k, w); }
    catch (e) { busy = false; const why = Object.keys(WHY).find(x => e.message.includes(x)); say(why ? WHY[why] : navigator.onLine ? 'Couldn’t check that. Try again.' : 'You’re offline. Guesses need a connection.'); buzz(10); shake(); return; }
    busy = false;
    if (gone) return;
    const l0 = s.links[k].clues.length; s = r;
    const was = r.links[k];
    if (w === '+') { say(''); draw(); return; }
    if (was.solved) { say(`${was.answer.toUpperCase()}. ${['On one clue!', 'Two clues.', 'Just in time.'][was.used - 1] || ''}`); SOUNDS.ok(); buzz(12); }
    else if (was.done) { say(w === '?' ? '' : `Not ${w.toUpperCase()}.`); SOUNDS.miss(); buzz(15); }
    else { say(`Not ${w.toUpperCase()} (−1 point). ${3 - was.tries.length} ${3 - was.tries.length === 1 ? 'try' : 'tries'} left${was.hint ? `. It starts with ${was.hint}.` : was.clues.length > l0 ? '. Here’s another clue.' : '.'}`); SOUNDS.miss(); buzz(15); }
    // a finished link moves you on to the next open one after a beat, so you see the answer first
    if (was.done && !r.result) { draw(); setTimeout(() => { if (!gone && s === r) { cur = nextOpen(k); draw(); } }, 1100); }
    else { draw(); if (!was.done) shake(); }
    // the aha: the chain snaps together; first-try solves get the big burst
    // the answer flips in letter by letter, each a note higher; a clue earned by a miss drops in
    if (was.solved) { $('.lk-now')?.classList.add('linked', 'reveal'); [...was.answer].forEach((_, i) => setTimeout(() => SOUNDS.link(i + 1), 120 + i * 90)); if (was.used === 1) burst('#F2A93B'); }
    else if (!was.done && was.clues.length > l0) app.querySelector('.lk-clues li:last-child')?.classList.add('fresh');
    if (r.result) { finish('link', r.result, day); if (r.result.solved) burst('var(--c-link)'); result(r.result, true); }
  }

  function result(r, fresh) {
    const beat = r.beat != null && r.players >= 10 ? `Better than ${r.beat}% of players today` : 'You’re one of the first to finish today';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <img class="g-mug" src="/art/mugs/link-${r.solved ? 'full' : 'empty'}.webp" alt="" width="80" height="75">
      <p class="eyebrow">${r.solved === 5 ? 'All five linked' : `${r.solved} of 5 linked`}</p>
      <h2 class="display"><em>${r.score}</em> of 15</h2>
      <p class="lk-dots">${r.tries.map(t => `<i class="t${t}" title="${t ? `${t} clue${t > 1 ? 's' : ''}` : 'missed'}"></i>`).join('')}</p>
      <p class="muted">${[beat, `in ${clock(r.ms)}`, streak('link') > 1 ? `${streak('link')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      ${resultButtons('link')}
      <p class="next-in">Tomorrow’s links in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a>
    </div>`;
    if (fresh) SOUNDS.chime();
    const send = only => async () => { SOUNDS.tap(); if (await shareDose('story', only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('link'));
    $('#all').addEventListener('click', send());
    friendsOn($('#fr-on'), 'link');
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await linkStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s links aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.link = { day }; save();
    cur = Math.max(0, s.links.findIndex(l => !l.done));
    draw();
    if (s.result) { finish('link', s.result, day); result(s.result, false); }
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('link') || state.progress.link?.day === day) load();
  return () => { gone = true; };
}
