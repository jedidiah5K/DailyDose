// The share image (a 9:16 story or a square) and the lineup it reads from.
// Spoiler-free: it shows how you did, never the answers.
import { puzzleNo } from '../lib/day.js';
import { moonPath } from './icons.js';
import { resultFor } from '../lib/store.js';
import { clock } from '../lib/day.js';

// Finished games for today, as lines for the card and the text share. Add new games here.
export const LINEUP = [
  { k: 'rewire', name: 'Rewire', color: '#3F7FC4', emoji: '⚡',
    big: r => `Wired in ${clock(r.ms)}`, small: r => (r.stars ? `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}  ` : '') + (r.beat != null ? `Faster than ${r.beat}% of players` : 'Solved') + (r.hints ? ` · ${r.hints} hint${r.hints > 1 ? 's' : ''}` : ' · no hints') },
  { k: 'hunch', name: 'Hunch', color: '#C99A1E', emoji: '🎯',
    big: r => r.points != null ? `${r.points} points` : `${Math.round(r.err)}% off`, small: r => r.points != null ? `${r.hits} of 5 in band${r.theme ? ` · theme: ${r.theme}` : ''}` : `Average error ${Math.round(r.err)}%` },
  { k: 'link', name: 'Missing Link', color: '#2C9A88', emoji: '🔗',
    big: r => `${r.score} of 15`, small: r => `${r.solved} of 5 links` + (r.beat != null ? ` · beat ${r.beat}%` : '') },
  { k: 'tangle', name: 'Tangle', color: '#DD7444', emoji: '🪢',
    big: r => `Untangled in ${clock(r.ms)}`, small: r => (r.beat != null ? `Faster than ${r.beat}% of players` : 'Knot untied') + ` · ${r.moves} moves` },
  { k: 'anagram', name: 'Anagram', color: '#CF4F7D', emoji: '🔤',
    big: r => `${r.solved} of ${r.n} in ${clock(r.ms)}`, small: r => r.beat != null ? `Better than ${r.beat}% of players` : 'Unscrambled' },
  { k: 'ladder', name: 'Ladder', color: '#7D5FC6', emoji: '🪜',
    big: r => r.solved ? `${r.steps} steps` : 'Gave up', small: r => `Par ${r.par}` + (r.beat != null ? ` · beat ${r.beat}%` : '') },
];
export const doneTonight = () => LINEUP.filter(g => resultFor(g.k)).map(g => ({ ...g, r: resultFor(g.k) }));

const SERIF = '"Instrument Serif", Georgia, serif', SANS = '"Geist Variable", system-ui, sans-serif', MONO = '"Geist Mono Variable", ui-monospace, monospace';

// The share image: a plain white card, like a clipping. One row per game you finished today.
export async function drawCard(format = 'story') {
  await Promise.all([`96px ${SERIF}`, `italic 96px ${SERIF}`, `400 40px ${SANS}`, `600 40px ${SANS}`, `500 30px ${MONO}`].map(f => document.fonts.load(f).catch(() => {})));
  const W = 1080, H = format === 'story' ? 1920 : 1080, story = format === 'story';
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), pad = 96;
  x.fillStyle = '#F3F1EC'; x.fillRect(0, 0, W, H);

  // masthead
  const top = story ? 220 : 130;
  x.fillStyle = '#151515'; x.font = `${story ? 150 : 120}px ${SERIF}`; x.fillText('Daily', pad, top); x.font = `italic ${story ? 150 : 120}px ${SERIF}`; x.fillText('Dose', pad + x.measureText('Daily ').width + 30, top);
  // the moon, as full as tonight's dose
  const f = doneTonight().length / LINEUP.length, mx = W - pad - 60, my = top - 50;
  x.fillStyle = '#E2DED5'; x.beginPath(); x.arc(mx, my, 56, 0, 7); x.fill();
  x.fillStyle = '#C9A54A'; x.fill(new Path2D(moonPath(f, mx, my, 56)));
  x.fillStyle = '#8A867E'; x.font = `500 30px ${MONO}`; x.letterSpacing = '5px';
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  x.fillText(`${date} · No. ${puzzleNo()}`.toUpperCase(), pad, top + 70); x.letterSpacing = '0px';
  x.fillStyle = '#DEDAD2'; x.fillRect(pad, top + 110, W - pad * 2, 2);

  // one row per finished game: colour square, name, result
  const games = doneTonight().slice(0, story ? 6 : 3);
  const rh = story ? 200 : 170;
  let y = top + 170;
  for (const gm of games) {
    x.fillStyle = gm.color; x.beginPath(); x.roundRect(pad, y, 110, 110, 28); x.fill();
    x.fillStyle = '#151515'; x.font = `600 40px ${SANS}`; x.fillText(gm.name, pad + 150, y + 42);
    x.font = `64px ${SERIF}`; x.fillText(gm.big(gm.r), pad + 150, y + 106);
    x.fillStyle = '#8A867E'; x.font = `500 26px ${MONO}`; x.fillText(gm.small(gm.r), pad + 150, y + 148);
    y += rh;
    x.fillStyle = '#DEDAD2'; x.fillRect(pad, y - 22, W - pad * 2, 2);
  }

  x.fillStyle = '#151515'; x.font = `500 30px ${MONO}`;
  const url = location.host; x.fillText(url, (W - x.measureText(url).width) / 2, H - (story ? 120 : 70));
  return c;
}

export const shareText = () => [`DAILY DOSE #${puzzleNo()}`, ...doneTonight().map(g => `${g.emoji} ${g.name}: ${g.big(g.r)}`), location.origin].join('\n');

// Share the image (and text) through the phone's share sheet; where that's not possible, save the image and copy the text.
export async function shareDose(format = 'story') {
  const canvas = await drawCard(format);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], `daily-dose-${puzzleNo()}-${format}.png`, { type: 'image/png' });
  const text = shareText();
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); } catch (e) {} return 'shared'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { await navigator.clipboard?.writeText(text); } catch (e) {}
  return 'saved';
}
