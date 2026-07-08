import React from 'react';

export function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-3 rounded-lg bg-[#0c0c1e] border border-[#1e1e3a] relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00ff88]/40 to-transparent" />
      <span className="font-mono text-xl font-bold text-[#e2e2f2]">{value}</span>
      <span className="text-[9px] uppercase tracking-widest text-[#6b6b9a] mt-1">{label}</span>
    </div>
  );
}
