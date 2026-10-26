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
export async function rewireSubmit(tiles, taps) {
  const { data, error } = await sb.rpc('dose_rewire_submit', { p_tiles: tiles, p_taps: taps });
  if (error) throw error;
  return data;
}

// Most games: one server function per move; the server checks it and keeps the official result.
async function rpc(name, args) {
  await user();
  const { data, error } = await sb.rpc(name, args);
  if (error) throw error;
  return data;
}
export const cipherStart = () => rpc('dose_cipher_start');
export const cipherGuess = (c, p) => rpc('dose_cipher_guess', { p_c: c, p_p: p });
export const ladderStart = () => rpc('dose_ladder_start');
export const ladderStep = word => rpc('dose_ladder_step', { p_word: word });
export const tangleStart = () => rpc('dose_tangle_start');
export const tangleSubmit = (pos, moves) => rpc('dose_tangle_submit', { p_pos: pos, p_moves: moves });

// Names and friends. Friends add each other by typing a friend code; they see each other's name and
// tonight's results, nothing else.
export const getMe = () => rpc('dose_me');
export const setName = name => rpc('dose_set_name', { p_name: name });
export const addFriend = code => rpc('dose_friend_add', { p_code: code });
export const removeFriend = id => rpc('dose_friend_remove', { p_id: id });
export const friendsToday = () => rpc('dose_friends_today');
// Without making a guest account just to look.
export const hasAccount = async () => !!(await sb.auth.getSession()).data.session;

// Your finished games from the server (the database only ever returns your own), so stats, streaks
// and badges match on every phone you sign in on.
export async function myResults() {
  // ponytail: newest 1000 games (about 200 nights of all five); page it when someone gets there
  const { data, error } = await sb.from('dose_plays').select('game, day, result').not('finished_at', 'is', null)
    .order('day', { ascending: false }).limit(1000);
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
