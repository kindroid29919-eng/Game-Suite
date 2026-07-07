import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Player stats ──────────────────────────────────────────────────────────────

export interface PlayerStats {
  username: string;
  user_id?: string;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  bat_runs: number;
  bat_balls: number;
  bat_outs: number;
  bat_hs: number;
  bowl_wkts: number;
  bowl_runs: number;
  bowl_balls: number;
  catches: number;
  runouts: number;
  stumpings: number;
}

export async function loadPlayer(username: string): Promise<PlayerStats | null> {
  if (!username) return null;
  try {
    const { data, error } = await supabase
      .from('hc_players').select('*').eq('username', username).limit(1).single();
    if (error && error.code === 'PGRST116') {
      const blank: PlayerStats = {
        username, matches: 0, wins: 0, losses: 0, ties: 0,
        bat_runs: 0, bat_balls: 0, bat_outs: 0, bat_hs: 0,
        bowl_wkts: 0, bowl_runs: 0, bowl_balls: 0,
        catches: 0, runouts: 0, stumpings: 0,
      };
      await supabase.from('hc_players').insert(blank);
      return blank;
    }
    if (error) return null;
    return data as PlayerStats;
  } catch { return null; }
}

export async function upsertPlayerStats(
  username: string,
  userId: string | undefined,
  won: boolean,
  tied: boolean,
  playerStats: {
    runs: number; balls: number; outs: number;
    runs_conceded: number; balls_bowled: number;
    catches: number; runouts: number; stumpings: number; bowled: number;
  },
  bowlWkts: number,
): Promise<void> {
  if (!username) return;
  try {
    const { data: existing } = await supabase
      .from('hc_players').select('*').eq('username', username).limit(1).single();
    const ex = (existing as PlayerStats) || {} as PlayerStats;
    const a = (k: keyof PlayerStats, v: number) => ((ex[k] as number) || 0) + v;
    const row: Partial<PlayerStats> = {
      username,
      matches:    a('matches', 1),
      wins:       a('wins',    won ? 1 : 0),
      losses:     a('losses',  !won && !tied ? 1 : 0),
      ties:       a('ties',    tied ? 1 : 0),
      bat_runs:   a('bat_runs',   playerStats.runs),
      bat_balls:  a('bat_balls',  playerStats.balls),
      bat_outs:   a('bat_outs',   playerStats.outs),
      bat_hs:     Math.max(ex.bat_hs || 0, playerStats.runs),
      bowl_wkts:  a('bowl_wkts',  bowlWkts),
      bowl_runs:  a('bowl_runs',  playerStats.runs_conceded),
      bowl_balls: a('bowl_balls', playerStats.balls_bowled),
      catches:    a('catches',    playerStats.catches),
      runouts:    a('runouts',    playerStats.runouts),
      stumpings:  a('stumpings',  playerStats.stumpings),
    };
    if (userId) row.user_id = userId;
    await supabase.from('hc_players').upsert(row);
  } catch { /* silent */ }
}

export async function logBall(
  username: string,
  userId: string | undefined,
  batterNum: number,
  bowlerNum: number,
  outcome: string,
  playerRole: string,
): Promise<void> {
  if (!username) return;
  try {
    await supabase.from('hc_balls').insert({
      username,
      user_id: userId ?? null,
      batter_num: batterNum,
      bowler_num: bowlerNum,
      outcome,
      player_role: playerRole,
    });
  } catch { /* silent */ }
}

export async function getGlobalBatterNums(): Promise<number[]> {
  try {
    const { data } = await supabase.from('hc_balls').select('batter_num').limit(10000);
    return (data || []).map((r: { batter_num: number }) => r.batter_num);
  } catch { return []; }
}

/** Load this user's ball history for AI seeding — last 200 balls as batter, last 200 as bowler. */
export async function getUserBallHistory(userId: string): Promise<{ batSeq: number[]; bowlSeq: number[] }> {
  try {
    const { data } = await supabase
      .from('hc_balls')
      .select('batter_num, bowler_num, player_role')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(400);
    if (!data) return { batSeq: [], bowlSeq: [] };
    const batSeq: number[] = [];
    const bowlSeq: number[] = [];
    for (const row of [...data].reverse()) {
      if (row.player_role === 'batter') batSeq.push(row.batter_num);
      if (row.player_role === 'bowler') bowlSeq.push(row.bowler_num);
    }
    return { batSeq: batSeq.slice(-200), bowlSeq: bowlSeq.slice(-200) };
  } catch { return { batSeq: [], bowlSeq: [] }; }
}

