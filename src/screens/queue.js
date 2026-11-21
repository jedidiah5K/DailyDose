import { dayKey, puzzleNo, countdown } from '../lib/day.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { gameHeader, wireHelp, burst, esc } from '../ui/shell.js';
import { TRIES, SIZE, puzzleFor, marks } from '../games/queueLogic.js';

// Queue (PROTOTYPE, not on home): put five things in order in five tries. After each try the ones in the
// right spot turn green and lock; the rest get an arrow saying which way they need to move.
// shortcut: the day's puzzle is picked here from Drop's number pools, so the answer is in the browser.
// Before it goes live it needs dose_queue_start / dose_queue_guess in Postgres like the other games.
const KEY = 'dose:queue';

export function queue(app) {
  const day = dayKey(), p = puzzleFor(day);
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.day === day) return s; } catch {} return null; };
  const saved = load();
  // orders are kept as names so a saved game survives a reload
  const byName = n => p.answer.find(it => it[0] === n);
  let tries = (saved?.tries || []).map(t => t.map(byName)), cur = saved ? saved.cur.map(byName) : p.start, pick = -1, busy = false;
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify({ day, tries: tries.map(t => t.map(it => it[0])), cur: cur.map(it => it[0]) })); } catch {} };
  const last = () => tries.length ? marks(tries.at(-1), p.answer) : null;
  const won = () => !!last()?.every(m => m === 'ok');
  const over = () => won() || tries.length >= TRIES;

  app.innerHTML = `<main class="screen game queue">
    ${gameHeader('queue', 'Queue', '<span class="eyebrow mono" id="left"></span>')}
    <div class="g-play"><section id="body" class="qu-body">
      <div class="h-intro g-intro rise">
        <h2 class="display">Put them <br>in <em>order</em></h2>
        <p>Five things, one order. Swap them around and serve. Right spots turn green and stay put; the rest show which way to move. Five tries.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <aside class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></aside>
  </main>`;
  wireHelp(app, 'queue');
  const $ = q => app.querySelector(q);
  let toastT = 0;
  const say = t => { const m = $('#msg'); m.textContent = t; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); clearTimeout(toastT); if (t) toastT = setTimeout(() => { m.textContent = ''; }, 2800); };
  const ARROW = { up: '↑', down: '↓', ok: '✓' };

  function draw(fresh = false) {
    const m = last(), done = over();
    $('#left').textContent = done ? '' : `Try ${tries.length + 1}/${TRIES}`;
    $('#body').innerHTML = `<h2 class="qu-ask display">${p.ask[0]}</h2>
      <p class="qu-end">${p.ask[1]}</p>
      <ol class="qu-list">${(done ? p.answer : cur).map((it, i) => {
        const mk = done ? (won() ? 'ok' : (m[i] === 'ok' ? 'ok' : '')) : (m && tries.at(-1)[i] === it ? m[i] : '');
        return `<li><button class="qu-card ${mk} ${pick === i ? 'on' : ''} ${fresh && mk ? 'flip' : ''}" data-i="${i}" style="--d:${i * 110}ms" ${done || mk === 'ok' ? 'disabled' : ''}>
          <span>${esc(it[0])}</span>${done ? `<small>${esc(it[2])}</small>` : mk ? `<b aria-label="${mk === 'ok' ? 'right spot' : `move ${mk}`}">${ARROW[mk]}</b>` : ''}</button></li>`; }).join('')}</ol>
      <p class="qu-end">${p.ask[2]}</p>
      ${done ? '' : `<p class="qu-hint">${pick < 0 ? 'Tap two to swap them.' : 'Now tap where it goes.'}</p>
      <div class="h-bottom"><button class="btn wide" id="serve">${tries.length === TRIES - 1 ? 'Serve · last try' : 'Serve'}</button></div>`}`;
    if (done) return result(fresh);
    app.querySelectorAll('.qu-card:not(:disabled)').forEach(b => b.addEventListener('click', () => tap(+b.dataset.i)));
    $('#serve').addEventListener('click', serve);
  }

  function tap(i) {
    if (busy) return;
    if (pick < 0 || pick === i) { pick = pick === i ? -1 : i; SOUNDS.tap(); buzz(6); return draw(); }
    [cur[pick], cur[i]] = [cur[i], cur[pick]];
    pick = -1; SOUNDS.turn(); buzz(8); store(); draw();
  }

  function serve() {
    if (busy) return;
    const before = last()?.filter(x => x === 'ok').length || 0;
    tries.push([...cur]); pick = -1; store();
    const m = last(), n = m.filter(x => x === 'ok').length;
    busy = true; draw(true);
    // each card flips in turn; a green one rings a little higher than the one before
    let k = 0;
    m.forEach((x, i) => setTimeout(() => { if (x === 'ok') SOUNDS.link(2 + k++); else SOUNDS.tick(); }, i * 110));
    setTimeout(() => {
      busy = false;
      if (won()) return;
      buzz(n > before ? 18 : 8);
      say(tries.length >= TRIES ? '' : n > before ? `${n} in the right spot. Closer!` : `${n} in the right spot.`);
    }, SIZE * 110 + 150);
  }

  function result(fresh) {
    const w = won(), rows = tries.map(t => marks(t, p.answer).map(x => x === 'ok' ? '🟩' : '⬛').join(''));
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${w ? (tries.length === 1 ? 'First try!' : 'In order') : 'Not this time'}</p>
      <h2 class="display">${w ? `<em>${tries.length}</em>/${TRIES}` : 'X/5'}</h2>
      <div class="qu-grid" aria-label="Your tries">${rows.map(r => `<p>${r}</p>`).join('')}</div>
      <button class="btn wide" id="share">Share</button>
      <p class="next-in">Tomorrow’s queue in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">Back to the counter</a>
    </div>`;
    if (fresh) setTimeout(() => { w ? (SOUNDS.chime(), burst('var(--c)')) : SOUNDS.miss(); buzz(w ? 30 : 10); }, SIZE * 110 + 100);
    $('#share').addEventListener('click', async () => {
      SOUNDS.tap();
      const text = `Daily Dose · Queue No. ${puzzleNo()}  ${w ? tries.length : 'X'}/${TRIES}\n${rows.join('\n')}\n${location.origin}`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); say('Copied. Paste it anywhere.'); } } catch {}
    });
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); draw(); });
  if (saved) draw();
  return () => {};
}
