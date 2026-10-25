import { countdown, puzzleNo } from '../lib/day.js';
import { resultFor, streak } from '../lib/store.js';
import { playingToday } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars, skyline, icon } from '../ui/sky.js';
import { clock, rewireLine } from './rewire.js';
import { hunchLine } from './hunch.js';
import { openAccount } from './account.js';

// The lineup. New games plug in here: a key, a building in the skyline (`at`), a screen in main.js, and a result line.
const GAMES = [
  { k: 'rewire', at: 4, name: 'Rewire', sign: 'REWIRE', line: 'Turn the wires. Light up the city.', done: r => `Lit in ${clock(r.ms)}`, share: rewireLine },
  { k: 'hunch', at: 9, name: 'Hunch', sign: 'HUNCH', line: 'Five guesses about the world.', done: r => r.rated ? `Beat the world ${r.beat}/${r.rated}` : `${Math.round(r.err)}% off`, share: hunchLine },
  { k: 'drop', at: 14, name: 'Drop', sign: 'DROP', line: 'One course. Three shots.', soon: 'Opens soon' },
  { k: 'meld', at: 18, name: 'Mind Meld', sign: 'MELD', line: 'Think like the world, or your best friend.', soon: 'Opens soon' },
  { k: 'last', name: 'Last Stand', line: 'Ten rounds, one life. Weekends only.', soon: 'Saturday' },
];
// Below this many players we keep quiet about the count; "3 playing" reads like an empty room.
const SHOW_PLAYERS_FROM = 25;

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
  const signs = GAMES.filter(g => g.at != null).map(g => ({ at: g.at, k: g.k, label: g.sign, on: !g.soon, lit: !!resultFor(g.k) }));

  app.innerHTML = `<main class="screen hub">
    <section class="sky">
      <div class="stars">${stars()}</div>
      <i class="moon" aria-hidden="true"></i>
      <i class="shoot" aria-hidden="true"></i>
      <header class="hub-head">
        <div class="hub-bar"><p class="eyebrow">No. ${puzzleNo()} · ${today}</p>
          <button class="me" id="me" aria-label="Account" title="Account"><svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg></button></div>
        <h1 class="display">Your daily <em>dose</em></h1>
        <div class="hub-meta">
          <span class="pill">${s ? `<b>${s}</b> night${s === 1 ? '' : 's'} in a row` : 'Light your first window'}</span>
          <span class="pill" id="live" hidden></span>
        </div>
      </header>
      ${skyline(signs)}
    </section>
    <div class="street">
      <p class="tonight"><span>${played.length} of ${open.length} lit tonight</span><span class="mono">Lights out in <b id="cd">${countdown()}</b></span></p>
      <ol class="tiles">
        ${GAMES.map(g => `<li><button class="tile g-${g.k}${resultFor(g.k) ? ' is-done' : ''}" data-k="${g.k}" ${g.soon ? 'aria-disabled="true"' : ''}>
          <span class="t-ic">${icon(g.k)}</span>
          <span class="t-body"><span class="t-name display">${g.name}</span><span class="t-line">${g.line}</span></span>
          ${status(g)}
        </button></li>`).join('')}
      </ol>
      ${played.length ? '<button class="btn wide" id="share">Share tonight’s dose</button>' : '<p class="hint">Same puzzles for everyone on Earth. New ones at midnight UTC.</p>'}
    </div>
  </main>`;

  app.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled')) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); buzz(8); return; }
    SOUNDS.tap(); buzz(); location.hash = b.dataset.k;
  }));
  app.querySelector('#me').addEventListener('click', openAccount);
  app.querySelector('#share')?.addEventListener('click', () => {
    const text = [`DAILY DOSE #${puzzleNo()}`, ...played.map(g => `${g.name} ${g.share(resultFor(g.k))}`), location.origin].join('\n');
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard?.writeText(text);
  });

  let gone = false;
  playingToday().then(n => {
    if (gone || !(n >= SHOW_PLAYERS_FROM)) return;
    const el = app.querySelector('#live'); el.hidden = false;
    el.innerHTML = `<i class="dot"></i><b>${n.toLocaleString()}</b> playing tonight`;
  }).catch(() => {});

  const cd = app.querySelector('#cd');
  const t = setInterval(() => { cd.textContent = countdown(); if (cd.textContent === '00:00:00') location.reload(); }, 1000);
  return () => { gone = true; clearInterval(t); };
}
