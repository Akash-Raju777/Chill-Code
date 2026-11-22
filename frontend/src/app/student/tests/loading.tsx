import React from 'react';

export default function TestsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-white/5 rounded-md animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 animate-pulse">
            <div className="h-5 w-40 bg-white/10 rounded" />
            <div className="h-4 w-full bg-white/5 rounded" />
            <div className="h-4 w-2/3 bg-white/5 rounded" />
            <div className="h-9 w-full bg-indigo-600/20 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
