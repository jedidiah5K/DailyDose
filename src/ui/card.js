// The share image (the café counter card) and the lineup it reads from.
// Spoiler-free: it shows how you did, never the answers.
import { puzzleNo } from '../lib/day.js';
import { resultFor, streak } from '../lib/store.js';
import { clock } from '../lib/day.js';
import { blendTiles } from '../screens/blend.js';
import { dropTiles } from '../screens/drop.js';

// Finished games for today, as lines for the card and the text share. Add new games here.
export const LINEUP = [
  { k: 'shot', name: 'The Shot', color: '#3F7FC4', emoji: '🎯',
    big: r => r.ok ? `Got it in ${(r.ms / 1000).toFixed(1)}s` : 'Missed', small: r => `${r.pct}% got today’s shot` },
  { k: 'rush', name: 'Rush', color: '#DD7444', emoji: '⏱️',
    big: r => `${r.points} points`, small: r => `${r.found} found` + (r.rare ? ` · ${r.rare} rare` : '') + (r.beat != null ? ` · beat ${r.beat}%` : '') },
  { k: 'blend', name: 'Blend', color: '#CF4F7D', emoji: '🥤',
    big: r => `${r.score} of 500`, small: r => blendTiles(r) + (r.beat != null ? ` · beat ${r.beat}%` : '') },
  { k: 'hilo', name: 'Drop', color: '#C99A1E', emoji: '💰',
    big: r => r.bust ? `Busted at ${r.rights + 1}` : `Banked ${r.banked.toLocaleString()}`, small: r => dropTiles(r) },
  { k: 'link', name: 'Missing Link', color: '#2C9A88', emoji: '🔗',
    big: r => `${r.score} of 15`, small: r => `${r.solved} of 5 links` + (r.beat != null ? ` · beat ${r.beat}%` : '') },
  { k: 'ladder', name: 'Ladder', color: '#7D5FC6', emoji: '🪜',
    big: r => r.solved ? `${r.steps} steps` : 'Gave up', small: r => `Par ${r.par}` + (r.beat != null ? ` · beat ${r.beat}%` : '') },
];
export const doneTonight = () => LINEUP.filter(g => resultFor(g.k)).map(g => ({ ...g, r: resultFor(g.k) }));

