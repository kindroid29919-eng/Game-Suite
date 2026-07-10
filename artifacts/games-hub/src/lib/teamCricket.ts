import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { upsertMpStats } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeamPhase =
  | 'lobby'
  | 'toss_call'
  | 'toss'
  | 'batting_setup'
  | 'bowling_setup'
  | 'pick'
  | 'dismissal'
  | 'innings_break'
  | 'result';

export interface BatRecord {
  runs: number; balls: number; fours: number; sixes: number;
  isOut: boolean; outType?: string; bowlerUsername?: string; fielderUsername?: string;
  didNotBat: boolean;
}
export interface BowlRecord {
  balls: number; runs: number; wickets: number;
  catches: number; runouts: number; stumpings: number;
  catchesDropped: number; runoutsMissed: number; stumpingsMissed: number;
}
export interface FielderAssignment {
  catch: string[]; runout: string[]; stump: string | null;
}
export interface InningsData {
  battingTeam: 'A' | 'B';
  runs: number; wickets: number; balls: number;
  batting: Record<string, BatRecord>;
  bowling: Record<string, BowlRecord>;
  batterOrder: string[];
  currentBatterUserId: string | null;
  nonStrikerUserId: string | null;
  currentBowlerUserId: string | null;
  fielders: FielderAssignment | null;
  batterHistory: Record<string, number[]>;
  pendingOverReset: boolean;
}
export interface PendingDismissal {
  type: string;
  batterUserId: string; bowlerUserId: string;
  batterNum: number; bowlerNum: number;
  fielderUserId: string | null;
  overEndedOnThisBall: boolean;
}
export interface TeamGameState {
  phase: TeamPhase;
  totalOvers: number; totalWickets: number;
  players: Record<string, { username: string }>;
  teamNames: { A: string; B: string };
  captains: { A: string | null; B: string | null };
  teamPlayers: { A: string[]; B: string[] };
  tossCaller: 'A' | 'B';
  tossCall: 'heads' | 'tails' | null;
  tossResult: 'heads' | 'tails' | null;
  tossWinner: 'A' | 'B' | null;
  battingTeam: 'A' | 'B' | null;
  currentInnings: 1 | 2;
  innings1: InningsData | null;
  innings2: InningsData | null;
  target: number | null;
  lastMsg: string;
  lastEvent: 'out' | 'six' | 'runs' | 'dot' | 'survived' | null;
  pendingDismissal: PendingDismissal | null;
  dismissalOptions: number[] | null;
  resultMsg: string;
  mvpUserId: string | null;
  statsProcessed: boolean;
}
export interface TeamMatch {
  id: string; join_code: string; host_id: string; host_username: string;
  status: string; game_state: TeamGameState;
  player_actions: Record<string, { type: string; value: unknown; ts: number }>;
  created_at: string;
}

// ── Factories ─────────────────────────────────────────────────────────────────

export function makeInitialTeamState(totalOvers: number, totalWickets: number): TeamGameState {
  return {
    phase: 'lobby', totalOvers, totalWickets, players: {},
    teamNames: { A: 'Team Alpha', B: 'Team Bravo' },
    captains: { A: null, B: null }, teamPlayers: { A: [], B: [] },
    tossCaller: Math.random() < 0.5 ? 'A' : 'B',
    tossCall: null, tossResult: null, tossWinner: null, battingTeam: null,
    currentInnings: 1, innings1: null, innings2: null, target: null,
    lastMsg: 'Waiting for players…', lastEvent: null,
    pendingDismissal: null, dismissalOptions: null,
    resultMsg: '', mvpUserId: null, statsProcessed: false,
  };
}

export function makeInnings(battingTeam: 'A' | 'B', gs: TeamGameState): InningsData {
  const batting: Record<string, BatRecord> = {};
  const bowling: Record<string, BowlRecord> = {};
  for (const uid of [...gs.teamPlayers.A, ...gs.teamPlayers.B]) {
    batting[uid] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, didNotBat: true };
    bowling[uid] = { balls: 0, runs: 0, wickets: 0, catches: 0, runouts: 0, stumpings: 0, catchesDropped: 0, runoutsMissed: 0, stumpingsMissed: 0 };
  }
  return { battingTeam, runs: 0, wickets: 0, balls: 0, batting, bowling, batterOrder: [], currentBatterUserId: null, nonStrikerUserId: null, currentBowlerUserId: null, fielders: null, batterHistory: {}, pendingOverReset: false };
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function ballsToOvers(balls: number) { return `${Math.floor(balls / 6)}.${balls % 6}`; }
export function fmtEco(runs: number, balls: number) { return balls ? ((runs / balls) * 6).toFixed(2) : '—'; }
export function fmtSR(runs: number, balls: number) { return balls ? ((runs / balls) * 100).toFixed(1) : '—'; }

