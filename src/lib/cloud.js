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
export async function rewireHint(tiles) {
  const { data, error } = await sb.rpc('dose_rewire_hint', { p_tiles: tiles });
  if (error) throw error;
  return data;
}
export async function rewireSubmit(tiles) {
  const { data, error } = await sb.rpc('dose_rewire_submit', { p_tiles: tiles });
  if (error) throw error;
  return data;
}

// Drop runs in a server function that replays every shot with the same physics.
async function dropCall(body) {
  await user();
  const { data, error } = await sb.functions.invoke('dose-drop', { body });
  if (error) { const msg = await error.context?.json?.().then(j => j.error).catch(() => null); throw new Error(msg || error.message); }
  return data;
}
export const dropStart = () => dropCall({ action: 'start' });
export const dropShot = (dx, dy) => dropCall({ action: 'shot', dx, dy });

// Mind Meld: prompts come one at a time; the server times each and matches answers to its list.
async function rpc(name, args) {
  await user();
  const { data, error } = await sb.rpc(name, args);
  if (error) throw error;
  return data;
}
export const lastStart = () => rpc('dose_last_start');
export const lastServe = () => rpc('dose_last_serve');
export const lastAnswer = choice => rpc('dose_last_answer', { p_choice: choice });
export const lastBank = () => rpc('dose_last_bank');
export const lastPick = perk => rpc('dose_last_pick', { p_perk: perk });
export const lastUse = perk => rpc('dose_last_use', { p_perk: perk });
export const meldStart = () => rpc('dose_meld_start');
export const meldServe = () => rpc('dose_meld_serve');
export const meldAnswer = text => rpc('dose_meld_answer', { p_text: text });

// Today's Hunch: the questions (no answers) and any guesses already made.
export async function hunchStart() {
  await user();
  const { data, error } = await sb.rpc('dose_hunch_start');
  if (error) throw error;
  return data;
}
export async function hunchBet(i, v, band, double) {
  const { data, error } = await sb.rpc('dose_hunch_bet', { p_i: i, p_v: v, p_band: band, p_double: !!double });
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
