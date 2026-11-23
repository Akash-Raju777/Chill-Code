'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiCall, API_BASE_URL } from '@/utils/api';
import { useAuthStore } from '@/store/authStore';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  X,
  AlertCircle,
  BookOpen,
  Trophy,
  Users,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import BrandedLoader from '@/components/BrandedLoader';

export interface SubjectItemForReport {
  id: number;
  name: string;
  description?: string;
  color?: string;
  status?: string;
  assignedStaffName?: string;
}

interface SubjectTrackerReportProps {
  subject: SubjectItemForReport;
  onClose: () => void;
  backButtonLabel?: string;
  breadcrumbRootLabel?: string;
}

export default function SubjectTrackerReport({
  subject,
  onClose,
  backButtonLabel = 'Back to Overview',
  breadcrumbRootLabel = 'Assessments'
}: SubjectTrackerReportProps) {
  const [subjectStats, setSubjectStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Table Controls
  const [selectedTestFilter, setSelectedTestFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number | 'All'>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchStats = async (isRefresh = false) => {
    if (!subject?.id) return;
    try {
      setStatsLoading(true);
      setStatsError(null);
      const data = await apiCall(`/api/admin/subjects/${subject.id}/stats`);
      setSubjectStats(data);
    } catch (err: any) {
      setStatsError(err.message || 'Failed to load subject statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    setSelectedTestFilter('All');
    setSearchQuery('');
    setCurrentPage(1);
  }, [subject.id]);

  const handleDownloadReport = async () => {
    try {
      const token = useAuthStore.getState().token || (typeof window !== 'undefined' ? sessionStorage.getItem('chill_token') : null);
      const res = await fetch(`${API_BASE_URL}/api/admin/subjects/${subject.id}/export`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!res.ok) throw new Error('Failed to generate export file');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${subject.name.replace(/\s+/g, '_')}_Report.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Error downloading report');
    }
  };

  // Filtered Student Registry for Selected Subject Report
  const filteredMarks = useMemo(() => {
    if (!subjectStats?.studentMarks) return [];
    return subjectStats.studentMarks.filter((sm: any) => {
      if (selectedTestFilter !== 'All') {
        if (sm.testId?.toString() !== selectedTestFilter && sm.questionId?.toString() !== selectedTestFilter) {
          return false;
        }
      }
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      return (
        (sm.name && sm.name.toLowerCase().includes(query)) ||
        (sm.registerNumber && sm.registerNumber.toLowerCase().includes(query)) ||
        (sm.questionName && sm.questionName.toLowerCase().includes(query)) ||
        (sm.testName && sm.testName.toLowerCase().includes(query))
      );
    });
  }, [subjectStats, selectedTestFilter, searchQuery]);

  // Paginated Student Registry
  const paginatedMarks = useMemo(() => {
    if (pageSize === 'All') return filteredMarks;
    const start = (currentPage - 1) * pageSize;
    return filteredMarks.slice(start, start + pageSize);
  }, [filteredMarks, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'All' || filteredMarks.length === 0) return 1;
    return Math.ceil(filteredMarks.length / pageSize);
  }, [filteredMarks, pageSize]);

  const subjectColor = subject.color || '#06b6d4';

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Navigation & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>{backButtonLabel}</span>
          </button>
          <div className="hidden sm:block h-5 w-px bg-white/10" />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{breadcrumbRootLabel}</span>
            <span>/</span>
            <span className="font-semibold text-white">{subject.name}</span>
            <span>/</span>
            <span className="text-cyan-400 font-semibold">Tracker Overview</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchStats(true)}
            disabled={statsLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            title="Reload Latest Report Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:shadow-emerald-900/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            title="Close Report"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subject Header Banner */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/10">
        <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: subjectColor }} />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-3">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span 
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-white/10"
                style={{ backgroundColor: `${subjectColor}20`, color: subjectColor }}
              >
                Subject Tracker Overview
              </span>
              <span className="text-[10px] font-semibold text-gray-400 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 uppercase">
                {subject.status || 'ACTIVE'}
              </span>
              {subject.assignedStaffName && (
                <span className="text-[10px] font-semibold text-indigo-300 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  Staff: {subject.assignedStaffName}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{subject.name}</h1>
            {subject.description && (
              <p className="text-sm text-gray-400 mt-1 max-w-3xl leading-relaxed">{subject.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {statsLoading && (
        <div className="py-16">
          <BrandedLoader
            message="Loading Subject Report..."
            submessage="Compiling student scores, attendance data, and test performance registry"
          />
        </div>
      )}

      {/* Error State */}
      {statsError && !statsLoading && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to Load Subject Report</span>
          </div>
          <p className="text-xs text-gray-400 max-w-md mx-auto">{statsError}</p>
          <button
            onClick={() => fetchStats(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-red-900/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading Report</span>
          </button>
        </div>
      )}

      {/* Complete Report Metrics & Registry */}
      {!statsLoading && subjectStats && (
        <div className="space-y-6">
          {/* 4 Summary Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Topics / Questions */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Topics / Questions</span>
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-black text-white tracking-tight">{subjectStats.questionsCount}</div>
                <p className="text-[11px] text-gray-500 mt-1 font-medium">Configured questions in track</p>
              </div>
            </div>

            {/* Card 2: Top Rank Holder */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Top Rank Holder</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Trophy className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xl font-black text-indigo-300 truncate" title={subjectStats.rankHolder}>
                  {subjectStats.rankHolder || 'N/A'}
                </div>
                <p className="text-[11px] text-amber-400/90 mt-1 font-medium">
                  {subjectStats.rankScore > 0 ? `Top Score: ${subjectStats.rankScore} pts` : 'No submissions recorded'}
                </p>
              </div>
            </div>

            {/* Card 3: Students Attended */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Attended Students</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                  {subjectStats.attendedCount} <span className="text-xs font-normal text-gray-400">students</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 font-medium">
                  {subjectStats.passRate}% pass rate • {subjectStats.failRate}% fail
                </p>
              </div>
            </div>

            {/* Card 4: Students Not Attended */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Not Attended</span>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-black text-rose-400 tracking-tight">
                  {subjectStats.notAttendedCount} <span className="text-xs font-normal text-gray-400">students</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 font-medium">Pending test attempts</p>
              </div>
            </div>
          </div>

          {/* Student Performance Registry Card */}
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* Table Toolbar */}
            <div className="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-white tracking-wide">Student Performance Registry</h2>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {filteredMarks.length} records
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Test Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 hidden sm:inline">Filter Test:</span>
                  <select
                    value={selectedTestFilter}
                    onChange={(e) => {
                      setSelectedTestFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 appearance-none min-w-[140px]"
                  >
                    <option value="All">All Tests</option>
                    {(subjectStats.tests || []).map((t: any) => (
                      <option key={t.id} value={t.id.toString()}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Search Input */}
                <div className="relative min-w-[220px] sm:min-w-[280px]">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student, roll no, or question..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-[#0b0c10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Rows Per Page */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 hidden sm:inline">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const val = e.target.value === 'All' ? 'All' : Number(e.target.value);
                      setPageSize(val as any);
                      setCurrentPage(1);
                    }}
                    className="bg-[#0b0c10] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value="All">All</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-white/[0.03]">
                    <th className="py-3.5 px-4">Question Name</th>
                    <th className="py-3.5 px-4">Roll No</th>
                    <th className="py-3.5 px-4">Student Name</th>
                    <th className="py-3.5 px-4 text-center">Attempts</th>
                    <th className="py-3.5 px-4 text-center">Marks</th>
                    <th className="py-3.5 px-4">Badges & Awards</th>
                    <th className="py-3.5 px-4 text-center">Malpractice</th>
                    <th className="py-3.5 px-4">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {paginatedMarks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500 text-xs">
                        {searchQuery || selectedTestFilter !== 'All' 
                          ? 'No student performance records found matching your filters.'
                          : 'No student performance records recorded for this subject.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedMarks.map((sm: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div>{sm.questionName || 'N/A'}</div>
                          {sm.testName && (
                            <div className="text-[10px] text-gray-500 font-normal">{sm.testName}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                          {sm.registerNumber || '-'}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-gray-200">
                          {sm.name}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 font-semibold text-gray-300">
                            {sm.attempts ?? 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono text-amber-400 font-bold text-xs">
                            {sm.status === 'N/A' ? '-' : `${sm.score ?? 0} / ${sm.maxMarks ?? 100}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {sm.badges && sm.badges.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {sm.badges.map((b: any, bIdx: number) => (
                                <div
                                  key={bIdx}
                                  title={b.description || b.name}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px]"
                                >
                                  <span>{b.icon || '🏅'}</span>
                                  <span className="font-medium text-gray-300 truncate max-w-[120px]">{b.name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-600 font-semibold ml-2">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {sm.malpractice === 'YES' ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                              YES
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500 font-medium">NO</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sm.status === 'Pass'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : sm.status === 'Fail'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                            }`}
                          >
                            {sm.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && pageSize !== 'All' && (
              <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.01]">
                <div className="text-xs text-gray-500">
                  Showing <span className="font-semibold text-gray-300">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-gray-300">
                    {Math.min(currentPage * pageSize, filteredMarks.length)}
                  </span>{' '}
                  of <span className="font-semibold text-gray-300">{filteredMarks.length}</span> students
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    if (
                      p === 1 || 
                      p === totalPages || 
                      (p >= currentPage - 1 && p <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[32px] h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            currentPage === p
                              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                              : 'border border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    }
                    if (p === currentPage - 2 || p === currentPage + 2) {
                      return <span key={p} className="text-gray-600 px-1 text-xs">...</span>;
                    }
                    return null;
                  })}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
