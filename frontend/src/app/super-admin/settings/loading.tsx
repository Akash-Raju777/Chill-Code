import React from 'react';

export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="space-y-2">
        <div className="h-7 w-56 bg-white/10 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-white/5 rounded-md animate-pulse" />
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="space-y-3 pt-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 w-full bg-white/[0.02] rounded-xl border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
