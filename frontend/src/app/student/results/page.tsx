'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '../../../utils/api';
import { 
  ClipboardCheck, 
  Loader2, 
  Calendar, 
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  XCircle,
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
  attempts?: number;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString();
  } catch (e) {
    return 'N/A';
  }
};

export default function StudentResults() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<SubmissionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/student/submissions');
      setSubmissions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load submission results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed] mx-auto" />
          <p className="text-gray-400 font-sans text-xs">Loading academic results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Academic Results</h1>
        <p className="text-sm text-gray-500">View detailed scoring outputs and submission history</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-3 border border-white/5 bg-[#11131c]/50">
          <ClipboardCheck className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="font-bold text-white text-lg">No submissions yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Results will be published here once you run or submit code in the practice arena.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((item) => {
            const isAccepted = item.status === 'ACCEPTED';
            let verdictText = item.status;
            let badgeStyle = "bg-red-500/10 text-red-400 border border-red-500/20";
            
            if (isAccepted) {
              verdictText = "Accepted";
              badgeStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
            } else if (item.status === 'PENDING') {
              verdictText = "Failed";
              badgeStyle = "bg-red-500/10 text-red-400 border border-red-500/20";
            } else if (item.status === 'COMPILATION_ERROR') {
              verdictText = "Compilation Error";
              badgeStyle = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
            } else if (item.status === 'RUNTIME_ERROR') {
              verdictText = "Runtime Error";
              badgeStyle = "bg-red-500/10 text-red-400 border border-red-500/20";
            } else if (item.status === 'TIME_LIMIT_EXCEEDED') {
              verdictText = "Time Limit Exceeded";
              badgeStyle = "bg-orange-500/10 text-orange-400 border border-orange-500/20";
            } else if (item.status === 'MEMORY_LIMIT_EXCEEDED') {
              verdictText = "Memory Limit Exceeded";
              badgeStyle = "bg-purple-500/10 text-purple-400 border border-purple-500/20";
            } else if (item.status === 'WRONG_ANSWER') {
              verdictText = "Output Not Matched";
            }

            return (
              <div key={item.id} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/5 bg-[#11131c] hover:border-white/10 transition-all">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeStyle}`}>
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
  );
}
