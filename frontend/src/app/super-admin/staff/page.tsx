'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import {
  Users, User, Plus, Edit2, Trash2, Eye, Search, Filter,
  AlertTriangle, CheckCircle, Clock, ChevronRight
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openModal, setOpenModal] = useState(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', username: '', password: '', department: '', phone: '', status: 'ACTIVE'
  });

  const fetchStaff = async (skipCache = false) => {
    try {
      if (staff.length === 0) setLoading(true);
      const data = await apiCall('/api/super-admin/staff', { skipLocalCache: skipCache });
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

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.staffId.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (id: number, newStatus: string) => {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
    try {
      await apiCall(`/api/super-admin/staff/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('Staff status updated');
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await apiCall(`/api/super-admin/staff/${id}`, { method: 'DELETE' });
      toast.success('Staff deleted');
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete staff');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalMode === 'ADD') {
        await apiCall('/api/super-admin/staff', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      } else {
        await apiCall(`/api/super-admin/staff/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      }
      setOpenModal(false);
      setFormData({ name: '', email: '', username: '', password: '', department: '', phone: '', status: 'ACTIVE' });
      toast.success(`Staff ${modalMode === 'ADD' ? 'created' : 'updated'} successfully`);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save staff');
    }
  };

  const handleEdit = (s: StaffMember) => {
    setEditingId(s.id);
    setModalMode('EDIT');
    setFormData({
      name: s.name, email: s.email, username: s.staffId, password: '', department: s.department, phone: s.phone, status: s.status
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
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> Add Staff
        </button>
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
              <th className="pb-3">Staff Name</th>
              <th className="pb-3">Staff ID</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Department</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Joined</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5 animate-pulse">
                  <td className="py-4">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                  </td>
                  <td className="py-4">
                    <div className="h-4 w-20 bg-white/5 rounded font-mono" />
                  </td>
                  <td className="py-4">
                    <div className="h-4 w-40 bg-white/5 rounded" />
                  </td>
                  <td className="py-4">
                    <div className="h-4 w-24 bg-white/5 rounded" />
                  </td>
                  <td className="py-4">
                    <div className="h-5 w-16 bg-white/10 rounded-full" />
                  </td>
                  <td className="py-4">
                    <div className="h-4 w-20 bg-white/5 rounded" />
                  </td>
                  <td className="py-4 text-right">
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
                  <td className="py-4 text-sm font-medium text-white">{s.name}</td>
                  <td className="py-4 text-sm text-gray-300 font-mono">{s.staffId}</td>
                  <td className="py-4 text-sm text-gray-300">{s.email}</td>
                  <td className="py-4 text-sm text-gray-300">{s.department || 'N/A'}</td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[s.status] || statusColors.ACTIVE}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-gray-400">{new Date(s.dateJoined).toLocaleDateString()}</td>
                  <td className="py-4 text-right">
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
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all"
                >
                  {modalMode === 'ADD' ? 'Create Staff' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
