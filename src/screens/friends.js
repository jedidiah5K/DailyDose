// Friends: everyone has a friend code, and typing a friend's code makes you friends both ways (no links).
// Friends see each other's name and tonight's results, nothing else. Also here: the friends row on the
// home screen and the "friends tonight" list on each result screen.
import { getMe, setName, addFriend, removeFriend, friendsToday, hasAccount } from '../lib/cloud.js';
import { resultFor } from '../lib/store.js';
import { LINEUP } from '../ui/card.js';
import { SOUNDS, buzz } from '../ui/feedback.js';
import { stars } from '../ui/sky.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const pretty = code => code ? `${code.slice(0, 4)} ${code.slice(4)}` : '';
const nameOf = f => esc(f.name || 'Friend');
const lit = f => Object.keys(f.results).length;
const dots = f => `<span class="fr-dots" aria-label="${lit(f)} of 5 played tonight">${LINEUP.map(g => `<i class="${f.results[g.k] ? 'on' : ''}" style="--c:${g.color}"></i>`).join('')}</span>`;
// Higher is better, so a game's results can be put in order.
const SCORE = { rewire: r => -r.ms, hunch: r => r.points ?? -r.err, drop: r => r.score ?? (r.landed ? 1 : -r.miss), meld: r => r.points ?? r.score, last: r => r.points };

// Friends' results only change when someone finishes a game: one fetch a minute is plenty.
let cache = null;
export function friendsNow(fresh = false) {
  if (fresh || !cache || Date.now() - cache.at > 60000) cache = { at: Date.now(), p: friendsToday() };
  return cache.p.catch(e => { cache = null; throw e; });
}

// Result screens: you and your friends at this game tonight, best first. Nothing shows without friends.
export async function friendsOn(el, game) {
  if (!el || !(await hasAccount())) return;
  let list;
  try { list = await friendsNow(true); } catch (e) { return; }
  if (!list.length || !el.isConnected) return;
  const g = LINEUP.find(x => x.k === game), mine = resultFor(game);
  const rows = list.filter(f => f.results[game]).map(f => ({ name: nameOf(f), r: f.results[game] }));
  if (mine) rows.push({ name: 'You', r: mine, me: true });
  rows.sort((a, b) => SCORE[game](b.r) - SCORE[game](a.r));
  el.innerHTML = rows.length > 1
    ? `<p class="eyebrow">Friends tonight</p><ol class="fr-board">${rows.map((x, i) => `<li class="${x.me ? 'mine' : ''}"><span class="mono">${i + 1}</span><span>${x.name}</span><b>${esc(g.big(x.r))}</b></li>`).join('')}</ol>`
    : `<p class="fr-none">None of your friends has played ${g.name} yet tonight.</p>`;
}

// Home screen: a quiet row. With friends, how many games each has lit tonight.
export async function friendsStrip(el) {
  if (!el || !(await hasAccount())) return;
  let list;
  try { list = await friendsNow(); } catch (e) { return; }
  if (!list.length || !el.isConnected) return;
  const top = [...list].sort((a, b) => lit(b) - lit(a)).slice(0, 3);
  el.querySelector('.fr-sum').innerHTML = top.map(f => `<span class="fr-who"><span>${nameOf(f)}</span>${dots(f)}</span>`).join('')
    + (list.length > 3 ? `<span class="fr-more">+${list.length - 3}</span>` : '');
}

// "What should friends call you?" Used here and on the You screen.
export function nameForm(host, current, saved) {
  host.innerHTML = `<form class="fr-form" autocomplete="off" novalidate>
    <label for="nm">What should friends call you?</label>
    <div class="fr-row"><input id="nm" maxlength="20" value="${esc(current)}" placeholder="Your name" autocomplete="nickname" enterkeyhint="done"><button class="btn">Save</button></div>
    <p class="err" role="status"></p></form>`;
  const f = host.querySelector('form'), err = f.querySelector('.err'), b = f.querySelector('.btn');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const n = f.nm.value.trim();
    if (!n) return (err.textContent = 'Type a name first.');
    b.disabled = true; err.textContent = '';
    try { const name = await setName(n); SOUNDS.ok(); buzz(10); saved(name); }
    catch (x) { b.disabled = false; err.textContent = /bad name/.test(x.message) ? 'Use up to 20 letters, numbers or emoji (no < or >).' : 'Couldn’t save that. Try again.'; }
  });
  return f;
}

