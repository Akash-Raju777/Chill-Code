import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-white/5 rounded-md animate-pulse" />
        </div>
        <div className="h-9 w-24 bg-white/5 rounded-xl animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-white/5 rounded" />
              <div className="h-8 w-8 bg-white/5 rounded-xl" />
            </div>
            <div className="h-7 w-20 bg-white/10 rounded" />
            <div className="h-3 w-32 bg-white/5 rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-white/5 h-72 animate-pulse" />
        <div className="glass-panel p-6 rounded-2xl border border-white/5 h-72 animate-pulse" />
      </div>
    </div>
  );
}
