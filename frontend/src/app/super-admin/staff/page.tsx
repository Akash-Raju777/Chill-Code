'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Users, User, Plus, Edit2, Trash2, Eye, Search, Filter,
  AlertTriangle, CheckCircle, Clock, ChevronRight, RefreshCw
} from 'lucide-react';

interface StaffMember {
  id: number;
  staffId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  status: string;
  dateJoined: string;
  lastActive: string;
}

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openModal, setOpenModal] = useState(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', username: '', password: '', department: '', phone: '', status: 'ACTIVE'
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'danger',
    onConfirm: () => {},
  });

  const fetchStaff = async (skipCache = false, showRefreshing = skipCache) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else if (staff.length === 0) setLoading(true);
      const data = await apiCall('/api/super-admin/staff', { skipLocalCache: skipCache });
      setStaff(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filteredStaff = staff.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.staffId || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.department || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (id: number, newStatus: string) => {
    setConfirmModal({
      isOpen: true,
      title: newStatus === 'SUSPENDED' ? 'Suspend Staff Member' : 'Activate Staff Member',
      message: `Are you sure you want to change status to ${newStatus}?`,
      confirmText: newStatus === 'SUSPENDED' ? 'Suspend' : 'Activate',
      variant: newStatus === 'SUSPENDED' ? 'warning' : 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const previousStaff = staff;
        // Instant optimistic update
        setStaff(prev => prev.map(s => (s.id === id ? { ...s, status: newStatus } : s)));
        try {
          await apiCall(`/api/super-admin/staff/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus }),
          });
          toast.success('Staff status updated');
          fetchStaff(true, false);
        } catch (err: any) {
          setStaff(previousStaff);
          toast.error(err.message || 'Failed to update status');
        }
      },
    });
  };

  const handleDelete = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Staff Member',
      message: 'Are you sure you want to delete this staff member? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        const previousStaff = staff;
        // Instant optimistic removal
        setStaff(prev => prev.filter(s => s.id !== id));
        try {
          await apiCall(`/api/super-admin/staff/${id}`, { method: 'DELETE' });
          toast.success('Staff deleted');
          fetchStaff(true, false);
        } catch (err: any) {
          setStaff(previousStaff);
          toast.error(err.message || 'Failed to delete staff');
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentMode = modalMode;
    const targetId = editingId;
    const payload = { ...formData };

    if (currentMode === 'EDIT' && targetId !== null) {
      const previousStaff = staff;
      // Instant optimistic update & close modal immediately
      setStaff(prev =>
        prev.map(s =>
          s.id === targetId
            ? {
                ...s,
                name: payload.name,
                email: payload.email,
                staffId: payload.username,
                department: payload.department,
                phone: payload.phone,
                status: payload.status,
              }
            : s
        )
      );
      setOpenModal(false);
      setFormData({ name: '', email: '', username: '', password: '', department: '', phone: '', status: 'ACTIVE' });
      try {
        await apiCall(`/api/super-admin/staff/${targetId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Staff updated successfully');
        fetchStaff(true, false);
      } catch (err: any) {
        setStaff(previousStaff);
        toast.error(err.message || 'Failed to save staff');
      }
      return;
    }

    setSaving(true);
    try {
      const created = await apiCall('/api/super-admin/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (created && created.id) {
        const newStaff: StaffMember = {
          id: created.id,
          staffId: created.username || payload.username,
          name: created.name || payload.name,
          email: created.email || payload.email,
          phone: created.phone || payload.phone,
          department: created.department || payload.department,
          status: created.status || payload.status || 'ACTIVE',
          dateJoined: created.createdAt || new Date().toISOString(),
          lastActive: created.updatedAt || new Date().toISOString(),
        };
        setStaff(prev => [...prev, newStaff]);
      }
      setOpenModal(false);
      setFormData({ name: '', email: '', username: '', password: '', department: '', phone: '', status: 'ACTIVE' });
      toast.success('Staff created successfully');
      fetchStaff(true, false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save staff');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: StaffMember) => {
    setEditingId(s.id);
    setModalMode('EDIT');
    setFormData({
      name: s.name || '', email: s.email || '', username: s.staffId || '', password: '', department: s.department || '', phone: s.phone || '', status: s.status || 'ACTIVE'
    });
    setOpenModal(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setModalMode('ADD');
    setFormData({ name: '', email: '', username: '', password: '', department: '', phone: '', status: 'ACTIVE' });
    setOpenModal(true);
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    SUSPENDED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    INACTIVE: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    NO_SECURITY: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff Management</h1>
          <p className="text-sm text-gray-400">Manage administrator accounts and staff access.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStaff(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            {refreshing ? 'Reloading...' : 'Reload'}
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, staff ID, email, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#11131c] border border-white/10 py-2 pl-9 pr-3 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#11131c] border border-white/10 py-2 px-3 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs font-semibold text-gray-400 uppercase">
              <th className="px-4 pb-3 whitespace-nowrap">Staff Name</th>
              <th className="px-4 pb-3 whitespace-nowrap">Staff ID</th>
              <th className="px-4 pb-3 whitespace-nowrap">Email</th>
              <th className="px-4 pb-3 whitespace-nowrap">Department</th>
              <th className="px-4 pb-3 whitespace-nowrap">Status</th>
              <th className="px-4 pb-3 whitespace-nowrap">Joined</th>
              <th className="px-4 pb-3 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5 animate-pulse">
                  <td className="px-4 py-4">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-20 bg-white/5 rounded font-mono" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-40 bg-white/5 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-24 bg-white/5 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-5 w-16 bg-white/10 rounded-full" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-20 bg-white/5 rounded" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="h-8 w-20 bg-white/5 rounded-lg ml-auto" />
                  </td>
                </tr>
              ))
            ) : filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400 text-sm">
                  {search || statusFilter !== 'ALL' ? 'No staff members match the selected filters.' : 'No staff members found.'}
                </td>
              </tr>
            ) : (
              filteredStaff.map((s) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-white whitespace-nowrap max-w-[180px]">
                    <span className="block truncate" title={s.name}>{s.name}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300 font-mono whitespace-nowrap max-w-[150px]">
                    <span className="block truncate" title={s.staffId}>{s.staffId}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300 whitespace-nowrap max-w-[180px]">
                    <span className="block truncate" title={s.email}>{s.email}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300 whitespace-nowrap max-w-[150px]">
                    <span className="block truncate" title={s.department || 'N/A'}>{s.department || 'N/A'}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[s.status] || statusColors.ACTIVE}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-400 whitespace-nowrap">{new Date(s.dateJoined).toLocaleDateString()}</td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(s)}
                        className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStatusChange(s.id, s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                        className={`p-2 ${s.status === 'ACTIVE' ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10' : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'} rounded-lg transition-all`}
                        title={s.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      >
                        {s.status === 'ACTIVE' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#11131c] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">{modalMode === 'ADD' ? 'Add New Staff' : 'Edit Staff'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Staff ID / Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder={modalMode === 'ADD' ? 'Required' : 'Leave blank to keep current'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all disabled:opacity-50"
                >
                  {saving ? 'Creating...' : modalMode === 'ADD' ? 'Create Staff' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
