import React from 'react';

export default function SubjectsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-white/10 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-white/5 rounded-md animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-indigo-600/30 rounded-xl animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 animate-pulse">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5" />
                <div className="h-5 w-32 bg-white/10 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-white/5 rounded" />
              <div className="h-4 w-3/4 bg-white/5 rounded" />
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-white/5">
              <div className="h-4 w-16 bg-white/5 rounded" />
              <div className="h-7 w-24 bg-white/5 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
