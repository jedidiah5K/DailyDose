import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles.css';
import { hub } from './screens/hub.js';
import { rewire } from './screens/rewire.js';

const app = document.getElementById('app');
const SCREENS = { hub, rewire };
let cleanup = null;

// Hash routes (#rewire) so the back button and shared links work without a server.
function show() {
  const name = location.hash.slice(1);
  const go = () => { cleanup?.(); cleanup = (SCREENS[name] || hub)(app); };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go);
  else go();
}
addEventListener('hashchange', show);
show();

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
