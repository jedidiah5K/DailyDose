// "Tonight's Dose" share image, drawn on a canvas in the night-city look: a 9:16 story or a square.
// Spoiler-free: it shows how you did, never the answers.
import { puzzleNo, dayKey } from '../lib/day.js';
import { resultFor } from '../lib/store.js';
import { clock } from '../lib/day.js';

// Finished games for today, as lines for the card and the text share. Add new games here.
export const LINEUP = [
  { k: 'rewire', name: 'Rewire', color: '#5CE1FF', emoji: '⚡',
    big: r => `Lit in ${clock(r.ms)}`, small: r => (r.stars ? `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}  ` : '') + (r.beat != null ? `Faster than ${r.beat}% of players` : 'City lit') + (r.hints ? ` · ${r.hints} hint${r.hints > 1 ? 's' : ''}` : ' · no hints') },
  { k: 'hunch', name: 'Hunch', color: '#93AAFF', emoji: '🎯',
    big: r => r.points != null ? `${r.points} points` : `${Math.round(r.err)}% off`, small: r => r.points != null ? `${r.hits} of 5 in band${r.theme ? ` · theme: ${r.theme}` : ''}` : `Average error ${Math.round(r.err)}%` },
  { k: 'drop', name: 'Drop', color: '#FFA53D', emoji: '⛳',
    big: r => r.landed ? (r.shot === 1 ? 'Hole in one' : `Landed on shot ${r.shot}`) : `Missed by ${r.miss} px`, small: r => (r.landed && r.stars != null ? `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}  ` : '') + (r.beat != null ? `Better than ${r.beat}% of players` : 'Three shots, one course') },
  { k: 'meld', name: 'Mind Meld', color: '#FF7AB0', emoji: '🧠',
    big: r => r.points != null ? `${r.points} points` : `${r.score} of 10 landed`, small: r => `Herd ${[...r.herd].map(m => ({ g: '●', y: '◐', x: '○', p: '●', c: '○' })[m]).join(' ')}  ·  Odd ${[...r.odd].map(m => ({ g: '●', y: '◐', x: '○', p: '●', c: '○' })[m]).join(' ')}` },
  { k: 'last', name: 'Last Stand', color: '#FF4D6D', emoji: '⚔️',
    big: r => `${r.points} points`, small: r => (r.perfect ? 'Survived all 10' : r.banked ? `Banked after round ${r.reached}` : `Out on round ${r.reached + 1}`) + (r.beat != null ? ` · beat ${r.beat}%` : '') },
];
export const doneTonight = () => LINEUP.filter(g => resultFor(g.k)).map(g => ({ ...g, r: resultFor(g.k) }));

const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SERIF = '"Instrument Serif", Georgia, serif', MONO = '"Geist Mono Variable", ui-monospace, monospace', SANS = '"Geist Variable", system-ui, sans-serif';

function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }

