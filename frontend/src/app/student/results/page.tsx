'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall, formatISTDateTime, smartCache } from '../../../utils/api';
import { 
  ClipboardCheck, 
  Loader2, 
  Calendar, 
  ExternalLink,
  Clock,
  RefreshCw
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

const formatDuration = (seconds?: number, startedAt?: string, submittedAt?: string) => {
  let actualSec = seconds;
  if (actualSec === undefined || actualSec === null || actualSec < 0) return 'N/A';
  if (actualSec === 0) return '0 sec';
  
  const hrs = Math.floor(actualSec / 3600);
  const mins = Math.floor((actualSec % 3600) / 60);
  const secs = actualSec % 60;

  if (hrs > 0) {
    return `${hrs} hr ${mins} min ${secs} sec`;
  }
  if (mins > 0) {
    return `${mins} min ${secs} sec`;
  }
  return `${secs} sec`;
};

export default function StudentResults() {
  const router = useRouter();

  // Instant SWR initial state: read cached submissions & pending evaluation immediately
  const [submissions, setSubmissions] = useState<SubmissionResult[]>(() => {
    let list: SubmissionResult[] = [];
    try {
      const cached = smartCache.get('/api/student/submissions');
      if (cached && Array.isArray(cached.data)) {
        list = [...cached.data];
      }
    } catch (_) {}

    // Check if there is an active evaluation/exit pending from the test workspace
    try {
      if (typeof window !== 'undefined') {
        const pendingRaw = sessionStorage.getItem('chill_pending_evaluation');
        if (pendingRaw) {
          const pendingItem = JSON.parse(pendingRaw);
          if (pendingItem && pendingItem.questionName) {
            list = [pendingItem, ...list.filter(s => s.id !== pendingItem.id)];
          }
        }
      }
    } catch (_) {}
    return list;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const pendingRaw = sessionStorage.getItem('chill_pending_evaluation');
      if (pendingRaw) return false;
    }
    const cached = smartCache.get('/api/student/submissions');
    return !cached || !Array.isArray(cached.data);
  });

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [unlockedBadgeModal, setUnlockedBadgeModal] = useState<any>(null);

  const fetchSubmissions = async (showLoading = true, isRefresh = false) => {
    if (showLoading && submissions.length === 0) setLoading(true);
    if (isRefresh) setRefreshing(true);
    try {
      const [submissionsData, earnedList] = await Promise.all([
        apiCall('/api/student/submissions', { skipLocalCache: true }).catch(() => []),
        apiCall('/api/student/badges/earned', { skipLocalCache: isRefresh }).catch(() => []),
      ]);

      let freshList: SubmissionResult[] = Array.isArray(submissionsData) ? [...submissionsData] : [];

      // Check if chill_pending_evaluation is now represented in freshList (prevents duplicate cards)
      try {
        if (typeof window !== 'undefined') {
          const pendingRaw = sessionStorage.getItem('chill_pending_evaluation');
          if (pendingRaw) {
            const pendingItem = JSON.parse(pendingRaw);
            const isExitedStub = pendingItem.status === 'EXITED';
            const expectedAttempts = pendingItem.attempts ?? 1;
            const pendingAgeMs = Date.now() - (pendingItem.createdAt ? new Date(pendingItem.createdAt).getTime() : 0);

            let shouldRemoveStub = pendingAgeMs > 30000;
            if (!shouldRemoveStub && pendingItem.submissionId) {
              // Exact match by real DB submissionId — replace stub with real DB record (PENDING or finalized)
              shouldRemoveStub = freshList.some(s => s.id === pendingItem.submissionId);
            } else if (!shouldRemoveStub) {
              if (isExitedStub) {
                shouldRemoveStub = freshList.some(s =>
                  s.questionId === pendingItem.questionId &&
                  s.status === 'EXITED' &&
                  (s.attempts ?? 1) >= expectedAttempts
                );
              } else {
                shouldRemoveStub = freshList.some(s =>
                  s.questionId === pendingItem.questionId &&
                  (s.status === 'PENDING' || (s as any).status === 'EVALUATING' || (s.attempts ?? 1) >= expectedAttempts)
                );
              }
            }

            if (shouldRemoveStub) {
              sessionStorage.removeItem('chill_pending_evaluation');
            } else {
              // Not yet visible in backend list: keep stub pinned once at top without duplicating
              freshList = [pendingItem, ...freshList.filter(s => s.id !== pendingItem.id)];
            }
          }
        }
      } catch (_) {}

      // Safety deduplication by submission id
      const seenIds = new Set<number>();
      freshList = freshList.filter((item) => {
        if (item.id == null) return true;
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      setSubmissions(freshList);

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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubmissions(false, false);
  }, []);

  // Real-time automatic polling when any submission is in PENDING/EVALUATING state or a stub is active
  const hasActivePending = submissions.some(s => s.status === 'PENDING' || (s as any).status === 'EVALUATING' || s.id < 0);
  useEffect(() => {
    const hasPendingStub = typeof window !== 'undefined' && !!sessionStorage.getItem('chill_pending_evaluation');
    if (!hasActivePending && !hasPendingStub) return;

    const interval = setInterval(() => {
      fetchSubmissions(false, true);
    }, 750);

    return () => clearInterval(interval);
  }, [hasActivePending]);

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

      {/* Header with Refresh button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Academic Results</h1>
          <p className="text-sm text-gray-500">View detailed scoring outputs and code submission history</p>
        </div>
        <button
          onClick={() => fetchSubmissions(false, true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all disabled:opacity-50 select-none shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
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
              const isPending = item.status === 'PENDING' || (item as any).status === 'EVALUATING';
              const isExited = item.status === 'EXITED';
              const isAccepted = item.overallResult === 'PASS' || item.status === 'ACCEPTED';
              let verdictText = isAccepted ? 'PASS' : 'FAIL';
              let badgeStyle = isAccepted 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20';

              return (
                <div key={item.id} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/5 bg-[#11131c] hover:border-white/10 transition-all">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPending ? (
                        <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                          Evaluating
                        </span>
                      ) : isExited ? (
                        <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          EXITED (FAIL)
                        </span>
                      ) : (
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${badgeStyle}`}>
                          {verdictText}
                        </span>
                      )}
                      <h3 className="font-bold text-white text-lg">{item.questionName || 'Unknown Question'}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
                      <span className="text-gray-400 uppercase font-bold text-[10px] tracking-wider bg-white/5 px-2 py-0.5 rounded">
                        {item.subjectName || 'Unknown Subject'}
                      </span>
                      <span className="text-indigo-400 font-bold text-[10px] tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                        Attempts: {item.attempts ?? 1}
                      </span>
                      <span className="flex items-center gap-1 text-indigo-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        {formatDuration((item as any).timeTakenSeconds, (item as any).startedAt, (item as any).submittedAt || item.createdAt)}
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
