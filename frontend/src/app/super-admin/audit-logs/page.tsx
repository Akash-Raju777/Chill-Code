'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import { Activity, Search, User, Clock, AlertTriangle } from 'lucide-react';

interface AuditLogEntry {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (userFilter) params.set('userId', userFilter);
      params.set('limit', '100');
      const data = await apiCall(`/api/super-admin/audit-logs?${params.toString()}`);
      setLogs(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(l => {
    const matchesSearch = l.userName.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase());
    const matchesUser = !userFilter || l.userId.toString() === userFilter;
    return matchesSearch && matchesUser;
  });

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: 'text-purple-400',
    ADMIN: 'text-indigo-400',
    STUDENT: 'text-blue-400',
    UNKNOWN: 'text-gray-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-gray-400">Track administrative actions across the platform.</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by user name, action, or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#11131c] border border-white/10 py-2 pl-9 pr-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <input
            type="text"
            placeholder="Filter by User ID..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full sm:w-48 bg-[#11131c] border border-white/10 py-2 px-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs font-semibold text-gray-400 uppercase sticky top-0 bg-[#0b0c10]/50">
              <th className="pb-3 pr-4">Time</th>
              <th className="pb-3">User</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Action</th>
              <th className="pb-3">Details</th>
              <th className="pb-3">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400 text-sm">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 text-sm font-mono text-gray-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-4 text-sm text-white flex items-center gap-2">
                    <User className="w-3 h-3 text-gray-500" />
                    {log.userName}
                  </td>
                  <td className="py-4 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${roleColors[log.userRole] || 'border-gray-500/20 text-gray-400'}`}>
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-gray-300">{log.action}</td>
                  <td className="py-4 text-sm text-gray-400 max-w-[300px] truncate">{log.details}</td>
                  <td className="py-4 text-sm font-mono text-gray-500">{log.ipAddress || 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-panel p-6 rounded-xl">
        <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          About Audit Logs
        </h3>
        <p className="text-sm text-gray-400">
          This module records administrative actions such as staff creation, status changes, test
          creation, question updates, badge assignments, and Super Admin permission changes. Audit
          logs are read-only and cannot be modified or deleted from this interface.
        </p>
      </div>
    </div>
  );
}
