// The nightly dive (Job, 2026-11-20, docs/dive-plan.md): every finished game sinks you deeper into
// tonight's cup, up to 100 m a game. Worked out from results the server already sends, so the games'
// own rules, scores and rankings don't change. Even a miss sinks you a little.
const clamp = (x, lo = 0, hi = 100) => Math.round(Math.min(hi, Math.max(lo, x)));

const DEPTH = {
  shot: r => r.ok ? 60 + clamp(40 * (1 - (r.ms ?? 7000) / 7000), 0, 40) : r.close ? 30 : 10,
  rush: r => clamp((r.points || 0) * 5),
  blend: r => clamp((r.score || 0) / 5),
  hilo: r => r.bust ? clamp((r.rights || 0) * 5, 0, 30) : 30 + clamp(70 * (r.rights || 0) / (r.len || 12), 0, 70),
  link: r => clamp((r.score || 0) / 15 * 100),
  ladder: r => r.solved ? clamp(100 - 10 * Math.max(0, r.steps - r.par), 50) : 15,
};
export const GAMES = Object.keys(DEPTH);
export const depth = (k, r) => r && DEPTH[k] ? DEPTH[k](r) : 0;

// Tonight's depth from all results ({ game: { day: result } }).
export const tonight = (results, day) => GAMES.reduce((m, k) => m + depth(k, results[k]?.[day]), 0);

export const LANDMARKS = [
  [0, 'the foam'], [35, 'a wonky latte-art heart'], [80, 'the crema line'], [130, 'a sugar cube having a bath'],
  [190, 'a teaspoon someone dropped in 2019'], [250, 'a coffee-bean submarine'], [310, 'the barista’s lost wedding ring'],
  [370, 'a biscotti shipwreck'], [430, 'the cat’s missing toy mouse'], [490, 'a very confused goldfish'],
  [550, 'the secret recipe, in a bottle'], [600, 'the bottom of the cup'],
];
// The deepest landmark you've reached at m metres.
export const landmark = m => LANDMARKS.filter(([d]) => d <= m).pop()[1];
// Landmarks crossed going from a to b metres (for "You sank past …").
export const passed = (a, b) => LANDMARKS.filter(([d]) => d > a && d <= b).map(([, n]) => n);
