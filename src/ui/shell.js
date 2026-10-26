// The shared frame every game sits in: the same header, the same "How to play" pop-up and the same
// finish moment. Each game brings only its colour, its board and its rules.
import { puzzleNo } from '../lib/day.js';
import { icon } from './icons.js';
import { SOUNDS, buzz } from './feedback.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const gameHeader = (k, name, right = '') => `<header class="v-top gm-top g-${k}">
  <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
  <p class="gm-title">${icon(k)}<b>${name}</b><span>No. ${puzzleNo()}</span></p>
  <div class="gm-right">${right}<button class="gm-help" id="help" type="button" aria-label="How to play" title="How to play">?</button></div>
</header>`;

export const pageHeader = title => `<header class="v-top gm-top">
  <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
  <p class="gm-title"><b>${title}</b></p><span></span>
</header>`;

// How to play: a few short steps and a little animated example, like the card Wordle shows.
const HOWTO = {
  rewire: { name: 'Rewire', steps: ['Tap a tile to turn it a quarter turn.', 'Wire every building to a power plant, with no loose ends.', 'The two plants’ wires must never touch. Par is the fewest taps.'],
    demo: `<div class="demo demo-rewire"><span class="dt plant"></span><span class="dt wire"><i></i></span><span class="dt bld"></span></div>` },
  hunch: { name: 'Hunch', steps: ['Slide to your guess.', 'Bet on how sure you are: a tight band scores big, a wide one is safer.', 'Points only if the answer lands inside your band.'],
    demo: `<div class="demo demo-hunch"><div class="dh-track"><span class="dh-band"></span><span class="dh-ans"></span></div><b class="dh-pts">+50</b></div>` },
  tangle: { name: 'Tangle', steps: ['Drag the dots around the board.', 'Untangle the strings so no two of them cross.', 'The clock stops when every string is clear.'],
    demo: `<div class="demo"><svg class="demo-tangle" viewBox="0 0 120 70"><line x1="15" y1="15" x2="105" y2="55"/>
      <line x1="15" y1="55" x2="105" y2="15"><animate attributeName="x1" values="15;15;60;60" keyTimes="0;.25;.55;1" dur="3.2s" repeatCount="indefinite"/><animate attributeName="y1" values="55;55;6;6" keyTimes="0;.25;.55;1" dur="3.2s" repeatCount="indefinite"/></line>
      <circle cx="15" cy="15" r="5"/><circle cx="105" cy="55" r="5"/><circle cx="105" cy="15" r="5"/>
      <circle class="mover" cx="15" cy="55" r="5"><animate attributeName="cx" values="15;15;60;60" keyTimes="0;.25;.55;1" dur="3.2s" repeatCount="indefinite"/><animate attributeName="cy" values="55;55;6;6" keyTimes="0;.25;.55;1" dur="3.2s" repeatCount="indefinite"/></circle></svg></div>` },
  ladder: { name: 'Ladder', steps: ['Change one letter at a time.', 'Every step has to be a real word.', 'Reach the bottom word in as few steps as you can.'],
    demo: `<div class="demo demo-ladder"><p><b>C</b><b>O</b><b>L</b><b>D</b></p><p><b>C</b><b>O</b><b class="n">R</b><b>D</b></p><p><b class="n">W</b><b>O</b><b>R</b><b>D</b></p></div>` },
  link: { name: 'Missing Link', steps: ['Three clue words, one hidden word that goes with all of them.', 'Type the link. You get three tries for each one.', 'Five links a night. Fewer tries and less time score higher.'],
    demo: `<div class="demo demo-link"><p><span>SUN</span><span>MOON</span><span>CANDLE</span></p><b>LIGHT</b></div>` },
};

export function howTo(k) {
  const h = HOWTO[k]; if (!h) return;
  const d = document.createElement('dialog'); d.className = 'howto';
  d.innerHTML = `<div class="ht-in g-${k}">
    <button class="ht-x" aria-label="Close" title="Close">✕</button>
    <p class="eyebrow">How to play</p><h2 class="display">${h.name}</h2>
    ${h.demo}
    <ol>${h.steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <p class="ht-foot">A new puzzle every night at midnight UTC, the same for everyone.</p>
    <button class="btn wide" data-go>Got it</button></div>`;
  document.body.appendChild(d);
  const close = () => { d.classList.add('out'); setTimeout(() => d.remove(), calm() ? 0 : 220); };
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('.ht-x,[data-go]')) { SOUNDS.tap(); close(); } });
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  d.showModal();
}

// The "?" button, and the first visit to each game opens the pop-up by itself.
export function wireHelp(app, k) {
  app.querySelector('#help')?.addEventListener('click', () => { SOUNDS.tap(); howTo(k); });
  try { if (!localStorage.getItem(`dose:seen:${k}`)) { localStorage.setItem(`dose:seen:${k}`, '1'); setTimeout(() => howTo(k), 350); } } catch (e) {}
}

// Finish: a burst of sparks in the game's colour from the middle of the screen.
export function burst(color) {
  buzz(30);
  if (calm()) return;
  const box = document.createElement('div'); box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2, r = 90 + (i % 5) * 28;
    return `<i style="--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r - 40).toFixed(0)}px;--c:${i % 3 ? color : 'var(--ink)'};--d:${(i % 7) * 18}ms"></i>`;
  }).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1400);
}
