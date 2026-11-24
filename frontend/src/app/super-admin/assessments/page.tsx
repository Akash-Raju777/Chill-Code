'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { apiCall, formatISTDateTime } from '@/utils/api';
import { toast } from '@/store/toastStore';
import {
  FileCode,
  Users,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Layers,
  Calendar,
  Clock,
  UserCheck,
  Eye,
  X,
  Filter
} from 'lucide-react';

interface AssessmentItem {
  testId: number;
  testName: string;
  testCode?: string;
  subjectName?: string;
  createdBy?: string;
  totalStudents: number;
  studentsAttended: number;
  studentsNotAttended: number;
  completionStatus?: string;
  passRate?: number;
  averageScore?: number;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
}

function AssessmentOverviewContent() {
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [activeModalTest, setActiveModalTest] = useState<AssessmentItem | null>(null);

  const fetchAssessments = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await apiCall('/api/super-admin/overview/assessments', { skipLocalCache: isRefresh });
      const list = Array.isArray(data) ? data : [];
      setAssessments(list);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  // Distinct subjects for filter
  const subjectsList = useMemo(() => {
    const set = new Set<string>();
    assessments.forEach((a) => {
      if (a.subjectName) set.add(a.subjectName);
    });
    return ['ALL', ...Array.from(set)];
  }, [assessments]);

  // Filtered assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const matchSubject =
        selectedSubject === 'ALL' ||
        (a.subjectName && a.subjectName.toLowerCase() === selectedSubject.toLowerCase());

      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        a.testName.toLowerCase().includes(q) ||
        (a.testCode && a.testCode.toLowerCase().includes(q)) ||
        (a.subjectName && a.subjectName.toLowerCase().includes(q)) ||
        (a.createdBy && a.createdBy.toLowerCase().includes(q));

      return matchSubject && matchSearch;
    });
  }, [assessments, selectedSubject, search]);

  // Aggregate stats
  const totals = useMemo(() => {
    const subjects = new Set(assessments.map((a) => a.subjectName).filter(Boolean));
    return {
      totalTests: assessments.length,
      activeSubjects: subjects.size,
      totalAttended: assessments.reduce((acc, a) => acc + (a.studentsAttended || 0), 0),
      totalNotAttended: assessments.reduce((acc, a) => acc + (a.studentsNotAttended || 0), 0),
    };
  }, [assessments]);

  const getStatusBadge = (status?: string) => {
    const normalized = (status || 'UPCOMING').toUpperCase();
    if (normalized === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3 h-3" />
          COMPLETED
        </span>
      );
    }
    if (normalized === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3 animate-spin" />
          IN PROGRESS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <Calendar className="w-3 h-3" />
        UPCOMING
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Centralized Assessment Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Assessment Overview
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Monitor all created assessments, student attendance status, and subject performance.
          </p>
        </div>
        <button
          onClick={() => fetchAssessments(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12141c] border border-white/5 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Tests</span>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileCode className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white tracking-tight">{totals.totalTests}</div>
            <p className="text-[11px] text-gray-500 mt-1">Active assessments in department</p>
          </div>
        </div>

        <div className="bg-[#12141c] border border-white/5 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active Subjects</span>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-cyan-400 tracking-tight">{totals.activeSubjects}</div>
            <p className="text-[11px] text-gray-500 mt-1">Curriculum test tracks</p>
          </div>
        </div>

        <div className="bg-[#12141c] border border-white/5 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Students Attended</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-emerald-400 tracking-tight">{totals.totalAttended}</div>
            <p className="text-[11px] text-gray-500 mt-1">Total student test completions</p>
          </div>
        </div>

        <div className="bg-[#12141c] border border-white/5 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Not Attended</span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-rose-400 tracking-tight">{totals.totalNotAttended}</div>
            <p className="text-[11px] text-gray-500 mt-1">Pending student submissions</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#12141c] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Subject:
          </span>
          {subjectsList.map((sub) => {
            const isSelected = selectedSubject.toLowerCase() === sub.toLowerCase();
            return (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {sub === 'ALL' ? 'All Subjects' : sub}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search test name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Assessments Table */}
      {loading ? (
        <div className="p-16 text-center text-gray-400 space-y-3 bg-[#12141c] border border-white/5 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
          <p className="text-sm">Loading assessment records...</p>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="p-16 text-center text-gray-500 bg-[#12141c] border border-white/5 rounded-2xl">
          <FileCode className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
          <p className="text-base font-semibold text-gray-400">No assessments found</p>
          <p className="text-xs text-gray-500 mt-1">
            {selectedSubject !== 'ALL'
              ? `No tests match the subject "${selectedSubject}".`
              : 'Try clearing your search filters or create a new test in the Admin panel.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#12141c] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Test Name</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Created By</th>
                  <th className="py-3.5 px-4 text-center">Total Students</th>
                  <th className="py-3.5 px-4 text-center">Attended</th>
                  <th className="py-3.5 px-4 text-center">Not Attended</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {filteredAssessments.map((test) => (
                  <tr key={test.testId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{test.testName}</span>
                        {test.testCode && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-400">
                            {test.testCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {test.subjectName || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      <div className="flex items-center gap-1.5 text-xs">
                        <UserCheck className="w-3.5 h-3.5 text-gray-500" />
                        <span>{test.createdBy || 'Staff'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-gray-300">
                      {test.totalStudents}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {test.studentsAttended}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {test.studentsNotAttended}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(test.completionStatus)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setActiveModalTest(test)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-white/[0.01] border-t border-white/5 flex items-center justify-between text-xs text-gray-500 px-4">
            <span>Showing {filteredAssessments.length} assessment(s)</span>
            <span>Total assigned student slots: {totals.totalAttended + totals.totalNotAttended}</span>
          </div>
        </div>
      )}

      {/* Assessment Details Modal */}
      {activeModalTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {activeModalTest.testCode || `TEST-${activeModalTest.testId}`}
                  </span>
                  <span className="text-xs text-indigo-400 font-semibold">
                    {activeModalTest.subjectName}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{activeModalTest.testName}</h3>
              </div>
              <button
                onClick={() => setActiveModalTest(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 text-xs">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 uppercase font-semibold text-[10px] block">Created By</span>
                <span className="text-white font-medium mt-0.5 block">{activeModalTest.createdBy || 'Staff'}</span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 uppercase font-semibold text-[10px] block">Status</span>
                <div className="mt-0.5">{getStatusBadge(activeModalTest.completionStatus)}</div>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 uppercase font-semibold text-[10px] block">Students Attended</span>
                <span className="text-emerald-400 font-bold text-sm mt-0.5 block">
                  {activeModalTest.studentsAttended} / {activeModalTest.totalStudents}
                </span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 uppercase font-semibold text-[10px] block">Not Attended</span>
                <span className="text-rose-400 font-bold text-sm mt-0.5 block">
                  {activeModalTest.studentsNotAttended}
                </span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 uppercase font-semibold text-[10px] block">Average Score</span>
                <span className="text-yellow-400 font-bold text-sm mt-0.5 block">
                  {activeModalTest.averageScore != null ? `${activeModalTest.averageScore}%` : 'N/A'}
                </span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 uppercase font-semibold text-[10px] block">Duration</span>
                <span className="text-white font-medium mt-0.5 block">
                  {activeModalTest.durationMinutes ? `${activeModalTest.durationMinutes} mins` : '120 mins'}
                </span>
              </div>
            </div>

            {activeModalTest.startTime && (
              <div className="text-[11px] text-gray-500 space-y-1 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                <div className="flex justify-between">
                  <span>Start Time:</span>
                  <span className="text-gray-300">{formatISTDateTime(activeModalTest.startTime)}</span>
                </div>
                {activeModalTest.endTime && (
                  <div className="flex justify-between">
                    <span>End Time:</span>
                    <span className="text-gray-300">{formatISTDateTime(activeModalTest.endTime)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModalTest(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssessmentOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 text-center text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
          <p className="text-sm mt-3">Loading Assessment Overview...</p>
        </div>
      }
    >
      <AssessmentOverviewContent />
    </Suspense>
  );
}
