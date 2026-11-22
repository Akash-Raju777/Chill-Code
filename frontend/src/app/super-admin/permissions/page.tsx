'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import { FileText, User, Shield, Search, CheckCircle2 } from 'lucide-react';

interface StaffPermission {
  id: number;
  name: string;
  username: string;
  role: string;
  status: string;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'VIEW_STUDENTS', label: 'View Students', description: 'View student records and profiles' },
  { key: 'MANAGE_STUDENTS', label: 'Manage Students', description: 'Create, edit, and deactivate student accounts' },
  { key: 'CREATE_QUESTIONS', label: 'Create Questions', description: 'Create new coding questions' },
  { key: 'EDIT_QUESTIONS', label: 'Edit Questions', description: 'Modify existing questions' },
  { key: 'CREATE_TESTS', label: 'Create Tests', description: 'Create and schedule assessments' },
  { key: 'VIEW_RESULTS', label: 'View Results', description: 'View test results and submissions' },
  { key: 'MANAGE_BADGES', label: 'Manage Badges', description: 'Create and assign badges' },
  { key: 'VIEW_ANALYTICS', label: 'View Analytics', description: 'View platform analytics and reports' },
];

export default function RolesPermissions() {
  const [staff, setStaff] = useState<StaffPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/super-admin/permissions/all-staff');
      setStaff(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    SUSPENDED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    INACTIVE: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    NO_SECURITY: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
        <p className="text-sm text-gray-400">Control feature access for administrator accounts.</p>
      </div>

      <div className="glass-panel p-6 rounded-xl">
        <h3 className="font-bold text-white text-lg mb-4">Available System Permissions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AVAILABLE_PERMISSIONS.map((perm) => (
            <div key={perm.key} className="p-4 bg-white/5 border border-white/5 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">{perm.label}</span>
              </div>
              <p className="text-xs text-gray-400">{perm.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl overflow-x-auto">
        <h3 className="font-bold text-white text-lg mb-4">Staff Permission Assignments</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs font-semibold text-gray-400 uppercase sticky top-0 bg-[#0b0c10]/50">
              <th className="pb-3">Staff Name</th>
              <th className="pb-3">Username</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Status</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  Loading staff...
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  No staff members found.
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 text-sm font-medium text-white">{s.name}</td>
                  <td className="py-4 text-sm text-gray-300 font-mono">{s.username}</td>
                  <td className="py-4 text-sm text-gray-300">{s.role}</td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[s.status] || statusColors.ACTIVE}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-all" title="Manage Permissions">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-panel p-6 rounded-xl">
        <h3 className="font-bold text-white text-lg mb-4">Super Admin Control</h3>
        <p className="text-sm text-gray-400 mb-4">
          The Super Admin role has complete access to all platform features. Existing Administrator
          accounts retain their current role-based access (@PreAuthorize hasRole('ADMIN')). Permission
          granularity for individual admins is managed through this module.
        </p>
        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <p className="text-xs text-amber-400 font-semibold mb-1">Note:</p>
          <p className="text-xs text-gray-300">
            Fine-grained permission enforcement requires additional database tables. Currently, all
            ADMIN role users have access to all /api/admin/** endpoints. This module provides the UI
            framework for future permission-based access control.
          </p>
        </div>
      </div>
    </div>
  );
}