const FONT = '"Pixelify Sans", system-ui, sans-serif';
// What each game's mug says on the card.
const TAG = {
  shot: r => r.ok ? `${(r.ms / 1000).toFixed(1)}s` : 'Missed', rush: r => `${r.points} pts`, blend: r => `${r.score} pts`,
  hilo: r => r.bust ? 'Bust' : `${r.banked}`, link: r => `${r.score}/15`, ladder: r => r.solved ? (r.steps === r.par ? 'On par' : `${r.steps} steps`) : 'Gave up',
};
// Same art and rim centres as the home counter (src/screens/hub.js).
const ART = { shot: 1, blend: 2, rush: 3, hilo: 4, link: 5, ladder: 6 };
const RIM = { shot: .498, blend: .447, rush: .393, hilo: .393, link: .388, ladder: .498 };
const pic = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// The share image: the café counter. Today's six mugs on the counter, full ones carry your score.
// only: a game key to share just that game (one big mug); leave it out for the whole dose.
export async function drawCard(format = 'story', only) {
  const S = 3, W = 360 * S, H = 640 * S;   // drawn on a 360x640 grid, three times over
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const games = doneTonight().filter(g => !only || g.k === only), all = !only && games.length === LINEUP.length, run = streak();
  const hr = new Date().getHours(), A = '/art/home/';
  const keys = only ? [only] : LINEUP.map(g => g.k);
  const [bg, sign, pill, ...art] = await Promise.all([pic(`${A}tall-${hr >= 6 && hr < 18 ? 'day' : 'night'}.webp`), pic(A + 'sign_1.webp'), pic('/art/ui/pill.webp'),
    ...keys.flatMap(k => [pic(`${A}mug_${ART[k] + (resultFor(k) ? 6 : 0)}.webp`), pic(`${A}coaster_${ART[k]}.webp`)]),
    document.fonts.load(`700 40px ${FONT}`).catch(() => {})]);

  // the café, cropped to fill the card; the counter top ends up between y 429 and 543
  x.fillStyle = '#3A2117'; x.fillRect(0, 0, W, H);
  if (bg) { const k = H / bg.height; x.drawImage(bg, (W - bg.width * k) / 2, 0, bg.width * k, H); }
  if (sign) x.drawImage(sign, 180 * S - 78 * S, 22 * S, 156 * S, 156 * S * sign.height / sign.width);

  // the cream signboard: what you did today
  const [t1, t2] = only ? [games[0]?.name || 'Daily Dose', games[0] ? games[0].big(games[0].r) : '']
    : [all ? 'Full dose' : `${games.length} of ${LINEUP.length} shots`, run > 1 ? `${run} days in a row` : all ? 'Every shot pulled' : `${LINEUP.length - games.length} still brewing`];
  const bx = 34 * S, by = 196 * S, bw = 292 * S, bh = 132 * S, n = 4 * S;
  const board = (pad, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(bx - pad + n, by - pad); x.lineTo(bx + bw + pad - n, by - pad); x.lineTo(bx + bw + pad - n, by - pad + n); x.lineTo(bx + bw + pad, by - pad + n);
    x.lineTo(bx + bw + pad, by + bh + pad - n); x.lineTo(bx + bw + pad - n, by + bh + pad - n); x.lineTo(bx + bw + pad - n, by + bh + pad); x.lineTo(bx - pad + n, by + bh + pad);
    x.lineTo(bx - pad + n, by + bh + pad - n); x.lineTo(bx - pad, by + bh + pad - n); x.lineTo(bx - pad, by - pad + n); x.lineTo(bx - pad + n, by - pad + n); x.closePath(); x.fill(); };
  board(4 * S, '#3B2416'); board(0, '#F6E7C8');
  x.fillStyle = 'rgba(59,36,22,.12)'; x.fillRect(bx, by + bh - 6 * S, bw, 6 * S);   // a pixel shadow along the bottom
  x.textAlign = 'center'; x.fillStyle = '#3B2416';
  const fit = (t, size, max) => { let sz = size * S; x.font = `700 ${sz}px ${FONT}`; while (x.measureText(t).width > max * S && sz > 9 * S) { sz -= 1 * S; x.font = `700 ${sz}px ${FONT}`; } };
  fit(t1, 50, 260); x.fillText(t1, 180 * S, by + 60 * S);
  x.fillStyle = '#9A4E1F'; fit(t2, 24, 260); x.fillText(t2, 180 * S, by + 94 * S);
  x.fillStyle = 'rgba(59,36,22,.6)'; x.font = `700 ${12 * S}px ${FONT}`;
  x.fillText(`Daily Dose #${puzzleNo()}, ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, 180 * S, by + 118 * S);

  // the mugs on the counter: full with a score once played, empty and faded if not
  const big = !!only, slot = big ? [180] : keys.map((_, i) => 32 + 59.2 * i), base = big ? 506 : 486, mh = big ? 132 : 52;
  keys.forEach((k, i) => {
    const mug = art[i * 2], co = art[i * 2 + 1], g = games.find(v => v.k === k), cx = slot[i] * S;
    const cw = mh * 1.15 * S, ch = co ? cw * co.height / co.width : 0;
    x.globalAlpha = g ? 1 : .45;
    if (co) x.drawImage(co, cx - cw / 2, base * S - ch, cw, ch);
    if (mug) { const h = mh * S, w = h * mug.width / mug.height; x.drawImage(mug, cx - w * RIM[k], base * S - ch * .45 - h, w, h); }
    x.globalAlpha = 1;
    if (g && !big) {
      x.font = `700 ${13 * S}px ${FONT}`; x.lineJoin = 'round'; x.lineWidth = 4 * S; x.strokeStyle = '#3B2416';
      x.strokeText(TAG[k](g.r), cx, (base + 22) * S); x.fillStyle = '#F6E7C8'; x.fillText(TAG[k](g.r), cx, (base + 22) * S);
    }
  });

  // the golden pill: where to play
  const pw = 236 * S, ph = pill ? pw * pill.height / pill.width : 52 * S, py = 586 * S - ph / 2;
  if (pill) x.drawImage(pill, 180 * S - pw / 2, py, pw, ph);
  x.fillStyle = '#F6E7CB'; fit(location.host, 13, 160); x.fillText(location.host, 180 * S, py + ph / 2 + 4.5 * S);
  return c;
}

export const shareText = only => [`DAILY DOSE #${puzzleNo()}`, ...doneTonight().filter(g => !only || g.k === only).map(g => `${g.emoji} ${g.name}: ${g.big(g.r)}`), location.origin].join('\n');

// Share the image (and text) through the phone's share sheet; where that's not possible, save the image and copy the text.
export async function shareDose(format = 'story', only) {
  const canvas = await drawCard(format, only);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], `daily-dose-${puzzleNo()}-${format}.png`, { type: 'image/png' });
  const text = shareText(only);
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); } catch (e) {} return 'shared'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { await navigator.clipboard?.writeText(text); } catch (e) {}
  return 'saved';
}