export async function drawCard(format = 'story') {
  await Promise.all([`96px ${SERIF}`, `italic 96px ${SERIF}`, `40px ${MONO}`, `40px ${SANS}`].map(f => document.fonts.load(f).catch(() => {})));
  const W = 1080, H = format === 'story' ? 1920 : 1080, story = format === 'story';
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rnd(dayKey().split('-').join('') % 100000 + 7);

  // sky
  const g = x.createLinearGradient(0, 0, 0, H);
  [[0, '#060818'], [.4, '#0E1338'], [.68, '#23215A'], [.85, '#4A2C62'], [1, '#7A3D5C']].forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) { x.globalAlpha = .3 + r() * .7; x.fillStyle = '#fff'; x.beginPath(); x.arc(r() * W, r() * H * .62, r() > .9 ? 2.6 : 1.4, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  // moon
  const mx = W - 170, my = story ? 230 : 170;
  x.shadowColor = 'rgba(255,225,160,.45)'; x.shadowBlur = 90;
  const mg = x.createRadialGradient(mx - 20, my - 20, 10, mx, my, 70); mg.addColorStop(0, '#FFF8E2'); mg.addColorStop(1, '#F1D99A');
  x.fillStyle = mg; x.beginPath(); x.arc(mx, my, 66, 0, 7); x.fill(); x.shadowBlur = 0;

  // header
  const pad = 84;
  x.fillStyle = 'rgba(238,236,247,.75)'; x.font = `500 30px ${MONO}`; x.letterSpacing = '6px';
  x.fillText(`DAILY DOSE · NO. ${puzzleNo()}`, pad, story ? 180 : 130);
  x.letterSpacing = '0px';
  x.fillStyle = '#EEECF7'; x.font = `${story ? 150 : 118}px ${SERIF}`;
  const ty = story ? 360 : 255;
  x.fillText('Tonight’s', pad, ty);
  x.fillStyle = '#FFC861'; x.shadowColor = 'rgba(255,200,97,.6)'; x.shadowBlur = 40;
  x.font = `italic ${story ? 150 : 118}px ${SERIF}`; x.fillText('dose', pad, ty + (story ? 140 : 108)); x.shadowBlur = 0;

  // one neon sign per finished game
  const games = doneTonight().slice(0, story ? 4 : 2);
  const bh = story ? 250 : 200, gap = story ? 44 : 26;
  // centre the signs in the open sky between the title and the skyline
  const areaTop = story ? 560 : 340, areaBottom = story ? 1440 : 820;
  let y = areaTop + Math.max(0, (areaBottom - areaTop - (games.length * bh + (games.length - 1) * gap)) / 2);
  for (const gm of games) {
    x.save();
    x.shadowColor = gm.color; x.shadowBlur = 40; x.strokeStyle = gm.color; x.lineWidth = 5;
    roundRect(x, pad, y, W - pad * 2, bh, 34); x.stroke();
    x.shadowBlur = 0; x.fillStyle = 'rgba(6,8,24,.72)'; x.fill();
    x.restore();
    x.fillStyle = gm.color; x.shadowColor = gm.color; x.shadowBlur = 18; x.font = `700 32px ${MONO}`; x.letterSpacing = '8px';
    x.fillText(gm.name.toUpperCase(), pad + 52, y + (story ? 78 : 64)); x.letterSpacing = '0px'; x.shadowBlur = 0;
    x.fillStyle = '#FFFFFF'; x.font = `${story ? 92 : 74}px ${SERIF}`; x.fillText(gm.big(gm.r), pad + 50, y + (story ? 172 : 136));
    x.fillStyle = 'rgba(238,236,247,.6)'; x.font = `400 30px ${SANS}`; x.fillText(gm.small(gm.r), pad + 52, y + (story ? 220 : 172));
    y += bh + gap;
  }

  // skyline with warm windows: one lit tower per game you finished
  const base = H, top = story ? 1480 : 870;
  let bx = -10, k = 0;
  while (bx < W) {
    const w = 46 + r() * 70, h = (base - top) * (.35 + r() * .65), litAll = k % 5 === 2 && k / 5 < games.length;
    x.fillStyle = '#090B1C'; x.fillRect(bx, base - h, w - 4, h);
    for (let wy = base - h + 16; wy < base - 10; wy += 22) for (let wx = bx + 10; wx < bx + w - 14; wx += 16) {
      const on = litAll || r() > .78; x.fillStyle = on ? '#FFC861' : '#1E2546'; x.fillRect(wx, wy, 5, 7);
    }
    bx += w; k++;
  }
  // a dark strip so the address reads over the windows
  const fh = story ? 150 : 96, fade = x.createLinearGradient(0, H - fh, 0, H); fade.addColorStop(0, 'rgba(5,6,15,0)'); fade.addColorStop(.55, 'rgba(5,6,15,.92)'); fade.addColorStop(1, '#05060F');
  x.fillStyle = fade; x.fillRect(0, H - fh, W, fh);
  x.fillStyle = 'rgba(238,236,247,.85)'; x.font = `500 28px ${MONO}`; x.letterSpacing = '4px';
  const url = location.host.toUpperCase(); x.fillText(url, (W - x.measureText(url).width) / 2, H - 46); x.letterSpacing = '0px';
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
