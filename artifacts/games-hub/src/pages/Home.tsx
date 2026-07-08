import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/authContext';

const games = [
  {
    path: '/rps',
    emoji: '✊',
    title: 'Rock Paper Scissors',
    desc: 'Classic hand battle vs the computer',
    accent: '#00ff88',
    glow: 'rgba(0,255,136,0.25)',
    tag: 'QUICK PLAY',
  },
  {
    path: '/guess',
    emoji: '🔢',
    title: 'Guess the Number',
    desc: 'Can you find the secret number?',
    accent: '#818cf8',
    glow: 'rgba(129,140,248,0.25)',
    tag: 'PUZZLE',
  },
  {
    path: '/cricket',
    emoji: '🏏',
    title: 'Hand Cricket',
    desc: 'Full T20 vs CricBot — bat, bowl, win',
    accent: '#ffd700',
    glow: 'rgba(255,215,0,0.25)',
    tag: 'STRATEGY',
  },
  {
    path: '/multiplayer',
    emoji: '⚔',
    title: 'Multiplayer Cricket',
    desc: 'Challenge a real player online — live',
    accent: '#f472b6',
    glow: 'rgba(244,114,182,0.25)',
    tag: 'ONLINE',
  },
];

export default function Home() {
  const { user, signOut, loading } = useAuth();

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center p-4 md:p-8 relative overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 70% 40% at 50% -5%, rgba(0,255,136,0.08) 0%, transparent 60%),
          linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 40px 40px, 40px 40px',
      }}
    >
      <div className="w-full max-w-md md:max-w-3xl flex flex-col gap-8 items-center">

        {/* Auth bar */}
        {!loading && (
          <div className="w-full flex justify-end items-center gap-3 mt-2">
            {user ? (
              <>
                <span className="font-mono text-[10px] text-[#6b6b9a] uppercase tracking-widest">
                  <span className="text-[#00ff88]">{user.username}</span>
                </span>
                <button
                  onClick={() => signOut()}
                  className="font-mono text-[10px] uppercase tracking-widest text-[#4a4a70] hover:text-[#ff3366] transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/login">
                <span
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all cursor-pointer"
                  style={{ color: '#818cf8', borderColor: '#818cf840', background: '#818cf810' }}
                >
                  Sign In
                </span>
              </Link>
            )}
          </div>
        )}

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-2 w-full"
        >
          <h1
            className="text-3xl md:text-5xl font-black uppercase tracking-[0.15em] mb-3"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: '#00ff88',
              textShadow: '0 0 20px rgba(0,255,136,0.6), 0 0 60px rgba(0,255,136,0.2)',
            }}
          >
            AhaD's Games Hub
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#6b6b9a]">
            — Select a game —
          </p>
        </motion.header>

        {/* Game Cards */}
        <div className="flex flex-col md:grid md:grid-cols-2 gap-4 w-full">
          {games.map((g, i) => (
            <Link key={g.path} href={g.path} className="block group">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 + 0.2 }}
                whileHover={{ scale: 1.03, y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="relative rounded-xl overflow-hidden cursor-pointer"
                style={{
                  background: '#0c0c1e',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderLeft: `3px solid ${g.accent}`,
                }}
              >
                <div className="p-6 flex flex-col gap-3 h-full rounded-xl transition-all duration-300 group-hover:bg-[rgba(255,255,255,0.015)]">
                  {/* Tag */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border"
                      style={{ color: g.accent, borderColor: `${g.accent}40`, background: `${g.accent}10` }}
                    >
                      {g.tag}
                    </span>
                    <span
                      className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: g.accent }}
                    >
                      PLAY →
                    </span>
                  </div>

                  <div className="text-5xl leading-none mt-1">{g.emoji}</div>

                  <div>
                    <h2
                      className="font-bold text-base uppercase tracking-wider mb-1"
                      style={{ fontFamily: "'Orbitron', sans-serif", color: g.accent }}
                    >
                      {g.title}
                    </h2>
                    <p className="text-xs font-mono text-[#6b6b9a] leading-relaxed">{g.desc}</p>
                  </div>
                </div>

                {/* Bottom glow line */}
                <div
                  className="absolute inset-x-0 bottom-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, ${g.accent}60, transparent)` }}
                />
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Credits */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="font-mono text-xs text-[#6b6b9a] pb-6"
        >
          Built by{' '}
          <span
            className="font-bold"
            style={{
              background: 'linear-gradient(90deg, #00ff88, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AhaD
          </span>
        </motion.p>
      </div>
    </div>
  );
}
