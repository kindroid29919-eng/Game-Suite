import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface KeypadProps {
  onSelect: (n: number) => void;
  disabled?: boolean;
}

const KEY_STYLES: Record<number, { bg: string; border: string; color: string; glow: string }> = {
  0: { bg: 'rgba(255,51,102,0.08)', border: 'rgba(255,51,102,0.4)', color: '#ff3366', glow: 'rgba(255,51,102,0.5)' },
  1: { bg: 'rgba(12,12,30,0.9)', border: 'rgba(30,30,58,0.8)', color: '#9090c0', glow: 'rgba(130,130,200,0.4)' },
  2: { bg: 'rgba(12,12,30,0.9)', border: 'rgba(30,30,58,0.8)', color: '#9090c0', glow: 'rgba(130,130,200,0.4)' },
  3: { bg: 'rgba(12,12,30,0.9)', border: 'rgba(30,30,58,0.8)', color: '#9090c0', glow: 'rgba(130,130,200,0.4)' },
  4: { bg: 'rgba(0,255,136,0.06)', border: 'rgba(0,255,136,0.3)', color: '#00ff88', glow: 'rgba(0,255,136,0.5)' },
  5: { bg: 'rgba(0,255,136,0.06)', border: 'rgba(0,255,136,0.3)', color: '#00ff88', glow: 'rgba(0,255,136,0.5)' },
  6: { bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.4)', color: '#818cf8', glow: 'rgba(129,140,248,0.6)' },
};

export function Keypad({ onSelect, disabled }: KeypadProps) {
  const [tapped, setTapped] = useState<number | null>(null);
  const rows = [[0, 1, 2, 3], [4, 5, 6]];

  const handleTap = (n: number) => {
    if (disabled) return;
    setTapped(n);
    setTimeout(() => setTapped(null), 250);
    onSelect(n);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {row.map(n => {
            const s = KEY_STYLES[n];
            const isTapped = tapped === n;
            return (
              <motion.button
                key={n}
                whileTap={disabled ? undefined : { scale: 0.88 }}
                onClick={() => handleTap(n)}
                disabled={disabled}
                style={{
                  background: s.bg,
                  borderColor: isTapped ? s.color : s.border,
                  color: s.color,
                  boxShadow: isTapped
                    ? `0 0 24px ${s.glow}, inset 0 0 12px rgba(255,255,255,0.05)`
                    : `0 0 0px transparent`,
                }}
                className="flex-1 h-14 rounded-xl border-2 font-mono text-2xl font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:brightness-125 relative overflow-hidden"
              >
                <span className="relative z-10">{n}</span>
                {isTapped && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ background: s.color }}
                    className="absolute inset-0 m-auto w-full h-full rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}