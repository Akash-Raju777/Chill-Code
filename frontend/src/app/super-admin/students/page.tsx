'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import {
  GraduationCap,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Award,
  Eye,
  RefreshCw,
  X,
  Clock,
  BookOpen,
  Code2,
  Calendar,
  Phone,
  Mail,
  User
} from 'lucide-react';

interface StudentItem {
  id: number;
  name: string;
  registerNumber: string;
  username: string;
  email: string;
  department: string;
  phone: string | null;
  status: string;
  testsAttended: number;
  testsNotAttended: number;
  totalMarks: number;
  averagePerformance: number;
  badgeCount: number;
  dateJoined: string;
}

interface StudentProfile {
  id: number;
  name: string;
  registerNumber: string;
  username: string;
  email: string;
  phone: string | null;
  department: string;
  status: string;
  dateJoined: string;
  testsAttended: number;
  testsTotal: number;
  totalMarks: number;
  averagePerformance: number;
  testHistory: Array<{
    testId: number;
    testName: string;
    subject: string;
    score: number;
    maxMarks: number;
    status: string;
    warningsCount: number;
    startedAt: string | null;
    submittedAt: string | null;
  }>;
  submissionHistory: Array<{
    id: number;
    questionTitle: string;
    language: string;
    status: string;
    overallResult: string;
    score: number;
    executionTime: number;
    createdAt: string;
  }>;
  badges: Array<{
    id: number;
    name: string;
    description: string;
    icon: string;
    earnedAt: string;
  }>;
}

