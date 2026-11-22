import React from 'react';

export default function AssessmentsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-white/5 rounded-md animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 animate-pulse">
            <div className="h-3 w-20 bg-white/5 rounded" />
            <div className="h-7 w-16 bg-white/10 rounded" />
          </div>
        ))}
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="h-9 w-64 bg-white/5 rounded-xl animate-pulse" />
        <div className="space-y-3 pt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 w-full bg-white/[0.02] rounded-xl border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
