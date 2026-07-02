'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { Timer, Award, Bell, CheckSquare, Loader2, Sparkles, BookOpen } from 'lucide-react';

interface Stats {
  upcomingTests: number;
  completedTests: number;
  averageScore: number;
  rank: number;
  recentActivities: string[];
}

interface Achievement {
  id: number;
  title: string;
  type: string;
  badgeIcon: string;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export default function StudentDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const statsRes = await apiCall('/api/student/dashboard/stats');
      setStats(statsRes);

      const badgesRes = await apiCall('/api/student/achievements');
      setAchievements(badgesRes);

      const notifsRes = await apiCall('/api/student/notifications');
      setNotifications(notifsRes);
    } catch (err: any) {
      setError('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await apiCall(`/api/student/notifications/${id}/read`, { method: 'POST' });
      setNotifications(notifications.filter((n) => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm">
          Refresh
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const cardData = [
    { label: 'Upcoming Tests', value: stats.upcomingTests, icon: Timer, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Completed Tests', value: stats.completedTests, icon: CheckSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Average Grade (%)', value: stats.averageScore + '%', icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Department Rank', value: '#' + stats.rank, icon: Award, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Title greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Student Dashboard</h1>
        <p className="text-sm text-gray-500">Track your exam assignments, performance logs, and badges</p>
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Badges and Alerts panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Achievements list */}
        <div className="glass-panel p-6 rounded-xl space-y-4 lg:col-span-2">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            Earned Achievements
          </h3>
          {achievements.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              Complete your first coding exam successfully to earn achievements badges!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {achievements.map((ach) => (
                <div key={ach.id} className="p-4 rounded-xl bg-white/5 border border-white/5 text-center flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
                    <Award className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">{ach.title}</h4>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{ach.type} level</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications and warnings alerts list */}
        <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" />
              Notifications
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {notifications.map((notif) => (
                <div key={notif.id} className="flex gap-3 text-xs p-3 rounded-lg bg-white/5 items-start relative group">
                  <div className={`p-1.5 rounded-lg mt-0.5 ${
                    notif.type === 'SUSPENSION' ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400'
                  }`}>
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-white">{notif.title}</span>
                      <button 
                        onClick={() => handleMarkRead(notif.id)}
                        className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 hover:underline transition-opacity"
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="text-gray-400 mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-12 text-sm text-gray-500">
                  No active notifications at this time.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