export default function StudentManagementPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Selected student for Profile Modal
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tests' | 'submissions' | 'badges'>('tests');

  const fetchStudents = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await apiCall('/api/super-admin/students');
      setStudents(data as StudentItem[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const openProfile = async (id: number) => {
    setSelectedStudentId(id);
    setProfileLoading(true);
    setProfile(null);
    setActiveTab('tests');
    try {
      const data = await apiCall(`/api/super-admin/students/${id}`);
      setProfile(data as StudentProfile);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load student profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleStatusToggle = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiCall(`/api/super-admin/students/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Student status changed to ${newStatus}`);
      setStudents(prev =>
        prev.map(s => (s.id === id ? { ...s, status: newStatus } : s))
      );
      if (profile && profile.id === id) {
        setProfile({ ...profile, status: newStatus });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update student status');
    }
  };

  const departments = ['ALL', ...Array.from(new Set(students.map(s => s.department || 'General')))];

  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.registerNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());

    const matchesDept = deptFilter === 'ALL' || (s.department || 'General') === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Directory
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Centralized Student Management
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Full oversight of all student accounts, assessment performance, and active security status.
          </p>
        </div>
        <button
          onClick={() => fetchStudents(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#12141c] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, roll no, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
            >
              {departments.map(d => (
                <option key={d} value={d} className="bg-[#12141c] text-white">
                  Dept: {d}
                </option>
              ))}
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="ALL" className="bg-[#12141c] text-white">Status: All</option>
            <option value="ACTIVE" className="bg-[#12141c] text-white">ACTIVE</option>
            <option value="INACTIVE" className="bg-[#12141c] text-white">INACTIVE</option>
            <option value="SUSPENDED" className="bg-[#12141c] text-white">SUSPENDED</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-[#12141c] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
            <p>Loading candidate directory...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-base font-semibold text-gray-400">No students found matching your criteria</p>
            <p className="text-xs text-gray-500 mt-1">Try refining your search keyword or department filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Roll Number</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4 text-center">Attended</th>
                  <th className="py-3.5 px-4 text-center">Avg Score</th>
                  <th className="py-3.5 px-4 text-center">Badges</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-gray-300">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-white">{s.name}</div>
                        <div className="text-[11px] text-gray-400">{s.email}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                      {s.registerNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300 text-xs">
                        {s.department || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium">
                      <span className="text-emerald-400">{s.testsAttended}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-white">
                      {s.averagePerformance}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                        <Award className="w-3.5 h-3.5" />
                        {s.badgeCount}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : s.status === 'SUSPENDED'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openProfile(s.id)}
                          className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs font-semibold text-cyan-400 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Profile
                        </button>
                        <button
                          onClick={() => handleStatusToggle(s.id, s.status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            s.status === 'ACTIVE'
                              ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Profile Modal */}
      {selectedStudentId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#12141c] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {profile ? profile.name : 'Loading Profile...'}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    Roll No: {profile?.registerNumber} &bull; Dept: {profile?.department}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudentId(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {profileLoading || !profile ? (
              <div className="p-12 text-center text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-2" />
                <p>Loading candidate details & assessment history...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Highlights Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 uppercase font-semibold">Status</p>
                    <p className={`text-sm font-bold mt-1 ${profile.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {profile.status}
                    </p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 uppercase font-semibold">Tests Attended</p>
                    <p className="text-sm font-bold text-cyan-400 mt-1">
                      {profile.testsAttended}
                    </p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 uppercase font-semibold">Total Marks</p>
                    <p className="text-sm font-bold text-purple-400 mt-1">{profile.totalMarks}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[11px] text-gray-400 uppercase font-semibold">Avg Score</p>
                    <p className="text-sm font-bold text-yellow-400 mt-1">{profile.averagePerformance}%</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 gap-2">
                  <button
                    onClick={() => setActiveTab('tests')}
                    className={`pb-3 px-4 text-xs font-semibold transition-all border-b-2 ${
                      activeTab === 'tests'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    Test History ({profile.testHistory.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('submissions')}
                    className={`pb-3 px-4 text-xs font-semibold transition-all border-b-2 ${
                      activeTab === 'submissions'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    Submissions ({profile.submissionHistory.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('badges')}
                    className={`pb-3 px-4 text-xs font-semibold transition-all border-b-2 ${
                      activeTab === 'badges'
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    Achievements & Badges ({profile.badges.length})
                  </button>
                </div>

                {/* Tab Content: Tests */}
                {activeTab === 'tests' && (
                  <div className="space-y-3">
                    {profile.testHistory.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">No tests recorded for this student.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-gray-400 uppercase text-[10px]">
                              <th className="py-2 px-3">Test</th>
                              <th className="py-2 px-3">Subject</th>
                              <th className="py-2 px-3 text-center">Score</th>
                              <th className="py-2 px-3 text-center">Warnings</th>
                              <th className="py-2 px-3 text-center">Status</th>
                              <th className="py-2 px-3 text-right">Submitted</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-gray-300">
                            {profile.testHistory.map((th, idx) => (
                              <tr key={idx} className="hover:bg-white/[0.02]">
                                <td className="py-2 px-3 font-semibold text-white">{th.testName}</td>
                                <td className="py-2 px-3 text-gray-400">{th.subject}</td>
                                <td className="py-2 px-3 text-center font-bold text-emerald-400">
                                  {th.score} / {th.maxMarks}
                                </td>
                                <td className="py-2 px-3 text-center text-amber-400 font-medium">
                                  {th.warningsCount}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 border border-white/10">
                                    {th.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-gray-400 text-[11px]">
                                  {th.submittedAt ? new Date(th.submittedAt).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Content: Submissions */}
                {activeTab === 'submissions' && (
                  <div className="space-y-3">
                    {profile.submissionHistory.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">No submissions recorded for this student.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-gray-400 uppercase text-[10px]">
                              <th className="py-2 px-3">Problem</th>
                              <th className="py-2 px-3">Language</th>
                              <th className="py-2 px-3 text-center">Result</th>
                              <th className="py-2 px-3 text-center">Run Time</th>
                              <th className="py-2 px-3 text-center">Score</th>
                              <th className="py-2 px-3 text-right">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-gray-300">
                            {profile.submissionHistory.map((sh) => (
                              <tr key={sh.id} className="hover:bg-white/[0.02]">
                                <td className="py-2 px-3 font-semibold text-white">{sh.questionTitle}</td>
                                <td className="py-2 px-3 font-mono text-cyan-400">{sh.language}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    sh.status === 'ACCEPTED' || sh.overallResult === 'PASS'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}>
                                    {sh.status || sh.overallResult}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center text-gray-400 font-mono">
                                  {sh.executionTime ? `${sh.executionTime} ms` : '-'}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-white">
                                  {sh.score}
                                </td>
                                <td className="py-2 px-3 text-right text-gray-400 text-[11px]">
                                  {new Date(sh.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Content: Badges */}
                {activeTab === 'badges' && (
                  <div>
                    {profile.badges.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">No achievements unlocked yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {profile.badges.map((b) => (
                          <div key={b.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              <Award className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{b.name}</p>
                              <p className="text-xs text-gray-400">{b.description}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Earned on {new Date(b.earnedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