function dType(num: number, hist: number[]): 'catch_chance' | 'runout_chance' | 'stump_chance' | 'bowled' {
  const c = hist.filter(n => n === num).length;
  if (c >= 3) return 'stump_chance';
  if (c >= 2) return 'runout_chance';
  return 'catch_chance';
}

function cloneInn(inn: InningsData): InningsData {
  return {
    ...inn,
    batting: Object.fromEntries(Object.entries(inn.batting).map(([k, v]) => [k, { ...v }])),
    bowling: Object.fromEntries(Object.entries(inn.bowling).map(([k, v]) => [k, { ...v }])),
    batterOrder: [...inn.batterOrder],
    batterHistory: Object.fromEntries(Object.entries(inn.batterHistory).map(([k, v]) => [k, [...v]])),
  };
}

// Standard cricket strike rotation: odd runs (1,3,5) rotate strike; end of over also
// rotates ends. If both happen on the same ball, they cancel out (no net change).
function rotateStrikeIfNeeded(ni: InningsData, runsScored: number, overEnded: boolean) {
  if (!ni.nonStrikerUserId) return; // lone batter — always faces, nothing to rotate
  const oddRuns = runsScored % 2 === 1;
  if (oddRuns !== overEnded) {
    const tmp = ni.currentBatterUserId;
    ni.currentBatterUserId = ni.nonStrikerUserId;
    ni.nonStrikerUserId = tmp;
  }
}

export function calcMvp(gs: TeamGameState, extraInn2?: InningsData): string | null {
  const scores: Record<string, number> = {};
  for (const inn of [gs.innings1, extraInn2 ?? gs.innings2]) {
    if (!inn) continue;
    for (const [uid, b] of Object.entries(inn.batting)) { if (!b.didNotBat) scores[uid] = (scores[uid] || 0) + b.runs + b.sixes * 2 + b.fours; }
    for (const [uid, b] of Object.entries(inn.bowling)) { scores[uid] = (scores[uid] || 0) + b.wickets * 15 + (b.catches + b.runouts + b.stumpings) * 5; }
  }
  let best: string | null = null, bv = -1;
  for (const [uid, s] of Object.entries(scores)) { if (s > bv) { bv = s; best = uid; } }
  return best;
}

export function isInningsOver(gs: TeamGameState, inn: InningsData): boolean {
  if (inn.wickets >= gs.totalWickets) return true;
  if (inn.balls >= gs.totalOvers * 6) return true;
  if (gs.target !== null && inn.runs > gs.target) return true;
  if (gs.target !== null && inn.runs === gs.target && (inn.wickets >= gs.totalWickets || inn.balls >= gs.totalOvers * 6)) return true;
  // No more batters available
  const remaining = gs.teamPlayers[inn.battingTeam].filter(uid => inn.batting[uid]?.didNotBat);
  if (remaining.length === 0 && inn.currentBatterUserId === null) return true;
  return false;
}

function resultMsg(gs: TeamGameState, inn2: InningsData): string {
  const i1 = gs.innings1!;
  const batName = gs.teamNames[inn2.battingTeam];
  const bowlName = gs.teamNames[i1.battingTeam];
  if (gs.target !== null && inn2.runs > gs.target) {
    const w = gs.totalWickets - inn2.wickets;
    return `${batName} won by ${w} wicket${w !== 1 ? 's' : ''}!`;
  }
  if (gs.target !== null && inn2.runs === gs.target) return 'Match Tied!';
  const diff = i1.runs - inn2.runs;
  return `${bowlName} won by ${diff} run${diff !== 1 ? 's' : ''}!`;
}

// ── Ball resolution ───────────────────────────────────────────────────────────

export interface BallResult {
  innings: InningsData; phase: TeamPhase;
  pendingDismissal: PendingDismissal | null; dismissalOptions: number[] | null;
  lastMsg: string; lastEvent: TeamGameState['lastEvent'];
  newTarget?: number; resultMsg?: string; mvpUserId?: string | null;
}

