// Sound and haptics, ported from KeepUp. Synthesised with Web Audio (no files),
// which mixes over music on iPhone, so playing never pauses anyone's playlist.
import { state } from '../lib/store.js';

const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let hapEl = null;
export function buzz(ms = 12) {
  if (!state.settings.haptics) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(ms); return; }
    if (!IOS) return;
    if (!hapEl) {
      hapEl = document.createElement('label'); hapEl.setAttribute('aria-hidden', 'true');
      hapEl.style.cssText = 'position:fixed;left:-200px;top:0;opacity:0;pointer-events:none';
      hapEl.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(hapEl);
    }
    hapEl.click();
  } catch (e) {}
}

let ctx = null, master = null;
function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 1;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 12;
    master.connect(lim).connect(ctx.destination);
  }
  if (ctx.state !== 'running') ctx.resume();
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true, capture: true }));

function tone(freq, at = 0, len = .15, type = 'sine', vol = .12, slide) {
  const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + len);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + len);
  o.connect(g).connect(master); o.start(t0); o.stop(t0 + len + .02);
}
function noise(at = 0, len = .05, vol = .08, freq = 3000) {
  const t0 = ctx.currentTime + at, n = Math.floor(ctx.sampleRate * len), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f).connect(g).connect(master); s.start(t0);
}
const play = fn => (...a) => { if (!state.settings.sounds) return; unlock(); if (ctx) fn(...a); };

// Notes climb a pentatonic scale, so lighting a city plays a little tune.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
export const SOUNDS = {
  tap: play(() => tone(1500, 0, .05, 'sine', .04)),
  // a tile clicking round a quarter turn
  turn: play(() => { noise(0, .02, .12, 3200); tone(1900, 0, .03, 'triangle', .025); }),
  // another building joins the circuit: a small rising blip
  link: play(n => { const f = SCALE[Math.min(n, SCALE.length - 1)]; tone(f * .5, 0, .14, 'triangle', .08, f); }),
  // the whole grid powers up: a low electric hum swelling under everything
  hum: play(() => { tone(55, 0, 1.6, 'sawtooth', .05, 110); tone(110, 0, 1.4, 'sine', .14, 220); noise(0, .3, .06, 6000); }),
  light: play(k => tone(SCALE[k % SCALE.length], 0, .5, 'triangle', .07)),
  // Hunch: a soft notch as the slider moves, a thunk to lock in, a ding as the answer drops
  tick: play(() => tone(2400, 0, .02, 'sine', .02)),
  lock: play(() => { tone(160, 0, .14, 'sine', .22, 90); noise(0, .04, .06, 1200); }),
  drop: play(() => { tone(1318.5, 0, .5, 'triangle', .08); tone(1975.5, .03, .4, 'sine', .03); }),
  chime: play(() => [783.99, 1046.5, 1318.51].forEach((f, i) => tone(f, i * .07, .6, 'triangle', .06))),
  // Drop: a whoosh as the ball leaves, a bright drop into the cup, a soft thud on a miss
  launch: play(() => { noise(0, .18, .05, 1400); tone(320, 0, .18, 'sine', .06, 640); }),
  sink: play(() => { tone(880, 0, .12, 'triangle', .1); tone(1318.5, .08, .5, 'triangle', .09); tone(1760, .16, .6, 'sine', .05); noise(0, .05, .1, 5000); }),
  miss: play(() => { tone(220, 0, .25, 'sine', .12, 150); }),
  ok: play(() => { tone(988, 0, .1, 'triangle', .1); tone(1480, .05, .14, 'sine', .05); }),
};
