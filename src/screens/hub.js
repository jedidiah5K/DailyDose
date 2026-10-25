import { countdown, puzzleNo } from '../lib/day.js';
import { resultFor, streak } from '../lib/store.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { clock, rewireLine } from './rewire.js';
import { openAccount } from './account.js';

// The lineup. New games plug in here: a key, a tile, a screen in main.js, and a result line.
const GAMES = [
  { k: 'rewire', name: 'Rewire', line: 'Turn the wires. Light up the city.', done: r => `Lit in ${clock(r.ms)}`, share: rewireLine },
  { k: 'hunch', name: 'Hunch', line: 'Five guesses about the world. See how close everyone got.', soon: 'Soon' },
  { k: 'drop', name: 'Drop', line: 'One course. Three shots. Land it.', soon: 'Soon' },
  { k: 'meld', name: 'Mind Meld', line: 'Think like the world, or like your best friend.', soon: 'Soon' },
  { k: 'last', name: 'Last Stand', line: 'Ten rounds, one life. Weekends only.', soon: 'Weekends' },
];

// Small idle scenes for each tile, drawn in CSS.
const dots = (n, cls) => `<div class="${cls}" aria-hidden="true">` + Array.from({ length: n }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>';
const ART = {
  rewire: dots(9, 'art-rewire'),
  hunch: dots(7, 'art-hunch'),
  drop: '<div class="art-drop" aria-hidden="true"><i></i><b></b></div>',
  meld: '<div class="art-meld" aria-hidden="true"><i></i><i></i></div>',
  last: dots(18, 'art-last'),
};

const status = g => {
  if (g.soon) return `<span class="t-status soon">${g.soon}</span>`;
  const r = resultFor(g.k);
  return r ? `<span class="t-status done">${g.done(r)}</span>` : '<span class="t-status play">Play</span>';
};

export function hub(app) {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const s = streak();
  const doneAny = GAMES.some(g => resultFor(g.k));
  app.innerHTML = `<main class="screen hub">
    <header class="hub-top">
      <div class="hub-bar"><p class="eyebrow">No. ${puzzleNo()} · ${today}</p>
        <button class="me" id="me" aria-label="Account" title="Account"><svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg></button></div>
      <h1 class="display">Your daily <em>dose</em></h1>
      <div class="hub-meta">
        <span class="pill">${s ? `<b>${s}</b> day streak` : 'Start a streak today'}</span>
        <span class="pill mono" aria-label="Time until new puzzles">New in <b id="cd">${countdown()}</b></span>
      </div>
    </header>
    <ol class="tiles">
      ${GAMES.map((g, i) => `<li><button class="tile t-${g.k}" data-k="${g.k}" ${g.soon ? 'aria-disabled="true"' : ''}>
        <span class="t-no">0${i + 1}</span>
        <span class="t-body"><span class="t-name display">${g.name}</span><span class="t-line">${g.line}</span>${status(g)}</span>
        ${ART[g.k]}
      </button></li>`).join('')}
    </ol>
    ${doneAny ? '<button class="btn wide" id="share">Share today’s dose</button>' : '<p class="hint">Same puzzles for everyone. New ones at midnight UTC.</p>'}
  </main>`;

  app.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled')) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); buzz(8); return; }
    SOUNDS.tap(); buzz(); location.hash = b.dataset.k;
  }));
  app.querySelector('#me').addEventListener('click', openAccount);
  app.querySelector('#share')?.addEventListener('click', () => {
    const text = [`DAILY DOSE #${puzzleNo()}`, ...GAMES.filter(g => resultFor(g.k)).map(g => `${g.name} ${g.share(resultFor(g.k))}`), location.origin].join('\n');
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard?.writeText(text);
  });

  const cd = app.querySelector('#cd');
  const t = setInterval(() => { cd.textContent = countdown(); if (cd.textContent === '00:00:00') location.reload(); }, 1000);
  return () => clearInterval(t);
}
