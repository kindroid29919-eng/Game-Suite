import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Player stats ──────────────────────────────────────────────────────────────

export interface PlayerStats {
  username: string;
  user_id?: string;
  // General
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  current_win_streak?: number;
  best_win_streak?: number;
  last_5_results?: string;
  // Batting
  bat_runs: number;
  bat_balls: number;
  bat_outs: number;
  bat_hs: number;
  bat_highest_team_score?: number;
  bat_thirties?: number;
  bat_fifties?: number;
  bat_centuries?: number;
  bat_double_centuries?: number;
  // Bowling
  bowl_wkts: number;
  bowl_runs: number;
  bowl_balls: number;
  bowl_best_wkts?: number;
  bowl_best_runs_for_best?: number;
  bowl_4fer?: number;
  bowl_5fer?: number;
  bowl_10fer?: number;
  // Fielding
  catches: number;
  runouts: number;
  stumpings: number;
  catches_dropped?: number;
  runouts_missed?: number;
  stumpings_missed?: number;
  // Multiplayer General
  mp_matches?: number;
  mp_wins?: number;
  mp_losses?: number;
  mp_ties?: number;
  mp_current_win_streak?: number;
  mp_best_win_streak?: number;
  mp_last_5_results?: string;
  // Multiplayer Batting
  mp_bat_runs?: number;
  mp_bat_balls?: number;
  mp_bat_outs?: number;
  mp_bat_hs?: number;
  mp_bat_highest_team_score?: number;
  mp_bat_thirties?: number;
  mp_bat_fifties?: number;
  mp_bat_centuries?: number;
  mp_bat_double_centuries?: number;
  // Multiplayer Bowling
  mp_bowl_wkts?: number;
  mp_bowl_runs?: number;
  mp_bowl_balls?: number;
  mp_bowl_best_wkts?: number;
  mp_bowl_best_runs_for_best?: number;
  mp_bowl_4fer?: number;
  mp_bowl_5fer?: number;
  // Multiplayer Fielding
  mp_catches?: number;
}

// ── H2H Record ────────────────────────────────────────────────────────────────

