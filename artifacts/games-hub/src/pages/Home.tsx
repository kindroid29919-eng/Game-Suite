import React from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/authContext';

export default function Home() {
  const { user, signOut, loading } = useAuth();

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 70% 40% at 50% -5%, rgba(0,255,136,0.08) 0%, transparent 60%),
          linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 40px 40px, 40px 40px',
      }}
    >
      <div className="w-full max-w-md flex flex-col gap-6 items-center min-h-[100dvh]">

        {/* Auth bar */}
        {!loading && (
          <div className="w-full flex justify-end items-center gap-3 mt-3">
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

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3 mt-8 mb-4"
        >
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 1.2, delay: 0.4, ease: 'easeInOut' }}
            className="text-7xl leading-none"
          >
            🏏
          </motion.div>
          <h1
            className="text-4xl font-black uppercase tracking-[0.12em] text-center"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: '#00ff88',
              textShadow: '0 0 24px rgba(0,255,136,0.6), 0 0 60px rgba(0,255,136,0.2)',
            }}
          >
            Hand Cricket
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#6b6b9a]">
            — Choose your mode —
          </p>
        </motion.div>

        {/* Main action buttons */}
        <div className="flex flex-col gap-3 w-full">
          {[
            {
              href: '/cricket',
              label: 'Single Player',
              sub: 'vs CricBot AI',
              accent: '#00ff88',
              glow: 'rgba(0,255,136,0.3)',
              bg: 'rgba(0,255,136,0.07)',
              delay: 0.15,
            },
            {
              href: '/multiplayer',
              label: 'Multi Player',
              sub: 'Challenge a friend online',
              accent: '#f472b6',
              glow: 'rgba(244,114,182,0.3)',
              bg: 'rgba(244,114,182,0.07)',
              delay: 0.25,
            },
            {
              href: '/team',
              label: 'Team Mode',
              sub: '11-a-side, pick your XI',
              accent: '#ffd700',
              glow: 'rgba(255,215,0,0.3)',
              bg: 'rgba(255,215,0,0.07)',
              delay: 0.3,
            },
            {
              href: '/stats',
              label: 'Stats',
              sub: 'Career records & head-to-head',
              accent: '#818cf8',
              glow: 'rgba(129,140,248,0.3)',
              bg: 'rgba(129,140,248,0.07)',
              delay: 0.35,
            },
          ].map(btn => (
            <Link key={btn.href} href={btn.href} className="block group">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: btn.delay }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.97 }}
                className="w-full rounded-2xl flex items-center gap-5 px-6 py-5 cursor-pointer transition-all duration-200"
                style={{
                  background: btn.bg,
                  border: `1.5px solid ${btn.accent}40`,
                  boxShadow: `0 0 0 0 ${btn.glow}`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${btn.glow}`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${btn.accent}80`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 transparent';
                  (e.currentTarget as HTMLElement).style.borderColor = `${btn.accent}40`;
                }}
              >
                <div className="flex-1">
                  <div
                    className="text-xl font-black uppercase tracking-wider"
                    style={{ fontFamily: "'Orbitron', sans-serif", color: btn.accent }}
                  >
                    {btn.label}
                  </div>
                  <div className="text-[11px] font-mono text-[#6b6b9a] mt-0.5">{btn.sub}</div>
                </div>
                <span
                  className="font-mono text-lg opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                  style={{ color: btn.accent }}
                >
                  →
                </span>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Side Games divider */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full flex flex-col items-center gap-4 mt-2"
        >
          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-[#1e1e3a]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#3a3a5c]">side games</span>
            <div className="flex-1 h-px bg-[#1e1e3a]" />
          </div>

          <Link href="/side-games" className="block group w-full">
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all"
              style={{
                background: '#0c0c1e',
                border: '1px solid #1e1e3a',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎮</span>
                <div>
                  <div className="font-mono text-sm font-bold text-[#4a4a70] group-hover:text-[#6b6b9a] transition-colors uppercase tracking-wider">
                    Side Games
                  </div>
                  <div className="text-[10px] font-mono text-[#3a3a5c]">Rock Paper Scissors · Guess the Number</div>
                </div>
              </div>
              <span className="font-mono text-sm text-[#3a3a5c] group-hover:text-[#4a4a70] transition-colors">→</span>
            </motion.div>
          </Link>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="font-mono text-[10px] text-[#3a3a5c] pb-6 mt-auto"
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