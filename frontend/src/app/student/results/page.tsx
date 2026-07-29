'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, formatISTDateTime } from '../../../utils/api';
import { 
  ClipboardCheck, 
  Loader2, 
  Calendar, 
  ExternalLink,
  Clock,
  Database
} from 'lucide-react';

interface SubmissionResult {
  id: number;
  questionId: number;
  testId?: number;
  questionName: string;
  subjectName: string;
  language: string;
  status: string; // 'ACCEPTED', 'WRONG_ANSWER', etc.
  runTimeMs: number;
  memoryUsedKb: number;
  createdAt: string;
  passedTests: number;
  totalTests: number;
  attempts: number;
  score?: number;
  passingMarks?: number;
  percentage?: number;
  overallResult?: string; // 'PASS' or 'FAIL'
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  return formatISTDateTime(dateStr);
};

export default function StudentResults() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<SubmissionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [unlockedBadgeModal, setUnlockedBadgeModal] = useState<any>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const [submissionsData, earnedList] = await Promise.all([
        apiCall('/api/student/submissions').catch(() => []),
        apiCall('/api/student/badges/earned').catch(() => []),
      ]);

      setSubmissions(submissionsData || []);

      // Check for recently unlocked badges (within last 5 minutes)
      if (earnedList && earnedList.length > 0) {
        const sorted = [...earnedList].sort(
          (a: any, b: any) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()
        );
        const latest = sorted[0];
        const now = new Date().getTime();
        const earnedTime = new Date(latest.earnedAt).getTime();
        if (now - earnedTime < 300000) {
          setUnlockedBadgeModal(latest.badge);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load submission results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    router.refresh();
    fetchSubmissions();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed] mx-auto" />
          <p className="text-gray-400 font-sans text-xs">Loading academic results & submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans relative">
      {/* Animated Badge Unlock Notification Modal */}
      {unlockedBadgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-gradient-to-b from-purple-900/90 via-slate-900 to-slate-950 border-2 border-amber-400/80 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl shadow-purple-500/20 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-5xl mx-auto shadow-xl shadow-amber-500/30 animate-bounce">
              🎉
            </div>
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                Badge Unlocked!
              </span>
              <h2 className="text-2xl font-extrabold text-white">{unlockedBadgeModal.name}</h2>
              <p className="text-xs text-slate-300">{unlockedBadgeModal.description}</p>
            </div>
            <button
              onClick={() => setUnlockedBadgeModal(null)}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:brightness-110 transition-all"
            >
              Claim Badge
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Academic Results</h1>
        <p className="text-sm text-gray-500">View detailed scoring outputs and code submission history</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Code Submissions List */}
      <div>
        {submissions.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl text-center space-y-3 border border-white/5 bg-[#11131c]/50">
            <ClipboardCheck className="w-12 h-12 text-gray-600 mx-auto" />
            <h3 className="font-bold text-white text-lg">No submissions yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Results will be published here once you run or submit code in the practice arena.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((item) => {
              const isAccepted = item.overallResult === 'PASS' || item.status === 'ACCEPTED';
              let verdictText = isAccepted ? 'PASS' : 'FAIL';
              let badgeStyle = isAccepted 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20';

              return (
                <div key={item.id} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/5 bg-[#11131c] hover:border-white/10 transition-all">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${badgeStyle}`}>
                        {verdictText}
                      </span>
                      <h3 className="font-bold text-white text-lg">{item.questionName || 'Unknown Question'}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
                      <span className="text-gray-400 uppercase font-bold text-[10px] tracking-wider bg-white/5 px-2 py-0.5 rounded">
                        {item.subjectName || 'Unknown Subject'}
                      </span>
                      <span className="text-indigo-400 font-bold text-[10px] tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                        Attempts: {item.attempts ?? 1}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {item.runTimeMs !== null ? `${item.runTimeMs} ms` : 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-3.5 h-3.5" />
                        {item.memoryUsedKb !== null ? `${item.memoryUsedKb} KB` : 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => router.push(`/student/results/submission/${item.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 font-bold rounded-lg text-xs transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
