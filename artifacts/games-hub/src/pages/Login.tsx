import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/authContext';

type Mode = 'signin' | 'signup';

export default function Login() {
  const { signIn, signUp, user } = useAuth();
  const [, nav] = useLocation();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Already logged in → redirect home
  if (user) { nav('/'); return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    if (mode === 'signin') {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err); setLoading(false); return; }
      nav('/');
    } else {
      const { error: err } = await signUp(email, password, username);
      if (err) { setError(err); setLoading(false); return; }
      setSuccess('Account created! Check your email to confirm, then sign in.');
      setMode('signin');
      setUsername(''); setPassword('');
    }
    setLoading(false);
  }

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 50% 0%, rgba(129,140,248,0.08) 0%, transparent 60%),
          linear-gradient(rgba(129,140,248,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(129,140,248,0.03) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 40px 40px, 40px 40px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col gap-6"
      >
        {/* Logo */}
        <div className="text-center">
          <h1
            className="text-2xl font-black tracking-[0.15em] mb-1"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: '#818cf8',
              textShadow: '0 0 20px rgba(129,140,248,0.6)',
            }}
          >
            GAMES HUB
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#6b6b9a]">
            — Secure Your Profile —
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-[#0c0c1e] rounded-2xl border border-[#1e1e3a] overflow-hidden"
          style={{ borderTop: '2px solid #818cf8' }}
        >
          {/* Tab toggle */}
          <div className="flex">
            {(['signin', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                className="flex-1 py-3 font-mono text-[11px] uppercase tracking-widest transition-all"
                style={{
                  background: mode === m ? 'rgba(129,140,248,0.1)' : 'transparent',
                  color: mode === m ? '#818cf8' : '#4a4a70',
                  borderBottom: mode === m ? '2px solid #818cf8' : '2px solid transparent',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  key="username"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-1.5 overflow-hidden"
                >
                  <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">
                    Username <span className="text-[#ff3366]">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="[ your player tag ]"
                    autoComplete="off"
                    spellCheck={false}
                    className="bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] focus:border-[#818cf8] focus:shadow-[0_0_12px_rgba(129,140,248,0.2)] outline-none transition-all placeholder:text-[#2a2a50]"
                  />
                  <p className="text-[9px] font-mono text-[#4a4a70]">This is your public game ID — pick carefully.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] focus:border-[#818cf8] focus:shadow-[0_0_12px_rgba(129,140,248,0.2)] outline-none transition-all placeholder:text-[#2a2a50]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-[#6b6b9a] uppercase tracking-widest">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="········"
                required
                minLength={6}
                className="bg-[#06060f] border border-[#1e1e3a] h-11 rounded-xl px-4 font-mono text-[#e2e2f2] focus:border-[#818cf8] focus:shadow-[0_0_12px_rgba(129,140,248,0.2)] outline-none transition-all placeholder:text-[#2a2a50]"
              />
              {mode === 'signup' && (
                <p className="text-[9px] font-mono text-[#4a4a70]">Minimum 6 characters.</p>
              )}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] font-mono text-[#ff3366] bg-[#ff336615] border border-[#ff336640] rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] font-mono text-[#00ff88] bg-[#00ff8815] border border-[#00ff8840] rounded-lg px-3 py-2"
              >
                {success}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl font-bold tracking-widest transition-all mt-1 disabled:opacity-50"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                color: '#fff',
                fontSize: '13px',
                boxShadow: '0 0 20px rgba(129,140,248,0.3)',
              }}
            >
              {loading ? '…' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          </form>
        </div>

        <p className="font-mono text-[10px] text-center text-[#4a4a70]">
          Your account keeps stats private — only you can update them.
        </p>
      </motion.div>
    </div>
  );
}
