'use client';

import React, { useEffect, useState } from 'react';
import { useToastStore } from '../store/toastStore';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const [mounted, setMounted] = useState(false);
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';

        let bgStyle = 'bg-[#11131c] border-indigo-500/20 text-indigo-400';
        let Icon = Info;

        if (isSuccess) {
          bgStyle = 'bg-[#11131c]/95 border-emerald-500/20 text-emerald-400';
          Icon = CheckCircle;
        } else if (isError) {
          bgStyle = 'bg-[#11131c]/95 border-red-500/20 text-red-400';
          Icon = AlertCircle;
        } else if (isWarning) {
          bgStyle = 'bg-[#11131c]/95 border-amber-500/20 text-amber-400';
          Icon = AlertCircle;
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto border rounded-2xl p-4 flex gap-3 items-start justify-between shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300 ${bgStyle}`}
          >
            <div className="flex gap-2.5 items-start">
              <Icon className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-white leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
