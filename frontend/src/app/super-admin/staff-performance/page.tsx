'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, formatISTDateTime } from '@/utils/api';
import { toast } from '@/store/toastStore';
import {
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  Users,
  Search,
  RefreshCw,
  ArrowLeft,
  BookOpen,
  Filter,
  UserCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface SubjectStat {
  subjectId: number;
  subjectName: string;
  todayTests: number;
  weeklyTests: number;
  monthlyTests: number;
  totalTests: number;
}

interface StaffTestDetail {
  id: number;
  name: string;
  testCode: string;
  subjectId: number | null;
  subjectName: string;
  createdBy: string;
  createdAt: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  maxMarks: number;
  studentsAssigned: number;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
}

interface StaffPerformanceItem {
  id: number;
  name: string;
  staffId: string;
  email: string;
  department: string;
  status: string;
  todayTests: number;
  weekTests: number;
  monthTests: number;
  totalTests: number;
  subjectsHandled: string[];
  subjectStats: SubjectStat[];
  tests: StaffTestDetail[];
  lastActive: string | null;
}

interface GlobalSummary {
  todayTests: number;
  todayDate: string;
  weekTests: number;
  monthTests: number;
  totalTests: number;
}

interface ApiResponse {
  summary: GlobalSummary;
  staffPerformance: StaffPerformanceItem[];
}

export default function StaffPerformancePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Individual staff detail view state
  const [selectedStaff, setSelectedStaff] = useState<StaffPerformanceItem | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [testSearch, setTestSearch] = useState('');

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall('/api/super-admin/staff-performance', { skipLocalCache: isRefresh });
      setData(res as ApiResponse);

      // Keep selectedStaff up-to-date if already viewing one
      if (selectedStaff && (res as ApiResponse)?.staffPerformance) {
        const updated = (res as ApiResponse).staffPerformance.find(s => s.id === selectedStaff.id);
        if (updated) setSelectedStaff(updated);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load staff performance metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredStaff = data?.staffPerformance?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.staffId.toLowerCase().includes(search.toLowerCase()) ||
    s.department.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Filter tests inside individual staff detail view
  const getFilteredStaffTests = () => {
    if (!selectedStaff) return [];
    return selectedStaff.tests.filter(t => {
      // Subject filter
      if (subjectFilter !== 'ALL' && t.subjectName !== subjectFilter) {
        return false;
      }
      // Search filter
      if (testSearch) {
        const query = testSearch.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesCode = t.testCode.toLowerCase().includes(query);
        const matchesSubject = t.subjectName.toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesSubject) return false;
      }
      // Date filter (strictly uses creation timestamp)
      if (dateFilter !== 'ALL') {
        const rawDate = t.createdAt || t.startTime;
        if (!rawDate) return false;
        const testDate = new Date(rawDate);
        const now = new Date();
        if (dateFilter === 'TODAY') {
          const isSameDay = testDate.getDate() === now.getDate() &&
                            testDate.getMonth() === now.getMonth() &&
                            testDate.getFullYear() === now.getFullYear();
          if (!isSameDay) return false;
        } else if (dateFilter === 'WEEK') {
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
          startOfWeek.setDate(diff);
          startOfWeek.setHours(0, 0, 0, 0);
          if (testDate < startOfWeek) return false;
        } else if (dateFilter === 'MONTH') {
          const isSameMonth = testDate.getMonth() === now.getMonth() &&
                              testDate.getFullYear() === now.getFullYear();
          if (!isSameMonth) return false;
        }
      }
      return true;
    });
  };

  const filteredStaffTests = getFilteredStaffTests();

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Staff Performance Oversight
            </span>
            {selectedStaff && (
              <>
                <span className="text-gray-500">/</span>
                <span className="text-xs font-semibold text-white">{selectedStaff.name}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            {selectedStaff ? `${selectedStaff.name} - Test Activity Details` : 'Staff Performance Monitoring'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {selectedStaff
              ? `Comprehensive subject-wise test creation and scheduling records for ${selectedStaff.name} (${selectedStaff.department}).`
              : 'Track exactly how many tests each staff member creates or schedules, subject-wise.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedStaff && (
            <button
              onClick={() => {
                setSelectedStaff(null);
                setSubjectFilter('ALL');
                setDateFilter('ALL');
                setTestSearch('');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-gray-300 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Back to All Staff
            </button>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </button>
        </div>
      </div>

      {/* VIEW 1: MAIN STAFF PERFORMANCE LIST (when no individual staff is selected) */}
      {!selectedStaff && (
        <>
          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 - Today's Tests */}
            <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today&apos;s Tests</p>
                  <p className="text-3xl font-extrabold text-white mt-1.5">
                    {data?.summary?.todayTests ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-gray-400 font-medium">
                {data?.summary?.todayDate || 'Current Day'}
              </div>
            </div>

            {/* Card 2 - This Week's Tests */}
            <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">This Week&apos;s Tests</p>
                  <p className="text-3xl font-extrabold text-white mt-1.5">
                    {data?.summary?.weekTests ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-gray-400 font-medium">
                Current calendar week (Mon - Sun)
              </div>
            </div>

            {/* Card 3 - This Month's Tests */}
            <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">This Month&apos;s Tests</p>
                  <p className="text-3xl font-extrabold text-white mt-1.5">
                    {data?.summary?.monthTests ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-gray-400 font-medium">
                Current calendar month
              </div>
            </div>

            {/* Card 4 - Total Tests */}
            <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Tests</p>
                  <p className="text-3xl font-extrabold text-white mt-1.5">
                    {data?.summary?.totalTests ?? 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-gray-400 font-medium">
                Total tests assigned by all staff
              </div>
            </div>
          </div>

          {/* Staff-wise Detailed Performance Table */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Staff-Wise Test Performance
                </h3>
                <p className="text-xs text-gray-400">
                  Detailed test creation statistics for each individual staff member
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff by name, ID or department..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-400 mb-3" />
                <p className="text-sm font-medium">Loading staff test records...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-base font-semibold text-gray-400">No staff members found</p>
                <p className="text-xs text-gray-500 mt-1">Try adjusting your search criteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 px-4">Staff Name</th>
                      <th className="py-3.5 px-4">Staff ID</th>
                      <th className="py-3.5 px-4 text-center">Total Tests</th>
                      <th className="py-3.5 px-4 text-center">Today&apos;s Tests</th>
                      <th className="py-3.5 px-4 text-center">This Week</th>
                      <th className="py-3.5 px-4 text-center">This Month</th>
                      <th className="py-3.5 px-4">Subjects Handled</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {filteredStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Staff Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{staff.name}</div>
                          <div className="text-[11px] text-gray-500 truncate max-w-[180px]">{staff.email}</div>
                        </td>

                        {/* Staff ID */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            {staff.staffId}
                          </span>
                        </td>

                        {/* Total Tests Created */}
                        <td className="py-3.5 px-4 text-center font-bold text-base text-emerald-400">
                          {staff.totalTests}
                        </td>

                        {/* Today's Tests */}
                        <td className="py-3.5 px-4 text-center font-bold text-cyan-400">
                          {staff.todayTests}
                        </td>

                        {/* This Week's Tests */}
                        <td className="py-3.5 px-4 text-center font-bold text-indigo-400">
                          {staff.weekTests}
                        </td>

                        {/* This Month's Tests */}
                        <td className="py-3.5 px-4 text-center font-bold text-purple-400">
                          {staff.monthTests}
                        </td>

                        {/* Subjects Handled */}
                        <td className="py-3.5 px-4">
                          {staff.subjectsHandled && staff.subjectsHandled.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {staff.subjectsHandled.map((subj, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/5 text-gray-300 border border-white/5"
                                >
                                  {subj}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs italic">None assigned</span>
                          )}
                        </td>

                        {/* View Details Button */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedStaff(staff);
                              setSubjectFilter('ALL');
                              setDateFilter('ALL');
                              setTestSearch('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                          >
                            <span>View Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: INDIVIDUAL STAFF DETAILS & SUBJECT-WISE TEST METRICS */}
      {selectedStaff && (
        <div className="space-y-8">
          {/* Staff Info Banner */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-extrabold shadow-md shrink-0 border border-white/10">
                  {selectedStaff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedStaff.name}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      selectedStaff.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                      {selectedStaff.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                    <span>Staff ID: <strong className="text-gray-300 font-mono">@{selectedStaff.staffId}</strong></span>
                    <span>•</span>
                    <span>Department: <strong className="text-gray-300">{selectedStaff.department}</strong></span>
                    <span>•</span>
                    <span>Email: <strong className="text-gray-300">{selectedStaff.email}</strong></span>
                  </div>
                </div>
              </div>

              {/* Quick counts */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-3 bg-white/5 rounded-xl text-center min-w-[75px]">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Today</p>
                  <p className="text-lg font-extrabold text-cyan-400 mt-0.5">{selectedStaff.todayTests}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl text-center min-w-[75px]">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Week</p>
                  <p className="text-lg font-extrabold text-indigo-400 mt-0.5">{selectedStaff.weekTests}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl text-center min-w-[75px]">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Month</p>
                  <p className="text-lg font-extrabold text-purple-400 mt-0.5">{selectedStaff.monthTests}</p>
                </div>
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center min-w-[85px]">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Total Tests</p>
                  <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{selectedStaff.totalTests}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Subject-wise Staff Test Details */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Subject-Wise Test Breakdown
              </h3>
              <p className="text-xs text-gray-400">
                Number of tests authored/assigned by {selectedStaff.name} grouped by curriculum subject
              </p>
            </div>

            {selectedStaff.subjectStats.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                No tests created or scheduled under any subject by this staff member yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Today&apos;s Tests</th>
                      <th className="py-3 px-4 text-center">Weekly Tests</th>
                      <th className="py-3 px-4 text-center">Monthly Tests</th>
                      <th className="py-3 px-4 text-center">Total Tests</th>
                      <th className="py-3 px-4 text-right">Filter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {selectedStaff.subjectStats.map((s) => {
                      const isSelected = subjectFilter === s.subjectName;
                      return (
                        <tr
                          key={s.subjectId}
                          onClick={() => setSubjectFilter(isSelected ? 'ALL' : s.subjectName)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-500/10' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            {s.subjectName}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-cyan-400">
                            {s.todayTests}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-indigo-400">
                            {s.weeklyTests}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-purple-400">
                            {s.monthlyTests}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">
                            {s.totalTests}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              {isSelected ? 'Active Filter' : 'Show Tests'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed Test List with Filters */}
          <div className="bg-[#12141c] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Detailed Test Registry
                  <span className="text-xs font-semibold px-2 py-0.5 bg-white/5 text-indigo-400 rounded-full border border-white/5">
                    {filteredStaffTests.length} Tests
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Individual tests created or scheduled with timetable and candidate allocation
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 md:w-48">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search tests..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white/5 border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                {/* Subject Filter Dropdown */}
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="bg-[#181a25] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Subjects</option>
                  {selectedStaff.subjectStats.map((s) => (
                    <option key={s.subjectId} value={s.subjectName}>
                      {s.subjectName}
                    </option>
                  ))}
                </select>

                {/* Date Filter Dropdown */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="bg-[#181a25] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Dates</option>
                  <option value="TODAY">Today Only</option>
                  <option value="WEEK">This Week</option>
                  <option value="MONTH">This Month</option>
                </select>

                {(subjectFilter !== 'ALL' || dateFilter !== 'ALL' || testSearch) && (
                  <button
                    onClick={() => {
                      setSubjectFilter('ALL');
                      setDateFilter('ALL');
                      setTestSearch('');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {filteredStaffTests.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-semibold text-gray-400">
                  {selectedStaff.tests.length === 0
                    ? 'No tests created by this staff member yet.'
                    : 'No tests match the selected filters'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedStaff.tests.length === 0
                    ? 'Actual tests created through the Admin panel will appear here.'
                    : 'Try resetting your search, subject or date filter'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4">Test Name</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Created By</th>
                      <th className="py-3 px-4">Created Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {filteredStaffTests.map((test) => (
                      <tr key={test.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Test Name & Code */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                              {test.testCode}
                            </span>
                            {test.name}
                          </div>
                        </td>

                        {/* Subject */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 text-xs">
                            {test.subjectName}
                          </span>
                        </td>

                        {/* Created By */}
                        <td className="py-3 px-4 text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{test.createdBy || 'N/A'}</span>
                          </div>
                        </td>

                        {/* Created Date and Time */}
                        <td className="py-3 px-4 text-gray-400 text-xs font-mono">
                          {test.createdAt ? formatISTDateTime(test.createdAt) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
