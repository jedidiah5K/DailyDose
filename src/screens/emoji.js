import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { gameHeader, wireHelp, burst, esc } from '../ui/shell.js';
import { emojiDay, matches } from '../games/partyLogic.js';

// Emoji Decode (PROTOTYPE, only at #emoji): five things written in emojis. You start with two; every miss or
// "Another emoji" shows one more, up to six. Fewer emojis = better. Saved on this phone only for now.
const KEY = 'dose:emoji', MAX = 6, START = 2;
const CAT = { movie: ['🎬', 'Movie'], show: ['📺', 'TV show'], song: ['🎵', 'Song'], internet: ['💻', 'Internet'], celeb: ['⭐', 'Famous person'] };

export function emoji(app) {
  const day = dayKey(), set = emojiDay(day);
  let s = { day, res: [], shown: START };
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v?.day === day) s = v; } catch {}
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  let busy = false;

  app.innerHTML = `<main class="screen game emoji">
    ${gameHeader('emoji', 'Emoji Decode', '<span class="eyebrow mono" id="left"></span>')}
    <div class="g-play"><section id="body" class="em-body">
      <div class="h-intro g-intro rise">
        <h2 class="display">Read the <em>emojis</em></h2>
        <p>Five movies, shows, songs, memes and famous people, written in emojis. You start with two. Every miss shows one more. The fewer you need, the better.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <aside class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></aside>
  </main>`;
  wireHelp(app, 'emoji');
  const $ = q => app.querySelector(q);
  let toastT = 0;
  const say = t => { const m = $('#msg'); m.textContent = t; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); clearTimeout(toastT); if (t) toastT = setTimeout(() => { m.textContent = ''; }, 2800); };
  const shake = () => { const b = $('.em-card'); b?.classList.remove('nope'); void b?.offsetWidth; b?.classList.add('nope'); };

  function draw(grew = false) {
    const i = s.res.length;
    if (i >= set.length) return result();
    const p = set[i], [ic, label] = CAT[p.cat];
    $('#left').textContent = `${i + 1}/${set.length}`;
    $('#body').innerHTML = `<div class="em-card">
      <p class="eyebrow">${ic} ${label}</p>
      <p class="em-row" aria-label="${s.shown} emojis shown">${p.e.map((e, k) => k < s.shown ? `<span class="${grew && k === s.shown - 1 ? 'new' : ''}">${e}</span>` : '<span class="off">?</span>').join('')}</p>
      <form id="form" autocomplete="off"><input id="w" autocorrect="on" autocapitalize="none" spellcheck="true" enterkeyhint="go" aria-label="Your guess" placeholder="Type your guess"></form>
      <div class="em-tools"><button class="hint-btn" id="more" type="button">${s.shown < MAX ? 'Another emoji' : 'Give up'}</button></div>
    </div>
    <div class="em-dots">${set.map((_, k) => `<i class="${k < i ? (s.res[k] ? 'ok' : 'x') : k === i ? 'now' : ''}"></i>`).join('')}</div>
    <div class="h-bottom"><button class="btn wide" id="go" type="button">Guess</button></div>`;
    const input = $('#w');
    setTimeout(() => input.focus(), 50);
    $('#form').addEventListener('submit', e => { e.preventDefault(); guess(input.value); });
    $('#go').addEventListener('click', () => guess(input.value));
    $('#more').addEventListener('click', () => miss(''));
  }

  function guess(w) {
    if (busy || !w.trim()) return;
    const p = set[s.res.length];
    if (!matches(p.a, w)) { SOUNDS.miss(); buzz(10); shake(); return miss(`Not ${w.trim()}.`); }
    // landing it early rings higher: two emojis is the dream
    SOUNDS.link(MAX + 2 - s.shown); buzz(25);
    if (s.shown <= START) burst('var(--c)');
    say(s.shown <= START ? `On ${s.shown}! It’s ${p.a[0].toUpperCase()}.` : `Got it on ${s.shown}.`);
    next(s.shown);
  }

  function miss(msg) {
    if (busy) return;
    const p = set[s.res.length];
    if (s.shown >= MAX) { SOUNDS.miss(); say(`It was ${p.a[0].toUpperCase()}.`); return next(0); }
    s.shown++; store(); SOUNDS.tap(); say(msg); draw(true);
  }

  // record this one (0 = missed) and move on after a beat, so the answer can sink in
  function next(n) {
    busy = true; s.res.push(n); s.shown = START; store();
    $('#w')?.setAttribute('disabled', '');
    setTimeout(() => { busy = false; draw(); }, 1300);
  }

  function result() {
    const got = s.res.filter(Boolean), share = set.map((p, k) => `${CAT[p.cat][0]} ${s.res[k] || 'X'}`).join(' · ');
    $('#left').textContent = '';
    $('#body').innerHTML = '';
    $('#bottom').innerHTML = `<div class="result rise">
      <p class="eyebrow">${got.length === set.length ? 'All five' : `${got.length} of ${set.length}`}</p>
      <h2 class="display"><em>${got.reduce((a, b) => a + b, 0) || '-'}</em> emojis</h2>
      <p class="em-share">${share}</p>
      <p class="muted">${set.map((p, k) => `${s.res[k] ? '✓' : '✗'} ${esc(p.a[0].replace(/\b\w/g, c => c.toUpperCase()))}`).join('<br>')}</p>
      <button class="btn wide" id="share">Share</button>
      <p class="next-in">Tomorrow’s emojis in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a></div>`;
    $('#share').addEventListener('click', async () => {
      SOUNDS.tap();
      const text = `Daily Dose · Emoji Decode No. ${puzzleNo()}\n${share}\n${location.origin}`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); say('Copied. Paste it anywhere.'); } } catch {}
    });
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); draw(); });
  if (s.res.length || s.shown > START) draw();
  return () => {};
}
