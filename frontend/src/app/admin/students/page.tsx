'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { Users, Loader2, UserX, AlertTriangle, ShieldCheck, Edit2, Plus, Lock } from 'lucide-react';

interface Student {
  id: number;
  registerNumber: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  department?: string;
  password?: string;
}

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal toggle states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form Fields State
  const [name, setName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchStudents = async (isInitial = false) => {
    if (isInitial || students.length === 0) {
      setLoading(true);
    }
    try {
      const data = await apiCall('/api/admin/students');
      setStudents(data);
    } catch (err: any) {
      setError('Failed to fetch students database list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(true);
  }, []);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setName('');
    setRegisterNumber('');
    setEmail('');
    setDepartment('');
    setPassword('password'); // default password
    setStatus('ACTIVE');
    setShowAddForm(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setRegisterNumber(student.registerNumber);
    setEmail(student.email);
    setDepartment(student.department || '');
    setPassword(student.password || 'password');
    setStatus(student.status);
    setShowAddForm(false);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError('');

    try {
      await apiCall('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify({ name, registerNumber, email, department, password, status: 'ACTIVE' }),
      });
      setShowAddForm(false);
      fetchStudents();
    } catch (err: any) {
      setError(err.message || 'Failed to create student account');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSaveLoading(true);
    setError('');

    try {
      await apiCall(`/api/admin/students/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, registerNumber, email, department, password, status }),
      });
      setEditingStudent(null);
      fetchStudents();
    } catch (err: any) {
      setError(err.message || 'Failed to update student account details');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to delete student ${student.name} (${student.registerNumber})? This will permanently wipe all their scores, test sessions, and logs.`)) {
      return;
    }
    try {
      await apiCall(`/api/admin/students/${student.id}`, {
        method: 'DELETE',
      });
      fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to delete student account');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Student Control Deck</h1>
          <p className="text-sm text-gray-500">View and update college student accounts and execution parameters</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-xs font-bold transition-all shadow-md shadow-[#7c3aed]/10"
        >
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : students.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
          <Users className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="font-bold text-white text-lg">No student accounts</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Student credentials will appear here once they are registered by the administrator.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 bg-[#11131c]/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-500 uppercase font-bold tracking-wider">
                  <th className="p-4 pl-6">Register Number</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-400">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-white/5 transition-all">
                    <td className="p-4 pl-6 font-mono text-white font-semibold">{student.registerNumber}</td>
                    <td className="p-4 font-semibold text-white">{student.name}</td>
                    <td className="p-4 font-medium text-gray-300">{student.department || '-'}</td>
                    <td className="p-4 font-mono">{student.email}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        student.status === 'ACTIVE' 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {student.status === 'ACTIVE' ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                        {student.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(student)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-all select-none"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all select-none"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#11131c] border border-white/10 p-6 rounded-2xl shadow-2xl relative">
            <h2 className="text-lg font-bold text-white mb-4">Add Student Account</h2>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Student Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., John Doe"
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Register / Roll Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., STUD12345"
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Department</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Computer Science"
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g., student@college.edu"
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Sign In Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    required
                    placeholder="Enter login password"
                    className="w-full bg-[#0b0c10] border border-white/5 py-2.5 pl-10 pr-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-xs font-bold shadow-lg shadow-[#7c3aed]/10 disabled:opacity-50"
                >
                  {saveLoading ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#11131c] border border-white/10 p-6 rounded-2xl shadow-2xl relative">
            <h2 className="text-lg font-bold text-white mb-4">Edit Student Profile</h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Student Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Register Number</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Department</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Sign In Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    required
                    className="w-full bg-[#0b0c10] border border-white/5 py-2.5 pl-10 pr-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Access Status</label>
                <select
                  className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ACTIVE" className="bg-[#11131c]">ACTIVE (Enabled)</option>
                  <option value="SUSPENDED" className="bg-[#11131c]">SUSPENDED (Locked)</option>
                  <option value="INACTIVE" className="bg-[#11131c]">INACTIVE (Disabled)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-xs font-bold shadow-lg shadow-[#7c3aed]/10 disabled:opacity-50"
                >
                  {saveLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
