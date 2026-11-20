import { countdown, puzzleNo, dayKey } from '../lib/day.js';
import { state, save, resultFor, streak } from '../lib/store.js';
import { playingToday, hasAccount, getMe } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { tabBar, burst } from '../ui/shell.js';
import { ladderLine } from './ladder.js';
import { linkLine } from './link.js';
import { blendLine } from './blend.js';
import { shotLine } from './shot.js';
import { rushLine } from './rush.js';
import { dropLine } from './drop.js';
import { shareDose } from '../ui/card.js';
import { openAccount } from './account.js';
import { sb } from '../lib/cloud.js';

// The lineup, in counter order. New games plug in here: a key, a screen in main.js, a result line, a mug.
export const GAMES = [
  { k: 'shot', name: 'The Shot', c: '#FFC93C', share: r => `🎯 ${shotLine(r)}` },
  { k: 'rush', name: 'Rush', c: '#F0452B', share: r => `⏱️ ${rushLine(r)}` },
  { k: 'blend', name: 'Blend', c: '#FF8A5B', share: r => `🥤 ${blendLine(r)}` },
  { k: 'hilo', name: 'Drop', c: '#1F9A5D', share: r => `💰 ${dropLine(r)}` },
  { k: 'link', name: 'Missing Link', c: '#3D6FD9', share: r => `🔗 ${linkLine(r)}` },
  { k: 'ladder', name: 'Ladder', c: '#EFE3C8', share: r => `🪜 ${ladderLine(r)}` },
];
// Each game's mug and coaster in the art sheet, and where its rim is centred (handles push the picture off-centre).
const ART = { shot: 1, blend: 2, rush: 3, hilo: 4, link: 5, ladder: 6 };
const RIM = { shot: .498, blend: .447, rush: .393, hilo: .393, link: .388, ladder: .498 };
const SHOW_PLAYERS_FROM = 25;   // below this many players we keep quiet; "3 playing" reads like an empty room
const A = '/art/home/';
const esc = s => String(s).replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`);

// One layout per screen shape, in the background picture's own pixels. Sprites sit on their bottom-centre
// point [x, y] at a scale (the sprite files are stored at half size, so scales are doubled).
const TALL = { w: 981, h: 1602, sign: [490, 600, 1.24], man: [268, 1076, 1.84], woman: [520, 1076, 1.84], teen: [765, 1076, 1.84],
  dog: [84, 1066, .92], mach: [490, 1342, 1.16], cat: [840, 1262, 1], mug: .88, co: .8, row: 1392, slots: [80, 212, 344, 636, 768, 900],
  button: [200, 1422, 580, 128], foot: [1566, 23], ico: [26, 20, 100], live: 640 };
// the -x pictures are the same scene painted further out on every side (tools/extend-bg.py), so wide
// or tall screens show more café instead of blurry bands: top, each side, bottom, in picture pixels
const EXT = { wide: [300, 600, 300], tall: [400, 300, 600] };
const WIDE = { w: 1672, h: 941, sign: [836, 330, .8], man: [612, 664, 1.56], woman: [836, 664, 1.56], teen: [1062, 664, 1.56],
  dog: [420, 656, .76], mach: [836, 814, .92], cat: [1400, 776, .84], mug: .72, co: .68, row: 814, slots: [400, 545, 690, 982, 1127, 1272],
  button: [606, 830, 460, 94], foot: [928, 12], ico: [22, 14, 66], live: 362 };

export function hub(app) {
  const today = dayKey(), s = streak(), wide = innerWidth > innerHeight, L = wide ? WIDE : TALL;
  const x = EXT[wide ? 'wide' : 'tall'], hr = new Date().getHours(), bg = `${wide ? 'wide' : 'tall'}-${hr >= 6 && hr < 18 ? 'day' : 'night'}`;
  const open = g => !resultFor(g.k) && state.progress[g.k]?.day === today;
  const next = GAMES.find(open) || GAMES.find(g => !resultFor(g.k));
  // drinks you haven't seen served yet get handed over now
  const seen = state.stickersSeen?.day === today ? state.stickersSeen.k : [];
  const fresh = GAMES.filter(g => resultFor(g.k) && !seen.includes(g.k)).map(g => g.k);

  app.innerHTML = `<main class="screen hub cafe-home has-tabs">
    <div class="ch-blur" style="background-image:url(${A}${bg}.webp)" aria-hidden="true"></div>
    <div class="ch-fit"><div class="ch-st" id="st" style="width:${L.w}px;height:${L.h}px">
      <img class="ch-ext" src="${A}${bg}-x.webp" alt="" style="left:${-x[1]}px;top:${-x[0]}px;width:${L.w + 2 * x[1]}px;height:${L.h + x[0] + x[2]}px">
      <h1 class="sr-only">Daily Dose</h1>
    </div></div>
    ${tabBar('today')}
  </main>`;
  const st = app.querySelector('#st'), fit = app.querySelector('.ch-fit');
  const timers = [], every = (f, ms) => timers.push(setInterval(f, ms)), later = (f, ms) => timers.push(setTimeout(f, ms));
  let gone = false, coffee = null;
  const place = () => { st.style.transform = `translate(-50%,-50%) scale(${Math.min(fit.clientWidth / L.w, fit.clientHeight / L.h)})`; };
  // turning the phone swaps to the other layout: just draw the home screen again
  const onResize = () => { if ((innerWidth > innerHeight) !== wide) dispatchEvent(new HashChangeEvent('hashchange')); else place(); };
  addEventListener('resize', onResize); place();

  const I = {};
  const load = n => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => r(I[n] = i); i.src = `${A}${n}.webp`; });
  const names = ['sign_1', 'lever_1', 'lever_2', 'lever_5', 'lever_7', 'lever_8', 'fx_5', 'btn_2', 'btn_3', 'btn_4',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => 'face_' + i), ...[1, 2, 3, 4, 5].map(i => 'malt_' + i),
    'cat_1', 'cat_2', 'cat_3', 'cat_4', 'cat_6', ...[1, 2, 3, 4, 5, 6].map(i => 'coaster_' + i), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => 'mug_' + i)];

  // put an image so its bottom-centre sits at (x, y); swap() changes pose and keeps that point
  function put(n, [x, y, sc], z, cls = '') {
    const src = I[n], el = new Image(), w = src.naturalWidth * sc, h = src.naturalHeight * sc;
    el.src = src.src; el.alt = ''; el.className = 'ch-sp ' + cls; el._a = [x, y, sc];
    Object.assign(el.style, { left: x - w / 2 + 'px', top: y - h + 'px', width: w + 'px', height: h + 'px', zIndex: z });
    st.appendChild(el); return el;
  }
  function swap(el, n) {
    const f = I[n], [x, y, sc] = el._a, w = f.naturalWidth * sc, h = f.naturalHeight * sc;
    el.src = f.src; Object.assign(el.style, { left: x - w / 2 + 'px', top: y - h + 'px', width: w + 'px', height: h + 'px' });
  }

  Promise.all(names.map(load)).then(() => { if (!gone) build(); });

  function build() {
    put('sign_1', L.sign, 3, 'ch-bob');
    // the regulars at the window; their pictures are cut flat at the waist, right on the counter edge
    const man = put('face_1', L.man, 4, 'ch-bob'), woman = put('face_5', L.woman, 4, 'ch-bob'), teen = put('face_9', L.teen, 4, 'ch-bob');
    woman.style.animationDelay = '.8s'; teen.style.animationDelay = '1.5s';
    const crowd = [[man, 1], [woman, 5], [teen, 9]], face = (el, n) => swap(el, 'face_' + n);   // idle, happy, talking, blink
    every(() => { const [el, b] = crowd[Math.random() * 3 | 0]; if (el.dataset.busy) return; face(el, b + 2); later(() => face(el, b), 450); }, 2600);
    crowd.forEach(([el, b], i) => every(() => { if (el.dataset.busy) return; face(el, b + 3); later(() => face(el, b), 140); }, 3100 + i * 900));

    const dog = put('malt_1', L.dog, 4, 'ch-tap'), pup = n => swap(dog, 'malt_' + n);
    let dogBusy = false;
    dog.setAttribute('role', 'button'); dog.setAttribute('aria-label', 'Pet the dog');
    every(() => { if (dogBusy) return; pup(3); later(() => pup(4), 200); later(() => pup(3), 400); later(() => pup(1), 600); }, 3400);
    every(() => { if (dogBusy) return; dogBusy = true; pup(5); later(() => { pup(1); dogBusy = false; }, 7000); }, 26000);
    dog.addEventListener('click', () => { dogBusy = true; pup(2); buzz(10); later(() => { pup(1); dogBusy = false; }, 1200); });

    const mach = put('lever_1', L.mach, 6, 'ch-drop');
    const cat = put('cat_1', L.cat, 7, 'ch-tap'), zz = put('cat_6', [0, 0, L.cat[2] * .7], 7, 'ch-zzz');
    cat.setAttribute('role', 'button'); cat.setAttribute('aria-label', 'Wake the cat');
    const cw = parseFloat(cat.style.width);
    Object.assign(zz.style, { left: parseFloat(cat.style.left) + cw * .62 + 'px', top: parseFloat(cat.style.top) - cw * .28 + 'px' });
    let catAwake = false, breath = 0;
    every(() => { if (!catAwake) swap(cat, ++breath % 2 ? 'cat_2' : 'cat_1'); }, 1300);
    cat.addEventListener('click', () => { if (catAwake) return; catAwake = true; zz.style.opacity = 0; swap(cat, 'cat_3'); buzz(8);
      later(() => swap(cat, 'cat_4'), 1400); later(() => { swap(cat, 'cat_1'); catAwake = false; zz.style.opacity = ''; }, 2600); });

    // menu and sound on the awning
    const [ix, iy, is] = L.ico;
    const icon = (side, n, label) => { const b = document.createElement('button'); b.className = 'ch-ico'; b.setAttribute('aria-label', label); b.title = label;
      b.style.cssText = `${side}:${ix}px;top:${iy}px;width:${is}px;height:${is * .975}px;background-image:url(${A}${n}.webp)`; st.appendChild(b); return b; };
    icon('left', 'btn_2', 'About').addEventListener('click', () => { SOUNDS.tap(); about(); });
    const snd = icon('right', state.settings.sounds ? 'btn_3' : 'btn_4', 'Sound');
    snd.setAttribute('aria-pressed', String(!state.settings.sounds));
    snd.addEventListener('click', () => { state.settings.sounds = !state.settings.sounds; save(); SOUNDS.tap();
      snd.style.backgroundImage = `url(${A}${state.settings.sounds ? 'btn_3' : 'btn_4'}.webp)`; snd.setAttribute('aria-pressed', String(!state.settings.sounds)); });

    // guests: a Sign up / Log in pill on the awning, between the menu and sound buttons (Job, 2026-11-16:
    // "easier to find the register"). Hidden once you have an account.
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user; if (gone || (u && !u.is_anonymous)) return;
      const acc = document.createElement('div'); acc.className = 'ch-acct';
      acc.style.cssText = `top:${iy + is * .12}px;height:${is * .76}px;font-size:${is * .27}px`;
      acc.innerHTML = '<button type="button" data-m="new">Sign up</button><button type="button" data-m="in">Log in</button>';
      acc.addEventListener('click', e => { const b = e.target.closest('button'); if (b) openAccount(b.dataset.m); });
      st.appendChild(acc);
    }).catch(() => {});

    // the Pull button and the footer line in the dark strip
    const [bx, by, bw, bh] = L.button;
    const pull = document.createElement('button'); pull.className = 'ch-pull ch-drop';
    pull.style.cssText = `left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;font-size:${bh * .27}px;padding:0 ${bw * .13}px`;
    pull.innerHTML = '<span></span>'; st.appendChild(pull); const label = pull.firstChild;
    const foot = document.createElement('p'); foot.className = 'ch-foot ch-drop';
    foot.style.cssText = `top:${L.foot[0]}px;font-size:${L.foot[1]}px`;
    foot.innerHTML = `No. ${puzzleNo()}${s ? ` · ${s}-day streak` : ''} · New shots in <span data-cd>${countdown()}</span>`;
    st.appendChild(foot);
    const live = document.createElement('p'); live.className = 'ch-live'; live.hidden = true; live.style.top = L.live + 'px'; st.appendChild(live);

    // the mugs: empty until you play, full once you've finished; the chosen one waits under the spout
    const mb = { x: parseFloat(mach.style.left), y: parseFloat(mach.style.top), w: parseFloat(mach.style.width), h: parseFloat(mach.style.height) };
    const SPOUT = { x: mb.x + mb.w * .49, y: mb.y + mb.h * .8 }, UNDER = .62;
    const cups = GAMES.map((g, k) => {
      const a = ART[g.k], done = !!resultFor(g.k);
      const co = put('coaster_' + a, [L.slots[k], L.row, L.co], 9);
      const src = I['mug_' + (a + (done ? 6 : 0))], w = src.naturalWidth * L.mug, h = src.naturalHeight * L.mug;
      const x = L.slots[k] - w * RIM[g.k], y = L.row - parseFloat(co.style.height) * .45 - h;
      const b = document.createElement('button'); b.className = 'ch-mug' + (done ? ' done' : '');
      b.setAttribute('aria-label', done ? `${g.name}, finished: see your result` : `${g.name}${open(g) ? ', unfinished' : ''}`);
      b.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform-origin:${RIM[g.k] * 100}% 100%;--d:${k * .7}s`;
      const img = new Image(); img.src = src.src; img.alt = ''; b.appendChild(img); st.appendChild(b);
      if (done) { // a gold tick on the coaster: this one's finished
        const t = document.createElement('i'); t.className = 'ch-tick'; t.textContent = '✓'; const cw = parseFloat(co.style.width);
        t.style.cssText = `left:${L.slots[k] + cw * .22}px;top:${L.row - parseFloat(co.style.height) * 1.1}px;font-size:${cw * .32}px`; st.appendChild(t);
      }
      const c = { g, b, img, co, x, y, w, h, done };
      b.addEventListener('click', () => { hint?.remove(); try { localStorage.setItem('dose:seen:mugs', '1'); } catch (e) {} done ? go(c) : pick(c); }); return c;
    });
    // first visit: point at the mugs until one gets tapped
    let hint = null;
    try { if (!localStorage.getItem('dose:seen:mugs')) {
      const first = cups.find(c => !c.done && c.g !== next) || cups[0];
      hint = document.createElement('p'); hint.className = 'ch-hint'; hint.textContent = 'Tap a mug to pick a game';
      hint.style.cssText = `left:${Math.min(Math.max(first.x + first.w / 2, L.w * .32), L.w * .68)}px;top:${first.y - L.mug * 70}px;font-size:${L.foot[1] * 1.5}px`;
      hint.style.setProperty('--tx', `${first.x + first.w / 2 - Math.min(Math.max(first.x + first.w / 2, L.w * .32), L.w * .68)}px`);
      st.appendChild(hint);
    } } catch (e) {}
    const at = c => `translate(${SPOUT.x - (c.x + c.w * RIM[c.g.k])}px,${SPOUT.y - (c.y + c.h)}px) scale(${UNDER})`;
    let sel = null, busy = false;
    function pick(c, quiet) {
      if (busy) return;
      if (sel && sel !== c) { sel.b.style.transform = ''; sel.b.classList.remove('sel'); }
      sel = c; c.b.classList.add('sel'); c.b.style.transform = at(c); if (!quiet) SOUNDS.tap();
      label.textContent = `${open(c.g) ? 'Resume' : 'Pull'} ${c.g.name}`;
    }
    const go = c => { SOUNDS.tap(); buzz(); location.hash = '#' + c.g.k; };

    pull.addEventListener('click', () => {
      if (busy) return;
      if (!sel) { SOUNDS.tap(); shareDose('story').then(r => { if (r !== 'saved' || gone) return;   // no share sheet (desktop): say what happened
        const m = document.createElement('p'); m.className = 'ch-hint ch-complete'; m.innerHTML = 'Card saved!<small>Text copied too: paste it anywhere</small>';
        m.style.cssText = `left:${L.w / 2}px;top:${by - bh * .4}px;font-size:${L.foot[1] * 2}px`; st.appendChild(m); later(() => m.remove(), 2600); }); return; }
      busy = true; const c = sel; SOUNDS.tap(); buzz(30);
      swap(mach, 'lever_2'); later(() => swap(mach, 'lever_1'), 1100);
      // a thin espresso stream into the mug, then steam
      const top = mb.y + mb.h * .6, d = document.createElement('i'); d.className = 'ch-drip';
      d.style.cssText = `left:${SPOUT.x - mb.w * .012}px;top:${top}px;width:${mb.w * .024}px;height:${SPOUT.y - c.h * UNDER - top}px`;
      st.appendChild(d);
      later(() => { d.remove(); c.img.src = I['mug_' + (ART[c.g.k] + 6)].src; SOUNDS.ok?.();
        ['lever_7', 'lever_8', 'lever_5'].forEach((n, i) => later(() => { const p = put(n, [SPOUT.x + (i - 1) * mb.w * .1, SPOUT.y - c.h * UNDER, L.mug * .5], 17, 'ch-puff'); later(() => p.remove(), 1100); }, i * 140)); }, 800);
      // the dive: the counter drops away and you fall into the coffee itself, swirling out from the mug's rim
      later(() => {
        st.querySelectorAll('.ch-mug:not(.sel), .ch-drop').forEach(e => e.style.translate = `0 ${L.h}px`);
        cups.forEach(x => x.co.style.translate = `0 ${L.h}px`); cat.style.translate = zz.style.translate = `0 ${L.h}px`;
        const r = c.b.getBoundingClientRect();
        coffee = document.createElement('div'); coffee.className = 'ch-coffee'; coffee.setAttribute('aria-hidden', 'true');
        coffee.style.setProperty('--x', `${r.left + r.width * RIM[c.g.k]}px`); coffee.style.setProperty('--y', `${r.top + r.height * .16}px`);
        coffee.innerHTML = '<i></i>'; document.body.appendChild(coffee);
        requestAnimationFrame(() => requestAnimationFrame(() => coffee.classList.add('on')));
      }, 1300);
      later(() => { location.hash = '#' + c.g.k; }, 2100);
    });

    if (next) pick(cups[GAMES.indexOf(next)], true); else label.textContent = 'Get your dose card';
    // a drink you just finished gets served: it slides from the spout to its coaster and the next regular
    // in the queue beams (the man, then the woman, then the teen, round again)
    const beam = (i, ms) => { const [el, b] = crowd[i], pos = [L.man, L.woman, L.teen][i];
      el.dataset.busy = 1; face(el, b + 1);
      const p = put('fx_5', [pos[0], pos[1] - parseFloat(el.style.height) * .95, L.mug * .8], 8, 'ch-puff');
      later(() => { face(el, b); delete el.dataset.busy; p.remove(); }, ms); };
    if (fresh.length) {
      const c = cups.find(x => x.g.k === fresh[0]), served = GAMES.filter(g => resultFor(g.k)).length;
      c.b.style.transition = 'none'; c.b.style.transform = at(c); void c.b.offsetWidth; c.b.style.transition = '';
      later(() => { c.b.style.transform = ''; SOUNDS.ok?.(); buzz(18); beam((served - 1) % 3, 1600); }, 450);
      // the last of the six: the café's one big moment. Everyone cheers, sparks, a sign over the counter.
      if (!next) later(() => {
        hint?.remove(); SOUNDS.fanfare(); burst('#F2A93B'); [0, 1, 2].forEach(i => later(() => beam(i, 2600), i * 160));
        const sign = document.createElement('p'); sign.className = 'ch-hint ch-complete'; sign.innerHTML = 'Dose complete!<small>All six shots served</small>';
        sign.style.cssText = `left:${L.w / 2}px;top:${L.woman[1] - parseFloat(woman.style.height) * 1.02}px;font-size:${L.foot[1] * 3}px`;
        st.appendChild(sign); later(() => sign.classList.add('out'), 4200); later(() => sign.remove(), 4700);
      }, 1300);
      state.stickersSeen = { day: today, k: [...seen, ...fresh] }; save();
    }

    playingToday().then(n => { if (gone || !(n >= SHOW_PLAYERS_FROM)) return; live.hidden = false; live.textContent = `${n.toLocaleString()} people playing today`; }).catch(() => {});
  }

  // the menu button: what this is, and the small print
  function about() {
    const d = document.createElement('dialog'); d.className = 'howto';
    d.innerHTML = `<div class="ht-in"><button class="ht-x" aria-label="Close" title="Close">✕</button>
      <p class="eyebrow">Daily Dose</p><h2 class="display">Six shots a day</h2>
      <ol><li>Pick a mug, pull the shot, play the game.</li><li>Every mug fills when you finish. New shots every night at midnight, your time.</li>
      <li>${state.name ? `Playing as ${esc(state.name)}.` : 'Add a name on the You tab so friends can find you.'}</li></ol>
      <p class="ht-acct"><button type="button" class="link" data-acct="new">Sign up</button> · <button type="button" class="link" data-acct="in">Log in</button> to keep your streaks on any phone</p>
      <p class="ht-foot"><a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>
      <button class="btn wide" data-go>Back to the counter</button></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => {
      const a = e.target.closest('[data-acct]'); if (a) { d.remove(); openAccount(a.dataset.acct); return; }
      if (e.target === d || e.target.closest('.ht-x,[data-go]')) { SOUNDS.tap(); d.remove(); } });
    d.addEventListener('cancel', () => d.remove());
    d.showModal();
  }

  // your name, refreshed quietly for the menu and share card
  hasAccount().then(ok => ok && getMe()).then(m => { if (!m || (m.name || null) === (state.name || null) || gone) return; state.name = m.name || null; save(); }).catch(() => {});

  return () => {
    gone = true; timers.forEach(t => { clearInterval(t); clearTimeout(t); }); removeEventListener('resize', onResize);
    // the game screen surfaces through the coffee as it drains away
    const cof = coffee; if (cof) { cof.classList.add('out'); setTimeout(() => cof.remove(), 500); }
  };
}