export function resolveBall(gs: TeamGameState, inn: InningsData, batNum: number, bowlNum: number): BallResult {
  const ni = cloneInn(inn);
  const bUid = inn.currentBatterUserId!, wUid = inn.currentBowlerUserId!;
  if (!ni.batterHistory[bUid]) ni.batterHistory[bUid] = [];
  const histBefore = [...ni.batterHistory[bUid]];
  ni.batterHistory[bUid].push(batNum);
  ni.balls++;
  ni.batting[bUid] = { ...ni.batting[bUid], balls: ni.batting[bUid].balls + 1, didNotBat: false };
  ni.bowling[wUid] = { ...ni.bowling[wUid], balls: ni.bowling[wUid].balls + 1 };

  const overEnded = ni.balls % 6 === 0;
  let isOut = false, lastMsg = '', lastEvent: BallResult['lastEvent'] = null;
  let pd: PendingDismissal | null = null, opts: number[] | null = null;
  let newTarget: number | undefined, rmsg: string | undefined, mvp: string | null | undefined;

  if (batNum === bowlNum) {
    const dt = dType(batNum, histBefore);
    if (dt === 'bowled') {
      isOut = true; ni.wickets++;
      ni.batting[bUid] = { ...ni.batting[bUid], isOut: true, outType: 'Bowled', bowlerUsername: gs.players[wUid]?.username };
      ni.bowling[wUid] = { ...ni.bowling[wUid], wickets: ni.bowling[wUid].wickets + 1 };
      lastMsg = `OUT! ${gs.players[bUid]?.username} b ${gs.players[wUid]?.username}`; lastEvent = 'out';
    } else {
      const f = ni.fielders;
      let fUid: string | null = null;
      if (f) {
        if (dt === 'catch_chance' && f.catch.length > 0) fUid = f.catch[Math.floor(Math.random() * f.catch.length)];
        else if (dt === 'runout_chance' && f.runout.length > 0) fUid = f.runout[Math.floor(Math.random() * f.runout.length)];
        else if (dt === 'stump_chance' && f.stump) fUid = f.stump;
      }
      if (fUid) {
        const o1 = Math.floor(Math.random() * 7); let o2 = Math.floor(Math.random() * 7);
        while (o2 === o1) o2 = Math.floor(Math.random() * 7);
        pd = { type: dt, batterUserId: bUid, bowlerUserId: wUid, batterNum: batNum, bowlerNum: bowlNum, fielderUserId: fUid, overEndedOnThisBall: overEnded };
        opts = [o1, o2];
        lastMsg = `${dt.replace('_chance', '').toUpperCase()} chance! ${gs.players[fUid]?.username} to respond!`;
      } else {
        ni.runs += batNum; ni.batting[bUid] = { ...ni.batting[bUid], runs: ni.batting[bUid].runs + batNum, fours: ni.batting[bUid].fours + (batNum === 4 ? 1 : 0), sixes: ni.batting[bUid].sixes + (batNum === 6 ? 1 : 0) };
        ni.bowling[wUid] = { ...ni.bowling[wUid], runs: ni.bowling[wUid].runs + batNum };
        lastMsg = `Survived (no fielder)! +${batNum} runs`; lastEvent = batNum === 6 ? 'six' : batNum === 0 ? 'dot' : 'runs';
        rotateStrikeIfNeeded(ni, batNum, overEnded);
      }
    }
  } else {
    ni.runs += batNum; ni.batting[bUid] = { ...ni.batting[bUid], runs: ni.batting[bUid].runs + batNum, fours: ni.batting[bUid].fours + (batNum === 4 ? 1 : 0), sixes: ni.batting[bUid].sixes + (batNum === 6 ? 1 : 0) };
    ni.bowling[wUid] = { ...ni.bowling[wUid], runs: ni.bowling[wUid].runs + batNum };
    lastMsg = `+${batNum} (${batNum} vs ${bowlNum})`; lastEvent = batNum === 6 ? 'six' : batNum === 0 ? 'dot' : 'runs';
    rotateStrikeIfNeeded(ni, batNum, overEnded);
  }

  if (!pd) {
    if (isOut && overEnded) ni.pendingOverReset = true;
    else if (!isOut && overEnded) ni.pendingOverReset = true;
    if (isInningsOver(gs, ni)) {
      if (gs.currentInnings === 1) { newTarget = ni.runs + 1; lastMsg += ` · Innings over! Target: ${newTarget}`; }
      else { rmsg = resultMsg(gs, ni); mvp = calcMvp(gs, ni); }
    }
  }

  let phase: TeamPhase;
  if (pd) phase = 'dismissal';
  else if (rmsg) phase = 'result';
  else if (newTarget) phase = 'innings_break';
  else if (isInningsOver(gs, ni)) phase = gs.currentInnings === 1 ? 'innings_break' : 'result';
  else if (isOut) phase = 'batting_setup';
  else if (ni.pendingOverReset) phase = 'bowling_setup';
  else phase = 'pick';

  return { innings: ni, phase, pendingDismissal: pd, dismissalOptions: opts, lastMsg, lastEvent, newTarget, resultMsg: rmsg, mvpUserId: mvp };
}

