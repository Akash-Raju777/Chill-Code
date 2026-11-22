'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiCall, formatISTDateTime } from '@/utils/api';
import { toast } from '@/store/toastStore';
import {
  Megaphone,
  Send,
  Users,
  Shield,
  Search,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Eye,
  X,
  CheckSquare,
  Square,
  History,
  Mail,
  UserCheck
} from 'lucide-react';

interface SentInstruction {
  id: number;
  title: string;
  message: string;
  targetRole: 'STUDENT' | 'ADMIN';
  recipientSummary: string;
  senderName: string;
  sentAt: string;
  totalRecipients: number;
  readCount: number;
}

interface StudentOption {
  id: number;
  name: string;
  registerNumber: string;
  department?: string;
}

interface StaffOption {
  id: number;
  name: string;
  email: string;
  staffId?: string;
  department?: string;
}

export default function SuperAdminInstructionsPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');

  // Form State
  const [targetRole, setTargetRole] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [recipientType, setRecipientType] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Recipient Candidate Lists
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // History State
  const [history, setHistory] = useState<SentInstruction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeViewNotice, setActiveViewNotice] = useState<SentInstruction | null>(null);

  // Load recipient candidate lists on demand
  useEffect(() => {
    const fetchRecipients = async () => {
      setLoadingRecipients(true);
      try {
        if (targetRole === 'STUDENT' && students.length === 0) {
          const data = await apiCall('/api/super-admin/students');
          if (Array.isArray(data)) setStudents(data);
        } else if (targetRole === 'ADMIN' && staffList.length === 0) {
          const data = await apiCall('/api/super-admin/staff');
          if (Array.isArray(data)) setStaffList(data);
        }
      } catch (err: any) {
        console.error('Failed to load candidate list', err);
      } finally {
        setLoadingRecipients(false);
      }
    };

    fetchRecipients();
  }, [targetRole]);

  // Load History
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await apiCall('/api/super-admin/instructions');
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load instruction history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // Reset selected recipients when role changes
  const handleRoleChange = (role: 'STUDENT' | 'ADMIN') => {
    setTargetRole(role);
    setSelectedRecipientIds([]);
    setRecipientSearch('');
  };

  // Toggle recipient selection
  const toggleRecipient = (id: number) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select / Deselect all filtered recipients
  const handleSelectAllFiltered = () => {
    const ids = filteredCandidates.map((c) => c.id);
    const allSelected = ids.every((id) => selectedRecipientIds.includes(id));
    if (allSelected) {
      setSelectedRecipientIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedRecipientIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  // Filtered candidate list based on search
  const filteredCandidates = useMemo(() => {
    const q = recipientSearch.toLowerCase().trim();
    if (targetRole === 'STUDENT') {
      if (!q) return students;
      return students.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.registerNumber && s.registerNumber.toLowerCase().includes(q)) ||
          (s.department && s.department.toLowerCase().includes(q))
      );
    } else {
      if (!q) return staffList;
      return staffList.filter(
        (st) =>
          st.name.toLowerCase().includes(q) ||
          (st.email && st.email.toLowerCase().includes(q)) ||
          (st.staffId && st.staffId.toLowerCase().includes(q))
      );
    }
  }, [targetRole, students, staffList, recipientSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required.');
      return;
    }

    if (recipientType === 'SPECIFIC' && selectedRecipientIds.length === 0) {
      toast.error('Please select at least one recipient.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        targetRole,
        recipientType,
        recipientIds: recipientType === 'SPECIFIC' ? selectedRecipientIds : [],
        title: title.trim(),
        message: message.trim(),
      };

      await apiCall('/api/super-admin/instructions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(
        `Instruction broadcasted successfully to ${
          recipientType === 'ALL'
            ? `all ${targetRole.toLowerCase()}s`
            : `${selectedRecipientIds.length} recipient(s)`
        }!`
      );

      setTitle('');
      setMessage('');
      setSelectedRecipientIds([]);
      setActiveTab('history');
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch instruction.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Department Broadcast Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Instructions & Directives
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Dispatch urgent notices, examination protocols, and academic directives to students or faculty.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#12141c] border border-white/5 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'send'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Dispatch Notice
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Sent History ({history.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Dispatch Notice */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 1. Target Audience Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    1. Select Target Audience
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleRoleChange('STUDENT')}
                      className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        targetRole === 'STUDENT'
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-md shadow-cyan-500/10'
                          : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Students Portal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRoleChange('ADMIN')}
                      className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        targetRole === 'ADMIN'
                          ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 shadow-md shadow-purple-500/10'
                          : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <span>Staff & Admins</span>
                    </button>
                  </div>
                </div>

                {/* 2. Recipient Scope Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    2. Distribution Scope
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRecipientType('ALL')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        recipientType === 'ALL'
                          ? 'bg-white/10 border-white/30 text-white shadow'
                          : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>All {targetRole === 'STUDENT' ? 'Students' : 'Faculty'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientType('SPECIFIC')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        recipientType === 'SPECIFIC'
                          ? 'bg-white/10 border-white/30 text-white shadow'
                          : 'bg-white/[0.02] border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Specific Recipients {selectedRecipientIds.length > 0 && `(${selectedRecipientIds.length})`}</span>
                    </button>
                  </div>
                </div>

                {/* Specific Recipient Picker (if selected) */}
                {recipientType === 'SPECIFIC' && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder={
                            targetRole === 'STUDENT'
                              ? 'Search by name, roll no, or department...'
                              : 'Search by staff name, ID, or email...'
                          }
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-semibold text-gray-300 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Toggle All ({filteredCandidates.length})
                      </button>
                    </div>

                    {/* Candidate List */}
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-white/[0.03]">
                      {loadingRecipients ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto text-purple-400 mb-1" />
                          Loading recipients...
                        </div>
                      ) : filteredCandidates.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-500">
                          No recipients match your search.
                        </div>
                      ) : (
                        filteredCandidates.map((item: any) => {
                          const isSelected = selectedRecipientIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleRecipient(item.id)}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? 'bg-purple-500/10 text-white' : 'hover:bg-white/[0.02] text-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-purple-400 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-600 shrink-0" />
                                )}
                                <div>
                                  <div className="text-xs font-semibold text-white">{item.name}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {targetRole === 'STUDENT'
                                      ? `Roll: ${item.registerNumber || 'N/A'} • ${item.department || 'General'}`
                                      : `${item.email || item.staffId || 'Staff Member'}`}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20">
                                  Selected
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Title */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    3. Instruction Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Mandatory Coding Assessment Instructions or Proctoring Guidelines"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                {/* 4. Message Body */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    4. Instruction Details / Message Body
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Write complete instructions, exam rules, deadlines, or warnings here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 py-3 px-4 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors resize-none leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[11px] text-gray-500 mt-1.5 px-1">
                    <span>Target audience will receive this instantly upon login.</span>
                    <span>{message.length} characters</span>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold tracking-wider uppercase rounded-xl transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Broadcasting Notice...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          Broadcast To{' '}
                          {recipientType === 'ALL'
                            ? `All ${targetRole === 'STUDENT' ? 'Students' : 'Admins'}`
                            : `${selectedRecipientIds.length} Recipient(s)`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Side Info & Tips (1 col) */}
          <div className="space-y-4">
            <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 text-purple-400 font-bold text-sm">
                <Megaphone className="w-4 h-4" />
                <span>Notice Guidelines</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Instructions broadcasted by Super Admin are delivered directly into the recipient portal notifications area:
              </p>
              <ul className="text-xs text-gray-400 space-y-2.5 list-disc pl-4">
                <li>
                  <strong className="text-white">Role-Based Isolation:</strong> Students cannot view admin instructions, and admins cannot view student instructions.
                </li>
                <li>
                  <strong className="text-white">Individual Selection:</strong> You can target specific students by roll number or staff by email.
                </li>
                <li>
                  <strong className="text-white">Read Tracking:</strong> You can track how many recipients have marked the notice as read in the Sent History tab.
                </li>
              </ul>
            </div>

            <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 shadow-xl space-y-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Target Portals
              </span>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-300">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5" />
                    Student Notifications Portal
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Displayed under <code className="text-cyan-400">/student/notifications</code>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-purple-300">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <Shield className="w-3.5 h-3.5" />
                    Admin Directives Inbox
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Displayed under <code className="text-purple-400">/admin/instructions</code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Sent History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#12141c] border border-white/5 rounded-2xl p-4">
            <span className="text-xs text-gray-400">
              Showing total <span className="text-white font-bold">{history.length}</span> broadcast records
            </span>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-purple-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-16 text-center text-gray-400 space-y-3 bg-[#12141c] border border-white/5 rounded-2xl">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400" />
              <p className="text-sm">Loading sent history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-16 text-center text-gray-500 bg-[#12141c] border border-white/5 rounded-2xl space-y-3">
              <History className="w-12 h-12 mx-auto text-gray-600 opacity-40" />
              <p className="text-base font-semibold text-gray-400">No instructions broadcasted yet</p>
              <p className="text-xs text-gray-500">Dispatch your first instruction using the Dispatch Notice tab.</p>
            </div>
          ) : (
            <div className="bg-[#12141c] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Notice Title</th>
                      <th className="py-3.5 px-4">Audience</th>
                      <th className="py-3.5 px-4">Recipients</th>
                      <th className="py-3.5 px-4">Dispatched At</th>
                      <th className="py-3.5 px-4 text-center">Read Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white max-w-xs truncate">{h.title}</div>
                          <div className="text-[11px] text-gray-500 truncate max-w-xs mt-0.5">{h.message}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              h.targetRole === 'STUDENT'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}
                          >
                            {h.targetRole}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-400 max-w-xs truncate">
                          {h.recipientSummary}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-400 whitespace-nowrap">
                          {formatISTDateTime(h.sentAt)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-gray-300">
                            {h.readCount} / {h.totalRecipients} Read
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setActiveViewNotice(h)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-purple-400" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Notice Modal */}
      {activeViewNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    activeViewNotice.targetRole === 'STUDENT'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}
                >
                  {activeViewNotice.targetRole} NOTICE
                </span>
                <h3 className="text-lg font-bold text-white mt-1.5">{activeViewNotice.title}</h3>
              </div>
              <button
                onClick={() => setActiveViewNotice(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Dispatched By:</span>
                <span className="text-white font-medium">{activeViewNotice.senderName}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Recipients:</span>
                <span className="text-white font-medium max-w-xs text-right truncate">
                  {activeViewNotice.recipientSummary}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Dispatched At:</span>
                <span className="text-white font-medium">{formatISTDateTime(activeViewNotice.sentAt)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Read Progress:</span>
                <span className="text-emerald-400 font-bold">
                  {activeViewNotice.readCount} of {activeViewNotice.totalRecipients} read
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase text-gray-400">Notice Content</label>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-xs text-gray-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {activeViewNotice.message}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveViewNotice(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
