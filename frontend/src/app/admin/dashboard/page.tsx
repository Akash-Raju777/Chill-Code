'use client';

import React, { useEffect, useState, useRef } from 'react';
import { apiCall, formatISTDateTime } from '../../../utils/api';
import { toast } from '../../../store/toastStore';
import { 
  Users, 
  BookOpen, 
  Code2, 
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  CheckCheck,
  Sparkles,
  ClipboardList
} from 'lucide-react';

interface DashboardData {
  totalStudents: number;
  totalSubjects: number;
  totalTests: number;
  totalQuestions: number;
  todayActiveTests: number;
  pendingEvaluations: number;
  recentActivities: Array<{ time: string; user: string; details: string; type: string; registerNumber?: string }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reattemptRequests, setReattemptRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Search & Filter state for Reattempt Requests
  const [reattemptSearch, setReattemptSearch] = useState('');
  const [reattemptTestFilter, setReattemptTestFilter] = useState('ALL');

  // Search & Filter state for Security Warnings & Activities
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fetchingRef = useRef(false);
  const processedActionKeysRef = useRef<Set<string>>(new Set());
  const forgivenStudentKeysRef = useRef<Set<string>>(new Set());

  const fetchMetrics = async (isInitial = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [response, reattempts] = await Promise.all([
        apiCall(`/api/admin/dashboard?t=${Date.now()}`),
        apiCall(`/api/admin/tests/reattempt-requests?t=${Date.now()}`)
      ]);

      // Filter out activities of forgiven students
      if (response && response.recentActivities) {
        response.recentActivities = response.recentActivities.filter(
          (act: any) => !forgivenStudentKeysRef.current.has(act.registerNumber || act.user) && !forgivenStudentKeysRef.current.has(act.user)
        );
      }

      setData(response);

      const filteredReattempts = (reattempts || []).filter(
        (req: any) => !processedActionKeysRef.current.has(`${req.id}_${req.reattemptQuestionId}`)
      );
      setReattemptRequests(filteredReattempts);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  };

