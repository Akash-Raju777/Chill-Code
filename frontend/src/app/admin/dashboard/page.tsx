'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { 
  Users, 
  BookOpen, 
  Code2, 
  Timer, 
  Clock, 
  ClipboardCheck, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

interface DashboardData {
  totalStudents: number;
  totalSubjects: number;
  totalTests: number;
  totalQuestions: number;
  todayActiveTests: number;
  pendingEvaluations: number;
  monthlyTests: Array<{ month: string; tests: number }>;
  studentParticipation: Array<{ name: string; assigned: number; attended: number }>;
  languagePerformance: Array<{ language: string; avgScore: number }>;
  recentActivities: Array<{ time: string; user: string; details: string; type: string; registerNumber?: string }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reattemptRequests, setReattemptRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async (isInitial = false) => {
    if (isInitial || !data) {
      setLoading(true);
    }
    try {
      const [response, reattempts] = await Promise.all([
        apiCall('/api/admin/dashboard'),
        apiCall('/api/admin/tests/reattempt-requests')
      ]);
      setData(response);
      setReattemptRequests(reattempts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleForgive = async (studentKey: string, displayName: string) => {
    if (!confirm(`Are you sure you want to forgive ${displayName} and reset their warning logs?`)) return;
    if (data) {
      setData({
        ...data,
        recentActivities: data.recentActivities.filter(act => (act.registerNumber || act.user) !== studentKey)
      });
    }
    try {
      await apiCall(`/api/admin/student/forgive?registerNumber=${encodeURIComponent(studentKey)}`, {
        method: 'POST'
      });
      alert(`Successfully reset security warning logs for ${displayName}. They can now continue their test.`);
      fetchMetrics();
    } catch (e: any) {
      alert(e.message || 'Failed to forgive student.');
      fetchMetrics();
    }
  };

  const handleApproveReattempt = async (studentTestId: number, testName: string) => {
    if (!confirm(`Are you sure you want to approve this reattempt request for "${testName}"? The student's attempt progress will be reset.`)) return;
    setReattemptRequests(prev => prev.filter(req => req.id !== studentTestId));
    try {
      await apiCall(`/api/admin/tests/reattempt-requests/${studentTestId}/approve`, {
        method: 'POST',
      });
      alert('Reattempt request approved successfully.');
      fetchMetrics();
    } catch (e: any) {
      alert(e.message || 'Failed to approve request.');
      fetchMetrics();
    }
  };

  const handleRejectReattempt = async (studentTestId: number, testName: string) => {
    if (!confirm(`Are you sure you want to reject this reattempt request for "${testName}"?`)) return;
    setReattemptRequests(prev => prev.filter(req => req.id !== studentTestId));
    try {
      await apiCall(`/api/admin/tests/reattempt-requests/${studentTestId}/reject`, {
        method: 'POST',
      });
      alert('Reattempt request rejected.');
      fetchMetrics();
    } catch (e: any) {
      alert(e.message || 'Failed to reject request.');
      fetchMetrics();
    }
  };

  useEffect(() => {
    fetchMetrics(true);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[300px] bg-white/5 rounded-xl animate-pulse" />
          <div className="h-[300px] bg-white/5 rounded-xl animate-pulse" />
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
    { label: 'Total Tests', value: data.totalTests, icon: Timer, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Questions', value: data.totalQuestions, icon: Code2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Active Tests', value: data.todayActiveTests, icon: Clock, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { label: 'Pending Eval', value: data.pendingEvaluations, icon: ClipboardCheck, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

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
          className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/5 transition-all text-white"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Stats
        </button>
      </div>

      {/* Cards Panel */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

      {/* Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Tests & User Participation */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <h3 className="font-semibold text-white">Monthly Tests & scheduling trends</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyTests}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252836" />
                <XAxis dataKey="month" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ background: '#0b0c10', border: '1px solid rgba(255,255,255,0.05)' }} />
                <Line type="monotone" dataKey="tests" stroke="#6366f1" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Attendance participation */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <h3 className="font-semibold text-white">Test Participation (Attended vs Assigned)</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.studentParticipation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252836" />
                <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip contentStyle={{ background: '#0b0c10', border: '1px solid rgba(255,255,255,0.05)' }} />
                <Legend style={{ fontSize: '12px' }} />
                <Bar dataKey="assigned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="attended" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Test Reattempt Requests */}
        <div className="glass-panel p-6 rounded-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-white mb-4">Test Reattempt Requests</h3>
            {reattemptRequests.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500 font-medium font-sans">
                No pending reattempt requests from students.
              </div>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {reattemptRequests.map((req) => (
                  <div key={req.id} className="flex gap-3 text-sm p-3 rounded-lg bg-white/5 items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-white">
                        {req.reattemptQuestionTitle || req.test.name} <span className="text-gray-500 font-normal">({req.test.subject?.name || req.test.name})</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        Requested by <strong className="text-indigo-400">{req.studentName || 'Student'}</strong> ({req.studentRegisterNumber || 'N/A'})
                      </p>
                      <p className="text-gray-500 text-[10px] mt-0.5 font-semibold">
                        Attempt #2 (Re-attempt Request)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveReattempt(req.id, req.test.name)}
                        className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold transition-all uppercase tracking-wider"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectReattempt(req.id, req.test.name)}
                        className="px-2.5 py-1 text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg font-bold transition-all uppercase tracking-wider"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Logs feed */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-white mb-4">Security Warnings & Activities</h3>
            <div className="space-y-3">
              {data.recentActivities.map((act, index) => (
                <div key={index} className="flex gap-3 text-sm p-3 rounded-lg bg-white/5 items-start">
                  <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-white">{act.user}</span>
                      <span className="text-xs text-gray-500">{new Date(act.time).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{act.details}</p>
                    
                    {/* Forgive option triggers */}
                    {act.details.toLowerCase().includes('warning') || act.details.toLowerCase().includes('tab') || act.details.toLowerCase().includes('suspend') ? (
                      <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Secure Warning Logged</span>
                        <button
                          onClick={() => handleForgive(act.registerNumber || act.user, act.user)}
                          className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold transition-all uppercase tracking-wider"
                        >
                          Forgive Student
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
