import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Banner } from '@/components/Banner';
import { StatCell } from '@/components/StatCell';

type Status = 'idle' | 'high' | 'low' | 'win';

export default function GuessTheNumber() {
  const [secretNumber, setSecretNumber] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [gamesWon, setGamesWon] = useState(0);
  const [lastGuess, setLastGuess] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [inputValue, setInputValue] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  const initGame = () => {
    setSecretNumber(Math.floor(Math.random() * 100) + 1);
    setAttempts(0);
    setLastGuess(null);
    setStatus('idle');
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleGuess = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (status === 'win') return;
    
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 1 || num > 100) return;
    
    setLastGuess(num);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setInputValue('');
    
    if (num === secretNumber) {
      setStatus('win');
      setGamesWon(gw => gw + 1);
    } else if (num > secretNumber) {
      setStatus('high');
    } else {
      setStatus('low');
    }
    
    inputRef.current?.focus();
  };

  const getStatusColorClass = () => {
    if (status === 'win') return 'neon-green';
    if (status === 'high') return 'neon-red';
    if (status === 'low') return 'neon-indigo';
    return 'text-[#6b6b9a]';
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center p-4 relative">
      <div className="w-full max-w-md flex flex-col h-full gap-6 z-10">
        <header className="flex items-center gap-4 py-4 border-b border-[#1e1e3a]">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#00ff88] transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl md:text-2xl font-black tracking-widest text-[#818cf8]" style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 10px rgba(129,140,248,0.5)' }}>
            GUESS THE NUMBER
          </h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
          <div className="relative w-full aspect-[4/3] max-w-[300px]">
            <div className="absolute inset-0 bg-[#0c0c1e] border border-[#1e1e3a] rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center scanlines">
              <motion.div 
                key={lastGuess ?? 'none'}
                initial={{ scale: 0.5, opacity: 0, filter: 'blur(10px)' }}
                animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className={`text-8xl md:text-[140px] font-mono font-bold leading-none z-10 ${getStatusColorClass()}`}
              >
                {lastGuess ?? '00'}
              </motion.div>
            </div>
          </div>

          <div className="h-16 w-full">
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Banner variant="default">Awaiting input [1-100]...</Banner>
                </motion.div>
              )}
              {status === 'high' && (
                <motion.div key="high" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <Banner variant="danger">TOO HIGH ▼</Banner>
                </motion.div>
              )}
              {status === 'low' && (
                <motion.div key="low" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <Banner variant="info">TOO LOW ▲</Banner>
                </motion.div>
              )}
              {status === 'win' && (
                <motion.div key="win" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Banner variant="success">TARGET ACQUIRED IN {attempts} ATTEMPTS</Banner>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="w-full">
          {status === 'win' ? (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={initGame}
              className="w-full h-16 bg-[#00ff88] text-[#06060f] font-black text-xl rounded-xl hover:bg-[#00cc6a] transition-colors shadow-[0_0_30px_rgba(0,255,136,0.4)] tracking-widest"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              PLAY AGAIN
            </motion.button>
          ) : (
            <form onSubmit={handleGuess} className="flex gap-3">
              <input
                ref={inputRef}
                type="number"
                min="1"
                max="100"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="[1-100]"
                className="flex-1 h-16 bg-[#0c0c1e] border-2 border-[#1e1e3a] rounded-xl px-4 font-mono text-3xl text-center text-[#e2e2f2] focus:outline-none focus:border-[#00ff88] focus:shadow-[0_0_20px_rgba(0,255,136,0.2)] transition-all placeholder:text-[#1c1c38]"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputValue}
                className="h-16 px-8 bg-[#00ff88] text-[#06060f] border-none font-bold text-lg rounded-xl hover:bg-[#00cc6a] transition-colors disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,255,136,0.3)] tracking-widest"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                EXECUTE
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCell label="Attempts" value={<span className="text-[#e2e2f2]">{attempts}</span>} />
          <StatCell label="Range" value={<span className="text-[#6b6b9a]">1-100</span>} />
          <StatCell label="Wins" value={<span className="neon-green">{gamesWon}</span>} />
        </div>
      </div>
    </div>
  );
}