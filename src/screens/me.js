// You: your name, your account, nights in a row, badges, and how you're doing at each game.
// Results come from the server (so every phone you sign in on agrees), and from this phone while offline.
import { state, streak, mergeResults, save } from '../lib/store.js';
import { BADGES, earned, bestStreak, badgeArt } from '../lib/badges.js';
import { LINEUP } from '../ui/card.js';
import { clock } from '../lib/day.js';
import { sb, getMe, hasAccount, myResults } from '../lib/cloud.js';
import { openAccount } from './account.js';
import { nameForm } from './friends.js';
import { SOUNDS } from '../ui/feedback.js';
import { stars } from '../ui/sky.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const nums = xs => xs.filter(v => typeof v === 'number');
const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const count = (rs, test) => rs.filter(test).length;
const rare = r => (r.odd || '').split('p').length - 1;

// Three numbers per game: your best, your usual, and one thing worth bragging about.
const STATS = {
  rewire: rs => { const t = nums(rs.map(r => r.ms)); return [['best', clock(Math.min(...t))], ['average', clock(avg(t))], ['at par', count(rs, r => r.stars === 3)]]; },
  hunch: rs => { const p = nums(rs.map(r => r.points)); return p.length ? [['best', Math.max(...p)], ['average', Math.round(avg(p))], ['all 5 in band', count(rs, r => r.hits === 5)]] : [['average error', `${Math.round(avg(nums(rs.map(r => r.err))))}%`]]; },
  drop: rs => [['landed', `${Math.round(100 * count(rs, r => r.landed) / rs.length)}%`], ['holes in one', count(rs, r => r.landed && r.shot === 1)], ['all 3 stars', count(rs, r => r.landed && r.stars === 3)]],
  meld: rs => { const p = nums(rs.map(r => r.points ?? r.score)); return [['best', Math.max(...p)], ['average', Math.round(avg(p))], ['rare answers', rs.reduce((n, r) => n + rare(r), 0)]]; },
  last: rs => [['furthest', `${Math.max(...rs.map(r => r.perfect ? 10 : r.reached))} of 10`], ['top score', Math.max(0, ...nums(rs.map(r => r.points)))], ['all 10 cleared', count(rs, r => r.perfect)]],
};

export function me(app) {
  let gone = false, who = { name: null, friends: null };

  app.innerHTML = `<main class="screen game you">
    <div class="stars" aria-hidden="true">${stars(32, 29)}</div>
    <header class="v-top">
      <a href="#" class="back" aria-label="Back to all games" title="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></a>
      <p class="neon-title g-you">You</p>
      <span class="v-pad"></span>
    </header>
    <section class="you-head">
      <h1 class="display" id="who">You</h1>
      <button class="link-quiet" id="rename" type="button">Add your name</button>
      <div id="namebox" hidden></div>
      <p class="muted" id="acct"></p>
    </section>
    <ul class="you-big" id="big"></ul>
    <a class="you-friends" href="#friends"><span>Friends</span><span class="mono" id="fcount"></span><span aria-hidden="true">›</span></a>
    <section class="you-sec"><p class="eyebrow" id="bcount">Badges</p><ul class="badges" id="badges"></ul></section>
    <section class="you-sec"><p class="eyebrow">Your games</p><ol class="you-stats" id="stats"></ol></section>
  </main>`;
  const $ = s => app.querySelector(s);

  function draw() {
    const res = state.results, got = earned(res);
    const total = LINEUP.reduce((n, g) => n + Object.keys(res[g.k] || {}).length, 0);   // today's lineup only (not the retired Vault)
    $('#big').innerHTML = [['Nights in a row', streak()], ['Best run', bestStreak(res)], ['Games played', total]]
      .map(([l, v]) => `<li><b class="display">${v}</b><span>${l}</span></li>`).join('');
    $('#bcount').textContent = `Badges · ${got.size} of ${BADGES.length}`;
    $('#badges').innerHTML = BADGES.map(b => `<li class="${got.has(b.id) ? 'got' : ''}" title="${b.how}">${badgeArt(b, got.has(b.id))}
      <span class="b-name">${b.name}</span><span class="b-how">${got.has(b.id) ? 'Earned' : b.how}</span></li>`).join('');
    $('#stats').innerHTML = LINEUP.map(g => {
      const rs = Object.values(res[g.k] || {});
      return `<li class="ys${rs.length ? '' : ' off'}" style="--c:${g.color}">
        <p class="ys-top"><span class="ys-name display">${g.name}</span><span class="mono">${rs.length ? `${rs.length} played` : 'Not played yet'}</span></p>
        ${rs.length ? `<dl>${STATS[g.k](rs).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}</li>`;
    }).join('');
    $('#who').textContent = who.name || 'You';
    $('#rename').textContent = who.name ? 'Change name' : 'Add your name';
    $('#fcount').textContent = who.friends == null ? '' : String(who.friends);
  }

  async function account() {
    const u = (await sb.auth.getSession()).data.session?.user;
    if (gone) return;
    $('#acct').innerHTML = u && !u.is_anonymous
      ? `Signed in as ${esc(u.email)} · <button class="link" id="acc" type="button">Account</button>`
      : `Playing as a guest, saved on this phone. <button class="link" id="acc" type="button">Save your streaks</button>`;
    $('#acc').addEventListener('click', openAccount);
  }

  $('#rename').addEventListener('click', () => {
    SOUNDS.tap();
    const box = $('#namebox'); box.hidden = false; $('#rename').hidden = true;
    nameForm(box, who.name || '', name => { who.name = name; box.hidden = true; $('#rename').hidden = false; draw(); }).nm.focus();
  });

  draw(); account();
  // Fill in from the server: games played on other phones, your name and friends. Never makes a guest
  // account just to look.
  hasAccount().then(async ok => {
    if (!ok) return;
    const [m, rows] = await Promise.all([getMe(), myResults()]);
    if (gone) return;
    who = m;
    if (mergeResults(rows)) { state.badges = [...new Set([...(state.badges || []), ...earned(state.results)])]; save(); }
    draw();
  }).catch(() => {});

  return () => { gone = true; };
}
