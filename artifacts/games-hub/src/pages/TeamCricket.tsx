import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/authContext';
import {
  TeamMatch, TeamGameState, InningsData, PendingDismissal, FielderAssignment,
  makeInitialTeamState, makeInnings, ballsToOvers, fmtEco, fmtSR, calcMvp,
  resolveBall, resolveDismissal, isInningsOver, canSelectBowler,
  createTeamMatch, joinTeamMatch, getTeamMatch,
  updateTeamMatchState, submitTeamAction, subscribeTeamMatch, saveTeamMatchStats,
} from '@/lib/teamCricket';

// ── Mini helpers ──────────────────────────────────────────────────────────────

const TEAM_COLOR = { A: '#00ff88', B: '#f472b6' };
const TEAM_BG   = { A: 'rgba(0,255,136,0.08)', B: 'rgba(244,114,182,0.08)' };

function TeamBadge({ t, name }: { t: 'A' | 'B'; name: string }) {
  return <span className="font-mono text-[11px] px-2 py-0.5 rounded-full" style={{ background: TEAM_BG[t], color: TEAM_COLOR[t], border: `1px solid ${TEAM_COLOR[t]}40` }}>{name}</span>;
}

function GlowBtn({ onClick, children, color = '#00ff88', disabled = false, className = '' }: { onClick?: () => void; children: React.ReactNode; color?: string; disabled?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`font-mono font-bold rounded-xl transition-all px-4 py-3 ${className}`}
      style={{ background: disabled ? '#1c1c38' : `${color}18`, border: `1.5px solid ${disabled ? '#2a2a4a' : color + '60'}`, color: disabled ? '#4a4a70' : color, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );
}

function NumberPad({ onPick, disabled }: { onPick: (n: number) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full max-w-xs mx-auto">
      {[0, 1, 2, 3, 4, 5, 6].map(n => (
        <motion.button key={n} whileTap={{ scale: 0.9 }} onClick={() => !disabled && onPick(n)} disabled={disabled}
          className="h-14 rounded-xl font-mono font-bold text-2xl transition-all"
          style={{ background: disabled ? '#1c1c38' : '#0c0c1e', border: `2px solid ${disabled ? '#2a2a4a' : '#818cf840'}`, color: disabled ? '#3a3a5c' : '#e2e2f2' }}>
          {n}
        </motion.button>
      ))}
    </div>
  );
}

function Stepper({ label, value, min, max, color, onChange }: { label: string; value: number; min: number; max: number; color: string; onChange: (v: number) => void }) {
  return (
    <div className="flex-1 flex flex-col gap-1">
      <label className="text-[9px] font-mono text-[#6b6b9a] uppercase tracking-widest">{label}</label>
      <div className="flex items-center bg-[#06060f] border border-[#1e1e3a] rounded-xl overflow-hidden h-10">
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="w-10 h-full text-xl text-[#6b6b9a] hover:text-white disabled:opacity-30">−</button>
        <span className="flex-1 text-center font-mono font-bold" style={{ color }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="w-10 h-full text-xl text-[#6b6b9a] hover:text-white disabled:opacity-30">+</button>
      </div>
    </div>
  );
}

function LiveScoreBar({ gs, inn }: { gs: TeamGameState; inn: InningsData | null }) {
  if (!inn || !gs.battingTeam) return null;
  const bTeam = gs.battingTeam;
  const oTeam: 'A' | 'B' = bTeam === 'A' ? 'B' : 'A';
  return (
    <div className="w-full flex items-center justify-between px-4 py-3 bg-[#0a0a1a] border-b border-[#1e1e3a]">
      <div className="flex flex-col items-start">
        <span className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">{gs.teamNames[bTeam]} (batting)</span>
        <span className="font-mono text-xl font-bold" style={{ color: TEAM_COLOR[bTeam] }}>{inn.runs}/{inn.wickets}</span>
        <span className="font-mono text-[9px] text-[#6b6b9a]">{ballsToOvers(inn.balls)} ov</span>
      </div>
      {gs.target !== null && gs.currentInnings === 2 && (
        <div className="flex flex-col items-center">
          <span className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">need</span>
          <span className="font-mono text-lg font-bold text-[#ffd700]">{gs.target - inn.runs}</span>
          <span className="font-mono text-[9px] text-[#6b6b9a]">from {gs.totalOvers * 6 - inn.balls} balls</span>
        </div>
      )}
      <div className="flex flex-col items-end">
        <span className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest">{gs.teamNames[oTeam]} (bowling)</span>
        {gs.innings1 && gs.currentInnings === 2
          ? <span className="font-mono text-lg font-bold" style={{ color: TEAM_COLOR[oTeam] }}>{gs.innings1.runs}/{gs.innings1.wickets}</span>
          : <span className="font-mono text-lg text-[#3a3a5c]">—</span>}
      </div>
    </div>
  );
}

function LastAction({ msg, event }: { msg: string; event: TeamGameState['lastEvent'] }) {
  const color = event === 'out' ? '#ff3366' : event === 'six' ? '#ffd700' : event === 'survived' ? '#818cf8' : '#6b6b9a';
  return <p className="text-center font-mono text-[11px] px-4 py-2 text-ellipsis overflow-hidden" style={{ color }}>{msg}</p>;
}

function WaitBanner({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        className="w-8 h-8 border-2 border-[#818cf8] border-t-transparent rounded-full" />
      <p className="font-mono text-[12px] text-[#6b6b9a]">{msg}</p>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────

function LandingView({ onCreateClick, onJoin }: { onCreateClick: () => void; onJoin: (code: string) => void }) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [code, setCode] = useState('');
  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full max-w-md mx-auto">
      <div className="flex gap-2 w-full">
        {(['create', 'join'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 rounded-xl font-mono font-bold text-sm transition-all"
            style={{ background: tab === t ? '#818cf820' : '#0c0c1e', border: `1.5px solid ${tab === t ? '#818cf8' : '#1e1e3a'}`, color: tab === t ? '#818cf8' : '#4a4a70' }}>
            {t === 'create' ? 'Host Match' : 'Join Match'}
          </button>
        ))}
      </div>
      {tab === 'create' ? (
        <GlowBtn onClick={onCreateClick} color="#818cf8" className="w-full text-lg">Create Team Match</GlowBtn>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter join code" maxLength={6}
            className="w-full h-12 rounded-xl px-4 font-mono text-center text-lg tracking-[0.3em] bg-[#06060f] border border-[#1e1e3a] text-[#e2e2f2] focus:outline-none focus:border-[#818cf8]" />
          <GlowBtn onClick={() => code.length === 6 && onJoin(code)} color="#818cf8" disabled={code.length !== 6} className="w-full text-base">Join Match</GlowBtn>
        </div>
      )}
    </div>
  );
}

// ── Lobby ─────────────────────────────────────────────────────────────────────

function LobbyView({ match, gs, isHost, myUserId, onUpdate, onStart }: {
  match: TeamMatch; gs: TeamGameState; isHost: boolean; myUserId: string;
  onUpdate: (gs: TeamGameState) => void; onStart: () => void;
}) {
  const [localGs, setLocalGs] = useState(gs);
  useEffect(() => setLocalGs(gs), [JSON.stringify(gs)]);

  const save = (updated: TeamGameState) => { setLocalGs(updated); onUpdate(updated); };
  const assignTeam = (uid: string, team: 'A' | 'B') => {
    const ng = JSON.parse(JSON.stringify(localGs)) as TeamGameState;
    ng.teamPlayers.A = ng.teamPlayers.A.filter(x => x !== uid);
    ng.teamPlayers.B = ng.teamPlayers.B.filter(x => x !== uid);
    ng.teamPlayers[team].push(uid);
    if (ng.captains.A === uid && team !== 'A') ng.captains.A = null;
    if (ng.captains.B === uid && team !== 'B') ng.captains.B = null;
    save(ng);
  };
  const unassign = (uid: string) => {
    const ng = JSON.parse(JSON.stringify(localGs)) as TeamGameState;
    ng.teamPlayers.A = ng.teamPlayers.A.filter(x => x !== uid);
    ng.teamPlayers.B = ng.teamPlayers.B.filter(x => x !== uid);
    if (ng.captains.A === uid) ng.captains.A = null;
    if (ng.captains.B === uid) ng.captains.B = null;
    save(ng);
  };
  const setCaptain = (team: 'A' | 'B', uid: string) => {
    const ng = JSON.parse(JSON.stringify(localGs)) as TeamGameState;
    ng.captains[team] = ng.captains[team] === uid ? null : uid;
    save(ng);
  };
  const renameTeam = (team: 'A' | 'B', name: string) => {
    const ng = { ...localGs, teamNames: { ...localGs.teamNames, [team]: name } };
    save(ng);
  };

  const unassigned = Object.keys(localGs.players).filter(uid => !localGs.teamPlayers.A.includes(uid) && !localGs.teamPlayers.B.includes(uid));
  const totalPlayers = localGs.teamPlayers.A.length + localGs.teamPlayers.B.length;
  const teamsBalanced = localGs.teamPlayers.A.length === localGs.teamPlayers.B.length;
  const playerCountValid = totalPlayers >= 4 && totalPlayers <= 22 && totalPlayers % 2 === 0;
  const bothCaptainsReady = !!localGs.captains.A && !!localGs.captains.B;
  const canStart = teamsBalanced && playerCountValid && bothCaptainsReady;
  const myTeam = localGs.teamPlayers.A.includes(myUserId) ? 'A' : localGs.teamPlayers.B.includes(myUserId) ? 'B' : null;

  if (!isHost) {
    return (
      <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
        <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-2xl p-4 flex flex-col gap-2">
          <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">Join Code</p>
          <p className="font-mono text-2xl font-bold text-[#818cf8] tracking-[0.3em]">{match.join_code}</p>
        </div>
        {myTeam && <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-[#6b6b9a]">Your team:</span><TeamBadge t={myTeam} name={localGs.teamNames[myTeam]} /></div>}
        <WaitBanner msg="Waiting for host to configure teams and start the match…" />
        {(['A', 'B'] as const).map(t => (
          <div key={t} className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4">
            <p className="font-mono text-[11px] font-bold mb-2" style={{ color: TEAM_COLOR[t] }}>{localGs.teamNames[t]}</p>
            {localGs.teamPlayers[t].map(uid => (
              <p key={uid} className="font-mono text-[12px] text-[#e2e2f2]">
                {localGs.players[uid]?.username} {localGs.captains[t] === uid ? '★' : ''}
              </p>
            ))}
            {localGs.teamPlayers[t].length === 0 && <p className="font-mono text-[11px] text-[#3a3a5c]">No players yet</p>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
      {/* Join code */}
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest mb-1">Join Code</p>
          <p className="font-mono text-2xl font-bold text-[#818cf8] tracking-[0.3em]">{match.join_code}</p>
        </div>
        <button onClick={() => navigator.clipboard?.writeText(match.join_code)}
          className="font-mono text-[10px] text-[#4a4a70] hover:text-[#818cf8] transition-colors">Copy</button>
      </div>

      {/* Settings */}
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-2xl p-4 flex flex-col gap-3">
        <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">Match Settings</p>
        <div className="flex gap-3">
          <Stepper label="Overs" value={localGs.totalOvers} min={1} max={50} color="#00ff88" onChange={v => save({ ...localGs, totalOvers: v })} />
          <Stepper label="Wickets" value={localGs.totalWickets} min={1} max={10} color="#818cf8" onChange={v => save({ ...localGs, totalWickets: v })} />
        </div>
      </div>

      {/* Teams */}
      {(['A', 'B'] as const).map(t => (
        <div key={t} className="bg-[#0c0c1e] border rounded-2xl p-4 flex flex-col gap-2" style={{ borderColor: `${TEAM_COLOR[t]}30` }}>
          <div className="flex items-center gap-2">
            <input value={localGs.teamNames[t]} onChange={e => renameTeam(t, e.target.value)}
              className="flex-1 font-mono font-bold text-[13px] bg-transparent border-b border-[#2a2a4a] focus:outline-none focus:border-current pb-0.5"
              style={{ color: TEAM_COLOR[t] }} />
            <span className="font-mono text-[9px] text-[#6b6b9a]">{localGs.teamPlayers[t].length}P</span>
          </div>
          {localGs.teamPlayers[t].map(uid => (
            <div key={uid} className="flex items-center gap-2">
              <span className="flex-1 font-mono text-[12px] text-[#e2e2f2]">{localGs.players[uid]?.username}</span>
              <button onClick={() => setCaptain(t, uid)}
                className="font-mono text-[9px] px-2 py-0.5 rounded-lg transition-all"
                style={{ background: localGs.captains[t] === uid ? `${TEAM_COLOR[t]}20` : '#1c1c38', color: localGs.captains[t] === uid ? TEAM_COLOR[t] : '#4a4a70', border: `1px solid ${localGs.captains[t] === uid ? TEAM_COLOR[t] + '40' : '#2a2a4a'}` }}>
                ★
              </button>
              <button onClick={() => unassign(uid)} className="font-mono text-[9px] text-[#ff336650] hover:text-[#ff3366] transition-colors">✕</button>
            </div>
          ))}
          {localGs.captains[t] && <p className="font-mono text-[9px] text-[#6b6b9a]">Captain: {localGs.players[localGs.captains[t]!]?.username}</p>}
        </div>
      ))}

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-2">
          <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">Unassigned ({unassigned.length})</p>
          {unassigned.map(uid => (
            <div key={uid} className="flex items-center gap-2">
              <span className="flex-1 font-mono text-[12px] text-[#e2e2f2]">{localGs.players[uid]?.username}</span>
              {(['A', 'B'] as const).map(t => (
                <button key={t} onClick={() => assignTeam(uid, t)}
                  className="font-mono text-[10px] px-3 py-1 rounded-lg"
                  style={{ background: TEAM_BG[t], color: TEAM_COLOR[t], border: `1px solid ${TEAM_COLOR[t]}40` }}>
                  →{localGs.teamNames[t]}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <button onClick={onStart} disabled={!canStart}
        className="h-13 py-4 font-bold rounded-xl font-mono uppercase tracking-widest transition-all"
        style={{ background: canStart ? '#00ff88' : '#1c1c38', color: canStart ? '#06060f' : '#4a4a70', boxShadow: canStart ? '0 0 20px rgba(0,255,136,0.3)' : 'none' }}>
        {canStart ? 'Start Match →' : !playerCountValid ? 'Need even 4–22 players' : !teamsBalanced ? 'Teams must be equal' : 'Need both captains'}
      </button>
    </div>
  );
}

// ── Toss ──────────────────────────────────────────────────────────────────────

function TossCallView({ gs, myUserId, onSubmit }: { gs: TeamGameState; myUserId: string; onSubmit: (c: 'heads' | 'tails') => void }) {
  const callerCaptainId = gs.captains[gs.tossCaller];
  const iAmCaller = callerCaptainId === myUserId;
  return (
    <div className="flex flex-col items-center gap-6 p-6 text-center">
      <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">Toss — {gs.teamNames[gs.tossCaller]} calls</p>
      <div className="text-7xl">🪙</div>
      {iAmCaller ? (
        <>
          <p className="font-mono text-[13px] text-[#e2e2f2]">You're calling the toss — pick a side!</p>
          <div className="flex gap-4 w-full max-w-xs">
            <GlowBtn onClick={() => onSubmit('heads')} color="#ffd700" className="flex-1 text-base">HEADS</GlowBtn>
            <GlowBtn onClick={() => onSubmit('tails')} color="#818cf8" className="flex-1 text-base">TAILS</GlowBtn>
          </div>
        </>
      ) : (
        <WaitBanner msg={`${gs.teamNames[gs.tossCaller]} captain is calling the toss…`} />
      )}
    </div>
  );
}

function TossView({ gs, myUserId, onSubmit }: { gs: TeamGameState; myUserId: string; onSubmit: (c: 'bat' | 'bowl') => void }) {
  const w = gs.tossWinner!;
  const winnerCaptainId = gs.captains[w];
  const iAmWinner = winnerCaptainId === myUserId;
  return (
    <div className="flex flex-col items-center gap-5 p-6 text-center">
      <div className="text-6xl">{gs.tossResult === 'heads' ? '🟡' : '⚫'}</div>
      <p className="font-mono text-[14px] font-bold" style={{ color: TEAM_COLOR[w] }}>{gs.teamNames[w]} won the toss!</p>
      {iAmWinner ? (
        <>
          <p className="font-mono text-[12px] text-[#e2e2f2]">Choose to bat or bowl first:</p>
          <div className="flex gap-4 w-full max-w-xs">
            <GlowBtn onClick={() => onSubmit('bat')} color="#00ff88" className="flex-1">🏏 BAT FIRST</GlowBtn>
            <GlowBtn onClick={() => onSubmit('bowl')} color="#f472b6" className="flex-1">⚾ BOWL FIRST</GlowBtn>
          </div>
        </>
      ) : (
        <WaitBanner msg={`${gs.teamNames[w]} captain is deciding…`} />
      )}
    </div>
  );
}

// ── Captain picks ─────────────────────────────────────────────────────────────

function BattingSetupView({ gs, inn, myUserId, onSubmit, submitted }: { gs: TeamGameState; inn: InningsData; myUserId: string; onSubmit: (uid: string) => void; submitted: boolean }) {
  const bTeam = inn.battingTeam;
  const iAmCaptain = gs.captains[bTeam] === myUserId;
  const available = gs.teamPlayers[bTeam].filter(uid => inn.batting[uid]?.didNotBat);
  if (!iAmCaptain) return <WaitBanner msg={`${gs.teamNames[bTeam]} captain picking next batter…`} />;
  if (submitted) return <WaitBanner msg="Batter pick submitted, waiting…" />;
  return (
    <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
      <p className="font-mono text-[11px] text-[#6b6b9a] uppercase tracking-widest text-center">Pick Next Batter</p>
      {available.length === 0 ? <p className="font-mono text-center text-[#ff3366]">No batters remaining — innings over!</p> : available.map(uid => (
        <GlowBtn key={uid} onClick={() => onSubmit(uid)} color={TEAM_COLOR[bTeam]} className="w-full text-base">
          {gs.players[uid]?.username}
        </GlowBtn>
      ))}
    </div>
  );
}

function BowlingSetupView({ gs, inn, myUserId, onSubmit, submitted }: { gs: TeamGameState; inn: InningsData; myUserId: string; onSubmit: (v: { bowlerUserId: string; fielders: FielderAssignment }) => void; submitted: boolean }) {
  const bwlTeam: 'A' | 'B' = inn.battingTeam === 'A' ? 'B' : 'A';
  const iAmCaptain = gs.captains[bwlTeam] === myUserId;
  const teamUids = gs.teamPlayers[bwlTeam];

  const [bowlerUid, setBowlerUid] = useState('');
  const [catches, setCatches] = useState<string[]>([]);
  const [runouts, setRunouts] = useState<string[]>([]);
  const [stump, setStump] = useState<string | null>(null);

  useEffect(() => {
    setBowlerUid('');
    setCatches([]);
    setRunouts([]);
    setStump(null);
  }, [inn.balls, inn.currentBowlerUserId, inn.battingTeam, gs.currentInnings]);

  const nonBowlers = bowlerUid ? teamUids.filter(uid => uid !== bowlerUid) : [];
  const role = (uid: string) => catches.includes(uid) ? 'C' : runouts.includes(uid) ? 'R' : stump === uid ? 'S' : '—';
  const setRole = (uid: string, r: 'C' | 'R' | 'S' | '—') => {
    setCatches(c => c.filter(x => x !==
