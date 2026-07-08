import React, { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Banner } from '@/components/Banner';
import { StatCell } from '@/components/StatCell';

type Choice = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'lose' | 'tie' | null;

const EMOJI = { rock: '✊', paper: '🖐️', scissors: '✌️' };

const CHOICE_COLORS = {
  rock: { border: '#00ff88', glow: 'rgba(0,255,136,0.5)', hoverBg: 'rgba(0,255,136,0.1)' },
  paper: { border: '#818cf8', glow: 'rgba(129,140,248,0.5)', hoverBg: 'rgba(129,140,248,0.1)' },
  scissors: { border: '#ffd700', glow: 'rgba(255,215,0,0.5)', hoverBg: 'rgba(255,215,0,0.1)' },
};

export default function RockPaperScissors() {
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [ties, setTies] = useState(0);
  const [lastPlayer, setLastPlayer] = useState<Choice | null>(null);
  const [lastComputer, setLastComputer] = useState<Choice | null>(null);
  const [lastResult, setLastResult] = useState<Result>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const play = (choice: Choice) => {
    if (isRevealing) return;
    
    const compChoices: Choice[] = ['rock', 'paper', 'scissors'];
    const comp = compChoices[Math.floor(Math.random() * 3)];
    
    setLastPlayer(choice);
    setLastComputer(comp);
    setIsRevealing(true);
    
    setTimeout(() => {
      let result: Result = 'lose';
      if (choice === comp) result = 'tie';
      else if (
        (choice === 'rock' && comp === 'scissors') ||
        (choice === 'paper' && comp === 'rock') ||
        (choice === 'scissors' && comp === 'paper')
      ) {
        result = 'win';
      }
      
      setLastResult(result);
      if (result === 'win') setWins(w => w + 1);
      else if (result === 'lose') setLosses(l => l + 1);
      else setTies(t => t + 1);
      
      setIsRevealing(false);
    }, 600);
  };

  const reset = () => {
    setWins(0); setLosses(0); setTies(0);
    setLastPlayer(null); setLastComputer(null); setLastResult(null);
  };

  const getArenaBorder = (isPlayer: boolean) => {
    if (isRevealing || !lastResult) return '#1e1e3a';
    if (lastResult === 'tie') return '#ffd700';
    if (isPlayer) return lastResult === 'win' ? '#00ff88' : '#ff3366';
    return lastResult === 'win' ? '#ff3366' : '#00ff88';
  };

  const getArenaGlow = (isPlayer: boolean) => {
    if (isRevealing || !lastResult) return 'transparent';
    if (lastResult === 'tie') return 'rgba(255,215,0,0.3)';
    if (isPlayer) return lastResult === 'win' ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)';
    return lastResult === 'win' ? 'rgba(255,51,102,0.3)' : 'rgba(0,255,136,0.3)';
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center p-4 md:p-8 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[50vh] bg-[radial-gradient(ellipse_80%_100%_at_50%_-20%,rgba(0,255,136,0.08)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="w-full max-w-md flex flex-col h-full gap-6 z-10">
        <header className="flex items-center gap-4 py-4 border-b border-[#1e1e3a]">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-[#1c1c38] text-[#6b6b9a] hover:text-[#00ff88] transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-black tracking-widest text-[#00ff88]" style={{ fontFamily: "'Orbitron', sans-serif", textShadow: '0 0 10px rgba(0,255,136,0.5)' }}>RPS</h1>
        </header>

        <div className="flex-1 flex flex-col justify-center gap-8 py-4">
          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col items-center gap-3 w-[40%]">
              <span className="font-mono text-xs text-[#6b6b9a] uppercase tracking-[0.2em]">You</span>
              <div 
                className="w-full aspect-square rounded-2xl bg-[#0c0c1e] flex items-center justify-center text-7xl relative overflow-hidden transition-all duration-300"
                style={{ border: `2px solid ${getArenaBorder(true)}`, boxShadow: `0 0 30px ${getArenaGlow(true)}, inset 0 0 20px ${getArenaGlow(true)}` }}
              >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0px,transparent_3px,rgba(0,0,0,0.2)_3px,rgba(0,0,0,0.2)_4px)] pointer-events-none" />
                <AnimatePresence mode="popLayout">
                  {lastPlayer ? (
                    <motion.span
                      key={lastPlayer + Date.now()}
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute filter drop-shadow-xl"
                    >
                      {EMOJI[lastPlayer]}
                    </motion.span>
                  ) : <span className="text-[#1c1c38]">?</span>}
                </AnimatePresence>
              </div>
            </div>
            
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-2xl font-bold font-mono text-[#818cf8]"
              style={{ textShadow: '0 0 10px rgba(129,140,248,0.5)' }}
            >
              VS
            </motion.div>
            
            <div className="flex flex-col items-center gap-3 w-[40%]">
              <span className="font-mono text-xs text-[#6b6b9a] uppercase tracking-[0.2em]">Bot</span>
              <div 
                className="w-full aspect-square rounded-2xl bg-[#0c0c1e] flex items-center justify-center text-7xl relative overflow-hidden transition-all duration-300"
                style={{ border: `2px solid ${getArenaBorder(false)}`, boxShadow: `0 0 30px ${getArenaGlow(false)}, inset 0 0 20px ${getArenaGlow(false)}` }}
              >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0px,transparent_3px,rgba(0,0,0,0.2)_3px,rgba(0,0,0,0.2)_4px)] pointer-events-none" />
                <AnimatePresence mode="popLayout">
                  {lastComputer ? (
                    <motion.span
                      key={lastComputer + Date.now()}
                      initial={{ scale: 0, rotate: 45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute filter drop-shadow-xl"
                    >
                      {EMOJI[lastComputer]}
                    </motion.span>
                  ) : <span className="text-[#1c1c38]">?</span>}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="h-16 flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {lastResult && !isRevealing && (
                <motion.div
                  key={lastResult}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-full"
                >
                  <Banner variant={lastResult === 'win' ? 'success' : lastResult === 'lose' ? 'danger' : 'warning'} className="h-14 text-lg">
                    {lastResult === 'win' ? 'VICTORY' : lastResult === 'lose' ? 'DEFEAT' : 'DRAW'}
                  </Banner>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {(['rock', 'paper', 'scissors'] as const).map(choice => {
            const style = CHOICE_COLORS[choice];
            return (
              <motion.button
                key={choice}
                whileTap={isRevealing ? undefined : { scale: 0.85 }}
                onClick={() => play(choice)}
                disabled={isRevealing}
                className="group relative bg-[#0c0c1e] rounded-xl p-4 flex flex-col items-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                style={{ border: `1px solid #1e1e3a` }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = style.border;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${style.glow}`;
                  (e.currentTarget as HTMLElement).style.backgroundColor = style.hoverBg;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1e1e3a';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#0c0c1e';
                }}
              >
                <span className="text-4xl relative z-10 group-hover:scale-110 transition-transform">{EMOJI[choice]}</span>
                <span 
                  className="text-xs uppercase tracking-widest relative z-10 transition-colors"
                  style={{ fontFamily: "'Orbitron', sans-serif", color: '#e2e2f2' }}
                >
                  {choice}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCell label="Wins" value={<span className="neon-green">{wins}</span>} />
          <StatCell label="Losses" value={<span className="neon-red">{losses}</span>} />
          <StatCell label="Ties" value={<span className="neon-gold">{ties}</span>} />
        </div>

        <div className="flex justify-center mt-4 mb-8">
          <button 
            onClick={reset}
            className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6b6b9a] hover:text-[#e2e2f2] border border-transparent hover:border-[#1e1e3a] px-6 py-2 rounded-full transition-all hover:bg-[#0c0c1e]"
          >
            Reset Systems
          </button>
        </div>
      </div>
    </div>
  );
}