export interface DismissalResult {
  innings: InningsData; phase: TeamPhase;
  lastMsg: string; lastEvent: TeamGameState['lastEvent'];
  resultMsg?: string; mvpUserId?: string | null;
}

export function resolveDismissal(gs: TeamGameState, inn: InningsData, pd: PendingDismissal, fPick: number, botPick: number): DismissalResult {
  const ni = cloneInn(inn);
  const { batterUserId: bUid, bowlerUserId: wUid, batterNum, fielderUserId: fUid, overEndedOnThisBall } = pd;
  let isOut = false, lastMsg = '', lastEvent: DismissalResult['lastEvent'] = null;
  let rmsg: string | undefined, mvp: string | null | undefined;

  if (fPick === botPick) {
    isOut = true; ni.wickets++;
    const bowlerName = gs.players[wUid]?.username ?? '';
    const fielderName = fUid ? gs.players[fUid]?.username ?? '' : '';
    const ot = pd.type === 'catch_chance' ? `c ${fielderName} b ${bowlerName}` : pd.type === 'runout_chance' ? 'Run Out' : `st ${fielderName} b ${bowlerName}`;
    ni.batting[bUid] = { ...ni.batting[bUid], isOut: true, outType: ot, bowlerUsername: bowlerName, fielderUsername: fielderName };
    ni.bowling[wUid] = { ...ni.bowling[wUid], wickets: ni.bowling[wUid].wickets + 1 };
    if (fUid) {
      if (pd.type === 'catch_chance') ni.bowling[fUid] = { ...ni.bowling[fUid], catches: ni.bowling[fUid].catches + 1 };
      else if (pd.type === 'runout_chance') ni.bowling[fUid] = { ...ni.bowling[fUid], runouts: ni.bowling[fUid].runouts + 1 };
      else ni.bowling[fUid] = { ...ni.bowling[fUid], stumpings: ni.bowling[fUid].stumpings + 1 };
    }
    lastMsg = `OUT! ${gs.players[bUid]?.username} ${ot}`; lastEvent = 'out';
    if (overEndedOnThisBall) ni.pendingOverReset = true;
  } else {
    ni.runs += batterNum;
    ni.batting[bUid] = { ...ni.batting[bUid], runs: ni.batting[bUid].runs + batterNum, fours: ni.batting[bUid].fours + (batterNum === 4 ? 1 : 0), sixes: ni.batting[bUid].sixes + (batterNum === 6 ? 1 : 0) };
    ni.bowling[wUid] = { ...ni.bowling[wUid], runs: ni.bowling[wUid].runs + batterNum };
    if (fUid) {
      if (pd.type === 'catch_chance') ni.bowling[fUid] = { ...ni.bowling[fUid], catchesDropped: ni.bowling[fUid].catchesDropped + 1 };
      else if (pd.type === 'runout_chance') ni.bowling[fUid] = { ...ni.bowling[fUid], runoutsMissed: ni.bowling[fUid].runoutsMissed + 1 };
      else ni.bowling[fUid] = { ...ni.bowling[fUid], stumpingsMissed: ni.bowling[fUid].stumpingsMissed + 1 };
    }
    lastMsg = `Survived! +${batterNum} runs`; lastEvent = batterNum === 6 ? 'six' : batterNum === 0 ? 'dot' : 'runs';
    ni.pendingOverReset = overEndedOnThisBall;
    rotateStrikeIfNeeded(ni, batterNum, overEndedOnThisBall);
  }

  if (isInningsOver(gs, ni)) {
    if (gs.currentInnings === 2) { rmsg = resultMsg(gs, ni); mvp = calcMvp(gs, ni); }
  }

  let phase: TeamPhase;
  if (rmsg) phase = 'result';
  else if (isInningsOver(gs, ni)) phase = gs.currentInnings === 1 ? 'innings_break' : 'result';
  else if (isOut) phase = 'batting_setup';
  else if (ni.pendingOverReset) phase = 'bowling_setup';
  else phase = 'pick';

  return { innings: ni, phase, lastMsg, lastEvent, resultMsg: rmsg, mvpUserId: mvp };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function genCode() { return Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); }

