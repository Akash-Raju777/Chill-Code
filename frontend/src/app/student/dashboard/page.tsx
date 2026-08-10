'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { useAuthStore } from '../../../store/authStore';
import { Timer, Award, Bell, CheckSquare, Loader2, Sparkles, BookOpen, User as UserIcon } from 'lucide-react';

interface SubjectStat {
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  completedCount: number;
  incompleteCount: number;
  totalCount: number;
  status: 'COMPLETED' | 'INCOMPLETE';
}

interface Stats {
  unattendedTests: number;
  completedTests: number;
  inProgressTests: number;
  totalTests: number;
  averageScore: number;
  totalQuestions: number;
  completedQuestions: number;
  recentActivities: string[];
  subjectStats: SubjectStat[];
  totalBadges?: number;
}

export default function StudentDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuthStore();

  const fetchDashboardData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const statsRes = await apiCall('/api/student/dashboard/stats');
      setStats(statsRes);
    } catch (err: any) {
      if (!isSilent) setError('Failed to load dashboard metrics');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Automatic synchronization on window focus or tab activation
    const handleFocus = () => fetchDashboardData(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboardData(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-[300px] lg:col-span-2 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-[300px] bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-xl border border-red-500/20 text-center space-y-4">
        <p className="text-red-400 font-semibold">{error}</p>
        <button onClick={() => fetchDashboardData()} className="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm">
          Refresh
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const cardData = [
    { label: 'Unattended Tests', value: stats.unattendedTests ?? 0, icon: BookOpen, color: 'text-indigo-400', bg: 'bg-indigo-500/10', sub: 'Not started yet' },
    { label: 'In Progress', value: stats.inProgressTests ?? 0, icon: Timer, color: 'text-amber-400', bg: 'bg-amber-500/10', sub: 'Currently active' },
    { label: 'Completed Tests', value: stats.completedTests ?? 0, icon: CheckSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10', sub: 'Submitted attempts' },
    { label: 'Questions Solved', value: `${stats.completedQuestions ?? 0}/${stats.totalQuestions ?? 0}`, icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-500/10', sub: 'Problems completed' },
  ];

  return (
    <div className="space-y-8">
      {/* Title greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Student Dashboard</h1>
        <p className="text-sm text-gray-500">Track your exam assignments, performance logs, and profile</p>
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {cardData.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-panel p-4 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl font-bold text-white">{card.value}</span>
              <span className="text-[10px] text-gray-600 font-semibold mt-1">{card.sub}</span>
            </div>
          );
        })}
      </div>

      {/* Subject Progress and Alerts panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject-wise Test Status */}
        <div className="glass-panel p-6 rounded-xl space-y-4 lg:col-span-2">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Subject-wise Progress
          </h3>
          {!stats.subjectStats || stats.subjectStats.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              No subjects or tests assigned at this time.
            </div>
          ) : (
            <div className="space-y-4">
              {stats.subjectStats.map((sub) => {
                const completionPercentage = sub.totalCount > 0 
                  ? Math.round((sub.completedCount / sub.totalCount) * 100) 
                  : 0;

                return (
                  <div key={sub.subjectId} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-bold text-white text-sm">{sub.subjectName}</h4>
                        <p className="text-xs text-gray-500 font-semibold">
                          {sub.completedCount} of {sub.totalCount} questions solved
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        sub.status === 'COMPLETED' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {sub.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-1.5 w-full bg-[#11131c] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${completionPercentage}%`,
                            backgroundColor: sub.subjectColor || '#3b82f6'
                          }}
                        />
                      </div>
                      <div className="flex justify-end text-[10px] text-gray-500 font-semibold">
                        {completionPercentage}% Done
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Student Profile Card */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-indigo-400" />
              Student Profile
            </h3>
            <div className="space-y-6">
              {/* Profile header with avatar */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md border border-white/10 shrink-0">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div className="overflow-hidden">
                  <h4 className="font-bold text-white text-base truncate leading-tight">{user?.name || 'Student Name'}</h4>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-1">Student Portal Active</p>
                </div>
              </div>

              {/* Profile Details List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs p-3 rounded-lg bg-white/5">
                  <span className="text-gray-500 font-semibold">Student ID</span>
                  <span className="font-mono font-bold text-white select-all">{user?.registerNumber || 'STUDENT_ID'}</span>
                </div>
                <div className="flex justify-between items-center text-xs p-3 rounded-lg bg-white/5">
                  <span className="text-gray-500 font-semibold">Department</span>
                  <span className="font-bold text-white uppercase">{user?.department || 'Computer Science'}</span>
                </div>
                <div className="flex justify-between items-center text-xs p-3 rounded-lg bg-white/5">
                  <span className="text-gray-500 font-semibold">Email</span>
                  <span className="font-semibold text-gray-300 truncate max-w-[180px]">{user?.email || 'student@college.edu'}</span>
                </div>
                <div className="flex justify-between items-center text-xs p-3 rounded-lg bg-white/5">
                  <span className="text-gray-500 font-semibold">Badges Earned</span>
                  <span className="font-bold text-purple-400">{stats?.totalBadges ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
