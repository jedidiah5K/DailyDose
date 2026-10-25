// Supabase: accounts and the server-checked games. Everyone gets a guest account on first play
// (anonymous sign-in), so the server can check answers and keep one official result per day.
// Adding an email and password later keeps the same account and streaks.
// The publishable key is meant to be public: it only allows what the database rules allow.
import { createClient } from '@supabase/supabase-js';
import { dayKey } from './day.js';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://xgmwqpasogwlvtjaapwo.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_GLmm-oqwG3az6syLgjv1cA_3a8-oD9y';
export const sb = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'dose-auth' } });

export async function user() {
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user;
  const { data: d, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return d.user;
}
export const isGuest = async () => (await sb.auth.getSession()).data.session?.user?.is_anonymous !== false;

export async function vaultGuess(g) {
  await user();
  const { data, error } = await sb.rpc('dose_vault_guess', { p_guess: g });
  if (error) throw error;
  return data;
}

// Today's vault from the server, so a game started on one phone carries on another.
export async function vaultToday() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  const { data: row } = await sb.from('dose_plays').select('guesses, won, result, finished_at')
    .eq('game', 'vault').eq('day', dayKey()).maybeSingle();
  return row;
}

// Guest → real account: same user id, so today's games and streaks stay.
export async function createAccount(email, password) {
  const { data } = await sb.auth.getSession();
  const { error } = data.session?.user?.is_anonymous
    ? await sb.auth.updateUser({ email, password })
    : await sb.auth.signUp({ email, password });
  if (error) throw error;
}
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export const signOut = () => sb.auth.signOut();
