import React from 'react';
import { motion } from 'framer-motion';

interface BannerProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles = {
  default: {
    bg: 'rgba(28,28,56,0.9)',
    border: '#2a2a50',
    color: '#e2e2f2',
    shadow: 'none',
  },
  success: {
    bg: 'rgba(0,255,136,0.1)',
    border: '#00ff88',
    color: '#00ff88',
    shadow: '0 0 20px rgba(0,255,136,0.3), inset 0 0 20px rgba(0,255,136,0.05)',
  },
  danger: {
    bg: 'rgba(255,51,102,0.1)',
    border: '#ff3366',
    color: '#ff3366',
    shadow: '0 0 20px rgba(255,51,102,0.3), inset 0 0 20px rgba(255,51,102,0.05)',
  },
  warning: {
    bg: 'rgba(255,215,0,0.1)',
    border: '#ffd700',
    color: '#ffd700',
    shadow: '0 0 20px rgba(255,215,0,0.3), inset 0 0 20px rgba(255,215,0,0.05)',
  },
  info: {
    bg: 'rgba(129,140,248,0.1)',
    border: '#818cf8',
    color: '#818cf8',
    shadow: '0 0 20px rgba(129,140,248,0.3), inset 0 0 20px rgba(129,140,248,0.05)',
  },
};

export function Banner({ children, variant = 'default', className = '', style = {} }: BannerProps) {
  const s = variantStyles[variant];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: s.bg, borderColor: s.border, color: s.color, boxShadow: s.shadow, ...style }}
      className={`px-4 py-3 rounded-xl border text-center font-bold font-mono tracking-wide flex items-center justify-center gap-2 text-sm ${className}`}
    >
      {children}
    </motion.div>
  );
}