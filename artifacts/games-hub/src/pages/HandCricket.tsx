import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Banner } from '@/components/Banner';
import { StatCell } from '@/components/StatCell';
import { Keypad } from '@/components/Keypad';

import {
  detectCycle, aiBowlerChoice, aiBatterChoice, determineDismissalType,
  expertBowlerChoice, expertBatterChoice, updateModelWeights,
  newExpertState, ExpertState, ExpertCtx
} from '@/lib/cricketAI';

import { loadPlayer, upsertPlayerStats, logBall, PlayerStats } from '@/lib/supabase';

// --- Types & Initial State ---

type Phase = 'setup' | 'toss' | 'toss_choice' | 'innings1' | 'innings_break' | 'innings2' | 'result';

interface GameState {
  phase: Phase;
  playerName: string;
  difficulty: 'Classic' | 'Expert';
  totalWickets: number;
  totalOvers: number;
  firstBatter: 'player' | 'CricBot' | null;
  score: number;
  wicketsLost: number;
  ballsBowled: number;
  batterHistory: number[];
  bowlerHistory: number[];
  target: number | null;
  innings1Score: number;
  innings1Wickets: number;
  innings1Balls: number;
  innings1Batter: 'player' | 'CricBot' | null;
  lastEvent: 'out' | 'six' | 'runs' | 'dot' | 'survived' | null;
  lastMsg: string;
  resultMsg: string;
  breakMsg: string;
  tossResult: 'heads' | 'tails';
  pendingDismissal: { type: string; batter: string; bowler: string; batterNum: number; bowlerNum: number } | null;
  dismissalOptions: number[] | null;
  playerBattingHistory: number[];
  playerBowlingHistory: number[];
  playerInputsMatch: number[];
  playerLastBatOutcome: string | null;
  playerLastBowlOutcome: string | null;
  playerContextStats: {
    bat_after_boundary: Record<number, number>;
    bat_after_wicket: Record<number, number>;
    bowl_after_boundary: Record<number, number>;
    bowl_after_wicket: Record<number, number>;
  };
  expertState: ExpertState;
  stats: {
    player: { runs: number; balls: number; outs: number; balls_bowled: number; runs_conceded: number; catches: number; runouts: number; stumpings: number; bowled: number };
    CricBot: { runs: number; balls: number; outs: number; balls_bowled: number; runs_conceded: number; catches: number; runouts: number; stumpings: number; bowled: number };
  };
}

const getInitialState = (): GameState => ({
  phase: 'setup',
  playerName: '',
  difficulty: 'Classic',
  totalWickets: 3,
  totalOvers: 2,
  firstBatter: null,
  score: 0,
  wicketsLost: 0,
  ballsBowled: 0,
  batterHistory: [],
  bowlerHistory: [],
  target: null,
  innings1Score: 0,
  innings1Wickets: 0,
  innings1Balls: 0,
  innings1Batter: null,
  lastEvent: null,
  lastMsg: '',
  resultMsg: '',
  breakMsg: '',
  tossResult: Math.random() < 0.5 ? 'heads' : 'tails',
  pendingDismissal: null,
  dismissalOptions: null,
  playerBattingHistory: [],
  playerBowlingHistory: [],
  playerInputsMatch: [],
  playerLastBatOutcome: null,
  playerLastBowlOutcome: null,
  playerContextStats: { bat_after_boundary: {}, bat_after_wicket: {}, bowl_after_boundary: {}, bowl_after_wicket: {} },
  expertState: newExpertState(),
  stats: {
    player: { runs: 0, balls: 0, outs: 0, balls_bowled: 0, runs_conceded: 0, catches: 0, runouts: 0, stumpings: 0, bowled: 0 },
    CricBot: { runs: 0, balls: 0, outs: 0, balls_bowled: 0, runs_conceded: 0, catches: 0, runouts: 0, stumpings: 0, bowled: 0 },
  }
});

// --- Helpers ---

function whoIsBatting(state: GameState): 'player' | 'CricBot' {
  if (state.phase === 'innings1') return state.firstBatter!;
  return state.firstBatter === 'player' ? 'CricBot' : 'player';
}
function ballsRemaining(state: GameState) { return state.totalOvers * 6 - state.ballsBowled; }
function wicketsRemaining(state: GameState) { return state.totalWickets - state.wicketsLost; }
function formatOvers(balls: number) { return `${Math.floor(balls / 6)}.${balls % 6}`; }
function fmtSR(runs: number, balls: number) { return balls ? (runs / balls * 100).toFixed(1) : '—'; }
function fmtAvg(runs: number, outs: number) { return outs ? (runs / outs).toFixed(1) : runs === 0 ? '—' : `${runs}*`; }
function fmtEco(runs: number, balls: number) { return balls ? (runs / (balls / 6)).toFixed(2) : '—'; }

