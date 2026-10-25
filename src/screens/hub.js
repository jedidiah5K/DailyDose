import { countdown, puzzleNo } from '../lib/day.js';
import { resultFor, streak } from '../lib/store.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { shareText } from './vault.js';
import { openAccount } from './account.js';

const GAMES = [
  { k: 'last', name: 'Last Stand', line: 'Ten rounds. One mistake and you’re out.', soon: true },
  { k: 'meld', name: 'Mind Meld', line: 'Think like the world, or like your best friend.', soon: true },
  { k: 'vault', name: 'Vault', line: 'Crack today’s code in as few tries as you can.' },
];

// Small idle scenes for each tile, drawn in CSS.
const ART = {
  last: '<div class="art-last" aria-hidden="true">' + Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>',
  meld: '<div class="art-meld" aria-hidden="true"><i></i><i></i></div>',
  vault: '<div class="art-vault" aria-hidden="true"><i></i></div>',
};

const status = g => {
  if (g.soon) return '<span class="t-status soon">Soon</span>';
  const r = resultFor(g.k);
  if (!r) return '<span class="t-status play">Play</span>';
  return `<span class="t-status done">${r.won ? `Cracked in ${r.guesses.length}` : 'Locked out'}</span>`;
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
    const text = [`DAILY DOSE #${puzzleNo()}`, resultFor('vault') && shareText(resultFor('vault')).split('\n').slice(1, 2).join(''), location.origin].filter(Boolean).join('\n');
    if (navigator.share) navigator.share({ text }).catch(() => {}); else navigator.clipboard?.writeText(text);
  });

  const cd = app.querySelector('#cd');
  const t = setInterval(() => { cd.textContent = countdown(); if (cd.textContent === '00:00:00') location.reload(); }, 1000);
  return () => clearInterval(t);
}
