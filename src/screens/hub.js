import { countdown, puzzleNo, dayKey } from '../lib/day.js';
import { state, save, resultFor, streak } from '../lib/store.js';
import { playingToday, hasAccount, getMe } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { icon, moonPath } from '../ui/icons.js';
import { tabBar } from '../ui/shell.js';
import { clock, rewireLine } from './rewire.js';
import { hunchLine } from './hunch.js';
import { tangleLine } from './tangle.js';
import { ladderLine } from './ladder.js';
import { linkLine } from './link.js';
import { anagramLine } from './anagram.js';
import { shareDose } from '../ui/card.js';

// The lineup. New games plug in here: a key, a screen in main.js, and a result line.
export const GAMES = [
  { k: 'rewire', name: 'Rewire', line: 'Wire every building', done: r => `${clock(r.ms)}${r.stars ? ` · ${'★'.repeat(r.stars)}` : ''}`, share: rewireLine },
  { k: 'hunch', name: 'Hunch', line: 'Guess, then bet on it', done: r => r.points != null ? `${r.points} pts` : `${Math.round(r.err)}% off`, share: hunchLine },
  { k: 'link', name: 'Missing Link', line: 'One word fits all three', done: linkLine, share: r => `🔗 ${linkLine(r)}` },
  { k: 'tangle', name: 'Tangle', line: 'Untangle the lines', done: r => clock(r.ms), share: r => `🪢 ${tangleLine(r)}` },
  { k: 'anagram', name: 'Anagram', line: 'Unscramble five words', done: anagramLine, share: r => `🔤 ${anagramLine(r)}` },
  { k: 'ladder', name: 'Ladder', line: 'One letter at a time', done: ladderLine, share: r => `🪜 ${ladderLine(r)}` },
];
// Below this many players we keep quiet about the count; "3 playing" reads like an empty room.
const SHOW_PLAYERS_FROM = 25;

// The sky follows the player's own clock. ?sky=day (etc.) forces one, for testing.
function skyPhase(h = new Date().getHours()) {
  const forced = new URLSearchParams(location.search).get('sky');
  if (['dawn', 'day', 'dusk', 'night'].includes(forced)) return forced;
  return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
}
const greeting = (h = new Date().getHours()) => h < 5 ? 'Late night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 22 ? 'Evening' : 'Late night';

const moonIcon = f => `<svg class="mini-moon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="${moonPath(f, 10, 10, 8)}"/></svg>`;

const STARS = [[8, 40, 1.2], [18, 22, .9], [30, 64, 1.1], [41, 30, .8], [53, 54, 1], [62, 18, 1.2], [95, 150, .9], [5, 120, .8], [46, 110, .9], [95, 30, 1], [72, 90, .9], [84, 60, 1.1]];
// The sky: stars (x in %, so they spread on any width), hills that stretch like a horizon, and a moon
// that keeps its shape beside the greeting.
function hero(phase, f) {
  return `${phase === 'night' || phase === 'dusk' ? STARS.map(([x, y, r]) => `<i class="star" style="left:${x}%;top:${y}px;--r:${r * 2.2}px"></i>`).join('') : ''}
    <svg class="hero-hills" viewBox="0 140 390 160" preserveAspectRatio="none" aria-hidden="true">
      <path class="hill-far" d="M0 196C48 170 92 160 140 176s92 34 140 12 80-46 110-40v152H0z"/>
      <path class="hill-near" d="M0 236c58-30 110-34 168-16s110 30 160 8 52-18 62-16v88H0z"/>
      <path class="ground" d="M0 280c70-18 150-22 230-10s120 12 160 4v26H0z"/>
    </svg>`;
}
const moonArt = f => `<svg class="hero-moon" viewBox="0 0 120 120" aria-hidden="true"><circle class="moon-glow" cx="60" cy="60" r="50"/><circle class="moon-dark" cx="60" cy="60" r="26"/><path class="moon-lit" d="${moonPath(f, 60, 60, 26)}"/></svg>`;

// Monday to Sunday, each night with its own little moon.
const weekKeys = today => {
  const t = Date.parse(today), dow = (new Date(t).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(t + (i - dow) * 864e5).toISOString().slice(0, 10));
};
const doneOn = key => GAMES.filter(g => state.results[g.k]?.[key]).length;
const week = today => weekKeys(today).map((key, i) =>
  `<li class="${key === today ? 'today' : key > today ? 'later' : ''}"><span>${'MTWTFSS'[i]}</span><b>${+key.slice(8)}</b>${key <= today ? moonIcon(doneOn(key) / GAMES.length) : '<i></i>'}</li>`).join('');

