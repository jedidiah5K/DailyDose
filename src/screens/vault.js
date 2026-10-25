import { dayKey, puzzleNo } from '../lib/day.js';
import { state, save, finish, resultFor, streak } from '../lib/store.js';
import { vaultGuess, vaultToday } from '../lib/cloud.js';
import { SLOTS, SYMBOLS, MAX_GUESSES } from '../games/vaultLogic.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { sym, NAMES } from '../ui/symbols.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));
// Loot is cosmetic only: fewer guesses, bigger haul.
const lootFor = r => r.won ? (MAX_GUESSES + 1 - r.guesses.length) * 40 : 0;

export function shareText(r) {
  const locks = r.guesses.map((_, i) => r.won && i === r.guesses.length - 1 ? '🔓' : '🔒').join('');
  return `DAILY DOSE · VAULT #${puzzleNo()}\n${locks} ${r.won ? `cracked in ${r.guesses.length}` : 'stayed locked'}\nBank: ${(state.bank || 0).toLocaleString()} 💰`;
}

// A guess is { g: [symbols], x: right place, n: wrong place }, as the server returns it.
const pins = ({ x, n }) => Array.from({ length: SLOTS }, (_, i) => `<i class="${i < x ? 'x' : i < x + n ? 'n' : ''}"></i>`).join('');
const row = q => `<li class="row-g"><span class="g-syms">${q.g.map(sym).join('')}</span><span class="pins" aria-label="${q.x} right place, ${q.n} wrong place">${pins(q)}</span></li>`;

