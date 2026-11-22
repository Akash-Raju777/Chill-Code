import React from 'react';

export default function ResultsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-white/5 rounded-md animate-pulse" />
        </div>
        <div className="h-10 w-28 bg-white/5 rounded-xl animate-pulse" />
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="h-9 w-64 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-9 w-32 bg-white/5 rounded-xl animate-pulse" />
        </div>

        <div className="space-y-3 pt-2">
          <div className="h-5 w-full bg-white/5 rounded animate-pulse" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 w-full bg-white/[0.02] rounded-lg border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
