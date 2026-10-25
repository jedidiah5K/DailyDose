// Vault rules: crack a 4-symbol code (6 symbols, repeats allowed) in 8 guesses or fewer.
// The code and the checking live on the server (supabase/migrations/0001_dose_core.sql).
export const SLOTS = 4, SYMBOLS = 6, MAX_GUESSES = 8;
