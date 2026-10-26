import { dayKey, puzzleNo, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { cipherStart, cipherGuess } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, icon } from '../ui/sky.js';
import { friendsOn } from './friends.js';

const LIVES = 5;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
export const cipherLine = r => r.solved ? `Cracked${r.misses ? ` · ${r.misses} slip${r.misses > 1 ? 's' : ''}` : ' · no slips'}` : 'Not cracked';
const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

// Cipher: a famous line with every letter swapped for another. Tap a scrambled letter, then the letter
// it hides. The server knows the key; the phone only gets the scrambled text and its own guesses.
export function cipher(app) {
  const day = dayKey();
  let s = null, sel = null, busy = false, gone = false;
  const known = {}, wrong = {};   // known[cipherLetter] = real letter; wrong[cipherLetter] = letters already tried

  app.innerHTML = `<main class="screen game cipher">
    <div class="stars" aria-hidden="true">${stars(30, 53)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-cipher">${icon('cipher')}Cipher <span>No. ${puzzleNo()}</span></p>
      <span class="cp-lives" id="lives" aria-label="Wrong guesses left"></span>
    </header>
    <section id="body" class="cp-body">
      <div class="h-intro rise">
        <h2 class="display">Crack the <em>code</em></h2>
        <p>Every letter in today’s quote stands for a different one. Tap a scrambled letter, then the letter you think it hides. Five wrong guesses and the quote is out.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section>
    <p class="v-msg" id="msg" role="status"></p>
    <section id="bottom"></section>
  </main>`;
  const $ = q => app.querySelector(q);
  const say = t => { $('#msg').textContent = t; };
  const misses = () => Object.values(wrong).reduce((n, l) => n + l.length, 0);

  function lives() { const m = misses(); $('#lives').innerHTML = Array.from({ length: LIVES }, (_, i) => `<i class="${i < LIVES - m ? 'on' : ''}"></i>`).join(''); }

  function draw() {
    const words = s.cipher.split(' ');
    const solvedAll = [...s.cipher].every(ch => !/[A-Z]/.test(ch) || known[ch]);
    $('#body').innerHTML = `<div class="cp-quote" id="quote">${words.map(w => `<span class="cp-word">${[...w].map(ch => /[A-Z]/.test(ch)
      ? `<button class="cp-cell${known[ch] ? ' got' : ''}${sel === ch ? ' sel' : ''}" data-c="${ch}" aria-label="Scrambled ${ch}${known[ch] ? `, is ${known[ch]}` : ''}"><b>${known[ch] || ''}</b><small>${ch}</small></button>`
      : `<span class="cp-punct">${esc(ch)}</span>`).join('')}</span>`).join(' ')}</div>
      ${s.result || solvedAll ? '' : `<div class="cp-keys" id="keys">${KEYS.map(row => `<div>${[...row].map(k => {
        const used = Object.values(known).includes(k), tried = sel && wrong[sel]?.includes(k);
        return `<button data-k="${k}" ${used || tried || !sel ? 'disabled' : ''} class="${tried ? 'no' : ''}">${k}</button>`;
      }).join('')}</div>`).join('')}</div>`}`;
    app.querySelectorAll('.cp-cell').forEach(b => b.addEventListener('click', () => { if (s.result || known[b.dataset.c]) return; sel = b.dataset.c; SOUNDS.tap(); draw(); }));
    app.querySelectorAll('#keys button').forEach(b => b.addEventListener('click', () => guess(b.dataset.k)));
    lives();
  }

  // After a right answer, jump to the next scrambled letter still to crack.
  const nextOpen = () => [...s.cipher].find(ch => /[A-Z]/.test(ch) && !known[ch]) || null;

  async function guess(k) {
    if (busy || !sel || s.result) return;
    busy = true;
    let r;
    try { r = await cipherGuess(sel, k); }
    catch (e) { busy = false; say(navigator.onLine ? 'Couldn’t check that. Try again.' : 'You’re offline. Guesses need a connection.'); return; }
    busy = false;
    if (gone) return;
    if (r.ok) { known[r.c] = r.p; SOUNDS.link(Object.keys(known).length); buzz(10); sel = nextOpen(); }
    else if (r.ok === false) { (wrong[r.c] ||= []).push(r.p); SOUNDS.miss(); buzz(30); say(`${r.p} isn’t it.`); }
    if (r.ok) say('');
    if (r.result) { s.result = r.result; finish('cipher', r.result, day); draw(); return result(r.result, true); }
    draw();
  }

  function result(r, fresh) {
    sel = null; draw();
    const beat = r.beat != null ? `Better than ${r.beat}% of players today` : r.solved ? 'You’re one of the first to crack it today' : '';
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.solved ? 'Code cracked' : 'Out of guesses'}</p>
      <h2 class="display">${r.solved ? (r.misses ? `<em>${r.misses}</em> slip${r.misses > 1 ? 's' : ''}` : 'No <em>slips</em>') : 'So <em>close</em>'}</h2>
      <blockquote class="cp-said">${esc(r.text)}<cite>${esc(r.by)}</cite></blockquote>
      <p class="muted">${[beat, r.solved ? `in ${clock(r.ms)}` : '', streak('cipher') > 1 ? `${streak('cipher')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share tonight’s dose</button>
      <button class="link-quiet" id="square">Square image instead</button>
      <p class="next-in">Tomorrow’s code in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    if (fresh) { r.solved ? SOUNDS.chime() : SOUNDS.miss(); buzz(r.solved ? 30 : 10); }
    const send = fmt => async () => { SOUNDS.tap(); if (await shareDose(fmt) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('story'));
    $('#square').addEventListener('click', send('square'));
    friendsOn($('#fr-on'), 'cipher');
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await cipherStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s code isn’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    for (const g of s.given) known[g.c] = g.p;
    for (const t of s.tries || []) t.ok ? (known[t.c] = t.p) : (wrong[t.c] ||= []).push(t.p);
    state.progress.cipher = { day }; save();
    if (s.result) { finish('cipher', s.result, day); return result(s.result, false); }
    sel = nextOpen(); draw();
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('cipher') || state.progress.cipher?.day === day) load();
  lives();
  return () => { gone = true; };
}
