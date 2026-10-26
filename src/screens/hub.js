import { countdown, puzzleNo } from '../lib/day.js';
import { resultFor, streak, freezeUsedThisWeek } from '../lib/store.js';
import { playingToday } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, skyline, icon, skyPhase } from '../ui/sky.js';
import { clock, rewireLine } from './rewire.js';
import { hunchLine } from './hunch.js';
import { tangleLine } from './tangle.js';
import { cipherLine } from './cipher.js';
import { ladderLine } from './ladder.js';
import { friendsStrip } from './friends.js';
import { shareDose } from '../ui/card.js';

// The lineup. New games plug in here: a key, a building in the skyline (`at`), a screen in main.js, and a result line.
const GAMES = [
  { k: 'rewire', at: 3, name: 'Rewire', sign: 'REWIRE', line: 'Turn the wires. Light up the city.', done: r => `Lit in ${clock(r.ms)}${r.stars ? ` ${'★'.repeat(r.stars)}` : ''}`, share: rewireLine },
  { k: 'hunch', at: 7, name: 'Hunch', sign: 'HUNCH', line: 'Guess, then bet on how sure you are.', done: r => r.points != null ? `${r.points} pts` : `${Math.round(r.err)}% off`, share: hunchLine },
  { k: 'tangle', at: 11, name: 'Tangle', sign: 'TANGLE', line: 'Drag the dots until no lines cross.', done: r => `Untied in ${clock(r.ms)}`, share: r => `🪢 ${tangleLine(r)}` },
  { k: 'cipher', at: 15, name: 'Cipher', sign: 'CIPHER', line: 'Crack a famous line, letter by letter.', done: cipherLine, share: r => `🔐 ${cipherLine(r)}` },
  { k: 'ladder', at: 19, name: 'Ladder', sign: 'LADDER', line: 'Word to word, one letter at a time.', done: ladderLine, share: r => `🪜 ${ladderLine(r)}` },
];
// Below this many players we keep quiet about the count; "3 playing" reads like an empty room.
const SHOW_PLAYERS_FROM = 25;

// One obvious thing to do: the next game you haven't played. Once everything is lit, sharing takes its place.
function nextUp(g, played, open) {
  if (g) return `<button class="next g-${g.k}" data-k="${g.k}">
      <span class="n-ic">${icon(g.k)}</span>
      <span class="n-body"><span class="eyebrow">${played.length ? 'Next up' : 'Start tonight with'}</span><span class="n-name display">${g.name}</span></span>
      <span class="n-go" aria-hidden="true">Play</span></button>`;
  return `<div class="next all-lit"><span class="n-body"><span class="eyebrow">All ${open.length} lit tonight</span><span class="n-name display">The city’s glowing</span></span>
      <button class="btn" id="share">Share</button></div>`;
}

const status = g => {
  if (g.soon) return `<span class="t-status soon">${g.soon}</span>`;
  const r = resultFor(g.k);
  return r ? `<span class="t-status done">${g.done(r)}</span>` : '<span class="t-status play">Play</span>';
};

export function hub(app) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const s = streak();
  const played = GAMES.filter(g => !g.soon && resultFor(g.k));
  const open = GAMES.filter(g => !g.soon);
  const next = open.find(g => !resultFor(g.k));
  const signs = GAMES.filter(g => g.at != null).map(g => ({ at: g.at, k: g.k, label: g.sign, on: !g.soon, lit: !!resultFor(g.k) }));

  const phase = skyPhase();
  app.innerHTML = `<main class="screen hub">
    <section class="sky ph-${phase}">
      <div class="stars">${stars()}</div>
      <i class="moon" aria-hidden="true"></i>
      <i class="shoot" aria-hidden="true"></i>
      <header class="hub-head">
        <div class="hub-bar"><p class="eyebrow">No. ${puzzleNo()} · ${today}</p>
          <button class="me" id="me" aria-label="You: stats, badges and account" title="You"><svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg></button></div>
        <h1 class="display">Your daily <em>dose</em></h1>
        <div class="hub-meta">
          <span class="pill" title="Miss one night a week and your streak keeps going">${s ? `<b>${s}</b> night${s === 1 ? '' : 's'} in a row<span class="frz">${freezeUsedThisWeek() ? 'freeze used' : '1 freeze left'}</span>` : 'Light your first window'}</span>
          <span class="pill" id="live" hidden></span>
        </div>
      </header>
      ${skyline(signs, 22, 11, phase)}
    </section>
    <div class="street">
      ${nextUp(next, played, open)}
      <p class="tonight"><span>${played.length} of ${open.length} lit tonight</span><span class="mono">Lights out in <b data-cd>${countdown()}</b></span></p>
      <ol class="board">
        ${GAMES.map((g, i) => `<li><button class="row g-${g.k}${resultFor(g.k) ? ' is-done' : ''}" data-k="${g.k}" ${g.soon ? 'aria-disabled="true"' : ''}>
          <span class="r-no mono">0${i + 1}</span>
          <span class="r-body"><span class="r-name display">${g.name}</span><span class="r-line">${g.line}</span></span>
          ${status(g)}
        </button></li>`).join('')}
      </ol>
      <a class="fr-strip" id="frs" href="#friends"><span class="eyebrow">Friends</span><span class="fr-sum">Add friends with a code</span><span class="fr-go" aria-hidden="true">›</span></a>
      <p class="hint">Same puzzles for everyone on Earth. New ones at midnight UTC.</p>
      <p class="legal"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></p>
    </div>
  </main>`;

  const go = (k, el) => {
    if (GAMES.find(g => g.k === k)?.soon) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); buzz(8); return; }
    SOUNDS.tap(); buzz(); location.hash = k;
  };
  // the list, the big button, and the buildings themselves all open games
  app.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => go(b.dataset.k, b)));
  app.querySelector('#me').addEventListener('click', () => { SOUNDS.tap(); location.hash = 'me'; });
  friendsStrip(app.querySelector('#frs'));
  app.querySelector('#share')?.addEventListener('click', () => { SOUNDS.tap(); shareDose('story'); });

  let gone = false;
  playingToday().then(n => {
    if (gone || !(n >= SHOW_PLAYERS_FROM)) return;
    const el = app.querySelector('#live'); el.hidden = false;
    el.innerHTML = `<i class="dot"></i><b>${n.toLocaleString()}</b> playing tonight`;
  }).catch(() => {});

  return () => { gone = true; };
}
