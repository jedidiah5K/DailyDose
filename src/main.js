import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles.css';
import { countdown } from './lib/day.js';
import { hub } from './screens/hub.js';
import { rewire } from './screens/rewire.js';
import { hunch } from './screens/hunch.js';
import { drop } from './screens/drop.js';
import { meld } from './screens/meld.js';
import { last } from './screens/last.js';

const app = document.getElementById('app');
const SCREENS = { hub, rewire, hunch, drop, meld, last };
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
setInterval(() => {
  const t = countdown();
  document.querySelectorAll('[data-cd]').forEach(el => { el.textContent = t; });
  if (t === '00:00:00') setTimeout(() => location.reload(), 1500);
}, 1000);
show();

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