export function vault(app) {
  const day = dayKey();
  let prog = state.progress.vault?.day === day ? state.progress.vault : (state.progress.vault = { day, guesses: [] });
  let input = [], busy = false, gone = false;

  app.innerHTML = `<main class="screen vault">
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="eyebrow">Vault · No. ${puzzleNo()}</p>
      <span class="eyebrow" id="left"></span>
    </header>
    <div class="door-wrap">
      <div class="glow" aria-hidden="true"></div>
      <div class="door" id="door">
        <span class="bolt b1"></span><span class="bolt b2"></span><span class="bolt b3"></span><span class="bolt b4"></span>
        <span class="rivets" aria-hidden="true"></span>
        <div class="dials" id="dials">${Array.from({ length: SLOTS }, () => '<span class="dial"><span class="face"></span></span>').join('')}</div>
        <span class="lamp" id="lamp" aria-hidden="true"></span>
      </div>
    </div>
    <ol class="log" id="log"></ol>
    <p class="v-msg" id="msg" role="status"></p>
    <section id="bottom"></section>
  </main>`;

  const $ = s => app.querySelector(s);
  const dials = [...app.querySelectorAll('.face')];
  const left = () => { $('#left').textContent = resultFor('vault') ? '' : `${MAX_GUESSES - prog.guesses.length} tries left`; };
  const say = t => { $('#msg').textContent = t; };
  const showCode = code => dials.forEach((d, i) => { d.innerHTML = sym(code[i]); d.parentElement.classList.add('on'); });

  function drawInput() {
    dials.forEach((d, i) => { d.innerHTML = input[i] == null ? '' : sym(input[i]); d.parentElement.classList.toggle('on', input[i] != null); });
    const go = $('#go'); if (go) go.disabled = input.length < SLOTS || busy;
  }

  function pad() {
    $('#bottom').innerHTML = `<div class="pad">
      ${Array.from({ length: SYMBOLS }, (_, s) => `<button class="key" data-s="${s}" aria-label="${NAMES[s]}">${sym(s)}</button>`).join('')}
    </div>
    <div class="pad-row">
      <button class="key del" id="del" aria-label="Delete" title="Delete"><svg viewBox="0 0 24 24"><path d="M9 6h11v12H9l-6-6z M12.5 9.5l5 5m0-5-5 5"/></svg></button>
      <button class="btn grow" id="go" disabled>Try code</button>
    </div>`;
    app.querySelectorAll('.key[data-s]').forEach(k => k.addEventListener('click', () => {
      if (busy || input.length >= SLOTS) return;
      input.push(+k.dataset.s); SOUNDS.click(); buzz(6);
      const d = dials[input.length - 1].parentElement; d.classList.remove('spin'); void d.offsetWidth; d.classList.add('spin');
      drawInput();
    }));
    $('#del').addEventListener('click', () => { if (busy || !input.length) return; input.pop(); SOUNDS.tap(); drawInput(); });
    $('#go').addEventListener('click', submit);
    drawInput();
  }

  async function submit() {
    if (busy || input.length < SLOTS) return;
    busy = true; drawInput(); say('');
    SOUNDS.clunk(); buzz(20);
    $('#door').classList.add('turning');
    let res;
    try { res = await vaultGuess(input); }
    catch (e) {
      busy = false; $('#door').classList.remove('turning'); drawInput();
      say(/finished/.test(e.message) ? 'Today’s vault is done. Back at midnight UTC.' : navigator.onLine ? 'The vault didn’t answer. Try again.' : 'You’re offline. Your code is still on the dials.');
      return;
    }
    $('#door').classList.remove('turning');
    if (gone) return;
    const q = { g: input, x: res.x, n: res.n };
    prog.guesses.push(q); save();
    $('#log').insertAdjacentHTML('beforeend', row(q));
    const r = $('#log').lastElementChild; r.classList.add('new');
    r.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
    // pins light up one by one, each with its own tick
    for (const p of r.querySelectorAll('.pins i')) { await wait(140); p.classList.add('lit'); if (p.className.includes('x')) SOUNDS.exact(); else if (p.className.includes('n')) SOUNDS.near(); }
    input = [];
    if (res.over) {
      const done = { won: res.won, guesses: prog.guesses, code: res.code };
      state.bank = (state.bank || 0) + lootFor(done);
      finish('vault', done, day);
      left();
      await (res.won ? openDoor(res.code) : alarm(res.code));
      result(done, true);
    } else left();
    busy = false; drawInput();
  }

  async function openDoor(code) {
    showCode(code); dials.forEach(d => d.parentElement.classList.add('good'));
    $('#door').classList.add('unlock'); SOUNDS.open(); buzz(40);
    await wait(500); $('#door').classList.add('open'); $('.door-wrap').classList.add('lit');
    await wait(900);
  }
  async function alarm(code) {
    $('.door-wrap').classList.add('alarm'); SOUNDS.alarm(); buzz(60);
    await wait(1300);
    showCode(code);
  }

  function result(r, fresh) {
    const loot = lootFor(r);
    $('#bottom').innerHTML = `<div class="result ${fresh ? 'rise' : ''}">
      <p class="eyebrow">${r.won ? 'Vault cracked' : 'The code was above'}</p>
      <h2 class="display">${r.won ? `In <em>${r.guesses.length}</em> ${r.guesses.length === 1 ? 'try' : 'tries'}` : 'Stayed <em>locked</em>'}</h2>
      <p class="muted">${r.won ? `+${loot} to your bank · ${(state.bank || 0).toLocaleString()} total` : 'Fresh vault at midnight UTC.'}${streak('vault') > 1 ? ` · ${streak('vault')} days in a row` : ''}</p>
      <button class="btn wide" id="share">Share</button>
      <a class="link center" href="#">All games</a>
    </div>`;
    $('#share').addEventListener('click', () => {
      const text = shareText(r) + '\n' + location.origin;
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else navigator.clipboard?.writeText(text).then(() => { $('#share').textContent = 'Copied'; });
    });
  }

  function render() {
    $('#log').innerHTML = prog.guesses.map(row).join('');
    left();
    const done = resultFor('vault');
    if (done) {
      $('#door').classList.add(done.won ? 'open' : 'shut');
      if (done.won) $('.door-wrap').classList.add('lit');
      showCode(done.code);
      result(done, false);
    } else if (!$('#bottom').children.length) pad();
  }
  render();

  // The server's copy wins: it may hold guesses made on another phone.
  vaultToday().then(s => {
    if (gone || busy || !s || s.guesses.length <= prog.guesses.length) return;
    prog.guesses = s.guesses; save();
    if (s.finished_at) finish('vault', { won: s.won, guesses: s.guesses, code: s.result.code }, day);
    render();
  }).catch(() => {});

  return () => { gone = true; };
}
