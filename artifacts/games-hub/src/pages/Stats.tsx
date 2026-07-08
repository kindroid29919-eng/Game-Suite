import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search } from 'lucide-react';
import { StatCell } from '@/components/StatCell';
import { useAuth } from '@/lib/authContext';
import { loadPlayer, getH2HStats, PlayerStats, H2HRecord } from '@/lib/supabase';

type Tab = 'sp' | 'mp' | 'h2h';

function fmt(n: number | undefined | null): string {
  if (n == null || n === undefined) return '—';
  return n.toLocaleString();
}
function fmtSR(runs: number | undefined, balls: number | undefined) {
  if (!runs || !balls) return '—';
  return (runs / balls * 100).toFixed(1);
}
function fmtAvg(runs: number | undefined, outs: number | undefined) {
  if (outs == null || runs == null) return '—';
  if (outs === 0) return runs === 0 ? '—' : `${runs}*`;
  return (runs / outs).toFixed(1);
}
function fmtEco(runs: number | undefined, balls: number | undefined) {
  if (!runs || !balls) return '—';
  return (runs / (balls / 6)).toFixed(2);
}
function fmtBowlSR(balls: number | undefined, wkts: number | undefined) {
  if (!balls || !wkts) return '—';
  return (balls / wkts).toFixed(1);
}
function fmtBowlAvg(runs: number | undefined, wkts: number | undefined) {
  if (!runs || !wkts) return '—';
  return (runs / wkts).toFixed(1);
}
function fmtBestFigs(wkts: number | undefined, runs: number | undefined) {
  if (!wkts && !runs) return '—';
  return `${wkts ?? 0}/${runs ?? 0}`;
}
function fmtWinPct(wins: number | undefined, matches: number | undefined) {
  if (!wins || !matches) return '—';
  return (wins / matches * 100).toFixed(1) + '%';
}

