// Drop on the server: hands out today's course and replays every shot with the same physics the
// phone uses (dropLogic.js), so a result can't be faked. 3 shots, one official result per day.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { simulate, cleanShot, SHOTS } from './dropLogic.js';

const ALLOWED = ['https://daily-dose-azure.vercel.app', 'http://localhost:5181', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

Deno.serve(async req => {
  const h = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return out({ error: 'post only' }, 405);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return out({ error: 'not signed in' }, 401);

  let body: { action?: string; dx?: number; dy?: number } = {};
  try { body = await req.json(); } catch { return out({ error: 'bad request' }, 400); }
  const day = new Date().toISOString().slice(0, 10);

  const { data: puzzle } = await db.from('dose_puzzles').select('content').eq('game', 'drop').eq('day', day).eq('status', 'live').maybeSingle();
  if (!puzzle) return out({ error: 'no puzzle today' }, 404);
  const course = puzzle.content;

  await db.from('dose_plays').upsert({ user_id: user.id, game: 'drop', day }, { onConflict: 'user_id,game,day', ignoreDuplicates: true });
  const { data: play } = await db.from('dose_plays').select('guesses, result, finished_at').eq('user_id', user.id).eq('game', 'drop').eq('day', day).single();
  const shots = (play?.guesses || []) as { s: number[]; landed: boolean; miss: number }[];

  if (body.action === 'start') {
    const { rate, ...publicCourse } = course;   // the difficulty number isn't needed to play
    return out({ course: publicCourse, shots, result: play?.result ?? null });
  }
  if (body.action !== 'shot') return out({ error: 'bad action' }, 400);
  if (play?.finished_at) return out({ result: play.result, shots });
  if (shots.length >= SHOTS) return out({ error: 'no shots left' }, 409);
  if (!Number.isFinite(body.dx) || !Number.isFinite(body.dy)) return out({ error: 'bad shot' }, 400);

  // ponytail: two shots sent at the same instant could both pass the 3-shot check; the app sends one at a
  // time, so only a hand-made double request could do it. Add a guesses-unchanged check on update if that matters.
  const s = cleanShot(body.dx!, body.dy!);
  const sim = simulate(course, s);
  const next = [...shots, { s, landed: sim.landed, miss: sim.miss }];
  const over = sim.landed || next.length >= SHOTS;
  let result = null;
  if (over) {
    // score: landing on an earlier shot is better; a miss is ranked by how close it got
    const best = Math.min(...next.map(x => x.miss));
    const score = sim.landed ? next.length : SHOTS + 1 + best / 1000;
    const { data: others } = await db.from('dose_plays').select('result').eq('game', 'drop').eq('day', day).not('finished_at', 'is', null);
    const scores = (others || []).map(o => o.result?.score).filter((v: unknown) => typeof v === 'number') as number[];
    const worse = scores.filter(v => v > score).length;
    result = { landed: sim.landed, shot: sim.landed ? next.length : null, miss: sim.landed ? 0 : best, score, beat: scores.length ? Math.round(100 * worse / (scores.length + 1)) : null, players: scores.length + 1 };
  }
  await db.from('dose_plays').update({ guesses: next, ...(over ? { result, won: sim.landed, finished_at: new Date().toISOString() } : {}) })
    .eq('user_id', user.id).eq('game', 'drop').eq('day', day);
  return out({ shot: { s, landed: sim.landed, miss: sim.miss }, result, shots: next });
});