export async function createTeamMatch(hostId: string, hostUsername: string, totalOvers: number, totalWickets: number): Promise<TeamMatch | null> {
  const gs = makeInitialTeamState(totalOvers, totalWickets);
  gs.players[hostId] = { username: hostUsername };
  const { data, error } = await supabase.from('hc_team_matches').insert({ join_code: genCode(), host_id: hostId, host_username: hostUsername, status: 'lobby', game_state: gs, player_actions: {} }).select().single();
  if (error) { console.error('createTeamMatch', error); return null; }
  return data as TeamMatch;
}

export async function joinTeamMatch(joinCode: string, userId: string, username: string): Promise<TeamMatch | null> {
  const { data: m, error } = await supabase.from('hc_team_matches').select('*').eq('join_code', joinCode.toUpperCase()).single();
  if (error || !m) return null;
  const gs: TeamGameState = m.game_state;
  if (gs.phase !== 'lobby') return null;
  if (!gs.players[userId]) { gs.players[userId] = { username }; await supabase.from('hc_team_matches').update({ game_state: gs }).eq('id', m.id); }
  const { data: up } = await supabase.from('hc_team_matches').select('*').eq('id', m.id).single();
  return (up ?? null) as TeamMatch | null;
}

export async function getTeamMatch(id: string): Promise<TeamMatch | null> {
  const { data } = await supabase.from('hc_team_matches').select('*').eq('id', id).single();
  return (data ?? null) as TeamMatch | null;
}

export async function updateTeamMatchState(id: string, gs: TeamGameState, clearActions = false): Promise<void> {
  const up: Record<string, unknown> = { game_state: gs };
  if (clearActions) up.player_actions = {};
  await supabase.from('hc_team_matches').update(up).eq('id', id);
}

// Applies a mid-over fielder change without disturbing any other player's
// currently-pending action (e.g. a batter/bowler mid-way through picking a number).
export async function applyFieldersUpdate(matchId: string, gs: TeamGameState, actions: TeamMatch['player_actions'], captainUserId: string, fielders: FielderAssignment): Promise<void> {
  const inn = gs.currentInnings === 1 ? gs.innings1 : gs.innings2;
  if (!inn) return;
  const newInn: InningsData = { ...inn, fielders };
  const newGs: TeamGameState = { ...gs, innings1: gs.currentInnings === 1 ? newInn : gs.innings1, innings2: gs.currentInnings === 2 ? newInn : gs.innings2 };
  const newActions = { ...actions };
  delete newActions[captainUserId];
  await supabase.from('hc_team_matches').update({ game_state: newGs, player_actions: newActions }).eq('id', matchId);
}

export async function submitTeamAction(matchId: string, userId: string, type: string, value: unknown): Promise<void> {
  const { error } = await (supabase.rpc as Function)('team_submit_action', { p_match_id: matchId, p_user_id: userId, p_type: type, p_value: value });
  if (error) {
    const { data } = await supabase.from('hc_team_matches').select('player_actions').eq('id', matchId).single();
    const cur = (data?.player_actions ?? {}) as Record<string, unknown>;
    cur[userId] = { type, value, ts: Date.now() };
    await supabase.from('hc_team_matches').update({ player_actions: cur }).eq('id', matchId);
  }
}

export function subscribeTeamMatch(matchId: string, cb: (m: TeamMatch) => void): RealtimeChannel {
  return supabase.channel(`team:${matchId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hc_team_matches', filter: `id=eq.${matchId}` }, p => cb(p.new as TeamMatch))
    .subscribe();
}

export async function saveTeamMatchStats(gs: TeamGameState): Promise<void> {
  if (!gs.innings1 || !gs.innings2) return;
  const i1 = gs.innings1, i2 = gs.innings2;
  const winner: 'A' | 'B' | 'tie' = i2.runs > i1.runs ? i2.battingTeam : i2.runs === i1.runs ? 'tie' : i1.battingTeam;
  for (const [uid, { username }] of Object.entries(gs.players)) {
    const team: 'A' | 'B' = gs.teamPlayers.A.includes(uid) ? 'A' : 'B';
    const battingInn = i1.battingTeam === team ? i1 : i2;
    const bowlingInn = i1.battingTeam === team ? i2 : i1;
    const bat = battingInn.batting[uid]; const bowl = bowlingInn.bowling[uid];
    if (!bat || !bowl) continue;
    await upsertMpStats(username, uid, winner !== 'tie' && winner === team, winner === 'tie', {
      bat_runs: bat.runs, bat_balls: bat.balls, bat_outs: bat.isOut ? 1 : 0, team_score: battingInn.runs,
      bowl_wkts: bowl.wickets, bowl_runs: bowl.runs, bowl_balls: bowl.balls,
      catches: bowl.catches + bowl.runouts + bowl.stumpings,
    }, '');
  }
}