function Last5({ results }: { results?: string }) {
  if (!results) return <span className="font-mono text-[#6b6b9a] text-sm">—</span>;
  const chars = results.split('').slice(-5);
  return (
    <div className="flex gap-1">
      {chars.map((c, i) => (
        <span
          key={i}
          className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono"
          style={{
            background: c === 'W' ? 'rgba(0,255,136,0.15)' : c === 'L' ? 'rgba(255,51,102,0.15)' : 'rgba(255,215,0,0.15)',
            color: c === 'W' ? '#00ff88' : c === 'L' ? '#ff3366' : '#ffd700',
            border: `1px solid ${c === 'W' ? '#00ff8840' : c === 'L' ? '#ff336640' : '#ffd70040'}`,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <p className="text-[9px] font-mono uppercase tracking-[0.25em] font-bold pl-1 mt-2" style={{ color }}>
      {label}
    </p>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-4 gap-2">{children}</div>;
}

function StatGrid3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

function StatGrid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

// ── Single Player Stats ───────────────────────────────────────────────────────

function SinglePlayerStats({ stats, loading }: { stats: PlayerStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="font-mono text-sm text-[#6b6b9a] animate-pulse">Loading stats…</span>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="text-4xl">📊</span>
        <p className="font-mono text-sm text-[#6b6b9a]">No stats yet — play a match to get started!</p>
        <Link href="/cricket">
          <span className="font-mono text-[11px] text-[#00ff88] underline cursor-pointer">→ Play Single Player</span>
        </Link>
      </div>
    );
  }

  const s = stats;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* General */}
      <SectionHeader label="General" color="#ffd700" />
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <StatGrid>
          <StatCell label="Matches" value={<span className="text-[#e2e2f2]">{fmt(s.matches)}</span>} />
          <StatCell label="Wins" value={<span className="text-[#00ff88]">{fmt(s.wins)}</span>} />
          <StatCell label="Losses" value={<span className="text-[#ff3366]">{fmt(s.losses)}</span>} />
          <StatCell label="Ties" value={<span className="text-[#ffd700]">{fmt(s.ties)}</span>} />
        </StatGrid>
        <StatGrid3>
          <StatCell label="Win %" value={<span className="text-[#00ff88]">{fmtWinPct(s.wins, s.matches)}</span>} />
          <StatCell label="Cur Streak" value={<span className="text-[#ffd700]">{s.current_win_streak ?? 0}W</span>} />
          <StatCell label="Best Streak" value={<span className="text-[#818cf8]">{s.best_win_streak ?? 0}W</span>} />
        </StatGrid3>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono text-[#6b6b9a] uppercase tracking-widest pl-1">Last 5</span>
          <Last5 results={s.last_5_results} />
        </div>
      </div>

      {/* Batting */}
      <SectionHeader label="Batting" color="#00ff88" />
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <StatGrid>
          <StatCell label="Runs" value={fmt(s.bat_runs)} />
          <StatCell label="Balls" value={fmt(s.bat_balls)} />
          <StatCell label="Wkts Lost" value={<span className="text-[#ff3366]">{fmt(s.bat_outs)}</span>} />
          <StatCell label="SR" value={fmtSR(s.bat_runs, s.bat_balls)} />
        </StatGrid>
        <StatGrid3>
          <StatCell label="Average" value={fmtAvg(s.bat_runs, s.bat_outs)} />
          <StatCell label="HS (wkt)" value={<span className="text-[#ffd700]">{fmt(s.bat_hs) || '—'}</span>} />
          <StatCell label="Top Score" value={<span className="text-[#ffd700]">{fmt(s.bat_highest_team_score) || '—'}</span>} />
        </StatGrid3>
        <StatGrid>
          <StatCell label="30s" value={fmt(s.bat_thirties)} />
          <StatCell label="50s" value={<span className="text-[#818cf8]">{fmt(s.bat_fifties)}</span>} />
          <StatCell label="100s" value={<span className="text-[#ffd700]">{fmt(s.bat_centuries)}</span>} />
          <StatCell label="200s" value={<span className="text-[#ff3366]">{fmt(s.bat_double_centuries)}</span>} />
        </StatGrid>
      </div>

      {/* Bowling */}
      <SectionHeader label="Bowling" color="#818cf8" />
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <StatGrid>
          <StatCell label="Wickets" value={<span className="text-[#818cf8]">{fmt(s.bowl_wkts)}</span>} />
          <StatCell label="Balls" value={fmt(s.bowl_balls)} />
          <StatCell label="Runs" value={fmt(s.bowl_runs)} />
          <StatCell label="Economy" value={fmtEco(s.bowl_runs, s.bowl_balls)} />
        </StatGrid>
        <StatGrid3>
          <StatCell label="SR" value={fmtBowlSR(s.bowl_balls, s.bowl_wkts)} />
          <StatCell label="Average" value={fmtBowlAvg(s.bowl_runs, s.bowl_wkts)} />
          <StatCell label="Best" value={<span className="text-[#ffd700]">{fmtBestFigs(s.bowl_best_wkts, s.bowl_best_runs_for_best)}</span>} />
        </StatGrid3>
        <StatGrid3>
          <StatCell label="4-fers" value={fmt(s.bowl_4fer)} />
          <StatCell label="5-fers" value={<span className="text-[#818cf8]">{fmt(s.bowl_5fer)}</span>} />
          <StatCell label="10-fers" value={<span className="text-[#ffd700]">{fmt(s.bowl_10fer)}</span>} />
        </StatGrid3>
      </div>

      {/* Fielding */}
      <SectionHeader label="Fielding" color="#f472b6" />
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <StatGrid3>
          <StatCell label="Catches" value={<span className="text-[#00ff88]">{fmt(s.catches)}</span>} />
          <StatCell label="Dropped" value={<span className="text-[#ff3366]">{fmt(s.catches_dropped)}</span>} />
          <StatCell label="C%" value={
            <span style={{ color: (s.catches ?? 0) + (s.catches_dropped ?? 0) > 0 ? '#ffd700' : '#6b6b9a' }}>
              {(s.catches ?? 0) + (s.catches_dropped ?? 0) > 0
                ? Math.round((s.catches ?? 0) / ((s.catches ?? 0) + (s.catches_dropped ?? 0)) * 100) + '%'
                : '—'}
            </span>
          } />
        </StatGrid3>
        <StatGrid>
          <StatCell label="Stumpings" value={fmt(s.stumpings)} />
          <StatCell label="St Missed" value={<span className="text-[#ff3366]">{fmt(s.stumpings_missed)}</span>} />
          <StatCell label="Run Outs" value={fmt(s.runouts)} />
          <StatCell label="RO Missed" value={<span className="text-[#ff3366]">{fmt(s.runouts_missed)}</span>} />
        </StatGrid>
      </div>
    </div>
  );
}

// ── Multiplayer Stats ─────────────────────────────────────────────────────────

function MultiplayerStats({ stats, loading }: { stats: PlayerStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="font-mono text-sm text-[#6b6b9a] animate-pulse">Loading stats…</span>
      </div>
    );
  }
  if (!stats || !stats.mp_matches) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="text-4xl">⚔</span>
        <p className="font-mono text-sm text-[#6b6b9a]">No multiplayer matches yet!</p>
        <Link href="/multiplayer">
          <span className="font-mono text-[11px] text-[#f472b6] underline cursor-pointer">→ Play Multiplayer</span>
        </Link>
      </div>
    );
  }

  const s = stats;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <SectionHeader label="General" color="#ffd700" />
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <StatGrid>
          <StatCell label="Matches" value={<span className="text-[#e2e2f2]">{fmt(s.mp_matches)}</span>} />
          <StatCell label="Wins" value={<span className="text-[#00ff88]">{fmt(s.mp_wins)}</span>} />
          <StatCell label="Losses" value={<span className="text-[#ff3366]">{fmt(s.mp_losses)}</span>} />
          <StatCell label="Ties" value={<span className="text-[#ffd700]">{fmt(s.mp_ties)}</span>} />
        </StatGrid>
        <StatGrid3>
          <StatCell label="Win %" value={<span className="text-[#00ff88]">{fmtWinPct(s.mp_wins, s.mp_matches)}</span>} />
          <StatCell label="Cur Streak" value={<span className="text-[#ffd700]">{s.mp_current_win_streak ?? 0}W</span>} />
          <StatCell label="Best Streak" value={<span className="text-[#818cf8]">{s.mp_best_win_streak ?? 0}W</span>} />
        </StatGrid3>
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono text-[#6b6b9a] uppercase tracking-widest pl-1">Last 5</span>
          <Last5 results={s.mp_last_5_results} />
        </div>
      </div>

      <SectionHeader label="Batting" color="#00ff88" />
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <StatGrid>
          <StatCell label="Runs" value={fmt(s.mp_bat_runs)} />
          <StatCell label="Balls" value={fmt(s.mp_bat_balls)} />
          <StatCell label="Wkts Lost" value={<span className="text-[#ff3366]">{fmt(s.mp_bat_outs)}</span>} />
          <StatCell label="SR" value={fmtSR(s.mp_bat_runs, s.mp_bat_balls)} />
        </StatGrid>
        <StatGrid3>
          <StatCell label="Average" value={fmtAvg(s.mp_bat_runs, s.mp_bat_outs)} />
          <StatCell label="Highest" value={<span className="text-[#ffd700]">{fmt(s.mp_bat_hs) || '—'}</span>} />
          <StatCell label="Top Score" value={<span className="text-[#ffd700]">{fmt(s.mp_bat_highest_team_score) || '—'}</span>} />
        </StatGrid3>
        <StatGrid>
          <StatCell label="30s" value={fmt(s.mp_bat_thirties)} />
          <StatCell label="50s" value={<span className="text-[#818cf8]">{fmt(s.mp_bat_fifties)}</span>} />
          <StatCell label="100s" value={<span className="text-[#ffd700]">{fmt(s.mp_bat_centuries)}</span>} />
          <StatCell label="200s" value={<span className="text-[#ff3366]">{fmt(s.mp_bat_double_centuries)}</span>} />
        </StatGrid>
      </div>

      <SectionHeader label="Bowling" color="#818cf8" />
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <StatGrid>
          <StatCell label="Wickets" value={<span className="text-[#818cf8]">{fmt(s.mp_bowl_wkts)}</span>} />
          <StatCell label="Balls" value={fmt(s.mp_bowl_balls)} />
          <StatCell label="Runs" value={fmt(s.mp_bowl_runs)} />
          <StatCell label="Economy" value={fmtEco(s.mp_bowl_runs, s.mp_bowl_balls)} />
        </StatGrid>
        <StatGrid3>
          <StatCell label="SR" value={fmtBowlSR(s.mp_bowl_balls, s.mp_bowl_wkts)} />
          <StatCell label="Average" value={fmtBowlAvg(s.mp_bowl_runs, s.mp_bowl_wkts)} />
          <StatCell label="Best" value={<span className="text-[#ffd700]">{fmtBestFigs(s.mp_bowl_best_wkts, s.mp_bowl_best_runs_for_best)}</span>} />
        </StatGrid3>
        <StatGrid3>
          <StatCell label="4-fers" value={fmt(s.mp_bowl_4fer)} />
          <StatCell label="5-fers" value={<span className="text-[#818cf8]">{fmt(s.mp_bowl_5fer)}</span>} />
          <StatCell label="Catches" value={<span className="text-[#00ff88]">{fmt(s.mp_catches)}</span>} />
        </StatGrid3>
      </div>
    </div>
  );
}

// ── Head to Head ──────────────────────────────────────────────────────────────

function H2HStats({ userId }: { userId: string }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<H2HRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState('');

  async function handleSearch() {
    const opp = input.trim();
    if (!opp) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSearched(opp);
    try {
      const record = await getH2HStats(userId, opp);
      if (!record) {
        setError(`No head-to-head record vs "${opp}" yet.`);
      } else {
        setResult(record);
      }
    } catch {
      setError('Could not load H2H stats. Make sure the hc_h2h table exists in Supabase.');
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="bg-[#0c0c1e] border border-[#1e1e3a] rounded-xl p-4 flex flex-col gap-3">
        <p className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Enter opponent username</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="username"
            autoComplete="off"
            className="flex-1 bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] focus:border-[#818cf8] outline-none transition-all placeholder:text-[#2a2a50] text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: '#818cf8', color: '#06060f' }}
          >
            <Search size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
            <span className="font-mono text-sm text-[#6b6b9a] animate-pulse">Searching…</span>
          </motion.div>
        )}

        {!loading && error && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#0c0c1e] border border-[#ff336640] rounded-xl p-4 text-center">
            <p className="font-mono text-sm text-[#ff3366]">{error}</p>
          </motion.div>
        )}

        {!loading && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4">
            <div className="bg-[#0c0c1e] border border-[#818cf840] rounded-xl p-5 flex flex-col gap-4"
              style={{ borderTop: '2px solid #818cf8' }}>
              <div className="text-center">
                <p className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest mb-1">You vs</p>
                <h3 className="text-xl font-black tracking-widest"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: '#818cf8' }}>
                  {searched}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center text-center">
                <div className="flex flex-col gap-1">
                  <span className="text-4xl font-bold font-mono text-[#00ff88]">{result.wins}</span>
                  <span className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Wins</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold font-mono text-[#6b6b9a]">{result.matches}</span>
                  <span className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Played</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-4xl font-bold font-mono text-[#ff3366]">{result.losses}</span>
                  <span className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Losses</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <StatCell label="Win %" value={<span className="text-[#00ff88]">{fmtWinPct(result.wins, result.matches)}</span>} />
                <StatCell label="Ties" value={<span className="text-[#ffd700]">{result.ties}</span>} />
                <StatCell label="Matches" value={result.matches} />
              </div>

              {/* Win/loss bar */}
              {result.matches > 0 && (
                <div className="w-full h-2 rounded-full overflow-hidden bg-[#1e1e3a]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(result.wins / result.matches) * 100}%`,
                      background: 'linear-gradient(90deg, #00ff88, #00cc6a)',
                    }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Stats() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('sp');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    loadPlayer(user.username).then(p => {
      setStats(p);
      setStatsLoading(false);
    });
  }, [user?.username]);

  const tabs: { key: Tab; label: string; color: string }[] = [
    { key: 'sp', label: 'Single Player', color: '#00ff88' },
    { key: 'mp', label: 'Multiplayer', color: '#f472b6' },
    { key: 'h2h', label: 'Head to Head', color: '#818cf8' },
  ];

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex items-center justify-center">
        <span className="font-mono text-sm text-[#6b6b9a] animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-[#06060f] flex flex-col items-center">
        <header className="w-full max-w-md p-4 flex items-center gap-4 border-b border-[#1e1e3a]">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#818cf8] transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold tracking-widest text-[#818cf8]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Stats
          </h1>
        </header>
        <div className="flex flex-col gap-4 items-center justify-center flex-1 p-6 text-center">
          <div className="text-5xl">🔒</div>
          <p className="font-mono text-[#6b6b9a] text-sm">Sign in to view your career stats.</p>
          <Link href="/login">
            <span className="mt-2 px-6 py-3 rounded-xl font-bold font-mono tracking-widest text-sm inline-block cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)', color: '#fff', boxShadow: '0 0 20px rgba(129,140,248,0.3)' }}>
              SIGN IN
            </span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#06060f] flex flex-col items-center">
      <header className="w-full max-w-md p-4 flex items-center gap-4 border-b border-[#1e1e3a] shrink-0">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#818cf8] transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-widest text-[#818cf8]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            📊 Stats
          </h1>
          <p className="text-[10px] font-mono text-[#4a4a70] uppercase tracking-widest">{user.username}</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="w-full max-w-md flex border-b border-[#1e1e3a] shrink-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-3 font-mono text-[9px] uppercase tracking-widest transition-all"
            style={{
              color: tab === t.key ? t.color : '#4a4a70',
              background: tab === t.key ? `${t.color}08` : 'transparent',
              borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="w-full max-w-md p-4 overflow-y-auto flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'sp' && <SinglePlayerStats stats={stats} loading={statsLoading} />}
            {tab === 'mp' && <MultiplayerStats stats={stats} loading={statsLoading} />}
            {tab === 'h2h' && <H2HStats userId={user.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
