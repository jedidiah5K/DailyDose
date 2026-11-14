import { dayKey, countdown, clock } from '../lib/day.js';
import { shareDose } from '../ui/card.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { blendStart, blendOpen, blendAnswer } from '../lib/cloud.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { friendsOn } from './friends.js';
import { gameHeader, wireHelp, burst, toaster, roll, esc, timerBar } from '../ui/shell.js';

const MODE = {
  crowd: { name: 'Think like everyone', how: 'Match the answer most people give.' },
  rare: { name: 'Think like no one', how: 'A real answer that few people give.' },
};
const tile = (p, gem) => gem ? '💎' : p >= 70 ? '🟩' : p >= 35 ? '🟨' : p > 0 ? '🟧' : '⬛';
export const blendTiles = r => r.points.map((p, i) => tile(p, r.gems?.[i])).join('');
export const blendLine = r => `${r.score}/500 ${blendTiles(r)}`;
const LIMIT = 20000;

// Blend: five prompts, 20 seconds each, type the first thing that fits. "Think like everyone" scores for
// matching the crowd, "Think like no one" for a real answer few people gave. The server opens each prompt,
// runs the clock and keeps the answer lists; the phone only sees a prompt once it's opened.
export function blend(app) {
  const day = dayKey();
  let s = null, busy = false, gone = false, stop = () => {}, revealK = -1;

  app.innerHTML = `<main class="screen game blend">
    ${gameHeader('blend', 'Blend', '<span class="eyebrow mono" id="step"></span>')}
    <div class="g-play"><section id="body" class="bl-body">
      <div class="h-intro rise">
        <h2 class="display">Blend in. <em>Or don’t.</em></h2>
        <p>Five prompts, 20 seconds each. Type the first thing that fits. Some want what everyone says, some want what nobody says.</p>
      </div>
      <div class="h-bottom"><button class="btn wide" id="begin">Start</button></div>
    </section></div>
    <div class="g-side"><p class="v-msg top" id="msg" role="status"></p><section id="bottom"></section></div>
  </main>`;
  wireHelp(app, 'blend');
  const $ = q => app.querySelector(q);
  const say = toaster($('#msg'));
  const dots = () => `<ol class="bl-dots" aria-label="Prompts">${s.modes.map((m, i) => {
    const p = s.prompts[i]; const on = p?.done ? `${p.gem ? 'gem' : p.points >= 35 ? 'ok' : p.points > 0 ? 'meh' : 'miss'}` : !s.result && i === s.prompts.filter(x => x.done).length ? 'now' : '';
    return `<li class="${m} ${on}" title="${MODE[m].name}">${p?.done ? tile(p.points, p.gem) : i + 1}</li>`;
  }).join('')}</ol>`;

  function draw() {
    stop();
    const k = s.prompts.length - 1, cur = s.prompts[k];
    $('#step').textContent = s.result ? `${s.result.score}/500` : `${Math.min(s.prompts.filter(p => p.done).length + 1, s.n)}/${s.n}`;
    if (s.result && revealK < 0) { $('#body').innerHTML = dots() + past(); return; }
    if (revealK >= 0) return reveal(revealK);
    if (cur && !cur.done) return play(k, cur);
    ready(s.prompts.length);
  }

  // Between prompts: show which kind is next, so you can brace for it. The clock starts on Go.
  function ready(k) {
    const m = MODE[s.modes[k]];
    $('#body').innerHTML = `${dots()}<div class="bl-ready rise ${s.modes[k]}">
      <p class="eyebrow">Prompt ${k + 1} of ${s.n}</p><h2 class="display">${m.name}</h2><p>${m.how}</p></div>
      <div class="h-bottom"><button class="btn wide" id="go">Go · 20 seconds</button></div>`;
    $('#go').addEventListener('click', async () => {
      if (busy) return; busy = true; SOUNDS.tap(); buzz();
      try { s = await blendOpen(k); } catch (e) { busy = false; say(navigator.onLine ? 'Couldn’t open that. Try again.' : 'You’re offline. Blend needs a connection.'); return; }
      busy = false; if (!gone) draw();
    });
  }

  function play(k, p) {
    const end = Date.now() + (p.left_ms ?? LIMIT);
    if (p.left_ms <= 0) { answer(k, ''); return; }
    $('#body').innerHTML = `${dots()}<div class="bl-now ${p.mode}">
      <p class="bl-mode">${MODE[p.mode].name}</p>
      <h2 class="display bl-q">${esc(p.q)}</h2>
      <div class="bl-clock" aria-hidden="true"><i id="bar"></i></div><p class="bl-secs mono" id="secs"></p>
      <form id="form" class="bl-form" autocomplete="off"><input id="w" maxlength="30" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="go" placeholder="Type it…" aria-label="Your answer"><button class="btn" id="lock">Lock it in</button></form>
    </div>`;
    const input = $('#w');
    setTimeout(() => input.focus(), 30);
    stop = timerBar($('#bar'), $('#secs'), end, LIMIT, () => answer(k, input.value));
    $('#form').addEventListener('submit', e => { e.preventDefault(); if (!input.value.trim()) { say('Type something first.'); return; } answer(k, input.value); });
  }

  async function answer(k, w) {
    if (busy) return; busy = true; stop();
    let r;
    for (let i = 0; i < 3 && !r; i++) { try { r = await blendAnswer(k, w); } catch (e) { if (/not open/.test(e.message)) break; await new Promise(t => setTimeout(t, 600)); } }
    busy = false;
    if (gone) return;
    if (!r) { say('Couldn’t send that. Check your connection.'); try { s = await blendStart(); } catch (e) {} draw(); return; }
    s = r; revealK = k;
    const p = s.prompts[k];
    if (p.gem) { SOUNDS.chime(); buzz(30); } else if (p.points >= 35) { SOUNDS.ok(); buzz(12); } else { SOUNDS.miss(); buzz(15); }
    draw();
    if (s.result) { finish('blend', s.result, day); if (s.result.score >= 250) burst('var(--c-blend)'); result(s.result, true); }
  }

  // After each answer: your points, how many said it, and the top three you were up against.
  function reveal(k) {
    const p = s.prompts[k];
    const what = p.late || !p.raw ? 'Time’s up' : !p.answer ? 'Not on our list' : `${p.share}% said this`;
    const top = (p.top || []).map(([a, pct]) => `<li class="${a === p.answer ? 'me' : ''}"><span>${esc(a)}</span><b>${pct}%</b><i style="--w:${pct}%"></i></li>`).join('');
    $('#body').innerHTML = `${dots()}<div class="bl-reveal rise ${p.mode}">
      <p class="bl-mode">${MODE[p.mode].name} · ${esc(p.q)}</p>
      <p class="bl-you">${p.raw ? esc(p.raw) : '—'}</p>
      <p class="bl-pts"><b data-to="${p.points}">0</b> points${p.gem ? ' <span class="bl-gem">💎 Rare find</span>' : ''}</p>
      <p class="muted">${what}</p>
      <p class="eyebrow">Most said</p><ol class="bl-top">${top}</ol>
    </div>${s.result ? '' : `<div class="h-bottom"><button class="btn wide" id="next">${k + 1 < s.n ? 'Next prompt' : 'See your score'}</button></div>`}`;
    roll($('[data-to]'));
    $('#next')?.addEventListener('click', () => { SOUNDS.tap(); revealK = -1; draw(); });
  }

  const past = () => `<ul class="bl-past">${s.prompts.map(p => `<li><span>${esc(p.q)}</span><b>${p.raw ? esc(p.raw) : '—'}</b><em>${p.points}</em></li>`).join('')}</ul>`;

  function result(r, fresh) {
    const beat = r.beat != null ? `Better than ${r.beat}% of players today` : 'You’re one of the first to play today';
    const gems = r.gems.filter(Boolean).length;
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${gems ? `${gems} rare find${gems > 1 ? 's' : ''}` : 'Today’s Blend'}</p>
      <h2 class="display"><em>${r.score}</em> of 500</h2>
      <p class="bl-tiles">${blendTiles(r)}</p>
      <p class="muted">${[beat, streak('blend') > 1 ? `${streak('blend')} days in a row` : ''].filter(Boolean).join(' · ')}</p>
      <div class="fr-on" id="fr-on"></div>
      <button class="btn wide" id="share">Share Blend</button>
      <button class="link-quiet" id="all">Share today’s whole dose</button>
      <p class="next-in">Tomorrow’s prompts in <b data-cd>${countdown()}</b></p>
      <a class="link center" href="#">All games</a>
    </div>`;
    if (fresh) SOUNDS.chime();
    const send = only => async () => { SOUNDS.tap(); if (await shareDose('story', only) === 'saved') say('Image saved and the text copied. Paste it anywhere.'); };
    $('#share').addEventListener('click', send('blend'));
    $('#all').addEventListener('click', send());
    friendsOn($('#fr-on'), 'blend');
  }

  async function load() {
    $('#body').innerHTML = '<div class="h-skel"><i></i><i></i><i></i></div>';
    try { s = await blendStart(); }
    catch (e) { $('#body').innerHTML = ''; say(/no puzzle/.test(e.message) ? 'Today’s prompts aren’t ready yet. Check back soon.' : 'Couldn’t reach the server. Check your connection and try again.'); return; }
    if (gone) return;
    state.progress.blend = { day }; save();
    draw();
    if (s.result) { finish('blend', s.result, day); result(s.result, false); }
  }

  $('#begin').addEventListener('click', () => { SOUNDS.tap(); buzz(); load(); });
  if (resultFor('blend') || state.progress.blend?.day === day) load();
  return () => { gone = true; stop(); };
}
