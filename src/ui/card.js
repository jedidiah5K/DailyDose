// The share image (the Sticker Bomb card) and the lineup it reads from.
// Spoiler-free: it shows how you did, never the answers.
import { puzzleNo } from '../lib/day.js';
import { stickerSvgDoc } from './stickers.js';
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

const SERIF = '"Pixelify Sans", system-ui, sans-serif', MONO = SERIF; // one font everywhere, share card included
// What each game's sticker says on the card.
const TAG = {
  shot: r => r.ok ? `${(r.ms / 1000).toFixed(1)}S` : 'MISSED', rush: r => `${r.points} PTS`, blend: r => `${r.score} PTS`,
  hilo: r => r.bust ? 'BUST' : `${r.banked}`, link: r => `${r.score}/15`, ladder: r => r.solved ? (r.steps === r.par ? 'ON PAR' : `${r.steps} STEPS`) : 'GAVE UP',
};
// The pile on the card (centre x, centre y, size, tilt in a 360x640 card), drawn back to front.
const PILE = [['shot', 84, 318, 136, -12], ['link', 262, 306, 146, 9], ['rush', 82, 492, 128, 10],
  ['hilo', 284, 478, 128, -14], ['blend', 178, 404, 134, -3], ['ladder', 190, 540, 118, 6]];

async function drawSticker(x, k, cx, cy, size, tilt, text) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(stickerSvgDoc(k, Math.round(size * 1.12)));
  try { await img.decode(); } catch (e) { return; }
  x.save(); x.translate(cx, cy); x.rotate(tilt * Math.PI / 180);
  x.drawImage(img, -size * 0.56, -size * 0.56, size * 1.12, size * 1.12);
  if (text) {
    x.fillStyle = '#FFFDF7'; x.textAlign = 'center'; x.letterSpacing = `${size * 0.005}px`;
    x.font = `700 ${size * (text.length > 9 ? 0.085 : 0.11)}px ${MONO}`; x.fillText(text, 0, size * 0.27 + size * 0.035);
  }
  x.restore();
}

// The share image: the Sticker Bomb card. Your stickers for today piled on a dark card under "full dose."
// only: a game key to share just that game (one big sticker); leave it out for the whole dose.
export async function drawCard(format = 'story', only) {
  await Promise.all([`104px ${SERIF}`, `italic 104px ${SERIF}`, `500 30px ${MONO}`, `700 30px ${MONO}`].map(f => document.fonts.load(f).catch(() => {})));
  const S = 3, W = 360 * S, H = 640 * S;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const games = doneTonight().filter(g => !only || g.k === only), all = !only && games.length === LINEUP.length, run = streak();
  x.fillStyle = '#17151F'; x.fillRect(0, 0, W, H);

  // header
  x.fillStyle = 'rgba(244,239,227,.65)'; x.font = `500 ${10 * S}px ${MONO}`; x.letterSpacing = `${1.4 * S}px`;
  x.textAlign = 'left'; x.fillText(`THE DAILY DOSE · NO. ${puzzleNo()}`, 22 * S, 32 * S);
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  x.textAlign = 'right'; x.fillText(date, W - 22 * S, 32 * S);
  if (run > 1) x.fillText(`${run}-DAY STREAK`, W - 22 * S, 46 * S);
  x.textAlign = 'left'; x.letterSpacing = '0px';

  // the headline: "full dose." once everything is done, else the game or the count
  const [l1, l2] = only ? [games[0]?.name.toLowerCase() || 'today', 'dosed.'] : all ? ['full', 'dose.'] : [`${games.length} of ${LINEUP.length}`, 'dosed.'];
  const fit = (t, italic) => { let sz = 104 * S; x.font = `${italic ? 'italic ' : ''}${sz}px ${SERIF}`; while (x.measureText(t).width > (only ? 300 : 210) * S && sz > 50 * S) { sz -= 4 * S; x.font = `${italic ? 'italic ' : ''}${sz}px ${SERIF}`; } return sz; };
  x.fillStyle = '#F4EFE3'; fit(l1, false); x.fillText(l1, 18 * S, 124 * S);
  x.fillStyle = '#F2C94C'; fit(l2, true); x.fillText(l2, 18 * S, 209 * S);

  // the stickers
  if (only && games[0]) await drawSticker(x, games[0].k, 180 * S, 400 * S, 230 * S, -6, TAG[games[0].k](games[0].r));
  else for (const [k, cx, cy, size, tilt] of PILE) {
    const g = games.find(v => v.k === k);
    if (g) await drawSticker(x, k, cx * S, cy * S, size * S, tilt, TAG[k](g.r));
  }
  // footer: a pill with the count, and the address
  x.font = `500 ${9 * S}px ${MONO}`; x.letterSpacing = `${0.6 * S}px`;
  const pill = only ? 'DOSED TODAY' : `${games.length}/${LINEUP.length}${all ? ' · ALL DONE' : ''}`, pw = x.measureText(pill).width + 20 * S;
  x.fillStyle = '#F4EFE3'; x.beginPath(); x.roundRect(22 * S, H - 40 * S, pw, 22 * S, 11 * S); x.fill();
  x.fillStyle = '#151515'; x.fillText(pill, 32 * S, H - 25.5 * S);
  x.fillStyle = 'rgba(244,239,227,.8)'; x.textAlign = 'right'; x.fillText(location.host.toUpperCase(), W - 22 * S, H - 25.5 * S);
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
