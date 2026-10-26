import { countdown, puzzleNo } from '../lib/day.js';
import { resultFor, streak, freezeUsedThisWeek } from '../lib/store.js';
import { playingToday } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { icon } from '../ui/icons.js';
import { clock, rewireLine } from './rewire.js';
import { hunchLine } from './hunch.js';
import { tangleLine } from './tangle.js';
import { ladderLine } from './ladder.js';
import { friendsStrip } from './friends.js';
import { shareDose } from '../ui/card.js';

// The lineup. New games plug in here: a key, a screen in main.js, and a result line.
const GAMES = [
  { k: 'rewire', name: 'Rewire', line: 'Turn the tiles to wire every building.', done: r => `${clock(r.ms)}${r.stars ? ` ${'★'.repeat(r.stars)}` : ''}`, share: rewireLine },
  { k: 'hunch', name: 'Hunch', line: 'Guess, then bet on how sure you are.', done: r => r.points != null ? `${r.points} pts` : `${Math.round(r.err)}% off`, share: hunchLine },
  { k: 'tangle', name: 'Tangle', line: 'Drag the dots until no lines cross.', done: r => clock(r.ms), share: r => `🪢 ${tangleLine(r)}` },
  { k: 'ladder', name: 'Ladder', line: 'Word to word, one letter at a time.', done: ladderLine, share: r => `🪜 ${ladderLine(r)}` },
];
// Below this many players we keep quiet about the count; "3 playing" reads like an empty room.
const SHOW_PLAYERS_FROM = 25;

export function hub(app) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const s = streak();
  const played = GAMES.filter(g => resultFor(g.k));
  const next = GAMES.find(g => !resultFor(g.k));
  // One obvious thing to do: the next game you haven't played gets a full-width tile and the Play button.
  const tile = g => {
    const r = resultFor(g.k);
    return `<li class="${g === next ? 'wide' : ''}"><button class="tile g-${g.k}${r ? ' is-done' : ''}" data-k="${g.k}">
        <span class="t-ic">${icon(g.k)}</span>
        <span class="t-name">${g.name}</span>
        <span class="t-line">${g.line}</span>
        <span class="t-status">${r ? g.done(r) : 'Play'}</span>
      </button></li>`;
  };

  app.innerHTML = `<main class="screen hub">
    <header class="hub-top">
      <p class="logo"><i class="logo-mark" aria-hidden="true"></i>Daily Dose</p>
      <button class="me" id="me" aria-label="You: stats, badges and account" title="You"><svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg></button>
    </header>
    <section class="hub-head">
      <h1 class="display">${today}</h1>
      <p class="hub-meta"><span>No. ${puzzleNo()}</span><span title="Miss one day a week and your streak keeps going">${s ? `${s}-day streak · ${freezeUsedThisWeek() ? 'freeze used' : '1 freeze left'}` : 'Play one to start a streak'}</span><span id="live" hidden></span></p>
    </section>
    ${next ? '' : `<div class="all-done"><p><b>All ${GAMES.length} done today.</b> New puzzles in <span data-cd>${countdown()}</span></p><button class="btn" id="share">Share your results</button></div>`}
    <ol class="tiles">${[next, ...GAMES.filter(g => g !== next)].filter(Boolean).map(tile).join('')}</ol>
    ${next ? `<p class="tonight">${played.length} of ${GAMES.length} done · New puzzles in <span data-cd>${countdown()}</span></p>` : ''}
    <a class="fr-strip" id="frs" href="#friends"><span class="fr-label">Friends</span><span class="fr-sum">Add friends with a code</span><span class="fr-go" aria-hidden="true">›</span></a>
    <p class="hint">Same puzzles for everyone. New ones every day at midnight UTC.</p>
    <p class="legal"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></p>
  </main>`;

  app.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { SOUNDS.tap(); buzz(); location.hash = b.dataset.k; }));
  app.querySelector('#me').addEventListener('click', () => { SOUNDS.tap(); location.hash = 'me'; });
  friendsStrip(app.querySelector('#frs'));
  app.querySelector('#share')?.addEventListener('click', () => { SOUNDS.tap(); shareDose('story'); });

  let gone = false;
  playingToday().then(n => {
    if (gone || !(n >= SHOW_PLAYERS_FROM)) return;
    const el = app.querySelector('#live'); el.hidden = false;
    el.textContent = `${n.toLocaleString()} playing today`;
  }).catch(() => {});

  return () => { gone = true; };
}
