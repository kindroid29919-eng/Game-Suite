import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PlayerStats {
  username: string;
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
      .from('hc_players')
      .select('*')
      .eq('username', username)
      .limit(1)
      .single();
    if (error && error.code === 'PGRST116') {
      // not found — create
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
  } catch {
    return null;
  }
}

export async function upsertPlayerStats(
  username: string,
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
    const row = {
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
    await supabase.from('hc_players').upsert(row);
  } catch {
    // silent
  }
}

export async function logBall(
  username: string,
  batterNum: number,
  bowlerNum: number,
  outcome: string,
  playerRole: string,
): Promise<void> {
  if (!username) return;
  try {
    await supabase.from('hc_balls').insert({
      username, batter_num: batterNum, bowler_num: bowlerNum,
      outcome, player_role: playerRole,
    });
  } catch {
    // silent
  }
}

export async function getGlobalBatterNums(): Promise<number[]> {
  try {
    const { data } = await supabase
      .from('hc_balls').select('batter_num').limit(10000);
    return (data || []).map((r: { batter_num: number }) => r.batter_num);
  } catch {
    return [];
  }
}