  const handleForgive = (studentKey: string, displayName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Forgive Student Warnings',
      message: `Are you sure you want to forgive ${displayName} and reset their warning logs permanently?`,
      onConfirm: async () => {
        // Track locally so background polling never brings it back
        forgivenStudentKeysRef.current.add(studentKey);
        forgivenStudentKeysRef.current.add(displayName);

        if (data) {
          setData({
            ...data,
            recentActivities: data.recentActivities.filter(
              act => (act.registerNumber || act.user) !== studentKey && act.user !== displayName
            )
          });
        }

        try {
          await apiCall(`/api/admin/student/forgive?registerNumber=${encodeURIComponent(studentKey)}`, {
            method: 'POST'
          });
          toast.success(`Successfully reset security warning logs for ${displayName}.`);
          fetchMetrics();
        } catch (e: any) {
          toast.error(e.message || 'Failed to forgive student.');
          fetchMetrics();
        }
      }
    });
  };

  const handleBook = (studentKey: string, displayName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Book Student for Malpractice',
      message: `Are you sure you want to officially book ${displayName} for malpractice? This will permanently mark their status as YES for malpractice in the registry.`,
      onConfirm: async () => {
        // Track locally so background polling never brings it back
        forgivenStudentKeysRef.current.add(studentKey);
        forgivenStudentKeysRef.current.add(displayName);

        if (data) {
          setData({
            ...data,
            recentActivities: data.recentActivities.filter(
              act => (act.registerNumber || act.user) !== studentKey && act.user !== displayName
            )
          });
        }

        try {
          await apiCall(`/api/admin/student/book?registerNumber=${encodeURIComponent(studentKey)}`, {
            method: 'POST'
          });
          toast.success(`Successfully booked ${displayName} for malpractice.`);
          fetchMetrics();
        } catch (e: any) {
          toast.error(e.message || 'Failed to book student.');
          fetchMetrics();
        }
      }
    });
  };

  const handleForgiveAll = () => {
    if (!data || data.recentActivities.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Forgive All Active Warnings',
      message: 'Are you sure you want to forgive all listed security warnings for all students at once?',
      onConfirm: async () => {
        const studentKeys = Array.from(
          new Set(
            data.recentActivities
              .filter(act => act.user !== 'System Admin' && act.type !== 'info')
              .map(act => act.registerNumber || act.user)
              .filter(Boolean)
          )
        );

        studentKeys.forEach(key => forgivenStudentKeysRef.current.add(key));
        
        // Optimistic UI update instantly
        setData(prev => prev ? { 
          ...prev, 
          recentActivities: prev.recentActivities.filter(act => act.user === 'System Admin' || act.type === 'info') 
        } : prev);

        // Run all API calls in parallel in the background
        await Promise.all(studentKeys.map(key => 
          apiCall(`/api/admin/student/forgive?registerNumber=${encodeURIComponent(key)}`, {
            method: 'POST'
          }).catch(() => {})
        ));

        toast.success('Forgave all active student warning logs.');
        fetchMetrics();
      }
    });
  };

  const handleApproveReattempt = (studentTestId: number, testName: string, questionId?: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Approve Reattempt Request',
      message: `Are you sure you want to approve this reattempt request for "${testName}"?`,
      onConfirm: async () => {
        if (questionId) processedActionKeysRef.current.add(`${studentTestId}_${questionId}`);
        setReattemptRequests(prev => prev.filter(req => !(req.id === studentTestId && (!questionId || req.reattemptQuestionId === questionId))));
        try {
          const url = `/api/admin/tests/reattempt-requests/${studentTestId}/approve` + (questionId ? `?questionId=${questionId}` : '');
          await apiCall(url, {
            method: 'POST',
          });
          toast.success('Reattempt request approved successfully.');
          fetchMetrics();
        } catch (e: any) {
          toast.error(e.message || 'Failed to approve request.');
          fetchMetrics();
        }
      }
    });
  };

  const handleApproveAllFilteredReattempts = () => {
    if (filteredReattemptRequests.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Approve All Filtered Reattempts',
      message: `Are you sure you want to approve all ${filteredReattemptRequests.length} reattempt requests currently shown?`,
      onConfirm: async () => {
        // Optimistic UI update instantly
        const itemsToRemove = new Set(filteredReattemptRequests);
        setReattemptRequests(prev => prev.filter(req => !itemsToRemove.has(req)));

        // Run all API calls in parallel
        await Promise.all(filteredReattemptRequests.map(req => {
          if (req.reattemptQuestionId) processedActionKeysRef.current.add(`${req.id}_${req.reattemptQuestionId}`);
          const url = `/api/admin/tests/reattempt-requests/${req.id}/approve` + (req.reattemptQuestionId ? `?questionId=${req.reattemptQuestionId}` : '');
          return apiCall(url, { method: 'POST' }).catch(() => {});
        }));
        
        toast.success(`Approved ${filteredReattemptRequests.length} reattempt requests.`);
        fetchMetrics();
      }
    });
  };

  const handleRejectReattempt = (studentTestId: number, testName: string, questionId?: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reject Reattempt Request',
      message: `Are you sure you want to reject this reattempt request for "${testName}"?`,
      onConfirm: async () => {
        if (questionId) processedActionKeysRef.current.add(`${studentTestId}_${questionId}`);
        setReattemptRequests(prev => prev.filter(req => !(req.id === studentTestId && (!questionId || req.reattemptQuestionId === questionId))));
        try {
          const url = `/api/admin/tests/reattempt-requests/${studentTestId}/reject` + (questionId ? `?questionId=${questionId}` : '');
          await apiCall(url, {
            method: 'POST',
          });
          toast.success('Reattempt request rejected.');
          fetchMetrics();
        } catch (e: any) {
          toast.error(e.message || 'Failed to reject request.');
          fetchMetrics();
        }
      }
    });
  };

  const fetchMetricsRef = useRef(fetchMetrics);
  useEffect(() => {
    fetchMetricsRef.current = fetchMetrics;
  });

  useEffect(() => {
    fetchMetricsRef.current(true);
    const interval = setInterval(() => {
      fetchMetricsRef.current(false);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[350px] bg-white/5 rounded-xl animate-pulse" />
          <div className="h-[350px] bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-xl border border-red-500/20 text-center space-y-4">
        <p className="text-red-400 font-semibold">{error}</p>
        <button onClick={() => fetchMetrics()} className="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm">
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const cardData = [
    { label: 'Total Students', value: data.totalStudents, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Total Subjects', value: data.totalSubjects, icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Total Questions', value: data.totalQuestions, icon: Code2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  // Reattempt Filter Logic
  const uniqueTestNames = Array.from(
    new Set(reattemptRequests.map(req => req.test?.name).filter(Boolean))
  );

  const filteredReattemptRequests = reattemptRequests.filter(req => {
    const title = req.reattemptQuestionTitle || req.test?.name || '';
    const student = req.studentName || '';
    const regNo = req.studentRegisterNumber || '';
    const searchLower = reattemptSearch.toLowerCase();

    const matchesSearch = title.toLowerCase().includes(searchLower) ||
      student.toLowerCase().includes(searchLower) ||
      regNo.toLowerCase().includes(searchLower);

    const matchesTest = reattemptTestFilter === 'ALL' || req.test?.name === reattemptTestFilter;

    return matchesSearch && matchesTest;
  });

  // Activities Filter Logic
  const filteredActivities = data.recentActivities.filter(act => {
    const user = act.user || '';
    const regNo = act.registerNumber || '';
    const details = act.details || '';
    const searchLower = activitySearch.toLowerCase();

    const matchesSearch = user.toLowerCase().includes(searchLower) ||
      regNo.toLowerCase().includes(searchLower) ||
      details.toLowerCase().includes(searchLower);

    let matchesType = true;
    if (activityTypeFilter !== 'ALL') {
      matchesType = details.toLowerCase().includes(activityTypeFilter.toLowerCase());
    }

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Analytics</h1>
          <p className="text-sm text-gray-500">Realtime activity tracking and statistics</p>
        </div>
        <button 
          onClick={() => fetchMetrics()} 
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/5 transition-all text-white disabled:opacity-50 select-none cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Stats'}
        </button>
      </div>

      {/* Cards Panel (3 Clean Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cardData.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-panel p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-bold text-white">{card.value}</span>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Reattempt Requests & Security Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Test Reattempt Requests Panel */}
        <div className="glass-panel p-6 rounded-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Test Reattempt Requests</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                  {filteredReattemptRequests.length}
                </span>
              </div>

              {filteredReattemptRequests.length > 0 && (
                <button
                  onClick={handleApproveAllFilteredReattempts}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all select-none cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Approve All ({filteredReattemptRequests.length})
                </button>
              )}
            </div>

            {/* Controls: Search Bar & Test Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search student, reg #, question..."
                  value={reattemptSearch}
                  onChange={(e) => setReattemptSearch(e.target.value)}
                  className="w-full bg-[#11131c] border border-white/10 py-1.5 pl-8 pr-3 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="relative">
                <select
                  value={reattemptTestFilter}
                  onChange={(e) => setReattemptTestFilter(e.target.value)}
                  className="w-full bg-[#11131c] border border-white/10 py-1.5 px-3 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                >
                  <option value="ALL">All Practice Blocks</option>
                  {uniqueTestNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List */}
            {filteredReattemptRequests.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-500 font-medium font-sans space-y-2 border border-dashed border-white/5 rounded-xl">
                <Sparkles className="w-8 h-8 text-gray-600 mx-auto" />
                <p>No pending reattempt requests matching current filters.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {filteredReattemptRequests.map((req) => (
                  <div key={`${req.id}_${req.reattemptQuestionId}`} className="flex gap-3 text-xs p-3.5 rounded-xl bg-white/5 border border-white/5 items-start justify-between hover:bg-white/[0.07] transition-all">
                    <div className="flex-1 space-y-1">
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        {req.reattemptQuestionTitle || req.test?.name}
                        <span className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-gray-400 font-normal">
                          {req.test?.subject?.name || req.test?.name}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs">
                        Requested by <strong className="text-indigo-400">{req.studentName || 'Student'}</strong> ({req.studentRegisterNumber || 'N/A'})
                      </p>
                      <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        Re-attempt requested for reset
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveReattempt(req.id, req.test?.name, req.reattemptQuestionId)}
                        className="px-3 py-1.5 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold transition-all uppercase tracking-wider flex items-center gap-1 select-none cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectReattempt(req.id, req.test?.name, req.reattemptQuestionId)}
                        className="px-3 py-1.5 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg font-bold transition-all uppercase tracking-wider flex items-center gap-1 select-none cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Security Warnings & Activities Panel */}
        <div className="glass-panel p-6 rounded-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <h3 className="font-bold text-white text-base">Security Warnings & Activities</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                  {filteredActivities.length}
                </span>
              </div>

              {filteredActivities.length > 0 && (
                <button
                  onClick={handleForgiveAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all select-none cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Forgive All Warnings
                </button>
              )}
            </div>

            {/* Controls: Search Bar & Violation Type Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search student, reg #, reason..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full bg-[#11131c] border border-white/10 py-1.5 pl-8 pr-3 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div className="relative">
                <select
                  value={activityTypeFilter}
                  onChange={(e) => setActivityTypeFilter(e.target.value)}
                  className="w-full bg-[#11131c] border border-white/10 py-1.5 px-3 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-red-500 transition-colors cursor-pointer"
                >
                  <option value="ALL">All Violation Types</option>
                  <option value="warning">Security Warning</option>
                  <option value="tab">Tab Switch</option>
                  <option value="fullscreen">Fullscreen Exit</option>
                  <option value="suspend">Suspension Alert</option>
                </select>
              </div>
            </div>

            {/* List */}
            {filteredActivities.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-500 font-medium font-sans space-y-2 border border-dashed border-white/5 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p>No active security warnings or violations found.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {filteredActivities.map((act, index) => (
                  <div key={index} className="flex gap-3 text-xs p-3.5 rounded-xl bg-white/5 border border-white/5 items-start hover:bg-white/[0.07] transition-all">
                    <div className="p-2 bg-red-500/10 text-red-400 rounded-lg shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">{act.user}</span>
                        <span className="text-[10px] text-gray-500 font-semibold">{formatISTDateTime(act.time)}</span>
                      </div>
                      <p className="text-gray-400 text-xs">{act.details}</p>

                      {act.user !== 'System Admin' && act.type !== 'info' ? (
                        <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                          <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
                            Security Violation Recorded
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleBook(act.registerNumber || act.user, act.user)}
                              className="px-3 py-1 text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg font-bold transition-all uppercase tracking-wider select-none cursor-pointer"
                            >
                              Book Student
                            </button>
                            <button
                              onClick={() => handleForgive(act.registerNumber || act.user, act.user)}
                              className="px-3 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold transition-all uppercase tracking-wider select-none cursor-pointer"
                            >
                              Forgive Student
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                          <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                            System Activity Logged
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Custom Confirm Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#11131c] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white tracking-wide">{confirmDialog.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all select-none"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  await confirmDialog.onConfirm();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all select-none"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