// ── Multiplayer ───────────────────────────────────────────────────────────────

export interface MpConfig {
  totalOvers: number;
  totalWickets: number;
}

export type MpPhase =
  | 'lobby'
  | 'toss'
  | 'toss_choice'
  | 'pick'
  | 'innings_break'
  | 'result';

export interface MpGameState {
  phase: MpPhase;
  tossResult: 'heads' | 'tails';
  tossWinner: 'host' | 'guest';
  firstBatter: 'host' | 'guest' | null;
  currentInnings: 1 | 2;
  score: number;
  wicketsLost: number;
  ballsBowled: number;
  target: number | null;
  innings1Score: number;
  innings1Wickets: number;
  innings1Balls: number;
  innings1Batter: 'host' | 'guest' | null;
  lastMsg: string;
  lastEvent: 'out' | 'six' | 'runs' | 'dot' | null;
  resultMsg: string;
  batterHistory: number[];
  bowlerHistory: number[];
}

export interface MpMatch {
  id: string;
  room_code: string;
  host_id: string;
  guest_id: string | null;
  host_username: string;
  guest_username: string | null;
  status: 'waiting' | 'active' | 'complete';
  config: MpConfig;
  game_state: MpGameState;
  host_pick: number | null;
  guest_pick: number | null;
  guest_action: string | null;
}

function makeMpInitialState(config: MpConfig): MpGameState {
  return {
    phase: 'toss',
    tossResult: Math.random() < 0.5 ? 'heads' : 'tails',
    tossWinner: Math.random() < 0.5 ? 'host' : 'guest',
    firstBatter: null,
    currentInnings: 1,
    score: 0,
    wicketsLost: 0,
    ballsBowled: 0,
    target: null,
    innings1Score: 0,
    innings1Wickets: 0,
    innings1Balls: 0,
    innings1Batter: null,
    lastMsg: '',
    lastEvent: null,
    resultMsg: '',
    batterHistory: [],
    bowlerHistory: [],
  };
}

export async function createMpMatch(
  hostId: string,
  hostUsername: string,
  config: MpConfig,
): Promise<MpMatch | null> {
  try {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase
      .from('mp_matches')
      .insert({
        room_code: roomCode,
        host_id: hostId,
        host_username: hostUsername,
        status: 'waiting',
        config,
        game_state: { phase: 'lobby' },
        host_pick: null,
        guest_pick: null,
        guest_action: null,
      })
      .select()
      .single();
    if (error) { console.error('createMpMatch', error); return null; }
    return data as MpMatch;
  } catch (e) { console.error(e); return null; }
}

export async function joinMpMatch(
  roomCode: string,
  guestId: string,
  guestUsername: string,
): Promise<MpMatch | null> {
  try {
    // Fetch the match first
    const { data: match, error: fetchErr } = await supabase
      .from('mp_matches')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .eq('status', 'waiting')
      .single();
    if (fetchErr || !match) return null;
    if (match.host_id === guestId) return null; // can't join own match

    // Conditional update: only succeeds if match is still waiting with no guest (prevents double-join race)
    const gameState = makeMpInitialState(match.config as MpConfig);
    const { data, error } = await supabase
      .from('mp_matches')
      .update({
        guest_id: guestId,
        guest_username: guestUsername,
        status: 'active',
        game_state: gameState,
      })
      .eq('id', match.id)
      .eq('status', 'waiting')
      .is('guest_id', null)
      .select()
      .single();
    if (error) { console.error('joinMpMatch', error); return null; }
    return data as MpMatch;
  } catch (e) { console.error(e); return null; }
}

export async function getMpMatch(roomCode: string): Promise<MpMatch | null> {
  try {
    const { data, error } = await supabase
      .from('mp_matches')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .single();
    if (error) return null;
    return data as MpMatch;
  } catch { return null; }
}

export async function updateMpMatch(
  matchId: string,
  updates: Partial<Pick<MpMatch, 'game_state' | 'host_pick' | 'guest_pick' | 'guest_action' | 'status'>>,
): Promise<void> {
  try {
    await supabase.from('mp_matches').update(updates).eq('id', matchId);
  } catch { /* silent */ }
}
