'use client';

import React, { useEffect } from 'react';
import { XCircle, RefreshCw, ArrowRight } from 'lucide-react';

interface FailResultModalProps {
  score: number;
  totalMarks: number;
  passingMarks: number;
  percentage: number;
  questionName?: string;
  onComplete: () => void;
}

export default function FailResultModal({
  score,
  totalMarks,
  passingMarks,
  percentage,
  questionName = 'Coding Challenge',
  onComplete,
}: FailResultModalProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fadeIn select-none">
      {/* Background Soft Red Pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        <div className="w-[500px] h-[500px] rounded-full bg-red-600/15 blur-3xl animate-pulse" />
      </div>

      {/* Main Fail Card with Shake Animation */}
      <div className="relative z-10 w-full max-w-md bg-[#11131c]/95 border-2 border-red-500/30 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(239,68,68,0.25)] backdrop-blur-xl animate-shake">
        {/* Red Icon Badge */}
        <div className="relative inline-block mb-4">
          <div className="absolute inset-0 bg-red-500/30 blur-lg rounded-full" />
          <div className="relative w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
            <XCircle className="w-10 h-10 animate-pulse" />
          </div>
        </div>

        {/* Status Header */}
        <div className="inline-block px-4 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider mb-3">
          ❌ Better Luck Next Time
        </div>

        <h2 className="text-xl font-bold text-white mb-1 line-clamp-1">{questionName}</h2>
        <p className="text-xs text-red-300/80 font-medium mb-6">Keep Practicing! You'll get it next time.</p>

        {/* Score Card Breakdown */}
        <div className="bg-white/[0.03] border border-red-500/20 p-4 rounded-2xl mb-6 grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Score</div>
            <div className="text-2xl font-black text-red-400 font-mono">
              {score} <span className="text-xs text-gray-500">/ {totalMarks}</span>
            </div>
            <div className="text-[10px] text-gray-500 font-medium">Req. Passing: {passingMarks}</div>
          </div>

          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Percentage</div>
            <div className="text-2xl font-black text-red-400 font-mono">
              {percentage}%
            </div>
            <div className="text-[10px] text-gray-500 font-medium">Status: FAIL</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onComplete}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            Review Submission Details
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-gray-500">Redirecting to full report in 3 seconds...</p>
        </div>
      </div>
    </div>
  );
}
