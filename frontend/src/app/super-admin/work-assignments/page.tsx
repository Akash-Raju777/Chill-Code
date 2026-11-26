'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import ConfirmModal from '@/components/ConfirmModal';
import {
  ClipboardList, User, Plus, Edit2, Trash2, Search, Clock,
  AlertTriangle, CheckCircle, ChevronRight, ArrowRight
} from 'lucide-react';

interface WorkAssignment {
  id: number;
  title: string;
  description: string;
  assignedToId: number;
  assignedToName: string;
  assignedToStaffId: string;
  assignedById: number;
  assignedByName: string;
  priority: string;
  startDate: string;
  dueDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function WorkAssignments() {
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openModal, setOpenModal] = useState(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '', description: '', assignedToId: '', priority: 'MEDIUM', dueDate: ''
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/super-admin/work-assignments');
      setAssignments(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const filtered = assignments.filter(a => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/api/super-admin/work-assignments', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          assignedToId: parseInt(formData.assignedToId),
          priority: formData.priority,
          dueDate: formData.dueDate,
        }),
      });
      setOpenModal(false);
      setFormData({ title: '', description: '', assignedToId: '', priority: 'MEDIUM', dueDate: '' });
      toast.success('Assignment created');
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create assignment');
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      await apiCall(`/api/super-admin/work-assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('Assignment status updated');
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await apiCall(`/api/super-admin/work-assignments/${id}`, { method: 'DELETE' });
      toast.success('Assignment deleted');
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const priorityColors: Record<string, string> = {
    LOW: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    URGENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
    IN_PROGRESS: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Work Assignments</h1>
          <p className="text-sm text-gray-400">Assign and track responsibilities for staff members.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setModalMode('ADD');
            setFormData({ title: '', description: '', assignedToId: '', priority: 'MEDIUM', dueDate: '' });
            setOpenModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      <div className="glass-panel p-6 rounded-xl overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#11131c] border border-white/10 py-2 px-3 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-indigo-500 w-full sm:w-48"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs font-semibold text-gray-400 uppercase">
              <th className="pb-3">Title</th>
              <th className="pb-3">Assigned To</th>
              <th className="pb-3">Priority</th>
              <th className="pb-3">Due Date</th>
              <th className="pb-3">Status</th>
              <th className="pb-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400 text-sm">
                  No assignments found.
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 text-sm font-medium text-white">{a.title}</td>
                  <td className="py-4 text-sm text-gray-300">{a.assignedToName} <span className="text-xs text-gray-500 font-mono">({a.assignedToStaffId})</span></td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${priorityColors[a.priority] || priorityColors.MEDIUM}`}>
                      {a.priority}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-gray-300 font-mono">{new Date(a.dueDate).toLocaleDateString()}</td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusColors[a.status] || statusColors.PENDING}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleUpdateStatus(a.id, a.status === 'PENDING' ? 'IN_PROGRESS' : a.status === 'IN_PROGRESS' ? 'COMPLETED' : 'PENDING')}
                        className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-all"
                        title="Change Status"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
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
            <h3 className="text-base font-bold text-white">Create Work Assignment</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Task Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Assign To (Staff ID)</label>
                <input
                  type="number"
                  value={formData.assignedToId}
                  onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                  className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Enter staff user ID"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        title="Delete Assignment"
        message="Are you sure you want to delete this assignment?"
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