export interface H2HRecord {
  id?: string;
  user_id: string;
  opponent_username: string;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateLast5(current: string | undefined, result: 'W' | 'L' | 'T'): string {
  return ((current ?? '') + result).slice(-5);
}

function updateWinStreak(existingStreak: number | undefined, won: boolean): number {
  return won ? (existingStreak ?? 0) + 1 : 0;
}

function updateBestStreak(existingBest: number | undefined, newStreak: number): number {
  return Math.max(existingBest ?? 0, newStreak);
}

function updateBestFigures(
  existingWkts: number | undefined,
  existingRuns: number | undefined,
  newWkts: number,
  newRuns: number,
): { bowl_best_wkts: number; bowl_best_runs_for_best: number } {
  const ew = existingWkts ?? 0;
  const er = existingRuns ?? 999;
  const isBetter = newWkts > ew || (newWkts === ew && newRuns < er);
  return isBetter
    ? { bowl_best_wkts: newWkts, bowl_best_runs_for_best: newRuns }
    : { bowl_best_wkts: ew, bowl_best_runs_for_best: er === 999 ? 0 : er };
}

function milestoneIncrements(teamScore: number) {
  // Exclusive brackets: 30-49, 50-99, 100-199, 200+
  return {
    bat_thirties: teamScore >= 30 && teamScore < 50 ? 1 : 0,
    bat_fifties: teamScore >= 50 && teamScore < 100 ? 1 : 0,
    bat_centuries: teamScore >= 100 && teamScore < 200 ? 1 : 0,
    bat_double_centuries: teamScore >= 200 ? 1 : 0,
  };
}

// ── Data Loaders ──────────────────────────────────────────────────────────────

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

// ── Single-player stats upsert ────────────────────────────────────────────────

export async function upsertPlayerStats(
  username: string,
  userId: string | undefined,
  won: boolean,
  tied: boolean,
  playerStats: {
    runs: number; balls: number; outs: number;
    runs_conceded: number; balls_bowled: number;
    catches: number; runouts: number; stumpings: number; bowled: number;
    catches_dropped: number; runouts_missed: number; stumpings_missed: number;
    team_score: number;
  },
  bowlWkts: number,
): Promise<void> {
  if (!username) return;
  try {
    const { data: existing } = await supabase
      .from('hc_players').select('*').eq('username', username).limit(1).single();
    const ex = (existing as PlayerStats) || {} as PlayerStats;
    const a = (k: keyof PlayerStats, v: number) => ((ex[k] as number) || 0) + v;

    const resultChar: 'W' | 'L' | 'T' = won ? 'W' : tied ? 'T' : 'L';
    const newStreak = updateWinStreak(ex.current_win_streak, won);
    const bestFigs = updateBestFigures(ex.bowl_best_wkts, ex.bowl_best_runs_for_best, bowlWkts, playerStats.runs_conceded);
    const milestones = milestoneIncrements(playerStats.team_score);

    const row: Partial<PlayerStats> = {
      username,
      matches:    a('matches', 1),
      wins:       a('wins',    won ? 1 : 0),
      losses:     a('losses',  !won && !tied ? 1 : 0),
      ties:       a('ties',    tied ? 1 : 0),
      current_win_streak: newStreak,
      best_win_streak: updateBestStreak(ex.best_win_streak, newStreak),
      last_5_results: updateLast5(ex.last_5_results, resultChar),

      bat_runs:   a('bat_runs',   playerStats.runs),
      bat_balls:  a('bat_balls',  playerStats.balls),
      bat_outs:   a('bat_outs',   playerStats.outs),
      bat_hs:     Math.max(ex.bat_hs || 0, playerStats.team_score),
      bat_highest_team_score: Math.max(ex.bat_highest_team_score || 0, playerStats.team_score),
      bat_thirties:       a('bat_thirties',       milestones.bat_thirties),
      bat_fifties:        a('bat_fifties',        milestones.bat_fifties),
      bat_centuries:      a('bat_centuries',      milestones.bat_centuries),
      bat_double_centuries: a('bat_double_centuries', milestones.bat_double_centuries),

      bowl_wkts:  a('bowl_wkts',  bowlWkts),
      bowl_runs:  a('bowl_runs',  playerStats.runs_conceded),
      bowl_balls: a('bowl_balls', playerStats.balls_bowled),
      bowl_best_wkts: bestFigs.bowl_best_wkts,
      bowl_best_runs_for_best: bestFigs.bowl_best_runs_for_best,
      bowl_4fer:  a('bowl_4fer',  bowlWkts >= 4 && bowlWkts < 5 ? 1 : 0),
      bowl_5fer:  a('bowl_5fer',  bowlWkts >= 5 && bowlWkts < 10 ? 1 : 0),
      bowl_10fer: a('bowl_10fer', bowlWkts >= 10 ? 1 : 0),

      catches:           a('catches',           playerStats.catches),
      runouts:           a('runouts',            playerStats.runouts),
      stumpings:         a('stumpings',          playerStats.stumpings),
      catches_dropped:   a('catches_dropped',    playerStats.catches_dropped),
      runouts_missed:    a('runouts_missed',     playerStats.runouts_missed),
      stumpings_missed:  a('stumpings_missed',   playerStats.stumpings_missed),
    };
    if (userId) row.user_id = userId;
    await supabase.from('hc_players').upsert(row);
  } catch { /* silent */ }
}

// ── Multiplayer stats upsert ──────────────────────────────────────────────────

export async function upsertMpStats(
  username: string,
  userId: string,
  won: boolean,
  tied: boolean,
  playerStats: {
    bat_runs: number;
    bat_balls: number;
    bat_outs: number;
    team_score: number;
    bowl_wkts: number;
    bowl_runs: number;
    bowl_balls: number;
    catches: number;
  },
  opponentUsername: string,
): Promise<boolean> {
  if (!username) return false;
  try {
    // Ensure the player row exists before doing MP-column update.
    // loadPlayer creates a fully-initialised base row if missing.
    const loaded = await loadPlayer(username);
    if (!loaded) return false;

    const ex = loaded;
    const ma = (k: keyof PlayerStats, v: number) => ((ex[k] as number) || 0) + v;

    const resultChar: 'W' | 'L' | 'T' = won ? 'W' : tied ? 'T' : 'L';
    const newStreak = updateWinStreak(ex.mp_current_win_streak, won);
    const bestFigs = updateBestFigures(ex.mp_bowl_best_wkts, ex.mp_bowl_best_runs_for_best, playerStats.bowl_wkts, playerStats.bowl_runs);
    const milestones = milestoneIncrements(playerStats.team_score);

    const updates: Partial<PlayerStats> = {
      user_id: userId,
      mp_matches:            ma('mp_matches',  1),
      mp_wins:               ma('mp_wins',     won ? 1 : 0),
      mp_losses:             ma('mp_losses',   !won && !tied ? 1 : 0),
      mp_ties:               ma('mp_ties',     tied ? 1 : 0),
      mp_current_win_streak: newStreak,
      mp_best_win_streak:    updateBestStreak(ex.mp_best_win_streak, newStreak),
      mp_last_5_results:     updateLast5(ex.mp_last_5_results, resultChar),

      mp_bat_runs:            ma('mp_bat_runs',  playerStats.bat_runs),
      mp_bat_balls:           ma('mp_bat_balls', playerStats.bat_balls),
      mp_bat_outs:            ma('mp_bat_outs',  playerStats.bat_outs),
      mp_bat_hs:              Math.max(ex.mp_bat_hs || 0, playerStats.team_score),
      mp_bat_highest_team_score: Math.max(ex.mp_bat_highest_team_score || 0, playerStats.team_score),
      mp_bat_thirties:        ma('mp_bat_thirties',        milestones.bat_thirties),
      mp_bat_fifties:         ma('mp_bat_fifties',         milestones.bat_fifties),
      mp_bat_centuries:       ma('mp_bat_centuries',       milestones.bat_centuries),
      mp_bat_double_centuries:ma('mp_bat_double_centuries',milestones.bat_double_centuries),

      mp_bowl_wkts:           ma('mp_bowl_wkts',  playerStats.bowl_wkts),
      mp_bowl_runs:           ma('mp_bowl_runs',  playerStats.bowl_runs),
      mp_bowl_balls:          ma('mp_bowl_balls', playerStats.bowl_balls),
      mp_bowl_best_wkts:      bestFigs.bowl_best_wkts,
      mp_bowl_best_runs_for_best: bestFigs.bowl_best_runs_for_best,
      mp_bowl_4fer:           ma('mp_bowl_4fer', playerStats.bowl_wkts >= 4 && playerStats.bowl_wkts < 5 ? 1 : 0),
      mp_bowl_5fer:           ma('mp_bowl_5fer', playerStats.bowl_wkts >= 5 ? 1 : 0),

      mp_catches:             ma('mp_catches', playerStats.catches),
    };

    const { error } = await supabase
      .from('hc_players')
      .update(updates)
      .eq('username', username);
    if (error) return false;

    // H2H is best-effort
    if (opponentUsername) {
      upsertH2HRecord(userId, opponentUsername, won, tied).catch(() => {});
    }
    return true;
  } catch { return false; }
}

// ── H2H functions ─────────────────────────────────────────────────────────────

export async function getH2HStats(userId: string, opponentUsername: string): Promise<H2HRecord | null> {
  try {
    const { data, error } = await supabase
      .from('hc_h2h')
      .select('*')
      .eq('user_id', userId)
      .eq('opponent_username', opponentUsername.trim())
      .limit(1)
      .single();
    if (error) return null;
    return data as H2HRecord;
  } catch { return null; }
}

export async function upsertH2HRecord(
  userId: string,
  opponentUsername: string,
  won: boolean,
  tied: boolean,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('hc_h2h')
      .select('*')
      .eq('user_id', userId)
      .eq('opponent_username', opponentUsername)
      .limit(1)
      .single();

    const ex = (existing as H2HRecord) || { matches: 0, wins: 0, losses: 0, ties: 0 };
    const row = {
      user_id: userId,
      opponent_username: opponentUsername,
      matches: (ex.matches || 0) + 1,
      wins:    (ex.wins    || 0) + (won             ? 1 : 0),
      losses:  (ex.losses  || 0) + (!won && !tied   ? 1 : 0),
      ties:    (ex.ties    || 0) + (tied             ? 1 : 0),
    };

    if (existing) {
      await supabase.from('hc_h2h').update(row).eq('user_id', userId).eq('opponent_username', opponentUsername);
    } else {
      await supabase.from('hc_h2h').insert(row);
    }
  } catch { /* silent */ }
}

// ── Ball logging ──────────────────────────────────────────────────────────────

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

// ── Multiplayer types ─────────────────────────────────────────────────────────

export interface MpConfig {
  totalOvers: number;
  totalWickets: number;
}

export type MpPhase =
  | 'lobby'
  | 'toss_call'
  | 'toss'
  | 'toss_choice'
  | 'pick'
  | 'innings_break'
  | 'result';

export interface MpGameState {
  phase: MpPhase;
  tossCaller?: 'host' | 'guest';
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

export function makeMpInitialState(config: MpConfig): MpGameState {
  return {
    phase: 'toss_call',
    tossCaller: Math.random() < 0.5 ? 'host' : 'guest',
    tossResult: 'heads',       // placeholder — overwritten when call is processed
    tossWinner: 'host',        // placeholder — overwritten when call is processed
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

// ── Multiplayer CRUD ──────────────────────────────────────────────────────────

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
    const { data: match, error: fetchErr } = await supabase
      .from('mp_matches')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .eq('status', 'waiting')
      .single();
    if (fetchErr || !match) return null;
    if (match.host_id === guestId) return null;

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
