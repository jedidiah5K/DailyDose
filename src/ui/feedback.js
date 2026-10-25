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
const play = fn => () => { if (!state.settings.sounds) return; unlock(); if (ctx) fn(); };

export const SOUNDS = {
  tap: play(() => tone(1500, 0, .05, 'sine', .04)),
  // a dial tooth clicking over: short filtered tick + tiny metal ring
  click: play(() => { noise(0, .025, .18, 4200); tone(2600, 0, .04, 'triangle', .03); }),
  clunk: play(() => { tone(90, 0, .22, 'sine', .3, 50); noise(0, .08, .12, 900); }),
  near: play(() => tone(740, 0, .12, 'triangle', .08)),
  exact: play(() => { tone(988, 0, .1, 'triangle', .1); tone(1480, .05, .14, 'sine', .05); }),
  open: play(() => {
    [0, .09, .18, .27].forEach((t, i) => { noise(t, .05, .2, 1800); tone(120 - i * 10, t, .12, 'sine', .2); });
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .55 + i * .07, .7, 'triangle', .08));
  }),
  alarm: play(() => { for (let i = 0; i < 4; i++) tone(880, i * .28, .22, 'square', .05, 620); }),
};
