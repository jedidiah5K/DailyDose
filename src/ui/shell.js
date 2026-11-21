// The shared frame every game sits in: the same header, the same "How to play" pop-up and the same
// finish moment. Each game brings only its colour, its board and its rules.
import { puzzleNo, dayKey } from '../lib/day.js';

// Themed days (Job, 2026-11-15): the day's puzzles lean into one topic.
// Only Rush and Drop puzzles follow the theme, so only they show it. Friday has no music puzzles yet
// (playtest 2026-11-20: "Music Friday" over African countries read as a bug); add 5: 'Music Friday' back once it does.
const THEMES = { 1: 'Movie Monday', 4: 'Throwback Thursday' }, THEMED = ['rush', 'hilo'];
export const themeToday = () => THEMES[new Date(`${dayKey()}T12:00`).getDay()] || '';
import { icon } from './icons.js';
import { SOUNDS, buzz } from './feedback.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const gameHeader = (k, name, right = '') => `<header class="v-top gm-top g-${k}">
  <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
  <p class="gm-title">${icon(k)}<b>${name}</b><span>No. ${puzzleNo()}${themeToday() && THEMED.includes(k) ? `<small>${themeToday()}</small>` : ''}</span></p>
  <div class="gm-right">${right}<button class="gm-help" id="help" type="button" aria-label="How to play" title="How to play">?</button></div>
</header>`;

export const pageHeader = (title, label = '') => `<header class="page-top"><p class="eyebrow">${label}</p><h1 class="display">${title}</h1></header>`;

// The floating tab bar on the main screens (Today, Friends, You), with an optional round action button.
const TABS = [['today', '#', 'Today', '<path d="M5 12.5l4.5 4.5L19 7.5"/>'],
  ['friends', '#friends', 'Friends', '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.7-3.2 2.8-5 5.5-5s4.8 1.8 5.5 5"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M15.5 14.2c2.3-.3 4.3 1.2 5 4.3"/>'],
  ['me', '#me', 'You', '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>']];
export const tabBar = (active, fab = '') => `<nav class="tabbar" aria-label="Main">
  ${TABS.map(([k, href, label, d]) => `<a href="${href}" class="tab${k === active ? ' on' : ''}"${k === active ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg><span>${label}</span></a>`).join('')}
  ${fab}
</nav>`;

// How to play: a few short steps and a little animated example, like the card Wordle shows.
const HOWTO = {
  rewire: { name: 'Rewire', steps: ['Tap a tile to turn it a quarter turn.', 'Wire every building to a power plant, with no loose ends.', 'The two plants’ wires must never touch. Get close to par for three stars.'],
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
  anagram: { name: 'Anagram', steps: ['Tap the letters in order to spell the word (or type it).', 'It checks itself when every letter is placed. Tap a placed letter to take it back.', 'Five words, short to long. The clock runs until the last one; skipping costs the word.'],
    demo: `<div class="demo demo-anagram"><p><b>A</b><b>E</b><b>H</b><b>R</b><b>T</b></p><b>HEART</b></div>` },
  shot: { name: 'The Shot', steps: ['One question a day. You get 7 seconds and one try.', 'Type the answer. The boxes show how many letters it has.', 'See how many players got it, and how fast you were.'],
    demo: `<div class="demo demo-blend"><p>Capital of Australia?</p><b>CANBERRA · 4.2s</b></div>` },
  rush: { name: 'Rush', steps: ['One category, 30 seconds.', 'Type as many answers as you can, one at a time, pressing enter after each.', 'Common answers score 1, less common 2, rare ones 3.'],
    demo: `<div class="demo demo-blend"><p>US states</p><b>TEXAS · OHIO · IDAHO +3</b></div>` },
  hilo: { name: 'Drop', steps: ['Each card hides a number. Call the next card higher or lower within 7 seconds.', 'Every right call doubles your pot: 10, 20, 40, 80…', 'Bank it between cards whenever you like. One wrong call and the pot is gone.'],
    demo: `<div class="demo demo-blend"><p>Pot 80 → 160?</p><b>BANK IT · OR GO</b></div>` },
  blend: { name: 'Blend', steps: ['Five prompts, 20 seconds each. Type the first thing that fits.', '“Think like everyone”: match the answer most people give. “Think like no one”: a real answer few people give. Only the rarest answers score near 100.', 'Up to 100 points a prompt. A rare answer nobody saw coming is a 💎.'],
    demo: `<div class="demo demo-blend"><p>A fruit that’s yellow</p><b>BANANA · 71%</b></div>` },
  queue: { name: 'Queue', steps: ['Put five things in order, like oldest to youngest.', 'Tap two cards to swap them, then Serve.', 'Right spots turn green and lock. The rest show an arrow: move up or move down.', 'Five tries to get the whole queue right.'],
    demo: `<div class="demo"><p>🟩⬛⬛🟩⬛</p><p>🟩🟩⬛🟩🟩</p><p>🟩🟩🟩🟩🟩</p></div>` },
  link: { name: 'Missing Link', steps: ['One hidden word goes with every clue. It can come before or after each clue.', 'You start with one clue. Stuck? Show another, or a wrong guess shows it for you. Up to three clues, three guesses.', 'Solve it on 1 clue for 3 points, 2 clues for 2, 3 clues for 1. Each wrong guess costs a point too, so unsure? Ask for a clue.'],
    demo: `<div class="demo demo-link"><p><span>STAR</span><span>TRAFFIC</span><span>HOUSE</span></p><b>LIGHT</b></div>` },
};

export function howTo(k) {
  const h = HOWTO[k]; if (!h) return;
  const d = document.createElement('dialog'); d.className = 'howto';
  d.innerHTML = `<div class="ht-in g-${k}">
    <button class="ht-x" aria-label="Close" title="Close">✕</button>
    <p class="eyebrow">How to play</p><h2 class="display">${h.name}</h2>
    ${h.demo}
    <ol>${h.steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <p class="ht-foot">A new puzzle every night at midnight, in your time zone.</p>
    <button class="btn wide" data-go>Got it</button></div>`;
  document.body.appendChild(d);
  const close = () => { d.classList.add('out'); setTimeout(() => d.remove(), calm() ? 0 : 220); };
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('.ht-x,[data-go]')) { SOUNDS.tap(); close(); } });
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  d.showModal();
}

// The "?" button, and the first visit to each game opens the pop-up by itself.
export function wireHelp(app, k) {
  const help = app.querySelector('#help');
  help?.addEventListener('click', () => { SOUNDS.tap(); howTo(k); });
  // no pop-up on a first visit any more: the intro card already explains the game, and two screens
  // before playing was one too many (playtest 2026-11-20). The "?" opens it any time.
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

// Messages pop up at the top, where the phone keyboard can't cover them, then fade.
export function toaster(el) {
  let t = 0;
  return msg => { el.textContent = msg; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); clearTimeout(t); if (msg) t = setTimeout(() => { el.textContent = ''; }, 2800); };
}

// Numbers roll up to their value instead of jumping.
export function roll(el, to = +el.dataset.to) {
  if (!el) return;
  const from = +el.textContent || 0, t0 = performance.now();
  if (calm()) { el.textContent = to; return; }
  const f = t => { const x = Math.min(1, (t - t0) / 600); el.textContent = Math.round(from + (to - from) * (1 - (1 - x) ** 3)); if (x < 1 && el.isConnected) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

export const esc = s => String(s ?? '').replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`);