function buildExpertCtx(state: GameState, role: 'bat' | 'bowl'): ExpertCtx {
  const ballsRem = state.totalOvers * 6 - state.ballsBowled;
  return {
    role,
    score: state.score,
    target: state.target,
    balls_remaining: ballsRem,
    wickets_remaining: state.totalWickets - state.wicketsLost,
    total_overs: state.totalOvers,
    last_outcome: role === 'bat' ? state.playerLastBatOutcome ?? undefined : state.playerLastBowlOutcome ?? undefined,
    after_boundary: role === 'bat' ? state.playerContextStats.bat_after_boundary : state.playerContextStats.bowl_after_boundary,
    after_wicket: role === 'bat' ? state.playerContextStats.bat_after_wicket : state.playerContextStats.bowl_after_wicket,
    overall_seq: state.playerInputsMatch,
    own_seq: role === 'bat' ? state.bowlerHistory : state.batterHistory,
  };
}

function markOut(st: GameState, batterNum: number, bowlerNum: number, outType: string) {
  st.wicketsLost++;
  st.lastEvent = 'out';
  st.lastMsg = `OUT! (${batterNum} vs ${bowlerNum})`;
  
  const batter = whoIsBatting(st);
  const bowler = batter === 'player' ? 'CricBot' : 'player';
  
  st.stats[batter].outs++;
  
  if (outType === 'bowled') st.stats[bowler].bowled++;
  else if (outType === 'catch_chance') st.stats[bowler].catches++;
  else if (outType === 'runout_chance') st.stats[bowler].runouts++;
  else if (outType === 'stump_chance') st.stats[bowler].stumpings++;
}

function checkInningsOver(st: GameState) {
  const isAllOut = st.wicketsLost >= st.totalWickets;
  const isOversUp = st.ballsBowled >= st.totalOvers * 6;
  const isTargetChased = st.target !== null && st.score >= st.target;

  if (isAllOut || isOversUp || isTargetChased) {
    if (st.phase === 'innings1') {
      st.innings1Score = st.score;
      st.innings1Wickets = st.wicketsLost;
      st.innings1Balls = st.ballsBowled;
      st.innings1Batter = st.firstBatter;
      st.target = st.score + 1;
      st.phase = 'innings_break';
    } else if (st.phase === 'innings2') {
      st.phase = 'result';
      if (st.score >= st.target!) {
        st.resultMsg = whoIsBatting(st) === 'player' ? 'You Won!' : 'CricBot Won!';
      } else if (st.score === st.target! - 1) {
        st.resultMsg = 'Match Tied!';
      } else {
        st.resultMsg = whoIsBatting(st) === 'player' ? 'CricBot Won!' : 'You Won!';
      }
      
      if (st.playerName) {
        const pStats = st.stats.player;
        const won = st.resultMsg === 'You Won!';
        const tied = st.resultMsg === 'Match Tied!';
        upsertPlayerStats(st.playerName, won, tied, {
          runs: pStats.runs,
          balls: pStats.balls,
          outs: pStats.outs,
          runs_conceded: pStats.runs_conceded,
          balls_bowled: pStats.balls_bowled,
          catches: pStats.catches,
          runouts: pStats.runouts,
          stumpings: pStats.stumpings,
          bowled: pStats.bowled
        }, st.stats.CricBot.outs);
      }
    }
  }
}

// --- Main Component ---

