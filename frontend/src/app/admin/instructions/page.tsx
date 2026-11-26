'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, formatISTDateTime } from '../../../utils/api';
import {
  Megaphone,
  AlertCircle,
  CheckCircle,
  Loader2,
  Inbox,
  Shield,
  Clock,
  Eye,
  CheckCheck,
  RefreshCw
} from 'lucide-react';

interface AdminNotice {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function SendInstructions() {
  const [activeTab, setActiveTab] = useState<'broadcast' | 'inbox'>('broadcast');

  // Broadcast state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Inbox state
  const [inbox, setInbox] = useState<AdminNotice[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState('');

  const fetchInbox = async (showLoader = true) => {
    if (showLoader) setLoadingInbox(true);
    setInboxError('');
    try {
      const data = await apiCall('/api/admin/instructions/inbox', { skipLocalCache: true });
      if (Array.isArray(data)) {
        setInbox(data);
      }
    } catch (err: any) {
      if (showLoader) {
        setInboxError(err.message || 'Failed to load admin instructions inbox.');
      }
    } finally {
      if (showLoader) setLoadingInbox(false);
    }
  };

  useEffect(() => {
    fetchInbox(activeTab === 'inbox');
  }, [activeTab]);

  const handleMarkRead = async (id: number) => {
    try {
      await apiCall(`/api/admin/instructions/${id}/read`, { method: 'POST' });
      setInbox((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      await apiCall('/api/student/notifications', {
        method: 'POST',
        body: JSON.stringify({ title, message }),
      });
      setSuccess('Instruction broadcasted successfully to all students!');
      setTitle('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to broadcast instruction.');
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = inbox.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Instruction Center</h1>
          <p className="text-sm text-gray-500">Broadcast guidelines to students and view directives from Super Admin</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#11131c] border border-white/5 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-[#7c3aed] text-white shadow-md shadow-[#7c3aed]/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Broadcast to Students
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer relative ${
              activeTab === 'inbox'
                ? 'bg-[#7c3aed] text-white shadow-md shadow-[#7c3aed]/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Admin Notices</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: Broadcast to Students */}
      {activeTab === 'broadcast' && (
        <div className="max-w-2xl bg-[#11131c] border border-white/5 p-6 rounded-2xl shadow-xl space-y-6">
          <div className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Megaphone className="w-5 h-5 animate-bounce shrink-0" />
            <div className="text-xs">
              Instructions sent here will appear immediately in the <strong>Notifications</strong> tab of all active student portals.
            </div>
          </div>

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Instruction Title</label>
              <input
                type="text"
                required
                placeholder="e.g., Exam Postponement or Urgent Security Notice"
                className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Instruction Body Message</label>
              <textarea
                required
                rows={6}
                placeholder="Write detailed instructions, rules, guidelines, or notices here..."
                className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs tracking-wider rounded-xl transition-all shadow-md shadow-[#7c3aed]/10 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Broadcasting...
                </>
              ) : (
                'Broadcast Instruction'
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Admin Notices Inbox */}
      {activeTab === 'inbox' && (
        <div className="max-w-3xl space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => fetchInbox(true)}
              disabled={loadingInbox}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingInbox ? 'animate-spin text-purple-400' : ''}`} />
              <span>{loadingInbox ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
          {inboxError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {inboxError}
            </div>
          )}

          {loadingInbox ? (
            <div className="p-12 text-center text-gray-400 space-y-3 bg-[#11131c] border border-white/5 rounded-2xl">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400" />
              <p className="text-xs">Loading instructions from Super Admin...</p>
            </div>
          ) : inbox.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-[#11131c] border border-white/5 rounded-2xl space-y-2">
              <Shield className="w-10 h-10 mx-auto text-gray-600 opacity-40" />
              <h3 className="font-bold text-white text-sm">Inbox Clean</h3>
              <p className="text-xs text-gray-500">No instructions or directives from Super Admin at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inbox.map((notice) => (
                <div
                  key={notice.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    notice.isRead
                      ? 'border-white/5 bg-[#11131c]/50 opacity-80'
                      : 'border-purple-500/30 bg-[#11131c] shadow-lg shadow-purple-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">
                          Super Admin Directive
                        </span>
                        {!notice.isRead && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            UNREAD
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1">{notice.title}</h3>
                    </div>

                    {!notice.isRead && (
                      <button
                        onClick={() => handleMarkRead(notice.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-purple-300 transition-colors cursor-pointer shrink-0"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark as Read</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 whitespace-pre-wrap mt-3 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    {notice.message}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Sender: Super Administrator</span>
                    <span>{formatISTDateTime(notice.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