// Answers are stored lowercase without punctuation ("mcdonalds"); this is how they're written on screen.
// Unlisted answers just get capital letters (shortcut: add brand names here as content needs them).
const SPELL = { mcdonalds: 'McDonald’s', wendys: 'Wendy’s', 'in n out': 'In-N-Out', dominos: 'Domino’s', arbys: 'Arby’s', 'carls jr': 'Carl’s Jr.',
  hardees: 'Hardee’s', nandos: 'Nando’s', 'papa johns': 'Papa John’s', culvers: 'Culver’s', 'chick fil a': 'Chick-fil-A', hersheys: 'Hershey’s',
  reeses: 'Reese’s', 'reeses puffs': 'Reese’s Puffs', 'reeses pieces': 'Reese’s Pieces', kelloggs: 'Kellogg’s', levis: 'Levi’s', dvds: 'DVDs',
  mcgonagall: 'McGonagall', mclaren: 'McLaren', mcfly: 'McFly', mcflurry: 'McFlurry', mcchicken: 'McChicken', mcrib: 'McRib', mcdouble: 'McDouble',
  'ed edd n eddy': 'Ed, Edd n Eddy', 'cap n crunch': 'Cap’n Crunch', 'bowser jr': 'Bowser Jr.', iphone: 'iPhone', ipad: 'iPad', youtube: 'YouTube', tiktok: 'TikTok' };
const WORD = { dont: 'don’t', cant: 'can’t', wont: 'won’t', im: 'I’m', ive: 'I’ve', youre: 'you’re', didnt: 'didn’t', isnt: 'isn’t', doesnt: 'doesn’t', thats: 'that’s' };
const NOT_ACRONYM = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'vs']);
export const nice = s => { s = String(s ?? '').trim(); const k = s.toLowerCase();
  return SPELL[k] || s.split(' ').map(w => { const l = w.toLowerCase();
    if (WORD[l]) return WORD[l][0].toUpperCase() + WORD[l].slice(1);
    if (/^[bcdfghjklmnpqrstvwxz]{2,4}$/.test(l) && !NOT_ACRONYM.has(l)) return l.toUpperCase();
    return w && w[0].toUpperCase() + w.slice(1); }).join(' '); };

// A draining bar for timed games: calls done() once when it hits zero. Returns stop().
export function timerBar(bar, secs, endAt, total, done) {
  const step = () => {
    const left = Math.max(0, endAt - Date.now());
    bar.style.transform = `scaleX(${left / total})`; if (secs) secs.textContent = `${Math.ceil(left / 1000)}s`;
    if (left < Math.min(5000, total / 3)) bar.parentElement.classList.add('low');
    if (left <= 0) { clearInterval(id); done(); }
  };
  const id = setInterval(step, 100); step();
  return () => clearInterval(id);
}
