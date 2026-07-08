import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const games = [
  {
    path: '/rps',
    emoji: '✊',
    title: 'Rock Paper Scissors',
    desc: 'Classic hand battle vs the computer',
    accent: '#00ff88',
    tag: 'QUICK PLAY',
  },
  {
    path: '/guess',
    emoji: '🔢',
    title: 'Guess the Number',
    desc: 'Can you find the secret number?',
    accent: '#818cf8',
    tag: 'PUZZLE',
  },
];

export default function SideGames() {
  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 60% 30% at 50% -5%, rgba(129,140,248,0.06) 0%, transparent 60%),
          linear-gradient(rgba(129,140,248,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(129,140,248,0.02) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 40px 40px, 40px 40px',
      }}
    >
      <div className="w-full max-w-md flex flex-col gap-6 items-center">
        {/* Header */}
        <header className="w-full flex items-center gap-4 mt-3 mb-2">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#818cf8] transition-colors">
            <ArrowLeft size={22} />
          </Link>
          <h1
            className="text-xl font-black uppercase tracking-widest"
            style={{ fontFamily: "'Orbitron', sans-serif", color: '#818cf8' }}
          >
            Side Games
          </h1>
        </header>

        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#3a3a5c] w-full">
          — Quick games for a break —
        </p>

        {/* Game cards */}
        <div className="flex flex-col gap-4 w-full">
          {games.map((g, i) => (
            <Link key={g.path} href={g.path} className="block group">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="relative rounded-xl overflow-hidden cursor-pointer"
                style={{
                  background: '#0c0c1e',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderLeft: `3px solid ${g.accent}`,
                }}
              >
                <div className="p-6 flex flex-col gap-3 rounded-xl transition-all duration-300 group-hover:bg-[rgba(255,255,255,0.015)]">
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
                <div
                  className="absolute inset-x-0 bottom-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, ${g.accent}60, transparent)` }}
                />
              </motion.div>
            </Link>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4"
        >
          <Link href="/">
            <span className="font-mono text-[10px] text-[#3a3a5c] hover:text-[#6b6b9a] uppercase tracking-widest transition-colors cursor-pointer">
              ← Back to Hand Cricket
            </span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
