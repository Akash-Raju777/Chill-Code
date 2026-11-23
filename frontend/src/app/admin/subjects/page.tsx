'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import { apiCall, API_BASE_URL } from '../../../utils/api';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Tag, 
  Loader2, 
  Download, 
  RefreshCw, 
  ArrowLeft, 
  Trophy, 
  Users, 
  AlertCircle, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  BarChart3, 
  CheckCircle2, 
  Award,
  Filter
} from 'lucide-react';
import BrandedLoader from '../../../components/BrandedLoader';
import { useAuthStore } from '../../../store/authStore';

interface Subject {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: string;
  assignedStaffId?: number;
  assignedStaffName?: string;
}

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [staffList, setStaffList] = useState<{ id: number; name: string; staffId: string }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('BookOpen');
  const [error, setError] = useState('');

  // Subject Tracker Overview Report State
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjectStats, setSubjectStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTestFilter, setSelectedTestFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(25);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStatsForSubject = async (sub: Subject, skipCache = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatsLoading(true);
    setStatsError(null);

    try {
      const data = await apiCall(`/api/admin/subjects/${sub.id}/stats`, {
        signal: controller.signal,
        skipLocalCache: skipCache,
      });
      setSubjectStats(data);
      setSearchQuery('');
      setSelectedTestFilter('All');
      setCurrentPage(1);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Failed to load subject report:', e);
        setStatsError(e.message || 'Failed to load subject report');
      }
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSelectSubject = (sub: Subject) => {
    setSelectedSubject(sub);
    setCurrentPage(1);
    fetchStatsForSubject(sub, false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCloseReport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSelectedSubject(null);
    setSubjectStats(null);
    setStatsError(null);
    setSearchQuery('');
    setSelectedTestFilter('All');
    setCurrentPage(1);
  };

  const handleDownloadReport = async (subjectId: number, subjectName: string) => {
    try {
      const token = useAuthStore.getState().token || (typeof window !== 'undefined' ? localStorage.getItem('chill_token') || sessionStorage.getItem('chill_token') : null);
      
      const response = await fetch(`${API_BASE_URL}/api/admin/subjects/${subjectId}/export`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${subjectName.replace(/\s+/g, '-')}-report.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      console.warn('Backend Excel export failed, falling back to client-side report generation:', err);
    }

    // Fallback: Client-side Excel CSV generation
    try {
      let marksData = subjectStats?.studentMarks || [];
      if (!marksData.length) {
        const stats = await apiCall(`/api/admin/subjects/${subjectId}/stats`);
        marksData = stats?.studentMarks || [];
      }
      
      let csvContent = `Question Name,Roll No,Student Name,Test Name,Attempts,Score,Max Marks,Malpractice,Result\n`;
      if (marksData.length > 0) {
        marksData.forEach((item: any) => {
          const qName = `"${(item.questionName || '').replace(/"/g, '""')}"`;
          const roll = `"${(item.registerNumber || '').replace(/"/g, '""')}"`;
          const sName = `"${(item.name || '').replace(/"/g, '""')}"`;
          const tName = `"${(item.testName || '').replace(/"/g, '""')}"`;
          const att = item.attempts ?? 0;
          const score = item.score ?? 0;
          const max = item.maxMarks ?? 100;
          const mal = item.malpractice || 'NO';
          const res = `"${(item.status || 'N/A').replace(/"/g, '""')}"`;
          csvContent += `${qName},${roll},${sName},${tName},${att},${score},${max},${mal},${res}\n`;
        });
      } else {
        csvContent += `No Registry Data Available,,,,,,,,\n`;
      }

      const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${subjectName.replace(/\s+/g, '-')}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Failed to download report');
    }
  };

  const fetchSubjects = async (isInitial = false) => {
    if (isInitial || subjects.length === 0) {
      setLoading(true);
    }
    try {
      const data = await apiCall('/api/admin/subjects');
      setSubjects(data);

      const staffData = await apiCall('/api/admin/staff').catch(() => []);
      if (staffData && Array.isArray(staffData)) {
        setStaffList(staffData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects(true);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          description, 
          color, 
          icon, 
          status: 'ACTIVE',
          assignedStaffId: selectedStaffId || undefined 
        }),
      });
      setName('');
      setDescription('');
      setSelectedStaffId(null);
      setShowAddForm(false);
      fetchSubjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create subject');
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmDeleteSubject({ open: true, id });
  };

  const executeDeleteSubject = async () => {
    if (!confirmDeleteSubject.id) return;
    const id = confirmDeleteSubject.id;
    setConfirmDeleteSubject({ open: false, id: null });
    const previousSubjects = subjects;
    setSubjects(subjects.filter(sub => sub.id !== id));
    try {
      await apiCall(`/api/admin/subjects/${id}`, { method: 'DELETE' });
    } catch (err: any) {
      setSubjects(previousSubjects);
      setError(err.message || 'Failed to delete subject');
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

  /* ──────────────────────────────────────────────────────────────────────────
     1. FULL-SCREEN DEDICATED REPORT VIEW
     ────────────────────────────────────────────────────────────────────────── */
  if (selectedSubject) {
    return (
      <div className="space-y-6 pb-16 animate-in fade-in duration-200">
        {/* Navigation & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseReport}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Back to Subjects</span>
            </button>
            <div className="hidden sm:block h-5 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Subjects</span>
              <span>/</span>
              <span className="font-semibold text-white">{selectedSubject.name}</span>
              <span>/</span>
              <span className="text-cyan-400 font-semibold">Tracker Overview</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchStatsForSubject(selectedSubject, true)}
              disabled={statsLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              title="Reload Latest Report Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => handleDownloadReport(selectedSubject.id, selectedSubject.name)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:shadow-emerald-900/30"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel</span>
            </button>

            <button
              onClick={handleCloseReport}
              className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
              title="Close Report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subject Header Banner */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/10">
          <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: selectedSubject.color }} />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-3">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span 
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-white/10"
                  style={{ backgroundColor: `${selectedSubject.color}20`, color: selectedSubject.color }}
                >
                  Subject Tracker Overview
                </span>
                <span className="text-[10px] font-semibold text-gray-400 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 uppercase">
                  {selectedSubject.status || 'ACTIVE'}
                </span>
                {selectedSubject.assignedStaffName && (
                  <span className="text-[10px] font-semibold text-indigo-300 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    Staff: {selectedSubject.assignedStaffName}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{selectedSubject.name}</h1>
              <p className="text-sm text-gray-400 mt-1 max-w-3xl leading-relaxed">{selectedSubject.description}</p>
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
              onClick={() => fetchStatsForSubject(selectedSubject, true)}
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

  /* ──────────────────────────────────────────────────────────────────────────
     2. SUBJECTS LIST & MANAGEMENT VIEW (Standard View)
     ────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subject Management</h1>
          <p className="text-sm text-gray-500">Add or edit educational programming subjects</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-btn text-sm cursor-pointer shadow-lg shadow-indigo-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>Create Subject</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Add Subject Modal overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl relative border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">Create New Subject</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Java Programming"
                  className="w-full glass-input p-3 rounded-xl text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Description</label>
                <textarea
                  required
                  placeholder="Subject details..."
                  className="w-full glass-input p-3 rounded-xl text-sm h-24"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Color (Hex)</label>
                  <input
                    type="color"
                    className="w-full h-11 bg-transparent border-0 rounded-lg cursor-pointer"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Icon Identifier</label>
                  <select
                    className="w-full glass-input p-3 rounded-xl text-sm"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                  >
                    <option value="BookOpen">BookOpen</option>
                    <option value="Code2">Code2</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Cpu">Cpu</option>
                    <option value="Database">Database</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Assigned Staff Lead
                </label>
                <select
                  className="w-full glass-input p-3 rounded-xl text-sm"
                  value={selectedStaffId || ''}
                  onChange={(e) => setSelectedStaffId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Default (Current Admin)</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/5 text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl gradient-btn text-sm cursor-pointer">
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((sub) => (
            <div 
              key={sub.id} 
              onClick={() => handleSelectSubject(sub)}
              className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative group overflow-hidden cursor-pointer hover:border-white/20 hover:shadow-xl hover:shadow-cyan-950/20 transition-all border border-white/5"
            >
              {/* Color Stripe decoration */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: sub.color }} />
              <div>
                <div className="flex justify-between items-start mb-4 pl-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5" style={{ color: sub.color }}>
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-white text-lg tracking-tight group-hover:text-cyan-300 transition-colors">
                      {sub.name}
                    </h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(sub.id);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Delete Subject"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-400 pl-2 leading-relaxed mb-6 line-clamp-3">{sub.description}</p>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4 pl-2 text-xs text-gray-500">
                <span className="flex items-center gap-1.5 capitalize font-medium">
                  <Tag className="w-3.5 h-3.5" style={{ color: sub.color }} />
                  {(sub.status || 'ACTIVE').toLowerCase()}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectSubject(sub);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 font-semibold text-xs border border-indigo-500/20 transition-all cursor-pointer shadow-sm"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View Report</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDeleteSubject.open}
        title="Delete Subject"
        message="Are you sure you want to delete this subject? All related questions will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={executeDeleteSubject}
        onCancel={() => setConfirmDeleteSubject({ open: false, id: null })}
      />
    </div>
  );
}
