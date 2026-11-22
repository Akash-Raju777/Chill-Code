'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import { Bell, Activity, Clock, User, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/student/notifications');
      setNotifications(data || []);
    } catch (err: any) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <p className="text-sm text-gray-400">System activity and staff notifications.</p>
      </div>

      <div className="glass-panel p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-lg">System Notifications</h3>
          </div>
          <button className="px-4 py-2 text-sm text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-xl transition-all">
            Mark All as Read
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No notifications found.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="p-4 bg-white/5 border border-white/5 rounded-xl flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      n.type === 'CHEATING' || n.type === 'SUSPENSION'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : n.type === 'TEST_ALERT'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {n.type}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{n.title}</h4>
                  <p className="text-xs text-gray-400 mt-1">{n.message}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl">
        <h3 className="font-bold text-white text-lg mb-4">Broadcast Instruction</h3>
        <p className="text-sm text-gray-400 mb-4">Send a broadcast message to all students.</p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Notification title"
            className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <textarea
            placeholder="Notification message"
            className="w-full bg-[#0b0c10] border border-white/10 py-3 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            rows={4}
          />
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all w-full">
            Broadcast to All Students
          </button>
        </div>
      </div>
    </div>
  );
}
