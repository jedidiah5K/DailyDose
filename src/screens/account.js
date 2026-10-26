// Account sheet: guests add an email and password to keep their streaks; returning players sign in.
import { sb, createAccount, signIn, signOut } from '../lib/cloud.js';
import { forgetGames } from '../lib/store.js';
import { SOUNDS } from '../ui/feedback.js';

const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

export async function openAccount() {
  const u = (await sb.auth.getSession()).data.session?.user;
  const d = document.createElement('dialog'); d.className = 'sheet';
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });

  const form = mode => `<form method="dialog" class="stack" novalidate>
    <h2 class="display">${mode === 'new' ? 'Save your <em>streak</em>' : 'Welcome <em>back</em>'}</h2>
    <p class="muted">${mode === 'new' ? 'Add an email and password to keep your streaks on any phone.' : 'Sign in to pick up your streaks.'}</p>
    <label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
    <label>Password<input name="pw" type="password" autocomplete="${mode === 'new' ? 'new-password' : 'current-password'}" minlength="8" maxlength="72" required></label>
    ${mode === 'new' ? '<label>Password again<input name="pw2" type="password" autocomplete="new-password" maxlength="72" required></label>' : ''}
    <p class="err" role="alert"></p>
    <button class="btn wide">${mode === 'new' ? 'Create account' : 'Sign in'}</button>
    <button type="button" class="link center" data-swap>${mode === 'new' ? 'I already have an account' : 'Make a new account'}</button>
  </form>`;

  const draw = mode => {
    d.innerHTML = form(mode);
    const f = d.querySelector('form'), err = d.querySelector('.err');
    d.querySelector('[data-swap]').addEventListener('click', () => draw(mode === 'new' ? 'in' : 'new'));
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const email = f.email.value.trim(), pw = f.pw.value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return (err.textContent = 'That email doesn’t look right.');
      if (pw.length < 8) return (err.textContent = 'Use at least 8 characters.');
      if (mode === 'new' && pw !== f.pw2.value) return (err.textContent = 'The passwords don’t match.');
      const b = f.querySelector('.btn'); b.disabled = true; err.textContent = '';
      try {
        await (mode === 'new' ? createAccount(email, pw) : signIn(email, pw));
        // Signing in switches to that account's games (they come back from the server); a new account
        // keeps the guest's, since it's the same player.
        if (mode === 'in') forgetGames();
        SOUNDS.ok(); d.close(); location.reload();
      } catch (x) {
        // One vague message for sign-in, so nobody can test which emails have accounts.
        err.textContent = mode === 'in' ? 'Wrong email or password.' : /rate|many/i.test(x.message) ? 'Too many tries. Wait a few minutes.' : 'Couldn’t create the account. Try another email.';
        b.disabled = false;
      }
    });
  };

  if (u && !u.is_anonymous) {
    d.innerHTML = `<div class="stack"><h2 class="display">Your <em>account</em></h2><p class="muted">Signed in as ${esc(u.email)}</p>
      <button class="btn wide" data-close>Done</button><button class="link center" data-out>Sign out</button></div>`;
    d.querySelector('[data-close]').addEventListener('click', () => d.close());
    d.querySelector('[data-out]').addEventListener('click', async () => { await signOut(); forgetGames(); location.hash = ''; location.reload(); });
  } else draw('new');
  d.showModal(); SOUNDS.tap();
}
