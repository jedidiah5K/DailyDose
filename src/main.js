import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles.css';
import { countdown, dayKey } from './lib/day.js';
import { hub } from './screens/hub.js';
import { rewire } from './screens/rewire.js';
import { hunch } from './screens/hunch.js';
import { drop } from './screens/drop.js';
import { meld } from './screens/meld.js';
import { last } from './screens/last.js';
import { me } from './screens/me.js';
import { friends } from './screens/friends.js';
import { state, save, mergeResults } from './lib/store.js';
import { hasAccount, myResults } from './lib/cloud.js';
import { BADGES, earned, badgeArt } from './lib/badges.js';
import { SOUNDS, buzz } from './ui/feedback.js';

const app = document.getElementById('app');
const SCREENS = { hub, rewire, hunch, drop, meld, last, me, friends };
let cleanup = null;

// Hash routes (#rewire) so the back button and shared links work without a server.
function show() {
  const name = location.hash.slice(1);
  let ran = false;
  const go = () => { if (ran) return; ran = true; cleanup?.(); cleanup = (SCREENS[name] || hub)(app); };
  // The cross-fade is a nice-to-have: if the browser skips it (page in the background, low memory),
  // draw the screen anyway.
  if (document.startViewTransition && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const vt = document.startViewTransition(go);
    vt.ready.catch(() => {}); vt.finished.catch(() => {}).finally(go);
    setTimeout(go, 400);   // a stalled transition must never leave the old screen up
  } else go();
}
addEventListener('hashchange', show);

// Every countdown on screen ([data-cd]) ticks from here; at midnight UTC the new puzzles load.
// Checked by date, not by the exact second, so a phone that slept through midnight still catches up.
const bootDay = dayKey();
let reloading = false;
setInterval(() => {
  const t = countdown();
  document.querySelectorAll('[data-cd]').forEach(el => { el.textContent = t; });
  if (dayKey() !== bootDay && !reloading) { reloading = true; setTimeout(() => location.reload(), 1500); }
}, 1000);
show();

// Badges: a finished game can earn one, and each new badge gets a small moment (then lives on the You
// screen). The first run just remembers what's already earned.
if (!state.badges) { state.badges = [...earned(state.results)]; save(); }
addEventListener('dose:finish', () => {
  const fresh = [...earned(state.results)].filter(id => !state.badges.includes(id));
  if (!fresh.length) return;
  state.badges.push(...fresh); save();
  fresh.forEach((id, i) => setTimeout(() => badgeToast(BADGES.find(b => b.id === id)), 2400 + i * 3200));
});
function badgeToast(b) {
  const t = document.createElement('a'); t.className = 'badge-toast'; t.href = '#me'; t.setAttribute('role', 'status');
  t.innerHTML = `${badgeArt(b, true)}<span><span class="eyebrow">New badge</span><b>${b.name}</b></span>`;
  document.body.appendChild(t); SOUNDS.chime(); buzz(20);
  setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 4800);
}

// Games finished on another phone (or before a reinstall) come back from the server; badges earned
// there arrive quietly. Never makes a guest account just to look.
hasAccount().then(ok => ok && myResults()).then(rows => {
  if (!rows || !mergeResults(rows)) return;
  state.badges = [...new Set([...state.badges, ...earned(state.results)])]; save();
  if (!location.hash) show();
}).catch(() => {});

// Updates: the new version installs in the background; when it takes over, offer a one-tap refresh.
// Coming back to the app checks for a newer version.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || document.querySelector('.update')) return;   // first install isn't an update
    const t = document.createElement('div'); t.className = 'update'; t.setAttribute('role', 'status');
    t.innerHTML = '<span>A new version of Daily Dose is ready</span><button>Refresh</button>';
    t.querySelector('button').addEventListener('click', () => location.reload());
    document.body.appendChild(t);
  });
}