// This week in one line: full-moon nights (every game done) and games played.
function weekCard(today) {
  const past = weekKeys(today).filter(k => k <= today);
  const full = past.filter(k => doneOn(k) === GAMES.length).length, played = past.reduce((n, k) => n + doneOn(k), 0);
  const note = !full ? `Finish all ${GAMES.length} tonight for your first full moon.` : full === past.length ? 'Every night so far. Keep it going.' : 'Finish everything tonight for another.';
  return `<section class="wk-card"><p class="eyebrow">This week</p>
    <div class="wk-row"><b class="display">${full}</b><p><span><b>full moon${full === 1 ? '' : 's'}</b></span><span>${played} game${played === 1 ? '' : 's'} played</span></p></div>
    <p class="wk-note">${note}</p></section>`;
}

const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const flame = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.5 2-3.3C17.5 10.6 19 13 19 15.5A7 7 0 0 1 5 15.5C5 10 10 8 12 2z"/></svg>';
const esc = s => String(s).replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`);

export function hub(app) {
  const today = dayKey(), phase = skyPhase();
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const played = GAMES.filter(g => resultFor(g.k));
  const next = GAMES.find(g => !resultFor(g.k));
  const left = GAMES.length - played.length;

  const row = g => {
    // started but not finished: a half-full circle and a nudge, so it nags a little
    const r = resultFor(g.k), s = streak(g.k), open = !r && state.progress[g.k]?.day === today;
    return `<li><button class="row g-${g.k}${r ? ' is-done' : open ? ' is-open' : ''}" data-k="${g.k}">
      <span class="r-ic">${icon(g.k)}</span>
      <span class="r-body"><b class="r-name">${g.name}</b><span class="r-sub">${r ? g.done(r) : open ? 'Unfinished · pick it back up' : g.line}</span></span>
      ${s > 1 ? `<span class="r-streak">${flame}<b>${s}</b>days</span>` : ''}
      <span class="r-check">${r ? check : ''}</span>
    </button></li>`;
  };

  app.innerHTML = `<main class="screen hub has-tabs">
    <section class="hero sky-${phase}">
      ${hero(phase, played.length / GAMES.length)}
      <div class="hero-text">
        ${moonArt(played.length / GAMES.length)}
        <p class="eyebrow">${date} · No. ${puzzleNo()}</p>
        <h1 class="display">${greeting()}${state.name ? `, <em>${esc(state.name)}</em>` : ''}</h1>
        <p class="hero-count"><b>${played.length}</b>/${GAMES.length} done</p>
        <p class="hero-note">${left ? `${left} more to a full moon` : 'Full moon tonight'}</p>
      </div>
    </section>
    <div class="hub-body">
      <ol class="week">${week(today)}</ol>
      ${weekCard(today)}
      <div class="list-head"><p class="eyebrow">Today’s dose</p><p class="eyebrow">New in <span data-cd>${countdown()}</span></p></div>
      <ol class="rows">${GAMES.map(row).join('')}</ol>
      <p class="hint" id="live" hidden></p>
      <p class="hint">Same puzzles for everyone. New ones at midnight UTC.</p>
      <p class="legal"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></p>
    </div>
    ${tabBar('today', next
      ? `<button class="fab" id="fab" aria-label="Play ${next.name}" title="Play ${next.name}"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></button>`
      : `<button class="fab" id="fab" aria-label="Share your results" title="Share your results"><svg viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v6.5h14V13"/></svg></button>`)}
  </main>`;

  app.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { SOUNDS.tap(); buzz(); location.hash = b.dataset.k; }));
  app.querySelector('#fab').addEventListener('click', () => { SOUNDS.tap(); buzz(); if (next) location.hash = next.k; else shareDose('story'); });

  let gone = false;
  playingToday().then(n => {
    if (gone || !(n >= SHOW_PLAYERS_FROM)) return;
    const el = app.querySelector('#live'); el.hidden = false; el.textContent = `${n.toLocaleString()} people playing today`;
  }).catch(() => {});
  // Your name for the greeting: shown from memory straight away, refreshed quietly.
  hasAccount().then(ok => ok && getMe()).then(m => {
    if (!m || (m.name || null) === (state.name || null) || gone) return;
    state.name = m.name || null; save();
    app.querySelector('.hero h1').innerHTML = `${greeting()}${state.name ? `, <em>${esc(state.name)}</em>` : ''}`;
  }).catch(() => {});

  return () => { gone = true; };
}
