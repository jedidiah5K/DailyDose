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

const app = document.getElementById('app');
const SCREENS = { hub, rewire, hunch, drop };
let cleanup = null;

// Hash routes (#rewire) so the back button and shared links work without a server.
function show() {
  const name = location.hash.slice(1);
  const go = () => { cleanup?.(); cleanup = (SCREENS[name] || hub)(app); };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go);
  else go();
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
