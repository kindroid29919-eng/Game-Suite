import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { Banner } from '@/components/Banner';
import { Keypad } from '@/components/Keypad';
import { StatCell } from '@/components/StatCell';
import { useAuth } from '@/lib/authContext';
import {
  createMpMatch, joinMpMatch, getMpMatch, updateMpMatch,
  MpMatch, MpGameState, MpConfig,
} from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

type LobbyMode = 'menu' | 'creating' | 'joining';

function formatOvers(balls: number) { return `${Math.floor(balls / 6)}.${balls % 6}`; }
function fmtSR(runs: number, balls: number) { return balls ? (runs / balls * 100).toFixed(1) : '—'; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentBatterSide(gs: MpGameState): 'host' | 'guest' {
  if (gs.currentInnings === 1) return gs.firstBatter!;
  return gs.firstBatter === 'host' ? 'guest' : 'host';
}

function resolveBall(
  gs: MpGameState,
  hostPick: number,
  guestPick: number,
  config: MpConfig,
  hostUsername: string,
  guestUsername: string,
): MpGameState {
  const s = { ...gs, batterHistory: [...gs.batterHistory], bowlerHistory: [...gs.bowlerHistory] };
  const batter = currentBatterSide(s);
  const batterPick = batter === 'host' ? hostPick : guestPick;
  const bowlerPick = batter === 'host' ? guestPick : hostPick;

  s.batterHistory.push(batterPick);
  s.bowlerHistory.push(bowlerPick);
  s.ballsBowled++;

  const isOut = batterPick === bowlerPick;

  if (isOut) {
    s.wicketsLost++;
    s.lastEvent = 'out';
    s.lastMsg = `OUT! ${batter === 'host' ? hostUsername : guestUsername} is out! (${batterPick} vs ${bowlerPick})`;
  } else {
    s.score += batterPick;
    s.lastEvent = batterPick === 6 ? 'six' : batterPick === 0 ? 'dot' : 'runs';
    s.lastMsg = `+${batterPick} runs · (${batterPick} vs ${bowlerPick})`;
  }

  const isAllOut = s.wicketsLost >= config.totalWickets;
  const isOversUp = s.ballsBowled >= config.totalOvers * 6;
  const isChased = s.target !== null && s.score >= s.target;

  if (isAllOut || isOversUp || isChased) {
    if (s.currentInnings === 1) {
      s.innings1Score = s.score;
      s.innings1Wickets = s.wicketsLost;
      s.innings1Batter = s.firstBatter;
      s.target = s.score + 1;
      s.phase = 'innings_break';
    } else {
      s.phase = 'result';
      const winner2batter = currentBatterSide(s);
      if (s.score >= s.target!) {
        s.resultMsg = winner2batter === 'host' ? 'HOST WINS!' : 'GUEST WINS!';
      } else if (s.score === s.target! - 1) {
        s.resultMsg = 'MATCH TIED!';
      } else {
        s.resultMsg = winner2batter === 'host' ? 'GUEST WINS!' : 'HOST WINS!';
      }
    }
  }

  return s;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MultiplayerCricket() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>('menu');
  const [joinCode, setJoinCode] = useState('');
  const [config, setConfig] = useState<MpConfig>({ totalOvers: 5, totalWickets: 5 });
  const [match, setMatch] = useState<MpMatch | null>(null);
  const [myPick, setMyPick] = useState<number | null>(null);
  const [opponentPicked, setOpponentPicked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lobbyError, setLobbyError] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isHost = match ? match.host_id === user?.id : false;
  const gs = match?.game_state as MpGameState | undefined;

  // Supabase Realtime subscription
  useEffect(() => {
    if (!match?.id) return;
    if (channelRef.current) channelRef.current.unsubscribe();

    const ch = supabase
      .channel(`mp:${match.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mp_matches',
        filter: `id=eq.${match.id}`,
      }, (payload) => {
        const updated = payload.new as MpMatch;
        setMatch(updated);

        // Detect if opponent has picked (for current ball)
        if (updated.game_state?.phase === 'pick') {
          const opponentHasPick = isHost
            ? updated.guest_pick !== null
            : updated.host_pick !== null;
          setOpponentPicked(opponentHasPick);
        } else {
          setOpponentPicked(false);
        }
      })
      .subscribe();

    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [match?.id, isHost]);

  // Host resolves ball when both picks are in
  useEffect(() => {
    if (!match || !isHost) return;
    if (match.game_state?.phase !== 'pick') return;
    if (match.host_pick === null || match.guest_pick === null) return;

    const newGs = resolveBall(
      match.game_state,
      match.host_pick,
      match.guest_pick,
      match.config,
      match.host_username,
      match.guest_username ?? 'Guest',
    );
    updateMpMatch(match.id, {
      game_state: newGs,
      host_pick: null,
      guest_pick: null,
      guest_action: null,
    });
    setMyPick(null);
    setOpponentPicked(false);
  }, [match?.host_pick, match?.guest_pick, isHost]);

  // Host handles guest_action (toss call / bat/bowl choice)
  useEffect(() => {
    if (!match || !isHost) return;
    const gs = match.game_state;
    const ga = match.guest_action;
    if (!ga) return;

    if (gs.phase === 'toss' && gs.tossWinner === 'guest' && (ga === 'bat' || ga === 'bowl')) {
      const firstBatter: 'host' | 'guest' = ga === 'bat' ? 'guest' : 'host';
      updateMpMatch(match.id, {
        game_state: { ...gs, firstBatter, phase: 'pick' },
        guest_action: null,
      });
    }
  }, [match?.guest_action, isHost]);

  // Guest is waiting → poll occasionally if realtime misses
  useEffect(() => {
    if (!match?.id || !match.game_state || match.game_state.phase === 'result') return;
    const t = setInterval(async () => {
      const fresh = await getMpMatch(match.room_code);
      if (fresh) setMatch(fresh);
    }, 5000);
    return () => clearInterval(t);
  }, [match?.id, match?.game_state?.phase, match?.room_code]);

  // ── Lobby Actions ──────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!user) return;
    setLoadingAction(true); setLobbyError('');
    const m = await createMpMatch(user.id, user.username, config);
    if (!m) { setLobbyError('Failed to create room. Try again.'); setLoadingAction(false); return; }
    setMatch(m);
    setLoadingAction(false);
  }, [user, config]);

  const handleJoin = useCallback(async () => {
    if (!user || !joinCode.trim()) return;
    setLoadingAction(true); setLobbyError('');
    const m = await joinMpMatch(joinCode.trim(), user.id, user.username);
    if (!m) {
      setLobbyError('Room not found or already full. Check the code.');
      setLoadingAction(false);
      return;
    }
    setMatch(m);
    setLoadingAction(false);
  }, [user, joinCode]);

  const handleCopyCode = useCallback(() => {
    if (!match) return;
    navigator.clipboard.writeText(match.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [match?.room_code]);

  // ── Toss / Choice Actions ──────────────────────────────────────────────────

  const handleBatBowl = useCallback(async (choice: 'bat' | 'bowl') => {
    if (!match || !gs) return;
    const firstBatter: 'host' | 'guest' = choice === 'bat' ? (isHost ? 'host' : 'guest') : (isHost ? 'guest' : 'host');

    if (isHost) {
      await updateMpMatch(match.id, {
        game_state: { ...gs, firstBatter, phase: 'pick' },
      });
    } else {
      // Guest sends action, host picks it up
      await updateMpMatch(match.id, { guest_action: choice });
    }
  }, [match, gs, isHost]);

  // ── Ball Pick ──────────────────────────────────────────────────────────────

  const handlePick = useCallback(async (n: number) => {
    if (!match || !gs || myPick !== null) return;
    setMyPick(n);
    const updates = isHost ? { host_pick: n } : { guest_pick: n };
    await updateMpMatch(match.id, updates);
  }, [match, gs, myPick, isHost]);

  // ── Innings Break ──────────────────────────────────────────────────────────

  const handleStartInnings2 = useCallback(async () => {
    if (!match || !gs || !isHost) return;
    await updateMpMatch(match.id, {
      game_state: {
        ...gs,
        phase: 'pick',
        currentInnings: 2,
        score: 0,
        wicketsLost: 0,
        ballsBowled: 0,
        batterHistory: [],
        bowlerHistory: [],
        lastMsg: '',
        lastEvent: null,
      },
    });
  }, [match, gs, isHost]);

  const resetMatch = useCallback(() => {
    setMatch(null);
    setMyPick(null);
    setOpponentPicked(false);
    setLobbyMode('menu');
    setJoinCode('');
    setLobbyError('');
    if (channelRef.current) channelRef.current.unsubscribe();
  }, []);

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
        <header className="w-full max-w-md p-4 flex items-center gap-4 border-b border-[#1e1e3a]">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#00ff88] transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold tracking-widest text-[#818cf8]" style={{ fontFamily: "'Orbitron', sans-serif" }}>⚔ MULTIPLAYER</h1>
        </header>
        <div className="flex flex-col gap-4 items-center justify-center flex-1 p-6 text-center">
          <div className="text-5xl">🔒</div>
          <p className="font-mono text-[#6b6b9a] text-sm">Sign in to play multiplayer.</p>
          <Link href="/login" className="mt-2 px-6 py-3 rounded-xl font-bold font-mono tracking-widest text-sm"
            style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)', color: '#fff', boxShadow: '0 0 20px rgba(129,140,248,0.3)' }}>
            SIGN IN
          </Link>
        </div>
      </div>
    );
  }

  // ── Render Lobby ───────────────────────────────────────────────────────────

  if (!match || match.game_state?.phase === 'lobby') {
    // Waiting for guest (host just created room)
    if (match && match.status === 'waiting') {
      return (
        <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
          <MpHeader onBack={resetMatch} />
          <div className="flex flex-col gap-6 w-full max-w-md p-4 flex-1 items-center justify-center">
            <div className="w-full bg-[#0c0c1e] p-6 rounded-2xl border border-[#1e1e3a]" style={{ borderTop: '2px solid #818cf8' }}>
              <h2 className="font-bold tracking-widest text-[#818cf8] mb-1 text-lg" style={{ fontFamily: "'Orbitron', sans-serif" }}>ROOM CREATED</h2>
              <p className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest mb-5">Share this code with your opponent</p>

              <div className="flex items-center gap-2 mb-5">
                <div className="flex-1 bg-[#06060f] border border-[#818cf880] rounded-xl px-5 py-4 font-mono font-bold text-3xl text-center tracking-[0.3em] text-[#818cf8]"
                  style={{ textShadow: '0 0 15px rgba(129,140,248,0.5)' }}>
                  {match.room_code}
                </div>
                <button onClick={handleCopyCode}
                  className="p-3 rounded-xl border border-[#1e1e3a] text-[#6b6b9a] hover:text-[#818cf8] hover:border-[#818cf8] transition-all">
                  {copied ? <Check size={20} className="text-[#00ff88]" /> : <Copy size={20} />}
                </button>
              </div>

              <div className="flex items-center gap-2 justify-center">
                <div className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse" />
                <span className="text-[11px] font-mono text-[#6b6b9a] animate-pulse">Waiting for opponent…</span>
              </div>
            </div>
            <button onClick={resetMatch} className="text-[10px] font-mono text-[#6b6b9a] hover:text-[#ff3366] uppercase tracking-widest transition-colors">
              [ Cancel ]
            </button>
          </div>
        </div>
      );
    }

    // Lobby menu
    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
        <MpHeader onBack={() => nav('/')} />
        <div className="flex flex-col gap-5 w-full max-w-md p-4 flex-1 items-center justify-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#6b6b9a]">
            Logged in as <span className="text-[#818cf8]">{user.username}</span>
          </p>

          <AnimatePresence mode="wait">
            {lobbyMode === 'menu' && (
              <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 w-full">
                <button onClick={() => setLobbyMode('creating')}
                  className="w-full h-16 rounded-xl font-bold tracking-widest transition-all"
                  style={{ fontFamily: "'Orbitron', sans-serif", background: 'rgba(129,140,248,0.1)', border: '1px solid #818cf8', color: '#818cf8', boxShadow: '0 0 20px rgba(129,140,248,0.15)', fontSize: '15px' }}>
                  CREATE ROOM
                </button>
                <button onClick={() => setLobbyMode('joining')}
                  className="w-full h-16 rounded-xl font-bold tracking-widest transition-all"
                  style={{ fontFamily: "'Orbitron', sans-serif", background: 'rgba(0,255,136,0.08)', border: '1px solid #00ff88', color: '#00ff88', boxShadow: '0 0 20px rgba(0,255,136,0.15)', fontSize: '15px' }}>
                  JOIN ROOM
                </button>
              </motion.div>
            )}

            {lobbyMode === 'creating' && (
              <motion.div key="creating" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="w-full bg-[#0c0c1e] p-5 rounded-2xl border border-[#1e1e3a] flex flex-col gap-4"
                style={{ borderTop: '2px solid #818cf8' }}>
                <h2 className="font-bold tracking-widest text-[#818cf8] text-base" style={{ fontFamily: "'Orbitron', sans-serif" }}>MATCH SETTINGS</h2>
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Overs (1–20)</label>
                    <input type="number" min={1} max={20} value={config.totalOvers}
                      onChange={e => setConfig(c => ({ ...c, totalOvers: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) }))}
                      className="bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] outline-none focus:border-[#818cf8] transition-all" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Wickets (1–10)</label>
                    <input type="number" min={1} max={10} value={config.totalWickets}
                      onChange={e => setConfig(c => ({ ...c, totalWickets: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) }))}
                      className="bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] outline-none focus:border-[#818cf8] transition-all" />
                  </div>
                </div>
                {lobbyError && <p className="text-[11px] font-mono text-[#ff3366]">{lobbyError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setLobbyMode('menu')} className="flex-1 h-11 rounded-xl border border-[#1e1e3a] font-mono text-[#6b6b9a] hover:text-[#ff3366] transition-all text-sm">Back</button>
                  <button onClick={handleCreate} disabled={loadingAction}
                    className="flex-1 h-11 rounded-xl font-bold font-mono tracking-widest transition-all text-sm disabled:opacity-50"
                    style={{ background: '#818cf8', color: '#06060f' }}>
                    {loadingAction ? '…' : 'CREATE'}
                  </button>
                </div>
              </motion.div>
            )}

            {lobbyMode === 'joining' && (
              <motion.div key="joining" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="w-full bg-[#0c0c1e] p-5 rounded-2xl border border-[#1e1e3a] flex flex-col gap-4"
                style={{ borderTop: '2px solid #00ff88' }}>
                <h2 className="font-bold tracking-widest text-[#00ff88] text-base" style={{ fontFamily: "'Orbitron', sans-serif" }}>JOIN MATCH</h2>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Room Code</label>
                  <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABC123" maxLength={6} autoComplete="off"
                    className="bg-[#06060f] border border-[#1e1e3a] h-12 rounded-xl px-4 font-mono text-[#00ff88] text-xl tracking-[0.3em] text-center outline-none focus:border-[#00ff88] transition-all placeholder:text-[#2a2a50]" />
                </div>
                {lobbyError && <p className="text-[11px] font-mono text-[#ff3366]">{lobbyError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setLobbyMode('menu')} className="flex-1 h-11 rounded-xl border border-[#1e1e3a] font-mono text-[#6b6b9a] hover:text-[#ff3366] transition-all text-sm">Back</button>
                  <button onClick={handleJoin} disabled={loadingAction || joinCode.length < 4}
                    className="flex-1 h-11 rounded-xl font-bold font-mono tracking-widest transition-all text-sm disabled:opacity-50"
                    style={{ background: '#00ff88', color: '#06060f' }}>
                    {loadingAction ? '…' : 'JOIN'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── Render Toss ────────────────────────────────────────────────────────────

  if (gs?.phase === 'toss') {
    const iWonToss = gs.tossWinner === (isHost ? 'host' : 'guest');
    const opponentName = isHost ? match.guest_username : match.host_username;

    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
        <MpHeader onBack={resetMatch} code={match.room_code} />
        <div className="flex flex-col gap-8 w-full max-w-md p-4 flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4" style={{ filter: `drop-shadow(0 0 20px ${iWonToss ? '#ffd700' : '#818cf8'})` }}>
              {gs.tossResult === 'heads' ? '🟡' : '⚫'}
            </div>
            <h2 className="text-2xl font-black tracking-widest mb-2" style={{ fontFamily: "'Orbitron', sans-serif", color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.5)' }}>
              {gs.tossResult.toUpperCase()}
            </h2>
            <p className="font-mono text-sm text-[#6b6b9a]">
              {iWonToss ? 'You won the toss!' : `${opponentName} won the toss!`}
            </p>
          </div>

          {iWonToss ? (
            <div className="w-full flex flex-col gap-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-center text-[#6b6b9a]">Choose your innings</p>
              <div className="flex gap-3">
                <button onClick={() => handleBatBowl('bat')}
                  className="flex-1 h-24 rounded-xl font-bold text-xl tracking-widest border-2 border-[#00ff88] text-[#00ff88] transition-all hover:shadow-[0_0_25px_rgba(0,255,136,0.3)]"
                  style={{ fontFamily: "'Orbitron', sans-serif", background: 'rgba(0,255,136,0.08)' }}>
                  BAT FIRST
                </button>
                <button onClick={() => handleBatBowl('bowl')}
                  className="flex-1 h-24 rounded-xl font-bold text-xl tracking-widest border-2 border-[#818cf8] text-[#818cf8] transition-all hover:shadow-[0_0_25px_rgba(129,140,248,0.3)]"
                  style={{ fontFamily: "'Orbitron', sans-serif", background: 'rgba(129,140,248,0.08)' }}>
                  BOWL FIRST
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-[#818cf8] animate-pulse" />
              <span className="text-[12px] font-mono text-[#6b6b9a] animate-pulse">
                Waiting for {opponentName} to choose…
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render Innings Break ───────────────────────────────────────────────────

  if (gs?.phase === 'innings_break') {
    const inn1BatterName = gs.innings1Batter === 'host' ? match.host_username : match.guest_username;
    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
        <MpHeader onBack={resetMatch} code={match.room_code} />
        <div className="flex flex-col gap-6 w-full max-w-md p-4 flex-1 items-center justify-center">
          <h2 className="text-2xl font-black tracking-widest text-[#818cf8]" style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 10px rgba(129,140,248,0.5)' }}>INNINGS BREAK</h2>
          <div className="bg-[#0c0c1e] w-full p-8 rounded-3xl border border-[#1e1e3a] text-center flex flex-col gap-3">
            <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">{inn1BatterName}'s score</p>
            <div className="text-7xl font-bold font-mono text-[#e2e2f2]">
              {gs.innings1Score}<span className="text-4xl text-[#6b6b9a]">/{gs.innings1Wickets}</span>
            </div>
            <p className="font-mono text-[#ffd700] tracking-widest uppercase">
              Target: <span className="font-bold text-xl">{gs.target}</span>
            </p>
          </div>
          {isHost ? (
            <button onClick={handleStartInnings2}
              className="w-full h-14 font-bold text-lg rounded-xl tracking-widest transition-all"
              style={{ fontFamily: "'Orbitron', sans-serif", background: '#00ff88', color: '#06060f', boxShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
              START INNINGS 2
            </button>
          ) : (
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-[#818cf8] animate-pulse" />
              <span className="text-[12px] font-mono text-[#6b6b9a] animate-pulse">Waiting for host to start innings 2…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render Result ──────────────────────────────────────────────────────────

  if (gs?.phase === 'result') {
    const myRole: 'host' | 'guest' = isHost ? 'host' : 'guest';
    const iWon = gs.resultMsg.toLowerCase().includes(myRole);
    const isTied = gs.resultMsg.includes('TIED');

    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
        <MpHeader onBack={resetMatch} />
        <div className="flex flex-col gap-6 w-full max-w-md p-4 flex-1 pb-8 overflow-y-auto">
          <Banner
            variant={isTied ? 'warning' : iWon ? 'success' : 'danger'}
            className="w-full text-xl py-4 uppercase tracking-widest"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {isTied ? 'MATCH TIED!' : iWon ? 'YOU WIN! 🏆' : 'YOU LOSE!'}
          </Banner>
          <div className="bg-[#0c0c1e] p-5 rounded-2xl border border-[#1e1e3a] flex flex-col gap-4">
            <h3 className="font-mono text-[10px] text-[#818cf8] uppercase tracking-[0.2em] font-bold">Match Summary</h3>
            <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-center items-center text-[11px] font-mono">
              <div className="text-[#00ff88]">{match.host_username}</div>
              <div className="text-[#6b6b9a]">VS</div>
              <div className="text-[#818cf8]">{match.guest_username}</div>

              <div className="text-[#e2e2f2] text-lg font-bold">{gs.innings1Batter === 'host' ? gs.innings1Score : gs.score}</div>
              <div className="text-[#6b6b9a] text-xs">Scores</div>
              <div className="text-[#e2e2f2] text-lg font-bold">{gs.innings1Batter === 'guest' ? gs.innings1Score : gs.score}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCell label="Balls" value={`${gs.ballsBowled + gs.innings1Score}`} />
            <StatCell label="Target" value={gs.target ?? '—'} />
            <StatCell label="Overs" value={match.config.totalOvers} />
          </div>
          <button onClick={resetMatch}
            className="w-full h-14 font-bold text-lg rounded-xl tracking-widest transition-all mt-2"
            style={{ fontFamily: "'Orbitron', sans-serif", background: '#00ff88', color: '#06060f', boxShadow: '0 0 20px rgba(0,255,136,0.3)' }}>
            BACK TO LOBBY
          </button>
        </div>
      </div>
    );
  }

  // ── Render Ball Play ───────────────────────────────────────────────────────

  if (gs?.phase === 'pick') {
    const iAmBatter = currentBatterSide(gs) === (isHost ? 'host' : 'guest');
    const roleColor = iAmBatter ? '#00ff88' : '#818cf8';
    const opponentName = isHost ? match.guest_username : match.host_username;
    const needTarget = gs.currentInnings === 2 && gs.target !== null;

    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
        <MpHeader onBack={resetMatch} code={match.room_code} />

        <div className="flex flex-col w-full max-w-md p-4 flex-1 gap-4">
          {/* Status bar */}
          <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-[#6b6b9a] bg-[#0c0c1e] px-4 py-3 rounded-xl border border-[#1e1e3a]">
            <span>{match.host_username} vs {match.guest_username}</span>
            <span>INN {gs.currentInnings}</span>
            <span className="font-bold" style={{ color: roleColor }}>{iAmBatter ? 'BATTING' : 'BOWLING'}</span>
          </div>

          {/* Target banner */}
          {needTarget && (
            <Banner variant="warning" className="py-2">
              Target: {gs.target} · Need {gs.target! - gs.score} from {match.config.totalOvers * 6 - gs.ballsBowled} balls
            </Banner>
          )}

          {/* Score display */}
          <div className="flex bg-[#0c0c1e] rounded-2xl border border-[#1e1e3a] overflow-hidden min-h-[110px]">
            <div className="flex-1 flex items-center justify-center p-4">
              <span className="text-6xl font-mono font-bold text-[#e2e2f2]">
                {gs.score}<span className="text-3xl text-[#6b6b9a]">/{gs.wicketsLost}</span>
              </span>
            </div>
            <div className="w-24 bg-[#06060f] flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-[#6b6b9a] uppercase">
              <span className="font-bold text-[#e2e2f2] text-xl">{formatOvers(gs.ballsBowled)}</span>
              <span>Overs</span>
              {gs.currentInnings === 2 && (
                <>
                  <span className="font-bold text-[#e2e2f2] text-base mt-1">{gs.innings1Score}</span>
                  <span>Inn1</span>
                </>
              )}
            </div>
          </div>

          {/* Last event */}
          <div className="h-14 flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {gs.lastMsg && (
                <motion.div key={gs.lastMsg} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                  <Banner variant={gs.lastEvent === 'out' ? 'danger' : gs.lastEvent === 'six' ? 'success' : 'default'} className="h-13">
                    {gs.lastMsg}
                  </Banner>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pick area */}
          <div className="mt-auto pb-4">
            {myPick !== null ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-2xl border-2 border-[#818cf8] flex items-center justify-center text-4xl font-mono font-bold text-[#818cf8]"
                  style={{ boxShadow: '0 0 25px rgba(129,140,248,0.3)' }}>
                  {myPick}
                </div>
                <div className="flex items-center gap-2">
                  {opponentPicked
                    ? <><div className="w-2 h-2 rounded-full bg-[#00ff88]" /><span className="text-[11px] font-mono text-[#00ff88]">Both picked — resolving…</span></>
                    : <><div className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse" /><span className="text-[11px] font-mono text-[#6b6b9a] animate-pulse">Waiting for {opponentName}…</span></>
                  }
                </div>
              </div>
            ) : (
              <>
                <p className="font-mono text-center text-[10px] text-[#6b6b9a] uppercase tracking-[0.2em] mb-4">
                  YOUR {iAmBatter ? 'SHOT' : 'BALL'} [0–6]
                </p>
                <Keypad onSelect={handlePick} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback (joining / syncing)
  return (
    <div className="min-h-[100dvh] bg-[#06060f] flex items-center justify-center">
      <span className="font-mono text-[#6b6b9a] animate-pulse text-sm">Connecting…</span>
    </div>
  );
}

function MpHeader({ onBack, code }: { onBack: () => void; code?: string }) {
  return (
    <header className="w-full max-w-md p-4 flex items-center gap-4 border-b border-[#1e1e3a] shrink-0">
      <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#00ff88] transition-colors">
        <ArrowLeft size={24} />
      </button>
      <h1 className="text-lg font-bold tracking-widest text-[#818cf8] flex-1" style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 10px rgba(129,140,248,0.5)' }}>
        ⚔ MULTIPLAYER
      </h1>
      {code && (
        <span className="font-mono text-[10px] tracking-widest text-[#4a4a70]">{code}</span>
      )}
    </header>
  );
}
