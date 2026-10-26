import { dayKey, puzzleNo, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { ladderStart, ladderStep } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';
import { friendsOn } from './friends.js';

export const ladderLine = r => r.solved ? `${r.steps} step${r.steps === 1 ? '' : 's'}${r.steps === r.par ? ' · par' : ` · par ${r.par}`}` : 'Gave up';
const WHY = { 'not a word': w => `${w.toUpperCase()} isn’t in our word list.`, 'change one letter': () => 'Change exactly one letter.', 'already used': () => 'You’ve used that word already.', 'four letters': () => 'Words have four letters.' };

// Ladder: turn one word into another, one letter at a time. Every rung must be a real word; the server
// checks each one. Fewest steps wins.
export function ladder(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false, giveArmed = 0;

  app.innerHTML = `<main class="screen game ladder">
    <div class="stars" aria-hidden="true">${stars(30, 67)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-ladder">${icon('ladder')}Ladder <span>No. ${puzzleNo()}</span></p>
      <span class="eyebrow mono" id="steps"></span>
    </header>
    <section id="body" class="ld-body">
      <div class="h-intro rise">
        <h2 class="display">One letter at a <em>time</em></h2>
        <p>Turn the top word into the bottom word. Change one letter per step, and every step has to be a real word. Fewest steps wins.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section>
    <p class="v-msg" id="msg" role="status"></p>
    <section id="bottom"></section>
  </main>`;
  const $ = q => app.querySelector(q);
  const say = t => { $('#msg').textContent = t; };

  // A rung, with the letter that changed from the rung above lit up.
  const rung = (w, prev, cls = '') => `<li class="ld-rung ${cls}">${[...w].map((ch, i) => `<span class="${prev && prev[i] !== ch ? 'new' : ''}">${ch}</span>`).join('')}</li>`;

  function draw() {
    const chain = s.chain, done = !!s.result;
    $('#steps').textContent = `${chain.length - 1} step${chain.length === 2 ? '' : 's'} · par ${s.par}`;
    $('#body').innerHTML = `<ol class="ld-ladder">
      ${chain.map((w, i) => rung(w, chain[i - 1], i === 0 ? 'top' : '')).join('')}
      ${done ? '' : `<li class="ld-rung ld-input"><form id="form" autocomplete="off"><input id="w" maxlength="4" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Next word" placeholder="····"></form></li>`}
      ${chain[chain.length - 1] === s.end ? '' : rung(s.end, null, 'goal')}
    </ol>
    ${done ? '' : `<div class="ld-tools"><button class="hint-btn" id="undo" ${chain.length < 2 ? 'disabled' : ''}>Undo</button><button class="link-quiet" id="giveup">Give up</button></div>`}`;
    if (done) return;
    const input = $('#w');
    setTimeout(() => input.focus(), 50);
    input.addEventListener('input', () => { input.value = input.value.replace(/[^a-z]/gi, '').toUpperCase(); });
    $('#form').addEventListener('submit', e => { e.preventDefault(); step(input.value); });
    $('#undo').addEventListener('click', () => step('back'));
    $('#giveup').addEventListener('click', e => {
      if (Date.now() - giveArmed > 3000) { giveArmed = Date.now(); e.target.textContent = 'Tap again to give up'; SOUNDS.tap(); return; }
      step('give up');
    });
  }

  async function step(w) {
    if (busy) return;
    const word = w.toLowerCase();
    if (word !== 'back' && word !== 'give up') {
      if (word.length !== 4) { say('Words have four letters.'); buzz(8); return; }
      const last = s.chain[s.chain.length - 1];
      if ([...word].filter((ch, i) => ch !== last[i]).length !== 1) { say('Change exactly one letter.'); buzz(8); return; }
    }
    busy = true;
    let r;
    try { r = await ladderStep(word); }
    catch (e) { busy = false; const why = Object.keys(WHY).find(k => e.message.includes(k)); say(why ? WHY[why](word) : navigator.onLine ? 'Couldn’t check that. Try again.' : 'You’re offline. Steps need a connection.'); buzz(15); SOUNDS.miss(); return; }
    busy = false;
    if (gone) return;
    say('');
    const grew = r.chain.length > s.chain.length;
    s = r;
    if (grew) { SOUNDS.link(r.chain.length); buzz(10); } else SOUNDS.tap();
    draw();
    if (r.result) { finish('ladder', r.result, day); result(r.result, true); }
  }

  function result(r, fresh) {
    const beat = r.beat != null ? `Better than ${r.beat}% of players today` : r.solved ? 'You’re one of the first to finish today' : '';
    const best = !r.solved || r.steps > r.par ? `<p class="ld-path"><span class="eyebrow">A shortest ladder</span>${r.path.map(w => w.toUpperCase()).join(' → ')}</p>` : '';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.solved ? (r.steps === r.par ? 'Right on par' : 'Made it') : 'Not this time'}</p>
      <h2 class="display">${r.solved ? `<em>${r.steps}</em> step${r.steps === 1 ? '' : 's'}` : `Par was <em>${r.par}</em>`}</h2>
      ${best}
      <p class="muted">${[beat, r.solved ? `in ${clock(r.ms)}` : '', streak('ladder') > 1 ? `${streak('ladder')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s ladder in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    if (fresh) { r.solved ? SOUNDS.chime() : SOUNDS.miss(); buzz(r.solved ? 30 : 10); }
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
    friendsOn($('#fr-on'), 'ladder');
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await ladderStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s ladder isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.ladder = { day }; save();
    draw();
    if (s.result) { finish('ladder', s.result, day); result(s.result, false); }
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('ladder') || state.progress.ladder?.day === day) load();
  return () => { gone = true; };
}
