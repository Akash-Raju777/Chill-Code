'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { Award, ClipboardCheck, Loader2, Calendar, FileText, Download } from 'lucide-react';

interface Test {
  id: number;
  name: string;
  maxMarks: number;
  durationMinutes: number;
  startTime: string;
}

interface StudentTest {
  id: number;
  status: string;
  score: number;
  warningsCount: number;
  isSuspended: boolean;
  submittedAt?: string;
  test: Test;
}

export default function StudentResults() {
  const [attempts, setAttempts] = useState<StudentTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAttempts = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/student/tests');
      // Show only completed or evaluated test runs
      setAttempts(data.filter((st: StudentTest) => ['SUBMITTED', 'EVALUATED', 'SUSPENDED'].includes(st.status)));
    } catch (err: any) {
      setError('Failed to load assessment results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const handleDownloadReport = (testName: string) => {
    alert(`Downloading score report for: ${testName}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Academic Results</h1>
        <p className="text-sm text-gray-500">View scoring outputs and assessment results</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {attempts.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
          <ClipboardCheck className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="font-bold text-white text-lg">No completed tests</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Results will be published here once you submit assigned coding exams.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attempts.map((st) => (
            <div key={st.id} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    st.status === 'SUSPENDED' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {st.status}
                  </span>
                  <h3 className="font-bold text-white text-lg">{st.test.name}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Submitted: {st.submittedAt ? new Date(st.submittedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                  </span>
                  <span>Duration: {st.test.durationMinutes} mins</span>
                  <span>Warnings Logged: <strong className={st.warningsCount > 0 ? 'text-red-400' : 'text-gray-400'}>{st.warningsCount}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Score badge */}
                <div className="text-left md:text-right">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase">Final Grade</div>
                  <div className="text-2xl font-black text-white">{st.score} <span className="text-xs text-gray-500 font-normal">/ {st.test.maxMarks} pts</span></div>
                </div>

                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/5 border border-[#252836] text-[10px] font-bold text-gray-500 uppercase tracking-wider select-none">
                  View Only
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