export function friends(app) {
  let gone = false, me = null, list = [];
  app.innerHTML = `<main class="screen game friends">
    <div class="stars" aria-hidden="true">${stars(30, 23)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-friends">Friends</p>
      <span class="v-pad"></span>
    </header>
    <section id="name" hidden></section>
    <section class="fr-me">
      <p class="eyebrow">Your friend code</p>
      <button class="fr-code mono" id="code" type="button" title="Copy your code" disabled><span class="skel"></span></button>
      <button class="link-quiet" id="share" type="button" disabled>Send it to a friend</button>
    </section>
    <form class="fr-form" id="add" autocomplete="off" novalidate>
      <label for="fc">Add a friend</label>
      <div class="fr-row"><input id="fc" maxlength="12" placeholder="Their code" autocapitalize="characters" spellcheck="false" enterkeyhint="go"><button class="btn" id="addbtn">Add</button></div>
      <p class="err" id="msg" role="status"></p>
    </form>
    <section class="fr-sec"><p class="eyebrow" id="count">Tonight</p><ol class="fr-list" id="list"><li class="fr-skel"></li><li class="fr-skel"></li></ol></section>
  </main>`;
  const $ = s => app.querySelector(s);
  const say = t => { $('#msg').textContent = t; };

  function drawList() {
    list.sort((a, b) => lit(b) - lit(a) || (a.name || '').localeCompare(b.name || ''));
    $('#count').textContent = list.length ? `${list.length} friend${list.length === 1 ? '' : 's'} · tonight` : 'No friends yet';
    if (!list.length) { $('#list').innerHTML = '<li class="fr-empty">Send your code to a friend, or type theirs above. Then you’ll see each other’s results here every night.</li>'; return; }
    $('#list').innerHTML = list.map((f, i) => `<li class="fr-item">
      <button class="fr-head" type="button" aria-expanded="false" data-i="${i}"><span class="fr-name">${nameOf(f)}</span>${dots(f)}<span class="fr-n mono">${lit(f)}/5</span></button>
      <div class="fr-detail" hidden>
        <ul>${LINEUP.map(g => `<li style="--c:${g.color}"><span>${g.name}</span><b>${f.results[g.k] ? esc(g.big(f.results[g.k])) : '<span class="muted">Not yet</span>'}</b></li>`).join('')}</ul>
        <button class="link-quiet fr-remove" type="button" data-id="${esc(f.id)}">Remove ${nameOf(f)}</button>
      </div></li>`).join('');
    app.querySelectorAll('.fr-head').forEach(h => h.addEventListener('click', () => {
      const open = h.getAttribute('aria-expanded') !== 'true';
      h.setAttribute('aria-expanded', open); h.nextElementSibling.hidden = !open; SOUNDS.tap();
    }));
    // Removing takes two taps, like a hint: the first asks, the second does it.
    app.querySelectorAll('.fr-remove').forEach(b => b.addEventListener('click', async () => {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to remove'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = `Remove ${b.closest('.fr-item').querySelector('.fr-name').textContent}`; } }, 3000); return; }
      b.disabled = true;
      try { await removeFriend(b.dataset.id); list = list.filter(f => f.id !== b.dataset.id); SOUNDS.tap(); drawList(); }
      catch (e) { b.disabled = false; say('Couldn’t remove them right now. Try again.'); }
    }));
  }

  function showName() {
    const host = $('#name'); host.hidden = false;
    nameForm(host, '', name => { me.name = name; host.hidden = true; say(`Friends will see you as ${name}.`); });
  }

  $('#code').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pretty(me.code)); say('Code copied.'); SOUNDS.tap(); } catch (e) {}
  });
  $('#share').addEventListener('click', async () => {
    SOUNDS.tap();
    const text = `Add me on Daily Dose. My friend code is ${pretty(me.code)}\n${location.origin}`;
    try { if (navigator.share) return await navigator.share({ text }); } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); say('Copied. Paste it to a friend.'); } catch (e) { say(`Your code is ${pretty(me.code)}`); }
  });

  $('#add').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#fc').value.replace(/[^a-z0-9]/gi, '').toUpperCase(), b = $('#addbtn');
    if (code.length !== 8) { say('Friend codes have 8 letters and numbers, like KX7P M2QD.'); buzz(8); return; }
    b.disabled = true; say('');
    let r;
    try { r = await addFriend(code); }
    catch (x) { b.disabled = false; say(navigator.onLine ? 'Couldn’t add them right now. Try again.' : 'You’re offline. Try again when you’re back online.'); return; }
    b.disabled = false;
    if (gone) return;
    if (!r.ok) {
      say({ unknown: 'No one has that code. Check it and try again.', self: 'That’s your own code. Send it to a friend instead.',
        tries: 'Too many tries. Wait an hour, then try again.', full: 'One of you already has 100 friends.' }[r.why] || 'Couldn’t add that code.');
      buzz(10); return;
    }
    $('#fc').value = ''; SOUNDS.chime(); buzz(20);
    say(r.already ? `You’re already friends with ${r.name || 'them'}.` : `You and ${r.name || 'your friend'} are friends now.`);
    try { list = await friendsNow(true); if (!gone) drawList(); } catch (x) {}
  });

  (async () => {
    try { [me, list] = await Promise.all([getMe(), friendsNow(true)]); }
    catch (e) { $('#list').innerHTML = ''; say(navigator.onLine ? 'Couldn’t load your friends just now.' : 'You’re offline. Your friends show up when you’re back online.'); return; }
    if (gone) return;
    $('#code').textContent = pretty(me.code); $('#code').disabled = false; $('#share').disabled = false;
    if (!me.name) showName();
    drawList();
  })();

  return () => { gone = true; };
}
