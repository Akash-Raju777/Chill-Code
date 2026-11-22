import React from 'react';

export default function StaffPerformanceLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-60 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-white/5 rounded-md animate-pulse" />
        </div>
        <div className="h-10 w-24 bg-white/5 rounded-xl animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-white/5 rounded" />
              <div className="h-7 w-7 bg-white/5 rounded-xl" />
            </div>
            <div className="h-7 w-16 bg-white/10 rounded" />
            <div className="h-3 w-32 bg-white/5 rounded" />
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
