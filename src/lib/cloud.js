// Supabase: accounts and the server-checked games. Everyone gets a guest account on first play
// (anonymous sign-in), so the server can check answers and keep one official result per day.
// Adding an email and password later keeps the same account and streaks.
// The publishable key is meant to be public: it only allows what the database rules allow.
import { createClient } from '@supabase/supabase-js';

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

// How many people played anything today. Works without signing in.
export async function playingToday() {
  const { data, error } = await sb.rpc('dose_players_today');
  if (error) throw error;
  return data;
}

// Today's Rewire: starts the server clock the first time, then returns the same puzzle.
export async function rewireStart() {
  await user();
  const { data, error } = await sb.rpc('dose_rewire_start');
  if (error) throw error;
  return data;
}
export async function rewireSubmit(tiles) {
  const { data, error } = await sb.rpc('dose_rewire_submit', { p_tiles: tiles });
  if (error) throw error;
  return data;
}

// Today's Hunch: the questions (no answers) and any guesses already made.
export async function hunchStart() {
  await user();
  const { data, error } = await sb.rpc('dose_hunch_start');
  if (error) throw error;
  return data;
}
export async function hunchGuess(i, v) {
  const { data, error } = await sb.rpc('dose_hunch_guess', { p_i: i, p_v: v });
  if (error) throw error;
  return data;
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
