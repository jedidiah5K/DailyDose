import { countdown, puzzleNo, dayKey, clock } from '../lib/day.js';
import { state, save, resultFor, streak } from '../lib/store.js';
import { playingToday, hasAccount, getMe } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { tabBar } from '../ui/shell.js';
import { ensureStickerDefs, sticker, EDGE } from '../ui/stickers.js';
import { rewireLine } from './rewire.js';
import { hunchLine } from './hunch.js';
import { tangleLine } from './tangle.js';
import { ladderLine } from './ladder.js';
import { linkLine } from './link.js';
import { anagramLine } from './anagram.js';
import { shareDose } from '../ui/card.js';

// The lineup, as the day's newspaper: each story is the game's name, big. Solving it earns its sticker.
// New games plug in here: a key, a screen in main.js, and a result line.
export const GAMES = [
  { k: 'rewire', name: 'Rewire', c: '#3F7FC4',
    done: r => `wired in ${clock(r.ms)}`, share: rewireLine },
  { k: 'hunch', name: 'Hunch', c: '#B3881A', btn: '#C99A1E',
    done: r => r.points != null ? `${r.points} points` : `${Math.round(r.err)}% off`, share: hunchLine },
  { k: 'link', name: 'Missing Link', c: '#2C9A88',
    done: r => `${r.score} of 15`, share: r => `🔗 ${linkLine(r)}` },
  { k: 'tangle', name: 'Tangle', c: '#DD7444',
    done: r => `untied in ${clock(r.ms)}`, share: r => `🪢 ${tangleLine(r)}` },
  { k: 'anagram', name: 'Anagram', c: '#CF4F7D',
    done: r => `${r.solved} of ${r.n}`, share: r => `🔤 ${anagramLine(r)}` },
  { k: 'ladder', name: 'Ladder', c: '#7D5FC6',
    done: r => r.solved ? (r.steps === r.par ? 'on par' : `${r.steps} steps`) : 'gave up', share: r => `🪜 ${ladderLine(r)}` },
];
// Where each sticker lands in its story: how far from the right edge, how far down (of the story), the lean.
// They sit in the gap between the name and the rule under it, each leaning its own way.
const LAND = { rewire: { right: 4, at: 55, r: -11 }, hunch: { right: 10, at: 53, r: 8 }, link: { right: 0, at: 57, r: -5 },
  tangle: { right: 8, at: 54, r: 13 }, anagram: { right: 2, at: 56, r: -14 }, ladder: { right: 12, at: 53, r: 6 } };
// Below this many players we keep quiet about the count; "3 playing" reads like an empty room.
const SHOW_PLAYERS_FROM = 25;
const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.5 2-3.3C17.5 10.6 19 13 19 15.5A7 7 0 0 1 5 15.5C5 10 10 8 12 2z"/></svg>';
const esc = s => String(s).replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`);

export function hub(app) {
  ensureStickerDefs();
  const today = dayKey(), s = streak();
  const date = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const done = GAMES.map(g => !!resultFor(g.k)), n = done.filter(Boolean).length;
  // the top story: a game you started and left, else the next one you haven't played
  const open = g => !resultFor(g.k) && state.progress[g.k]?.day === today;
  const next = GAMES.find(open) || GAMES.find(g => !resultFor(g.k));
  // stickers you haven't seen land yet get slapped on now
  const seen = state.stickersSeen?.day === today ? state.stickersSeen.k : [];
  const fresh = GAMES.filter(g => resultFor(g.k) && !seen.includes(g.k)).map(g => g.k);

  const story = g => {
    const res = resultFor(g.k), { right, at, r: tilt } = LAND[g.k];
    return `<div class="ed-story">
      <a class="ed-head" href="#${g.k}">${g.name}</a>
      ${res ? `${sticker(g.k, 60, fresh.includes(g.k) ? 'slap' : '', `right:${right}px;top:${at}%;--r:${tilt}deg`)}
               <span class="ed-res" style="color:${g.c}">✓ ${g.done(res)}</span>`
            : `${open(g) ? '<span class="ed-open">Unfinished</span>' : ''}
               <a class="ed-play" href="#${g.k}" style="background:${g.btn || g.c}">${open(g) ? 'Resume' : 'Play'}</a>`}
    </div>`;
  };

  const lead = next
    ? `<div class="ed-lead">
        <a class="ed-lhead" href="#${next.k}">${next.name}</a>
        <a class="ed-bigplay" href="#${next.k}" style="background:${next.btn || next.c}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>${open(next) ? 'Resume' : 'Play'} ${next.name}</a>
        <div class="ed-spot" aria-hidden="true">
          <svg viewBox="0 0 100 100"><path d="${EDGE}" fill="rgba(255,255,255,.35)" stroke="#A99F8E" stroke-width="2.4" stroke-dasharray="5 5"/></svg>
          ${sticker(next.k, 72, 'ghost')}
          <span>Up for grabs</span>
        </div>
      </div>`
    : `<div class="ed-lead"><div class="ed-extra">
        <p class="ed-ex1">Extra! Extra!</p>
        <p class="ed-ex2">${state.name ? esc(state.name) : 'Reader'} gets their <em>daily dose</em></p>
        <button class="ed-exbtn" id="card">Get your sticker card</button>
      </div></div>`;

  app.innerHTML = `<main class="screen hub ed has-tabs">
    <header class="ed-mast">
      <div class="ed-top"><span>Est. 2026${state.name ? ` · For ${esc(state.name)}` : ' · Free'}</span>${s ? `<span class="ed-streak">${FLAME}${s}-day streak</span>` : '<span>A new paper at midnight, where you are</span>'}</div>
      <h1 class="ed-name">The Daily <em>Dose</em></h1>
      <div class="ed-date"><span>No. ${puzzleNo()} · ${date}</span>
        <span class="ed-dots" aria-label="${n} of ${GAMES.length} stickers">${n}/${GAMES.length}${GAMES.map((g, i) => `<i style="${done[i] ? `background:${g.c}` : ''};--t:${LAND[g.k].r}deg"></i>`).join('')}</span></div>
    </header>
    ${lead}
    <div class="ed-grid">${GAMES.map(story).join('')}</div>
    <p class="hint" id="live" hidden></p>
    <p class="ed-foot"><span>Solve a story · earn its sticker</span><span>Next edition <span data-cd>${countdown()}</span></span></p>
    <p class="legal"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></p>
    ${tabBar('today')}
  </main>`;

  app.querySelectorAll('.ed-head, .ed-play, .ed-lhead, .ed-bigplay').forEach(a => a.addEventListener('click', () => { SOUNDS.tap(); buzz(); }));
  app.querySelector('#card')?.addEventListener('click', () => { SOUNDS.tap(); shareDose('story'); });
  if (fresh.length) {
    setTimeout(() => { SOUNDS.ok?.(); buzz(18); }, 250);
    state.stickersSeen = { day: today, k: [...seen, ...fresh] }; save();
  }

  let gone = false;
  playingToday().then(c => {
    if (gone || !(c >= SHOW_PLAYERS_FROM)) return;
    const el = app.querySelector('#live'); el.hidden = false; el.textContent = `${c.toLocaleString()} people playing today`;
  }).catch(() => {});
  // Your name for the masthead: shown from memory straight away, refreshed quietly.
  hasAccount().then(ok => ok && getMe()).then(m => {
    if (!m || (m.name || null) === (state.name || null) || gone) return;
    state.name = m.name || null; save();
  }).catch(() => {});

  return () => { gone = true; };
}
