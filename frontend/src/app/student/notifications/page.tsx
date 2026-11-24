'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, formatISTDateTime } from '../../../utils/api';
import { Bell, Loader2, Calendar, AlertTriangle, ShieldCheck, MailOpen, RefreshCw } from 'lucide-react';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function StudentNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchNotifications = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    if (isRefresh) setRefreshing(true);
    try {
      const data = await apiCall('/api/student/notifications', { skipLocalCache: isRefresh });
      setNotifications(data || []);
      setError('');
    } catch (err: any) {
      setError('Failed to load notifications list');
    } finally {
      if (!isRefresh) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await apiCall(`/api/student/notifications/${id}/read`, { method: 'POST' });
      setNotifications(notifications.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Notifications</h1>
          <p className="text-sm text-gray-500">Official broadcast notifications from the administrator</p>
        </div>
        <button
          onClick={() => fetchNotifications(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all disabled:opacity-50 select-none shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
          <Bell className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="font-bold text-white text-lg">Clean log</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">No notifications logged at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => (
            <div 
              key={n.id} 
              className={`glass-panel p-5 rounded-2xl border flex items-start justify-between gap-4 transition-all ${
                n.isRead ? 'border-white/5 bg-[#11131c]/30 opacity-70' : 'border-indigo-500/20 bg-[#11131c]'
              }`}
            >
              <div className="flex gap-4 items-start">
                <div className={`p-2 rounded-xl mt-0.5 ${
                  n.type === 'SUSPENSION' || n.type === 'CHEATING' 
                    ? 'bg-red-500/10 text-red-400' 
                    : 'bg-indigo-500/10 text-indigo-400'
                }`}>
                  {n.type === 'SUSPENSION' || n.type === 'CHEATING' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{n.title}</h3>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">{n.message}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 pt-2 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatISTDateTime(n.createdAt)}
                  </div>
                </div>
              </div>

              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-white/10 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white transition-all uppercase tracking-wider"
                >
                  <MailOpen className="w-3.5 h-3.5" />
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