export default function HandCricket() {
  const [state, setState] = useState<GameState>(getInitialState());
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [nameError, setNameError] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);

  // Auto-load career stats when username is typed (debounced)
  useEffect(() => {
    const name = state.playerName.trim();
    if (!name) { setPlayerStats(null); return; }
    const t = setTimeout(async () => {
      setStatsLoading(true);
      const p = await loadPlayer(name);
      setPlayerStats(p);
      setStatsLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [state.playerName]);

  const handleStartMatch = async () => {
    if (!state.playerName.trim()) {
      setNameError('Player ID is required to save stats.');
      return;
    }
    setNameError('');
    setState(s => ({ ...s, phase: 'toss', playerName: s.playerName.trim() }));
  };

  const handleToss = (call: 'heads' | 'tails') => {
    if (call === state.tossResult) {
      setState(s => ({ ...s, phase: 'toss_choice' }));
    } else {
      const batFirst = Math.random() < 0.5;
      setState(s => ({ 
        ...s, 
        phase: 'innings1', 
        firstBatter: batFirst ? 'CricBot' : 'player',
        breakMsg: `CricBot won the toss and chose to ${batFirst ? 'bat' : 'bowl'}.`
      }));
    }
  };

  const handleTossChoice = (choice: 'bat' | 'bowl') => {
    setState(s => ({
      ...s,
      phase: 'innings1',
      firstBatter: choice === 'bat' ? 'player' : 'CricBot'
    }));
  };

  const startInnings2 = () => {
    setState(s => ({
      ...s,
      phase: 'innings2',
      score: 0,
      wicketsLost: 0,
      ballsBowled: 0,
      batterHistory: [],
      bowlerHistory: [],
      lastEvent: null,
      lastMsg: '',
    }));
  };

  const resetGame = () => {
    setState(s => ({ ...getInitialState(), playerName: s.playerName }));
  };

  // --- Core Game Logic ---

  const handleBall = (playerNum: number) => {
    setState(s => {
      if (s.pendingDismissal) return s;

      const st: GameState = {
        ...s,
        stats: { player: { ...s.stats.player }, CricBot: { ...s.stats.CricBot } },
        playerContextStats: {
          bat_after_boundary: { ...s.playerContextStats.bat_after_boundary },
          bat_after_wicket: { ...s.playerContextStats.bat_after_wicket },
          bowl_after_boundary: { ...s.playerContextStats.bowl_after_boundary },
          bowl_after_wicket: { ...s.playerContextStats.bowl_after_wicket },
        },
        expertState: {
          weights: { bat: { ...s.expertState.weights.bat }, bowl: { ...s.expertState.weights.bowl } },
          lastDists: { bat: s.expertState.lastDists.bat ? { ...s.expertState.lastDists.bat } : null, bowl: s.expertState.lastDists.bowl ? { ...s.expertState.lastDists.bowl } : null },
        },
        batterHistory: [...s.batterHistory],
        bowlerHistory: [...s.bowlerHistory],
        playerBattingHistory: [...s.playerBattingHistory],
        playerBowlingHistory: [...s.playerBowlingHistory],
        playerInputsMatch: [...s.playerInputsMatch],
      };

      const role = whoIsBatting(st) === 'player' ? 'bat' : 'bowl';
      const ballsRem = ballsRemaining(st);
      const wktsRem = wicketsRemaining(st);
      
      let batterNum: number;
      let bowlerNum: number;
      
      if (role === 'bat') {
        batterNum = playerNum;
        if (st.difficulty === 'Expert') {
          const eCtx = buildExpertCtx(st, 'bat');
          bowlerNum = expertBowlerChoice(st.playerBattingHistory, st.bowlerHistory, eCtx, st.expertState);
        } else {
          bowlerNum = aiBowlerChoice(st.batterHistory, st.bowlerHistory, st.target, st.score, ballsRem);
        }
      } else {
        bowlerNum = playerNum;
        if (st.difficulty === 'Expert') {
          const eCtx = buildExpertCtx(st, 'bowl');
          batterNum = expertBatterChoice(st.playerBowlingHistory, st.batterHistory, st.score, st.target, ballsRem, wktsRem, st.totalOvers, eCtx, st.expertState);
        } else {
          batterNum = aiBatterChoice(st.bowlerHistory, st.batterHistory, st.score, st.target, ballsRem, wktsRem, st.totalOvers);
        }
      }
      
      if (role === 'bat') {
        if (st.playerLastBatOutcome === 'boundary') st.playerContextStats.bat_after_boundary[playerNum] = (st.playerContextStats.bat_after_boundary[playerNum] || 0) + 1;
        if (st.playerLastBatOutcome === 'wicket') st.playerContextStats.bat_after_wicket[playerNum] = (st.playerContextStats.bat_after_wicket[playerNum] || 0) + 1;
      } else {
        if (st.playerLastBowlOutcome === 'boundary') st.playerContextStats.bowl_after_boundary[playerNum] = (st.playerContextStats.bowl_after_boundary[playerNum] || 0) + 1;
        if (st.playerLastBowlOutcome === 'wicket') st.playerContextStats.bowl_after_wicket[playerNum] = (st.playerContextStats.bowl_after_wicket[playerNum] || 0) + 1;
      }

      st.batterHistory.push(batterNum);
      st.bowlerHistory.push(bowlerNum);
      st.playerInputsMatch.push(playerNum);
      if (role === 'bat') st.playerBattingHistory.push(playerNum);
      else st.playerBowlingHistory.push(playerNum);
      st.ballsBowled++;

      const batterName = role === 'bat' ? 'player' : 'CricBot';
      const bowlerName = role === 'bat' ? 'CricBot' : 'player';

      st.stats[batterName].balls++;
      st.stats[bowlerName].balls_bowled++;

      let isOut = false;
      if (batterNum === bowlerNum) {
        if (st.difficulty === 'Classic') {
          const dType = determineDismissalType(batterNum, st.batterHistory);
          if (dType !== 'bowled') {
            st.pendingDismissal = { type: dType, batter: batterName, bowler: bowlerName, batterNum, bowlerNum };
            
            const opt1 = Math.floor(Math.random() * 7);
            let opt2 = Math.floor(Math.random() * 7);
            while(opt2 === opt1) opt2 = Math.floor(Math.random() * 7);
            st.dismissalOptions = [opt1, opt2];
            st.lastMsg = `Dismissal chance: ${dType.replace('_', ' ')}`;
            st.lastEvent = null;
            return st;
          }
        }
        isOut = true;
      }

      if (isOut) {
        markOut(st, batterNum, bowlerNum, 'bowled');
      } else {
        st.score += batterNum;
        st.stats[batterName].runs += batterNum;
        st.stats[bowlerName].runs_conceded += batterNum;
        
        if (batterNum === 6) st.lastEvent = 'six';
        else if (batterNum === 0) st.lastEvent = 'dot';
        else st.lastEvent = 'runs';
        st.lastMsg = `+${batterNum} runs · (${batterNum} vs ${bowlerNum})`;
      }

      const currentOutcome = isOut ? 'wicket' : batterNum >= 4 ? 'boundary' : 'other';
      if (role === 'bat') st.playerLastBatOutcome = currentOutcome;
      else st.playerLastBowlOutcome = currentOutcome;

      if (st.difficulty === 'Expert') {
        updateModelWeights(role, playerNum, st.expertState);
      }

      if (st.playerName) {
        logBall(st.playerName, batterNum, bowlerNum, isOut ? 'out' : `${batterNum}_runs`, role === 'bat' ? 'batter' : 'bowler');
      }

      checkInningsOver(st);
      return st;
    });
  };

  const handleDismissalPick = (pick: number) => {
    setState(s => {
      if (!s.pendingDismissal) return s;
      const st = {
        ...s,
        stats: { player: { ...s.stats.player }, CricBot: { ...s.stats.CricBot } },
      };
      
      const pd = st.pendingDismissal;
      if (!pd) return s;
      const cricBotPick = st.dismissalOptions![Math.floor(Math.random() * 2)];
      
      if (pick === cricBotPick) {
        markOut(st, pd.batterNum, pd.bowlerNum, pd.type);
      } else {
        st.lastEvent = 'survived';
        st.lastMsg = `Survived! Pick: ${pick} vs Bot: ${cricBotPick}`;
      }
      
      st.pendingDismissal = null;
      st.dismissalOptions = null;
      
      checkInningsOver(st);
      return st;
    });
  };

  // --- Render Views ---

  const renderSetup = () => (
    <div className="flex flex-col gap-4 w-full max-w-md p-4 flex-1 overflow-y-auto pb-8">
      {/* Match Settings Card */}
      <div
        className="w-full bg-[#0c0c1e] p-5 rounded-2xl border border-[#1e1e3a] flex flex-col gap-5 relative overflow-hidden"
        style={{ borderTop: '2px solid #00ff88' }}
      >
        <h2 className="text-lg font-bold tracking-widest text-[#00ff88]" style={{ fontFamily: "'Orbitron', sans-serif" }}>MATCH SETTINGS</h2>

        {/* Player ID — required */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Player ID <span className="text-[#ff3366]">*</span></label>
            {statsLoading && <span className="text-[9px] font-mono text-[#6b6b9a] animate-pulse">Loading stats…</span>}
            {!statsLoading && playerStats && state.playerName.trim() && (
              <span className="text-[9px] font-mono text-[#00ff88]">✓ Profile found</span>
            )}
            {!statsLoading && !playerStats && state.playerName.trim().length >= 2 && (
              <span className="text-[9px] font-mono text-[#ffd700]">New profile</span>
            )}
          </div>
          <input
            type="text"
            value={state.playerName}
            onChange={e => { setState(s => ({ ...s, playerName: e.target.value })); setNameError(''); }}
            className={`bg-[#06060f] border h-12 rounded-xl px-4 font-mono text-[#e2e2f2] focus:shadow-[0_0_15px_rgba(0,255,136,0.2)] outline-none transition-all placeholder:text-[#2a2a50] ${nameError ? 'border-[#ff3366]' : 'border-[#1e1e3a] focus:border-[#00ff88]'}`}
            placeholder="[ ENTER YOUR ID ]"
            autoComplete="off"
            spellCheck={false}
          />
          {nameError && <p className="text-[10px] font-mono text-[#ff3366]">{nameError}</p>}
        </div>

        {/* Difficulty */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Difficulty</label>
          <div className="flex gap-2">
            <button
              onClick={() => setState(s => ({ ...s, difficulty: 'Classic' }))}
              className={`flex-1 h-11 rounded-xl font-mono font-bold transition-all border text-sm ${state.difficulty === 'Classic' ? 'border-[#00ff88] text-[#00ff88] shadow-[0_0_15px_rgba(0,255,136,0.2)]' : 'bg-[#06060f] border-[#1e1e3a] text-[#6b6b9a] hover:bg-[#1c1c38]'}`}
              style={state.difficulty === 'Classic' ? { background: 'rgba(0,255,136,0.08)' } : {}}
            >CLASSIC</button>
            <button
              onClick={() => setState(s => ({ ...s, difficulty: 'Expert', totalOvers: 20, totalWickets: 10 }))}
              className={`flex-1 h-11 rounded-xl font-mono font-bold transition-all border text-sm ${state.difficulty === 'Expert' ? 'border-[#ff3366] text-[#ff3366] shadow-[0_0_15px_rgba(255,51,102,0.2)]' : 'bg-[#06060f] border-[#1e1e3a] text-[#6b6b9a] hover:bg-[#1c1c38]'}`}
              style={state.difficulty === 'Expert' ? { background: 'rgba(255,51,102,0.08)' } : {}}
            >EXPERT</button>
          </div>
          {state.difficulty === 'Expert' && <p className="text-[9px] text-[#ff3366] font-mono tracking-widest uppercase">Expert: 20 overs · 10 wickets · adaptive AI</p>}
        </div>

        {/* Overs & Wickets */}
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Overs (1–20)</label>
            <input
              type="number" min="1" max="20"
              value={state.totalOvers}
              onChange={e => setState(s => ({ ...s, totalOvers: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) }))}
              disabled={state.difficulty === 'Expert'}
              className="bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] outline-none disabled:opacity-40 focus:border-[#00ff88] focus:shadow-[0_0_15px_rgba(0,255,136,0.15)] transition-all"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Wickets (1–10)</label>
            <input
              type="number" min="1" max="10"
              value={state.totalWickets}
              onChange={e => setState(s => ({ ...s, totalWickets: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) }))}
              onBlur={e => setState(s => ({ ...s, totalWickets: Math.max(1, Math.min(10, parseInt(e.target.value) || s.totalWickets)) }))}
              disabled={state.difficulty === 'Expert'}
              className="bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] outline-none disabled:opacity-40 focus:border-[#00ff88] focus:shadow-[0_0_15px_rgba(0,255,136,0.15)] transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleStartMatch}
          className="h-14 mt-1 font-bold text-lg rounded-xl transition-all tracking-widest"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            background: state.playerName.trim() ? '#00ff88' : '#1c1c38',
            color: state.playerName.trim() ? '#06060f' : '#4a4a70',
            boxShadow: state.playerName.trim() ? '0 0 20px rgba(0,255,136,0.35)' : 'none',
            cursor: state.playerName.trim() ? 'pointer' : 'not-allowed',
          }}
        >START MATCH</button>
      </div>

      {/* Career Stats Card — shown when profile loaded */}
      {(playerStats || statsLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-[#0c0c1e] rounded-2xl border border-[#1e1e3a] overflow-hidden"
          style={{ borderTop: '2px solid #818cf8' }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-[11px] font-bold tracking-widest text-[#818cf8] uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Career Stats
            </h3>
            {playerStats && (
              <span className="text-[9px] font-mono text-[#6b6b9a]">{playerStats.username}</span>
            )}
          </div>

          {statsLoading ? (
            <div className="px-5 pb-5 flex items-center justify-center h-20">
              <span className="text-[11px] font-mono text-[#6b6b9a] animate-pulse">Loading profile…</span>
            </div>
          ) : playerStats ? (
            <div className="px-4 pb-5 flex flex-col gap-3">
              {/* Match record */}
              <div className="grid grid-cols-4 gap-2">
                <StatCell label="Matches" value={<span className="text-[#e2e2f2]">{playerStats.matches}</span>} />
                <StatCell label="Wins" value={<span className="text-[#00ff88]">{playerStats.wins}</span>} />
                <StatCell label="Losses" value={<span className="text-[#ff3366]">{playerStats.losses}</span>} />
                <StatCell label="Ties" value={<span className="text-[#ffd700]">{playerStats.ties}</span>} />
              </div>

              {/* Batting */}
              <div>
                <p className="text-[9px] font-mono text-[#6b6b9a] uppercase tracking-widest mb-1.5 pl-1">Batting</p>
                <div className="grid grid-cols-4 gap-2">
                  <StatCell label="Runs" value={playerStats.bat_runs} />
                  <StatCell label="Avg" value={fmtAvg(playerStats.bat_runs, playerStats.bat_outs)} />
                  <StatCell label="SR" value={fmtSR(playerStats.bat_runs, playerStats.bat_balls)} />
                  <StatCell label="HS" value={<span className="text-[#ffd700]">{playerStats.bat_hs || '—'}</span>} />
                </div>
              </div>

              {/* Bowling */}
              <div>
                <p className="text-[9px] font-mono text-[#6b6b9a] uppercase tracking-widest mb-1.5 pl-1">Bowling</p>
                <div className="grid grid-cols-4 gap-2">
                  <StatCell label="Wkts" value={<span className="text-[#818cf8]">{playerStats.bowl_wkts}</span>} />
                  <StatCell label="Runs" value={playerStats.bowl_runs} />
                  <StatCell label="Eco" value={fmtEco(playerStats.bowl_runs, playerStats.bowl_balls)} />
                  <StatCell label="Avg" value={playerStats.bowl_wkts ? (playerStats.bowl_runs / playerStats.bowl_wkts).toFixed(1) : '—'} />
                </div>
              </div>

              {/* Fielding */}
              {(playerStats.catches + playerStats.runouts + playerStats.stumpings) > 0 && (
                <div>
                  <p className="text-[9px] font-mono text-[#6b6b9a] uppercase tracking-widest mb-1.5 pl-1">Fielding</p>
                  <div className="grid grid-cols-3 gap-2">
                    <StatCell label="Catches" value={playerStats.catches} />
                    <StatCell label="Run Outs" value={playerStats.runouts} />
                    <StatCell label="Stumpings" value={playerStats.stumpings} />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );

  const renderToss = () => (
    <div className="flex flex-col gap-10 w-full max-w-md p-4 flex-1 items-center justify-center">
      <div className="text-6xl text-[#00ff88] mb-4" style={{ textShadow: '0 0 30px rgba(0,255,136,0.5)' }}>⬤</div>
      <h2 className="text-3xl font-black tracking-widest text-[#e2e2f2]" style={{ fontFamily: "'Orbitron', sans-serif" }}>COIN TOSS</h2>
      <div className="flex gap-4 w-full">
        <button 
          onClick={() => handleToss('heads')} 
          className="flex-1 h-32 bg-[#0c0c1e] border-2 border-[#00ff88] rounded-2xl text-[#00ff88] font-bold text-2xl hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all hover:bg-[rgba(0,255,136,0.05)] tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >HEADS</button>
        <button 
          onClick={() => handleToss('tails')} 
          className="flex-1 h-32 bg-[#0c0c1e] border-2 border-[#818cf8] rounded-2xl text-[#818cf8] font-bold text-2xl hover:shadow-[0_0_30px_rgba(129,140,248,0.3)] transition-all hover:bg-[rgba(129,140,248,0.05)] tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >TAILS</button>
      </div>
    </div>
  );

  const renderTossChoice = () => (
    <div className="flex flex-col gap-8 w-full max-w-md p-4 flex-1 items-center justify-center">
      <Banner variant="success" className="w-full text-lg py-4">YOU WON THE TOSS!</Banner>
      <div className="flex gap-4 w-full mt-4">
        <button 
          onClick={() => handleTossChoice('bat')} 
          className="flex-1 h-32 bg-[#0c0c1e] border-2 border-[#00ff88] rounded-2xl text-[#00ff88] font-bold text-xl hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all hover:bg-[rgba(0,255,136,0.05)] tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >BAT FIRST</button>
        <button 
          onClick={() => handleTossChoice('bowl')} 
          className="flex-1 h-32 bg-[#0c0c1e] border-2 border-[#818cf8] rounded-2xl text-[#818cf8] font-bold text-xl hover:shadow-[0_0_30px_rgba(129,140,248,0.3)] transition-all hover:bg-[rgba(129,140,248,0.05)] tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >BOWL FIRST</button>
      </div>
    </div>
  );

  const renderInningsBreak = () => (
    <div className="flex flex-col gap-6 w-full max-w-md p-4 flex-1 items-center justify-center">
      <h2 className="text-2xl font-black tracking-widest text-[#818cf8]" style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 10px rgba(129,140,248,0.5)' }}>INNINGS BREAK</h2>
      {state.breakMsg && <p className="font-mono text-center text-xs tracking-widest text-[#6b6b9a] uppercase">{state.breakMsg}</p>}
      
      <div className="bg-[#0c0c1e] w-full p-8 rounded-3xl border border-[#1e1e3a] text-center flex flex-col gap-4 relative overflow-hidden card-glow">
        <div className="absolute inset-0 scanlines opacity-50" />
        <h3 className="font-mono text-[#6b6b9a] uppercase tracking-[0.2em] text-[10px] relative z-10">
          {state.innings1Batter === 'player' ? 'Your' : "CricBot's"} Score
        </h3>
        <div className="text-7xl font-bold font-mono text-[#e2e2f2] tracking-tighter relative z-10 score-glow">
          {state.innings1Score}<span className="text-4xl text-[#6b6b9a]">/{state.innings1Wickets}</span>
        </div>
        <p className="font-mono text-[#ffd700] text-sm tracking-widest uppercase mt-4 relative z-10" style={{ textShadow: '0 0 10px rgba(255,215,0,0.5)' }}>
          Target: <span className="font-bold text-xl">{state.target}</span>
        </p>
      </div>
      
      <button 
        onClick={startInnings2}
        className="w-full h-16 bg-[#00ff88] text-[#06060f] font-bold text-xl rounded-xl hover:bg-[#00cc6a] transition-all shadow-[0_0_20px_rgba(0,255,136,0.3)] mt-6 tracking-widest"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >START INNINGS 2</button>
    </div>
  );

  const renderResult = () => {
    const pBat = state.stats.player;
    const bBat = state.stats.CricBot;
    
    return (
      <div className="flex flex-col gap-6 w-full max-w-md p-4 flex-1 overflow-y-auto pb-12">
        <Banner variant={state.resultMsg.includes('You Won') ? 'success' : state.resultMsg.includes('Tied') ? 'warning' : 'danger'} className="w-full text-xl py-4 uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          {state.resultMsg}
        </Banner>
        
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-[10px] text-[#00ff88] uppercase tracking-[0.2em] font-bold">Batting Stats</h3>
          <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 grid grid-cols-[1fr_1fr_1fr] gap-y-4 gap-x-2 text-center items-center">
            <div className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">Player</div>
            <div className="font-mono text-[10px] text-[#1e1e3a] uppercase tracking-widest">—</div>
            <div className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">CricBot</div>
            
            <div className="font-mono font-bold text-xl text-[#e2e2f2]">{pBat.runs}<span className="text-[#6b6b9a] text-sm">/{pBat.outs}</span></div>
            <div className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">Score</div>
            <div className="font-mono font-bold text-xl text-[#e2e2f2]">{bBat.runs}<span className="text-[#6b6b9a] text-sm">/{bBat.outs}</span></div>
            
            <div className="font-mono text-lg text-[#e2e2f2]">{pBat.balls}</div>
            <div className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">Balls</div>
            <div className="font-mono text-lg text-[#e2e2f2]">{bBat.balls}</div>
            
            <div className="font-mono text-lg text-[#e2e2f2]">{fmtSR(pBat.runs, pBat.balls)}</div>
            <div className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">SR</div>
            <div className="font-mono text-lg text-[#e2e2f2]">{fmtSR(bBat.runs, bBat.balls)}</div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-[10px] text-[#818cf8] uppercase tracking-[0.2em] font-bold">Bowling Stats</h3>
          <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 grid grid-cols-[1fr_1fr_1fr] gap-y-4 gap-x-2 text-center items-center">
            <div className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">Player</div>
            <div className="font-mono text-[10px] text-[#1e1e3a] uppercase tracking-widest">—</div>
            <div className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">CricBot</div>
            
            <div className="font-mono font-bold text-xl text-[#e2e2f2]">{bBat.outs}</div>
            <div className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">Wickets</div>
            <div className="font-mono font-bold text-xl text-[#e2e2f2]">{pBat.outs}</div>
            
            <div className="font-mono text-lg text-[#e2e2f2]">{fmtEco(pBat.runs_conceded, pBat.balls_bowled)}</div>
            <div className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">Eco</div>
            <div className="font-mono text-lg text-[#e2e2f2]">{fmtEco(bBat.runs_conceded, bBat.balls_bowled)}</div>
          </div>
        </div>

        <button 
          onClick={resetGame}
          className="w-full h-16 bg-[#00ff88] text-[#06060f] font-bold text-xl rounded-xl hover:bg-[#00cc6a] transition-all shadow-[0_0_20px_rgba(0,255,136,0.3)] mt-6 shrink-0 tracking-widest"
          style={{ fontFamily: "'Orbitron', sans-serif" }}
        >PLAY AGAIN</button>
      </div>
    );
  };

  const renderInnings = () => {
    const isBatting = whoIsBatting(state) === 'player';
    const roleColor = isBatting ? 'text-[#00ff88]' : 'text-[#818cf8]';
    const bStats = isBatting ? state.stats.player : state.stats.CricBot;
    const bwStats = isBatting ? state.stats.CricBot : state.stats.player;

    return (
      <div className="flex flex-col w-full max-w-md p-4 flex-1 gap-5">
        <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-[#6b6b9a] bg-[#0c0c1e] px-4 py-3 rounded-xl border border-[#1e1e3a]">
          <span>{state.difficulty}</span>
          <span>INN {state.phase === 'innings1' ? 1 : 2}</span>
          <span>{state.totalOvers}v · {state.totalWickets}w</span>
          <span className="font-bold" style={{ color: roleColor, textShadow: `0 0 8px ${roleColor}` }}>{isBatting ? 'BATTING' : 'BOWLING'}</span>
        </div>

        {state.phase === 'innings2' && state.target && (
          <Banner variant="warning" className="py-2.5">
            Target: {state.target} <span className="text-[#1c1c38] mx-2">|</span> Need {state.target - state.score} from {ballsRemaining(state)}
            <br/>
            <span className="text-[10px] font-normal tracking-widest">RRR: {fmtEco(state.target - state.score, ballsRemaining(state))}</span>
          </Banner>
        )}

        <div className="flex bg-[#0c0c1e] rounded-2xl border border-[#1e1e3a] overflow-hidden shadow-inner min-h-[120px] relative">
          <div className="absolute inset-0 scanlines opacity-30" />
          <div className="flex-1 flex items-center justify-center p-4 relative z-10 border-r border-[#1e1e3a]">
            <span className="text-6xl md:text-7xl font-mono font-bold tracking-tighter text-[#e2e2f2] score-glow">
              {state.score}<span className="text-3xl text-[#6b6b9a] text-shadow-none">/{state.wicketsLost}</span>
            </span>
          </div>
          <div className="w-28 bg-[#06060f] flex flex-col items-center justify-center p-3 gap-2 font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest relative z-10">
            <div className="flex flex-col items-center">
              <span className="font-bold text-[#e2e2f2] text-2xl">{formatOvers(state.ballsBowled)}</span>
              <span>Overs</span>
            </div>
            {state.phase === 'innings2' && (
              <div className="flex flex-col items-center border-t border-[#1e1e3a] w-full pt-2 mt-1">
                <span className="font-bold text-[#e2e2f2] text-lg">{state.innings1Score}</span>
                <span>Inn 1</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {isBatting ? (
            <>
              <StatCell label="Runs" value={bStats.runs} />
              <StatCell label="SR" value={fmtSR(bStats.runs, bStats.balls)} />
              <StatCell label="4s/6s" value={state.batterHistory.filter(n=>n>=4).length} />
            </>
          ) : (
            <>
              <StatCell label="Wkts" value={state.wicketsLost} />
              <StatCell label="Eco" value={fmtEco(bwStats.runs_conceded, bwStats.balls_bowled)} />
              <StatCell label="Dots" value={state.batterHistory.filter(n=>n===0).length} />
            </>
          )}
        </div>

        <div className="h-16 flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            {state.lastMsg && (
              <motion.div
                key={state.lastMsg}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full"
              >
                <Banner variant={state.lastEvent === 'out' ? 'danger' : state.lastEvent === 'six' ? 'success' : state.lastEvent === 'survived' ? 'info' : 'default'} className="h-14">
                  {state.lastMsg}
                </Banner>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-auto pb-4">
          <p className="font-mono text-center text-[10px] text-[#6b6b9a] uppercase tracking-[0.2em] mb-4">
            {state.pendingDismissal ? 'Mini-Game: Pick an option' : `YOUR ${isBatting ? 'SHOT' : 'BALL'} [0-6]`}
          </p>
          
          {state.pendingDismissal ? (
            <div className="flex gap-4">
              {state.dismissalOptions?.map(opt => (
                <button 
                  key={opt}
                  onClick={() => handleDismissalPick(opt)}
                  className="flex-1 h-20 bg-[#0c0c1e] border-2 border-[#ff3366] text-[#ff3366] font-mono text-3xl font-bold rounded-xl hover:bg-[#ff3366] hover:text-[#06060f] transition-all shadow-[0_0_20px_rgba(255,51,102,0.2)]"
                >{opt}</button>
              ))}
            </div>
          ) : (
            <Keypad onSelect={handleBall} />
          )}
        </div>
        
        <button onClick={resetGame} className="text-[10px] uppercase tracking-[0.2em] text-[#6b6b9a] hover:text-[#ff3366] font-mono mt-2 mb-4 transition-colors text-center w-full">
          [ QUIT MATCH ]
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#06060f] flex flex-col items-center">
      <header className="w-full max-w-md p-4 flex items-center gap-4 border-b border-[#1e1e3a] shrink-0">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#00ff88] transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold tracking-widest text-[#00ff88]" style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 10px rgba(0,255,136,0.5)' }}>🏏 HAND CRICKET</h1>
      </header>
      
      {state.phase === 'setup' && renderSetup()}
      {state.phase === 'toss' && renderToss()}
      {state.phase === 'toss_choice' && renderTossChoice()}
      {state.phase === 'innings_break' && renderInningsBreak()}
      {state.phase === 'result' && renderResult()}
      {(state.phase === 'innings1' || state.phase === 'innings2') && renderInnings()}
    </div>
  );
}