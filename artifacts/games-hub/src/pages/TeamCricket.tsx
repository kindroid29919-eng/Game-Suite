import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/authContext';
import {
  TeamMatch, TeamGameState, InningsData, PendingDismissal, FielderAssignment,
  makeInitialTeamState, makeInnings, ballsToOvers, fmtEco, fmtSR, calcMvp,
  resolveBall, resolveDismissal, isInningsOver,
  createTeamMatch, joinTeamMatch, getTeamMatch,
  updateTeamMatchState, submitTeamAction, subscribeTeamMatch, saveTeamMatchStats, applyFieldersUpdate,
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
  const canStart = localGs.teamPlayers.A.length >= 2 && localGs.teamPlayers.B.length >= 2 && localGs.captains.A && localGs.captains.B;
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
        </div>
        <p className="font-mono text-[9px] text-[#4a4a70]">Wickets = players per team − 1 (all out). Set automatically when the match starts.</p>
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
        {canStart ? 'Start Match →' : 'Need 2v2 min + both captains'}
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

function BattingSetupView({ gs, inn, myUserId, onSubmit, submitted }: { gs: TeamGameState; inn: InningsData; myUserId: string; onSubmit: (v: string | string[]) => void; submitted: boolean }) {
  const bTeam = inn.battingTeam;
  const iAmCaptain = gs.captains[bTeam] === myUserId;
  const available = gs.teamPlayers[bTeam].filter(uid => inn.batting[uid]?.didNotBat);
  const isOpeningPick = inn.batterOrder.length === 0;
  const [openers, setOpeners] = useState<string[]>([]);

  if (!iAmCaptain) return <WaitBanner msg={isOpeningPick ? `${gs.teamNames[bTeam]} captain picking openers…` : `${gs.teamNames[bTeam]} captain picking next batter…`} />;
  if (submitted) return <WaitBanner msg="Batter pick submitted, waiting…" />;

  if (isOpeningPick) {
    const toggle = (uid: string) => setOpeners(o => o.includes(uid) ? o.filter(x => x !== uid) : o.length < 2 ? [...o, uid] : o);
    return (
      <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
        <p className="font-mono text-[11px] text-[#6b6b9a] uppercase tracking-widest text-center">Pick Opening Pair ({openers.length}/2)</p>
        {available.map(uid => (
          <button key={uid} onClick={() => toggle(uid)}
            className="font-mono text-[13px] px-3 py-2 rounded-xl text-left transition-all"
            style={{ background: openers.includes(uid) ? `${TEAM_COLOR[bTeam]}20` : '#0c0c1e', border: `1.5px solid ${openers.includes(uid) ? TEAM_COLOR[bTeam] : '#2a2a4a'}`, color: openers.includes(uid) ? TEAM_COLOR[bTeam] : '#6b6b9a' }}>
            {gs.players[uid]?.username} {openers[0] === uid ? '(strike)' : openers[1] === uid ? '(non-strike)' : ''}
          </button>
        ))}
        <GlowBtn onClick={() => openers.length === 2 && onSubmit(openers)} color={TEAM_COLOR[bTeam]} disabled={openers.length !== 2} className="w-full text-base">
          Confirm Openers
        </GlowBtn>
      </div>
    );
  }

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
  const lastBowlerUid = inn.currentBowlerUserId; // still holds the previous over's bowler at this point
  const fieldingEnabled = teamUids.length >= 6; // full fielding roles need a reasonably sized team
  const fieldersAlreadySet = inn.fielders !== null;

  const [bowlerUid, setBowlerUid] = useState('');
  const [catches, setCatches] = useState<string[]>(inn.fielders?.catch ?? []);
  const [runouts, setRunouts] = useState<string[]>(inn.fielders?.runout ?? []);
  const [stump, setStump] = useState<string | null>(inn.fielders?.stump ?? null);

  const nonBowlers = bowlerUid ? teamUids.filter(uid => uid !== bowlerUid) : [];
  const role = (uid: string) => catches.includes(uid) ? 'C' : runouts.includes(uid) ? 'R' : stump === uid ? 'S' : '—';
  const setRole = (uid: string, r: 'C' | 'R' | 'S' | '—') => {
    setCatches(c => c.filter(x => x !== uid));
    setRunouts(c => c.filter(x => x !== uid));
    if (stump === uid) setStump(null);
    if (r === 'C' && catches.length < 3) setCatches(c => [...c, uid]);
    else if (r === 'R' && runouts.length < 2) setRunouts(c => [...c, uid]);
    else if (r === 'S' && !stump) setStump(uid);
  };

  const isDisabledBowler = (uid: string) => uid === lastBowlerUid || (fieldersAlreadySet && inn.fielders!.stump === uid);
  const reasonFor = (uid: string) => uid === lastBowlerUid ? '(bowled last over)' : (fieldersAlreadySet && inn.fielders!.stump === uid) ? '(wicketkeeper)' : '';

  if (!iAmCaptain) return <WaitBanner msg={`${gs.teamNames[bwlTeam]} captain setting bowler…`} />;
  if (submitted) return <WaitBanner msg="Setup submitted, waiting for host…" />;

  // After the first over, fielders are already locked in — only need this over's bowler.
  if (fieldersAlreadySet) {
    return (
      <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
        <p className="font-mono text-[11px] text-[#6b6b9a] uppercase tracking-widest text-center">Pick This Over's Bowler</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {teamUids.map(uid => (
            <button key={uid} disabled={isDisabledBowler(uid)} onClick={() => setBowlerUid(uid)}
              className="font-mono text-[11px] px-3 py-1.5 rounded-xl transition-all disabled:opacity-30"
              style={{ background: bowlerUid === uid ? `${TEAM_COLOR[bwlTeam]}20` : '#0c0c1e', border: `1.5px solid ${bowlerUid === uid ? TEAM_COLOR[bwlTeam] : '#2a2a4a'}`, color: bowlerUid === uid ? TEAM_COLOR[bwlTeam] : '#6b6b9a' }}>
              {gs.players[uid]?.username} {reasonFor(uid) && <span className="text-[8px]">{reasonFor(uid)}</span>}
            </button>
          ))}
        </div>
        <GlowBtn onClick={() => bowlerUid && onSubmit({ bowlerUserId: bowlerUid, fielders: inn.fielders! })} color="#00ff88" disabled={!bowlerUid} className="w-full text-base">
          Confirm Bowler
        </GlowBtn>
        <p className="font-mono text-[9px] text-[#4a4a70] text-center">Fielding roles stay the same — change them anytime from the scoreboard screen.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
      <p className="font-mono text-[11px] text-[#6b6b9a] uppercase tracking-widest text-center">Bowling Setup</p>
      {/* Pick bowler */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] text-[#6b6b9a]">Pick Bowler</p>
        <div className="flex flex-wrap gap-2">
          {teamUids.map(uid => (
            <button key={uid} disabled={isDisabledBowler(uid)}
              onClick={() => { setBowlerUid(uid); setCatches(c => c.filter(x => x !== uid)); setRunouts(r => r.filter(x => x !== uid)); if (stump === uid) setStump(null); }}
              className="font-mono text-[11px] px-3 py-1.5 rounded-xl transition-all disabled:opacity-30"
              style={{ background: bowlerUid === uid ? `${TEAM_COLOR[bwlTeam]}20` : '#0c0c1e', border: `1.5px solid ${bowlerUid === uid ? TEAM_COLOR[bwlTeam] : '#2a2a4a'}`, color: bowlerUid === uid ? TEAM_COLOR[bwlTeam] : '#6b6b9a' }}>
              {gs.players[uid]?.username}
            </button>
          ))}
        </div>
      </div>
      {/* Assign fielders — only if the team is big enough for roles to make sense */}
      {bowlerUid && fieldingEnabled && nonBowlers.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] text-[#6b6b9a]">Fielder Roles (set once for the innings) — C:{catches.length}/3 R:{runouts.length}/2 S:{stump ? 1 : 0}/1</p>
          {nonBowlers.map(uid => {
            const cur = role(uid);
            return (
              <div key={uid} className="flex items-center gap-2">
                <span className="flex-1 font-mono text-[12px] text-[#e2e2f2]">{gs.players[uid]?.username}</span>
                {(['C', 'R', 'S', '—'] as const).map(r => (
                  <button key={r} onClick={() => setRole(uid, r)}
                    disabled={(r === 'C' && catches.length >= 3 && cur !== 'C') || (r === 'R' && runouts.length >= 2 && cur !== 'R') || (r === 'S' && !!stump && stump !== uid)}
                    className="font-mono text-[9px] w-7 h-7 rounded-lg transition-all"
                    style={{ background: cur === r ? '#818cf820' : '#0c0c1e', border: `1px solid ${cur === r ? '#818cf8' : '#2a2a4a'}`, color: cur === r ? '#818cf8' : '#4a4a70' }}>
                    {r}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {bowlerUid && !fieldingEnabled && (
        <p className="font-mono text-[10px] text-[#6b6b9a] text-center">Team too small for fielding roles — catches/run-outs/stumpings disabled this match.</p>
      )}
      <GlowBtn onClick={() => bowlerUid && onSubmit({ bowlerUserId: bowlerUid, fielders: fieldingEnabled ? { catch: catches, runout: runouts, stump } : { catch: [], runout: [], stump: null } })} color="#00ff88" disabled={!bowlerUid} className="w-full text-base">
        Confirm Setup
      </GlowBtn>
    </div>
  );
}

// ── Pick & Dismissal ──────────────────────────────────────────────────────────

function FieldingEditor({ gs, inn, bwlTeam, onSave }: { gs: TeamGameState; inn: InningsData; bwlTeam: 'A' | 'B'; onSave: (f: FielderAssignment) => void }) {
  const [open, setOpen] = useState(false);
  const bowlerUid = inn.currentBowlerUserId;
  const teamUids = gs.teamPlayers[bwlTeam];
  const nonBowlers = bowlerUid ? teamUids.filter(uid => uid !== bowlerUid) : teamUids;
  const [catches, setCatches] = useState<string[]>(inn.fielders?.catch ?? []);
  const [runouts, setRunouts] = useState<string[]>(inn.fielders?.runout ?? []);
  const [stump, setStump] = useState<string | null>(inn.fielders?.stump ?? null);
  const fieldingEnabled = teamUids.length >= 6;

  if (!fieldingEnabled) return null;

  const role = (uid: string) => catches.includes(uid) ? 'C' : runouts.includes(uid) ? 'R' : stump === uid ? 'S' : '—';
  const setRole = (uid: string, r: 'C' | 'R' | 'S' | '—') => {
    setCatches(c => c.filter(x => x !== uid));
    setRunouts(c => c.filter(x => x !== uid));
    if (stump === uid) setStump(null);
    if (r === 'C' && catches.length < 3) setCatches(c => [...c, uid]);
    else if (r === 'R' && runouts.length < 2) setRunouts(c => [...c, uid]);
    else if (r === 'S' && !stump) setStump(uid);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="font-mono text-[9px] text-[#818cf8] underline underline-offset-2">
      Edit Fielding
    </button>
  );

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl w-full" style={{ background: '#0c0c1e', border: '1px solid #2a2a4a' }}>
      <p className="font-mono text-[9px] text-[#6b6b9a]">Fielder Roles — C:{catches.length}/3 R:{runouts.length}/2 S:{stump ? 1 : 0}/1</p>
      {nonBowlers.map(uid => {
        const cur = role(uid);
        return (
          <div key={uid} className="flex items-center gap-2">
            <span className="flex-1 font-mono text-[11px] text-[#e2e2f2]">{gs.players[uid]?.username}</span>
            {(['C', 'R', 'S', '—'] as const).map(r => (
              <button key={r} onClick={() => setRole(uid, r)}
                disabled={(r === 'C' && catches.length >= 3 && cur !== 'C') || (r === 'R' && runouts.length >= 2 && cur !== 'R') || (r === 'S' && !!stump && stump !== uid)}
                className="font-mono text-[9px] w-6 h-6 rounded-lg transition-all"
                style={{ background: cur === r ? '#818cf820' : '#06060f', border: `1px solid ${cur === r ? '#818cf8' : '#2a2a4a'}`, color: cur === r ? '#818cf8' : '#4a4a70' }}>
                {r}
              </button>
            ))}
          </div>
        );
      })}
      <div className="flex gap-2">
        <GlowBtn onClick={() => { onSave({ catch: catches, runout: runouts, stump }); setOpen(false); }} color="#00ff88" className="flex-1 text-[11px] py-1.5">Save</GlowBtn>
        <button onClick={() => setOpen(false)} className="font-mono text-[10px] text-[#4a4a70]">Cancel</button>
      </div>
    </div>
  );
}

function PickView({ gs, inn, myUserId, onSubmit, onFieldersUpdate, submitted }: { gs: TeamGameState; inn: InningsData; myUserId: string; onSubmit: (n: number) => void; onFieldersUpdate: (f: FielderAssignment) => void; submitted: boolean }) {
  const isBatter = inn.currentBatterUserId === myUserId;
  const isBowler = inn.currentBowlerUserId === myUserId;
  const batterName = gs.players[inn.currentBatterUserId ?? '']?.username ?? '?';
  const nonStrikerName = inn.nonStrikerUserId ? gs.players[inn.nonStrikerUserId]?.username ?? '?' : null;
  const bowlerName = gs.players[inn.currentBowlerUserId ?? '']?.username ?? '?';
  const bwlTeam: 'A' | 'B' = inn.battingTeam === 'A' ? 'B' : 'A';
  const iAmBowlCaptain = gs.captains[bwlTeam] === myUserId;

  return (
    <div className="flex flex-col gap-4 p-4 items-center w-full max-w-md mx-auto">
      <div className="flex items-center justify-between w-full text-[11px] font-mono text-[#6b6b9a]">
        <span>🏏 {batterName}*{nonStrikerName ? ` / ${nonStrikerName}` : ''}</span>
        <span>⚾ {bowlerName}</span>
      </div>
      <LastAction msg={gs.lastMsg} event={gs.lastEvent} />
      {(isBatter || isBowler) ? (
        submitted ? (
          <WaitBanner msg={`Waiting for ${isBatter ? 'bowler' : 'batter'}…`} />
        ) : (
          <>
            <p className="font-mono text-[11px] text-[#6b6b9a] uppercase tracking-widest">{isBatter ? 'Your shot (0-6)' : 'Your ball (0-6)'}</p>
            <NumberPad onPick={onSubmit} disabled={false} />
          </>
        )
      ) : (
        <WaitBanner msg="Ball in play…" />
      )}
      {iAmBowlCaptain && <FieldingEditor gs={gs} inn={inn} bwlTeam={bwlTeam} onSave={onFieldersUpdate} />}
    </div>
  );
}

function DismissalView({ gs, inn, pd, opts, myUserId, onSubmit, submitted }: { gs: TeamGameState; inn: InningsData; pd: PendingDismissal; opts: number[]; myUserId: string; onSubmit: (n: number) => void; submitted: boolean }) {
  const isFielder = pd.fielderUserId === myUserId;
  const label = pd.type === 'catch_chance' ? 'CATCH' : pd.type === 'runout_chance' ? 'RUN OUT' : 'STUMPING';
  const fielderName = gs.players[pd.fielderUserId ?? '']?.username ?? '?';
  return (
    <div className="flex flex-col items-center gap-5 p-6 text-center">
      <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">{label} Chance!</p>
      {isFielder ? (
        <>
          <p className="font-mono text-[13px] text-[#e2e2f2]">Pick a number to attempt the {label.toLowerCase()}!</p>
          <p className="font-mono text-[10px] text-[#6b6b9a]">Match the bot's pick to take the wicket</p>
          {submitted ? <WaitBanner msg="Pick submitted…" /> : (
            <div className="flex gap-4">
              {opts.map(n => (
                <motion.button key={n} whileTap={{ scale: 0.9 }} onClick={() => onSubmit(n)}
                  className="w-20 h-20 rounded-2xl font-mono font-bold text-4xl"
                  style={{ background: '#0c0c1e', border: '2px solid #818cf840', color: '#e2e2f2' }}>
                  {n}
                </motion.button>
              ))}
            </div>
          )}
        </>
      ) : (
        <WaitBanner msg={`${fielderName} is deciding…`} />
      )}
      <LastAction msg={gs.lastMsg} event={gs.lastEvent} />
    </div>
  );
}

// ── Innings break ─────────────────────────────────────────────────────────────

function InningsBreakView({ gs, isHost, onStart }: { gs: TeamGameState; isHost: boolean; onStart: () => void }) {
  const i1 = gs.innings1!;
  const bowlTeam: 'A' | 'B' = i1.battingTeam === 'A' ? 'B' : 'A';
  return (
    <div className="flex flex-col items-center gap-5 p-6 text-center">
      <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">End of Innings 1</p>
      <div>
        <p className="font-mono text-3xl font-bold" style={{ color: TEAM_COLOR[i1.battingTeam] }}>{i1.runs}/{i1.wickets}</p>
        <p className="font-mono text-[11px] text-[#6b6b9a]">{gs.teamNames[i1.battingTeam]} · {ballsToOvers(i1.balls)} overs</p>
      </div>
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-2xl px-8 py-4">
        <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">Target</p>
        <p className="font-mono text-4xl font-bold text-[#ffd700]">{gs.target}</p>
        <p className="font-mono text-[11px] text-[#6b6b9a]">{gs.teamNames[bowlTeam]} need this to win</p>
      </div>
      {isHost ? (
        <GlowBtn onClick={onStart} color="#00ff88" className="text-base px-8">Start 2nd Innings →</GlowBtn>
      ) : <WaitBanner msg="Waiting for host to start 2nd innings…" />}
    </div>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────────

function InningsCard({ label, inn, gs }: { label: string; inn: InningsData; gs: TeamGameState }) {
  const t = inn.battingTeam;
  const bTeam: 'A' | 'B' = t === 'A' ? 'B' : 'A';
  const batters = [...inn.batterOrder.map(uid => ({ uid, bat: inn.batting[uid] })),
    ...Object.entries(inn.batting).filter(([uid, b]) => !inn.batterOrder.includes(uid) && !b.didNotBat).map(([uid, bat]) => ({ uid, bat }))];
  const dnb = gs.teamPlayers[t].filter(uid => inn.batting[uid]?.didNotBat).map(uid => gs.players[uid]?.username).filter(Boolean);
  const bowlers = Object.entries(inn.bowling).filter(([uid]) => gs.teamPlayers[bTeam].includes(uid) && inn.bowling[uid].balls > 0);
  return (
    <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `2px solid ${TEAM_COLOR[t]}40` }}>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: TEAM_COLOR[t] }}>{label}</p>
        <p className="font-mono text-xl font-bold" style={{ color: TEAM_COLOR[t] }}>{inn.runs}/{inn.wickets} <span className="text-sm text-[#6b6b9a]">({ballsToOvers(inn.balls)} ov)</span></p>
      </div>
      {/* Batting */}
      <div className="px-3 py-2">
        <p className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest mb-1">Batting</p>
        <div className="grid font-mono text-[10px] text-[#6b6b9a] mb-1" style={{ gridTemplateColumns: '1fr 28px 28px 24px 24px 44px' }}>
          <span>Batter</span><span className="text-right">R</span><span className="text-right">B</span><span className="text-right">4s</span><span className="text-right">6s</span><span className="text-right">SR</span>
        </div>
        {batters.map(({ uid, bat }) => (
          <div key={uid} className="grid font-mono text-[11px] py-0.5 border-t border-[#1a1a30]" style={{ gridTemplateColumns: '1fr 28px 28px 24px 24px 44px' }}>
            <span className="text-[#e2e2f2] truncate pr-1">{gs.players[uid]?.username}{!bat.isOut ? '*' : ''}</span>
            <span className="text-right text-[#e2e2f2] font-bold">{bat.runs}</span>
            <span className="text-right text-[#6b6b9a]">{bat.balls}</span>
            <span className="text-right text-[#6b6b9a]">{bat.fours}</span>
            <span className="text-right text-[#6b6b9a]">{bat.sixes}</span>
            <span className="text-right text-[#818cf8]">{fmtSR(bat.runs, bat.balls)}</span>
          </div>
        ))}
        {batters.map(({ uid, bat }) => bat.isOut && bat.outType && (
          <p key={uid + '-ot'} className="font-mono text-[9px] text-[#4a4a70] pl-1">{gs.players[uid]?.username}: {bat.outType}</p>
        ))}
        {dnb.length > 0 && <p className="font-mono text-[9px] text-[#3a3a5c] mt-1">DNB: {dnb.join(', ')}</p>}
      </div>
      {/* Bowling */}
      {bowlers.length > 0 && (
        <div className="px-3 py-2 border-t border-[#1e1e3a]">
          <p className="font-mono text-[9px] text-[#6b6b9a] uppercase tracking-widest mb-1">Bowling</p>
          <div className="grid font-mono text-[10px] text-[#6b6b9a] mb-1" style={{ gridTemplateColumns: '1fr 36px 36px 24px 52px' }}>
            <span>Bowler</span><span className="text-right">O</span><span className="text-right">R</span><span className="text-right">W</span><span className="text-right">Eco</span>
          </div>
          {bowlers.map(([uid, b]) => (
            <div key={uid} className="grid font-mono text-[11px] py-0.5 border-t border-[#1a1a30]" style={{ gridTemplateColumns: '1fr 36px 36px 24px 52px' }}>
              <span className="text-[#e2e2f2] truncate pr-1">{gs.players[uid]?.username}</span>
              <span className="text-right text-[#6b6b9a]">{ballsToOvers(b.balls)}</span>
              <span className="text-right text-[#6b6b9a]">{b.runs}</span>
              <span className="text-right text-[#818cf8] font-bold">{b.wickets}</span>
              <span className="text-right text-[#00ff88]">{fmtEco(b.runs, b.balls)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreboardView({ gs }: { gs: TeamGameState }) {
  const mvpName = gs.mvpUserId ? gs.players[gs.mvpUserId]?.username : null;
  return (
    <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto pb-8">
      <div className="text-center py-4">
        <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest mb-1">Match Result</p>
        <p className="font-mono text-2xl font-bold text-[#ffd700]">{gs.resultMsg}</p>
      </div>
      {gs.innings1 && <InningsCard label={`${gs.teamNames[gs.innings1.battingTeam]} – 1st Innings`} inn={gs.innings1} gs={gs} />}
      {gs.innings2 && <InningsCard label={`${gs.teamNames[gs.innings2.battingTeam]} – 2nd Innings`} inn={gs.innings2} gs={gs} />}
      {mvpName && (
        <div className="bg-[#0c0c1e] border border-[#ffd70040] rounded-2xl p-4 text-center">
          <p className="font-mono text-[9px] text-[#ffd700] uppercase tracking-widest mb-1">🏆 Player of the Match</p>
          <p className="font-mono text-xl font-bold text-[#ffd700]">{mvpName}</p>
        </div>
      )}
      <Link href="/"><GlowBtn color="#818cf8" className="w-full text-base">← Back to Home</GlowBtn></Link>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TeamCricket() {
  const { user } = useAuth();
  const [createOvers, setCreateOvers] = useState(10);
  const [showCreate, setShowCreate] = useState(false);
  const [match, setMatch] = useState<TeamMatch | null>(null);
  const [mySubmitted, setMySubmitted] = useState(false);
  const processingRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof subscribeTeamMatch> | null>(null);

  const gs = match?.game_state ?? null;
  const myUserId = user?.id ?? '';
  const myUsername = user?.username ?? '';
  const isHost = match?.host_id === myUserId;
  const inn = gs ? (gs.currentInnings === 1 ? gs.innings1 : gs.innings2) : null;

  // Reset submitted on phase/batter/bowler/ball change
  useEffect(() => { setMySubmitted(false); }, [gs?.phase, inn?.currentBatterUserId, inn?.currentBowlerUserId, inn?.balls]);

  // Realtime + poll
  useEffect(() => {
    if (!match) return;
    const ch = subscribeTeamMatch(match.id, setMatch);
    channelRef.current = ch;
    const poll = setInterval(() => getTeamMatch(match.id).then(m => m && setMatch(m)), 5000);
    return () => { ch.unsubscribe(); clearInterval(poll); };
  }, [match?.id]);

  // No leaving mid-game
  useEffect(() => {
    if (!gs || gs.phase === 'lobby' || gs.phase === 'result') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [gs?.phase]);

  // Host processing
  useEffect(() => {
    if (!isHost || !match || processingRef.current) return;
    const m = match;
    processingRef.current = true;
    processMatchActions(m).finally(() => { processingRef.current = false; });
  }, [match, isHost]);

  const submitAction = useCallback(async (type: string, value: unknown) => {
    if (!match) return;
    await submitTeamAction(match.id, myUserId, type, value);
    setMySubmitted(true);
  }, [match?.id, myUserId]);

  const refresh = () => match && getTeamMatch(match.id).then(m => m && setMatch(m));

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#06060f' }}>
        <p className="font-mono text-[#6b6b9a]">Sign in to play team matches.</p>
        <Link href="/login"><GlowBtn color="#818cf8">Sign In</GlowBtn></Link>
      </div>
    );
  }

  const header = (
    <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-[#1e1e3a]">
      <Link href="/"><span className="font-mono text-[10px] text-[#4a4a70] hover:text-[#818cf8]">←</span></Link>
      <span className="font-mono text-[11px] font-bold text-[#818cf8] uppercase tracking-widest flex-1">Team Cricket</span>
      {match && <span className="font-mono text-[9px] text-[#3a3a5c]">{match.join_code}</span>}
    </div>
  );

  // No match yet → landing
  if (!match) {
    if (showCreate) {
      return (
        <div className="min-h-screen flex flex-col" style={{ background: '#06060f', color: '#e2e2f2' }}>
          {header}
          <div className="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
            <p className="font-mono text-[11px] text-[#6b6b9a] uppercase tracking-widest text-center">Match Settings</p>
            <div className="flex gap-3">
              <Stepper label="Overs" value={createOvers} min={1} max={50} color="#00ff88" onChange={setCreateOvers} />
            </div>
            <GlowBtn color="#00ff88" className="w-full text-base" onClick={async () => {
              const m = await createTeamMatch(user.id, user.username, createOvers, 1);
              if (m) { setMatch(m); return; }
              alert('Could not create match — check console for details.');
            }}>Create Match</GlowBtn>
            <button onClick={() => setShowCreate(false)} className="font-mono text-[11px] text-[#4a4a70] hover:text-[#6b6b9a] text-center">Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#06060f', color: '#e2e2f2' }}>
        {header}
        <div className="flex flex-col items-center gap-6 p-6 mt-8">
          <div className="text-6xl">🏏</div>
          <p className="font-mono text-xl font-bold text-[#818cf8]">Team Cricket</p>
          <p className="font-mono text-[11px] text-[#6b6b9a] text-center">2v2 to 11v11 · Real cricket rules · Full scoreboard</p>
        </div>
        <LandingView onCreateClick={() => setShowCreate(true)} onJoin={async (code) => {
          const m = await joinTeamMatch(code, user.id, user.username);
          if (m) setMatch(m); else alert('Match not found or already started.');
        }} />
      </div>
    );
  }

  if (!gs) return <div style={{ background: '#06060f', minHeight: '100vh' }}><WaitBanner msg="Loading match…" /></div>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#06060f', color: '#e2e2f2' }}>
      {header}
      {inn && <LiveScoreBar gs={gs} inn={inn} />}
      <div className="flex-1 overflow-y-auto">
        {gs.phase === 'lobby' && (
          <LobbyView match={match} gs={gs} isHost={isHost} myUserId={myUserId}
            onUpdate={async (newGs) => { await updateTeamMatchState(match.id, newGs); await refresh(); }}
            onStart={async () => {
              const teamSize = Math.min(gs.teamPlayers.A.length, gs.teamPlayers.B.length);
              await updateTeamMatchState(match.id, { ...gs, totalWickets: teamSize, phase: 'toss_call' }, true);
              await refresh();
            }} />
        )}
        {gs.phase === 'toss_call' && <TossCallView gs={gs} myUserId={myUserId} onSubmit={(c) => submitAction('toss_call', c)} />}
        {gs.phase === 'toss' && <TossView gs={gs} myUserId={myUserId} onSubmit={(c) => submitAction('bat_bowl', c)} />}
        {gs.phase === 'batting_setup' && inn && (
          <BattingSetupView gs={gs} inn={inn} myUserId={myUserId} onSubmit={(uid) => submitAction('pick_batter', uid)} submitted={mySubmitted} />
        )}
        {gs.phase === 'bowling_setup' && inn && (
          <BowlingSetupView gs={gs} inn={inn} myUserId={myUserId} onSubmit={(v) => submitAction('bowling_setup', v)} submitted={mySubmitted} />
        )}
        {gs.phase === 'pick' && inn && (
          <PickView gs={gs} inn={inn} myUserId={myUserId} onSubmit={(n) => submitAction('ball_pick', n)} onFieldersUpdate={(f) => submitAction('update_fielders', { fielders: f })} submitted={mySubmitted} />
        )}
        {gs.phase === 'dismissal' && inn && gs.pendingDismissal && (
          <DismissalView gs={gs} inn={inn} pd={gs.pendingDismissal} opts={gs.dismissalOptions ?? []} myUserId={myUserId} onSubmit={(n) => submitAction('fielder_pick', n)} submitted={mySubmitted} />
        )}
        {gs.phase === 'innings_break' && (
          <InningsBreakView gs={gs} isHost={isHost} onStart={async () => {
            const bwlTeam: 'A' | 'B' = gs.battingTeam === 'A' ? 'B' : 'A';
            const innings2 = makeInnings(bwlTeam, gs);
            await updateTeamMatchState(match.id, { ...gs, phase: 'batting_setup', currentInnings: 2, innings2, battingTeam: bwlTeam, lastMsg: `${gs.teamNames[bwlTeam]} batting. Target: ${gs.target}` }, true);
            await refresh();
          }} />
        )}
        {gs.phase === 'result' && <ScoreboardView gs={gs} />}
      </div>
    </div>
  );
}

// ── Host action processing (standalone, no stale closure) ─────────────────────

// Shared "no more batters" resolution: promotes the surviving not-out partner to
// bat alone if one exists (per the All Out Rule), otherwise genuinely ends the innings.
function finalizeAfterWicket(gs: TeamGameState, newGs: TeamGameState, resInnings: InningsData, resResultMsg: string | undefined, resMvp: string | null | undefined) {
  const bTeam = resInnings.battingTeam;
  const remaining = gs.teamPlayers[bTeam].filter(uid => resInnings.batting[uid]?.didNotBat);
  if (remaining.length > 0) return; // a replacement is available — normal batting_setup flow continues
  if (resInnings.nonStrikerUserId !== null) {
    // Lone batter continues alone — no need to wait for a captain's pick.
    const soleUid = resInnings.nonStrikerUserId;
    const promotedInn: InningsData = { ...resInnings, currentBatterUserId: soleUid, nonStrikerUserId: null };
    newGs.innings1 = gs.currentInnings === 1 ? promotedInn : newGs.innings1;
    newGs.innings2 = gs.currentInnings === 2 ? promotedInn : newGs.innings2;
    newGs.phase = (!promotedInn.currentBowlerUserId || promotedInn.pendingOverReset) ? 'bowling_setup' : 'pick';
    newGs.lastMsg = `${gs.players[soleUid]?.username} continues alone!`;
  } else {
    // Genuinely all out.
    if (gs.currentInnings === 1) {
      newGs.phase = 'innings_break';
      newGs.target = resInnings.runs + 1;
    } else {
      newGs.phase = 'result';
      if (resResultMsg) newGs.resultMsg = resResultMsg;
      if (resMvp !== undefined) newGs.mvpUserId = resMvp;
      if (!gs.statsProcessed) { newGs.statsProcessed = true; saveTeamMatchStats(newGs).catch(console.error); }
    }
  }
}

async function processMatchActions(match: TeamMatch): Promise<void> {
  const gs = match.game_state;
  const actions = match.player_actions;
  const inn = gs.currentInnings === 1 ? gs.innings1 : gs.innings2;

  // Fielder changes can be submitted anytime during 'pick' phase, independent of
  // whichever ball_pick actions are also mid-flight — handle it first, every tick.
  if (gs.phase === 'pick' && inn) {
    const bwlTeamForFielders: 'A' | 'B' = inn.battingTeam === 'A' ? 'B' : 'A';
    const fieldCapId = gs.captains[bwlTeamForFielders];
    if (fieldCapId && actions[fieldCapId]?.type === 'update_fielders') {
      const { fielders } = actions[fieldCapId].value as { fielders: FielderAssignment };
      await applyFieldersUpdate(match.id, gs, actions, fieldCapId, fielders);
      return;
    }
  }

  switch (gs.phase) {
    case 'toss_call': {
      const cid = gs.captains[gs.tossCaller];
      if (!cid || actions[cid]?.type !== 'toss_call') return;
      const call = actions[cid].value as 'heads' | 'tails';
      const result: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
      const winner: 'A' | 'B' = call === result ? gs.tossCaller : gs.tossCaller === 'A' ? 'B' : 'A';
      await updateTeamMatchState(match.id, { ...gs, phase: 'toss', tossCall: call, tossResult: result, tossWinner: winner, lastMsg: `${gs.teamNames[winner]} won the toss!` }, true);
      break;
    }
    case 'toss': {
      const wid = gs.captains[gs.tossWinner!];
      if (!wid || actions[wid]?.type !== 'bat_bowl') return;
      const choice = actions[wid].value as 'bat' | 'bowl';
      const bTeam: 'A' | 'B' = choice === 'bat' ? gs.tossWinner! : gs.tossWinner === 'A' ? 'B' : 'A';
      const innings1 = makeInnings(bTeam, gs);
      await updateTeamMatchState(match.id, { ...gs, phase: 'batting_setup', battingTeam: bTeam, innings1, lastMsg: `${gs.teamNames[bTeam]} will bat first` }, true);
      break;
    }
    case 'batting_setup': {
      if (!inn) return;
      const bTeam = inn.battingTeam;
      const cid = gs.captains[bTeam];
      if (!cid || actions[cid]?.type !== 'pick_batter') return;
      const avail = gs.teamPlayers[bTeam].filter(uid => inn.batting[uid]?.didNotBat);
      const isOpeningPick = inn.batterOrder.length === 0;

      if (isOpeningPick) {
        const picks = actions[cid].value as string[];
        if (!Array.isArray(picks) || picks.length !== 2) return;
        const [strikerUid, nonStrikerUid] = picks;
        if (strikerUid === nonStrikerUid || !avail.includes(strikerUid) || !avail.includes(nonStrikerUid)) return;
        const newBatting = {
          ...inn.batting,
          [strikerUid]: { ...inn.batting[strikerUid], didNotBat: false },
          [nonStrikerUid]: { ...inn.batting[nonStrikerUid], didNotBat: false },
        };
        const newInn: InningsData = { ...inn, currentBatterUserId: strikerUid, nonStrikerUserId: nonStrikerUid, batting: newBatting, batterOrder: [strikerUid, nonStrikerUid] };
        const newGs = { ...gs, phase: 'bowling_setup' as TeamGameState['phase'], lastMsg: `${gs.players[strikerUid]?.username} & ${gs.players[nonStrikerUid]?.username} are in to open`, innings1: gs.currentInnings === 1 ? newInn : gs.innings1, innings2: gs.currentInnings === 2 ? newInn : gs.innings2 };
        await updateTeamMatchState(match.id, newGs, true);
        break;
      }

      const batUid = actions[cid].value as string;
      if (avail.length === 0 || !avail.includes(batUid)) return;
      // If the over also ended on the ball that brought this wicket, ends swap:
      // the new batter takes the non-striker's spot, the survivor keeps strike.
      const enterAsNonStriker = inn.pendingOverReset && inn.nonStrikerUserId !== null;
      const newInn: InningsData = enterAsNonStriker
        ? { ...inn, currentBatterUserId: inn.nonStrikerUserId, nonStrikerUserId: batUid, batting: { ...inn.batting, [batUid]: { ...inn.batting[batUid], didNotBat: false } }, batterOrder: [...inn.batterOrder, batUid] }
        : { ...inn, currentBatterUserId: batUid, batting: { ...inn.batting, [batUid]: { ...inn.batting[batUid], didNotBat: false } }, batterOrder: [...inn.batterOrder, batUid] };
      const nextPhase: TeamGameState['phase'] = (!inn.currentBowlerUserId || inn.pendingOverReset) ? 'bowling_setup' : 'pick';
      const newGs = { ...gs, phase: nextPhase, lastMsg: `${gs.players[batUid]?.username} is in to bat`, innings1: gs.currentInnings === 1 ? newInn : gs.innings1, innings2: gs.currentInnings === 2 ? newInn : gs.innings2 };
      await updateTeamMatchState(match.id, newGs, true);
      break;
    }
    case 'bowling_setup': {
      if (!inn) return;
      const bwlTeam: 'A' | 'B' = inn.battingTeam === 'A' ? 'B' : 'A';
      const cid = gs.captains[bwlTeam];
      if (!cid || actions[cid]?.type !== 'bowling_setup') return;
      const { bowlerUserId, fielders } = actions[cid].value as { bowlerUserId: string; fielders: FielderAssignment };
      // Reject an illegal pick: same bowler as last over, or the designated wicketkeeper.
      if (bowlerUserId === inn.currentBowlerUserId) return;
      if (inn.fielders && inn.fielders.stump === bowlerUserId) return;
      const newInn = { ...inn, currentBowlerUserId: bowlerUserId, fielders, pendingOverReset: false };
      const newGs = { ...gs, phase: 'pick' as TeamGameState['phase'], lastMsg: `${gs.players[bowlerUserId]?.username} is bowling`, innings1: gs.currentInnings === 1 ? newInn : gs.innings1, innings2: gs.currentInnings === 2 ? newInn : gs.innings2 };
      await updateTeamMatchState(match.id, newGs, true);
      break;
    }
    case 'pick': {
      if (!inn) return;
      const batAct = actions[inn.currentBatterUserId!];
      const bowlAct = actions[inn.currentBowlerUserId!];
      if (!batAct || batAct.type !== 'ball_pick') return;
      if (!bowlAct || bowlAct.type !== 'ball_pick') return;
      const res = resolveBall(gs, inn, batAct.value as number, bowlAct.value as number);
      const newGs: TeamGameState = { ...gs, phase: res.phase, lastMsg: res.lastMsg, lastEvent: res.lastEvent, pendingDismissal: res.pendingDismissal, dismissalOptions: res.dismissalOptions, target: res.newTarget ?? gs.target, resultMsg: res.resultMsg ?? gs.resultMsg, mvpUserId: res.mvpUserId !== undefined ? res.mvpUserId : gs.mvpUserId, innings1: gs.currentInnings === 1 ? res.innings : gs.innings1, innings2: gs.currentInnings === 2 ? res.innings : gs.innings2 };
      if (res.phase === 'batting_setup') finalizeAfterWicket(gs, newGs, res.innings, res.resultMsg, res.mvpUserId);
      if (newGs.phase === 'result' && !newGs.statsProcessed) { newGs.statsProcessed = true; saveTeamMatchStats(newGs).catch(console.error); }
      await updateTeamMatchState(match.id, newGs, true);
      break;
    }
    case 'dismissal': {
      const pd = gs.pendingDismissal;
      if (!pd?.fielderUserId) return;
      const fAct = actions[pd.fielderUserId];
      if (!fAct || fAct.type !== 'fielder_pick') return;
      const botPick = gs.dismissalOptions![Math.floor(Math.random() * gs.dismissalOptions!.length)];
      const res = resolveDismissal(gs, inn!, pd, fAct.value as number, botPick);
      const newGs: TeamGameState = { ...gs, phase: res.phase, lastMsg: res.lastMsg, lastEvent: res.lastEvent, pendingDismissal: null, dismissalOptions: null, resultMsg: res.resultMsg ?? gs.resultMsg, mvpUserId: res.mvpUserId !== undefined ? res.mvpUserId : gs.mvpUserId, innings1: gs.currentInnings === 1 ? res.innings : gs.innings1, innings2: gs.currentInnings === 2 ? res.innings : gs.innings2 };
      if (res.phase === 'batting_setup') finalizeAfterWicket(gs, newGs, res.innings, res.resultMsg, res.mvpUserId);
      if (newGs.phase === 'result' && !newGs.statsProcessed) { newGs.statsProcessed = true; saveTeamMatchStats(newGs).catch(console.error); }
      await updateTeamMatchState(match.id, newGs, true);
      break;
    }
  }
}
