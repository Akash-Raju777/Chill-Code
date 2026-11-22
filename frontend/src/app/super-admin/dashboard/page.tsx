'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, formatISTDateTime } from '@/utils/api';
import { toast } from '@/store/toastStore';
import {
  Users,
  UserCheck,
  Code2,
  FileCheck2,
  Layers,
  Activity,
  Award,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart as PieIcon,
  Shield,
  GraduationCap,
  Trash2,
  X,
  Loader2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  activeStaff: number;
  totalQuestions: number;
  totalTests: number;
  deletedTests?: number;
  totalSubmissions: number;
  totalTestsConducted: number;
  fullyCompletedTests?: number;
  overallStudentPerformance: number;
  departmentPassPercentage: number;
}

interface DeletedTestItem {
  id: number;
  testName: string;
  subject: string;
  createdBy: string;
  originalCreatedAt: string | null;
  deletedAt: string;
  deletedBy: string;
}

interface CompletedTestItem {
  testId: number;
  testName: string;
  testCode?: string;
  subject: string;
  createdBy: string;
  createdAt: string;
  totalAssignedStudents: number;
  totalCompletedStudents: number;
  completionDateTime: string;
}

interface DashboardCharts {
  studentParticipation: {
    totalStudents: number;
    attended: number;
    notAttended: number;
    participationRate: number;
  };
  passFailStats: {
    passed: number;
    failed: number;
    totalEvaluated: number;
  };
  monthlyAssessments: Array<{
    month: string;
    testsCreated: number;
    testsConducted: number;
  }>;
  departmentPerformance: Array<{
    department: string;
    studentCount: number;
    averageScore: number;
    passRate: number;
  }>;
  staffActivity: Array<{
    name: string;
    questionsCount: number;
    testsCount: number;
    completedTasks: number;
  }>;
}

const PIE_COLORS = ['#10b981', '#ef4444', '#6366f1', '#f59e0b'];
const PARTICIPATION_COLORS = ['#3b82f6', '#475569'];

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Detail Modal States
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedTestsList, setDeletedTestsList] = useState<DeletedTestItem[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);

  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [completedTestsList, setCompletedTestsList] = useState<CompletedTestItem[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);

  const handleOpenDeletedModal = async () => {
    setShowDeletedModal(true);
    setLoadingDeleted(true);
    try {
      const data = await apiCall('/api/super-admin/dashboard/deleted-tests');
      setDeletedTestsList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Failed to load deleted tests registry');
    } finally {
      setLoadingDeleted(false);
    }
  };

  const handleOpenCompletedModal = async () => {
    setShowCompletedModal(true);
    setLoadingCompleted(true);
    try {
      const data = await apiCall('/api/super-admin/dashboard/completed-tests');
      setCompletedTestsList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Failed to load completed tests registry');
    } finally {
      setLoadingCompleted(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [statsData, chartsData] = await Promise.all([
        apiCall('/api/super-admin/dashboard/stats'),
        apiCall('/api/super-admin/dashboard/charts')
      ]);

      setStats(statsData as DashboardStats);
      setCharts(chartsData as DashboardCharts);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading || !mounted) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-72 bg-white/5 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Students',
      value: stats?.totalStudents ?? 0,
      icon: GraduationCap,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      subtitle: 'Enrolled candidates'
    },
    {
      title: 'Total Staff / Admins',
      value: stats?.totalStaff ?? 0,
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      subtitle: `${stats?.activeStaff ?? 0} active members`
    },
    {
      title: 'Active Staff',
      value: stats?.activeStaff ?? 0,
      icon: UserCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      subtitle: 'Currently operational'
    },
    {
      title: 'Coding Questions',
      value: stats?.totalQuestions ?? 0,
      icon: Code2,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      subtitle: 'In question bank'
    },
    {
      title: 'DELETED TESTS',
      value: stats?.deletedTests ?? 0,
      icon: Trash2,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      subtitle: 'Removed from Admin panel',
      action: handleOpenDeletedModal
    },
    {
      title: 'FULLY COMPLETED TESTS',
      value: stats?.fullyCompletedTests ?? 0,
      icon: FileCheck2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      subtitle: '100% assigned students done',
      action: handleOpenCompletedModal
    },
    {
      title: 'Total Submissions',
      value: stats?.totalSubmissions ?? 0,
      icon: Activity,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/20',
      subtitle: 'Code runs executed'
    },
    {
      title: 'Avg Performance',
      value: `${stats?.overallStudentPerformance ?? 0}%`,
      icon: Award,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 border-yellow-500/20',
      subtitle: `Dept Pass: ${stats?.departmentPassPercentage ?? 0}%`
    }
  ];

  const participationData = [
    { name: 'Attended', value: charts?.studentParticipation.attended ?? 0 },
    { name: 'Not Attended', value: charts?.studentParticipation.notAttended ?? 0 }
  ];

  const passFailData = [
    { name: 'Passed', value: charts?.passFailStats.passed ?? 0 },
    { name: 'Failed', value: charts?.passFailStats.failed ?? 0 }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Super Admin Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Real-time analytics, staff productivity, and student performance oversight.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-[#12141c] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all shadow-lg flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {card.title}
                  </p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5">
                    {card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl border ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                <span>{card.subtitle}</span>
                {card.action && (
                  <button
                    onClick={card.action}
                    className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 hover:underline"
                  >
                    View Details →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section 1: Monthly Assessment Trend & Department Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Activity Area Chart */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Monthly Assessment Activity
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Tests created vs. tests completed by students over the last 6 months
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.monthlyAssessments || []}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorConducted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#181b26', borderColor: '#374151', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" dataKey="testsCreated" name="Tests Created" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorCreated)" />
                <Area type="monotone" dataKey="testsConducted" name="Tests Conducted" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorConducted)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Coding Performance Bar Chart */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Department Coding Performance
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Average assessment score and candidate count by academic branch
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.departmentPerformance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="department" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#181b26', borderColor: '#374151', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="averageScore" name="Avg Score (%)" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="studentCount" name="Enrolled Students" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Section 2: Student Participation & Pass/Fail Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Participation Pie */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
            <PieIcon className="w-4 h-4 text-cyan-400" />
            Student Participation
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Rate: {charts?.studentParticipation.participationRate ?? 0}% completed tests
          </p>
          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={participationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {participationData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PARTICIPATION_COLORS[index % PARTICIPATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#181b26', borderColor: '#374151', borderRadius: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-center">
            <div>
              <p className="text-xs text-gray-400">Attended</p>
              <p className="text-base font-bold text-cyan-400">{charts?.studentParticipation.attended ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Not Attended</p>
              <p className="text-base font-bold text-gray-400">{charts?.studentParticipation.notAttended ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Pass / Fail Statistics Pie */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-emerald-400" />
            Pass / Fail Statistics
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Total Evaluated: {charts?.passFailStats.totalEvaluated ?? 0} assessments
          </p>
          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={passFailData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {passFailData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#181b26', borderColor: '#374151', borderRadius: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-center">
            <div>
              <p className="text-xs text-gray-400">Passed (&ge; 40%)</p>
              <p className="text-base font-bold text-emerald-400">{charts?.passFailStats.passed ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Failed (&lt; 40%)</p>
              <p className="text-base font-bold text-red-400">{charts?.passFailStats.failed ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Staff Contribution Comparison Bar Chart */}
        <div className="bg-[#12141c] border border-white/5 rounded-2xl p-6 shadow-lg">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-400" />
            Staff Activity Contribution
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Questions, tests, and completed work orders by staff
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.staffActivity || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#181b26', borderColor: '#374151', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Bar dataKey="testsCount" name="Tests" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="questionsCount" name="Questions" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                <Bar dataKey="completedTasks" name="Tasks" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Deleted Tests Registry Modal */}
      {showDeletedModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#12141c] border border-white/10 p-6 rounded-2xl shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Deleted Tests Registry</h2>
                  <p className="text-xs text-gray-400">Audit registry of tests deleted from the Admin panel</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeletedModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {loadingDeleted ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <p className="text-xs text-gray-400">Fetching deleted test logs...</p>
                </div>
              ) : deletedTestsList.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-500">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">No Deleted Tests Recorded</h4>
                  <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    Zero tests have been recorded as deleted. Genuine deletion events performed via the Admin panel will be tracked and displayed here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3 px-3">Test Name</th>
                        <th className="pb-3 px-3">Subject</th>
                        <th className="pb-3 px-3">Created By</th>
                        <th className="pb-3 px-3">Original Created Date & Time</th>
                        <th className="pb-3 px-3">Deleted Date & Time</th>
                        <th className="pb-3 px-3">Deleted By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {deletedTestsList.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">{item.testName}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              {item.subject}
                            </span>
                          </td>
                          <td className="py-3 px-3">{item.createdBy}</td>
                          <td className="py-3 px-3 text-gray-400 font-mono text-[11px]">
                            {item.originalCreatedAt ? formatISTDateTime(item.originalCreatedAt) : 'N/A'}
                          </td>
                          <td className="py-3 px-3 text-rose-400 font-mono text-[11px]">
                            {formatISTDateTime(item.deletedAt)}
                          </td>
                          <td className="py-3 px-3 font-medium text-white">{item.deletedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowDeletedModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white transition-colors"
              >
                Close Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fully Completed Tests Registry Modal */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-[#12141c] border border-white/10 p-6 rounded-2xl shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Fully Completed Tests Registry</h2>
                  <p className="text-xs text-gray-400">Tests where 100% of assigned students have completed their assessment</p>
                </div>
              </div>
              <button
                onClick={() => setShowCompletedModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {loadingCompleted ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <p className="text-xs text-gray-400">Loading fully completed tests...</p>
                </div>
              ) : completedTestsList.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-500">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">No Fully Completed Tests Yet</h4>
                  <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    A test appears in this registry only when all assigned/eligible students have submitted their assessment. Tests with pending or in-progress students are excluded.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3 px-3">Test Name</th>
                        <th className="pb-3 px-3">Subject</th>
                        <th className="pb-3 px-3">Created By</th>
                        <th className="pb-3 px-3">Created Date & Time</th>
                        <th className="pb-3 px-3 text-center">Assigned Students</th>
                        <th className="pb-3 px-3 text-center">Completed Students</th>
                        <th className="pb-3 px-3">Completion Date & Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {completedTestsList.map((item) => (
                        <tr key={item.testId} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{item.testName}</div>
                            {item.testCode && (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {item.testCode}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              {item.subject}
                            </span>
                          </td>
                          <td className="py-3 px-3">{item.createdBy}</td>
                          <td className="py-3 px-3 text-gray-400 font-mono text-[11px]">
                            {formatISTDateTime(item.createdAt)}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-gray-300">{item.totalAssignedStudents}</td>
                          <td className="py-3 px-3 text-center font-bold text-emerald-400">{item.totalCompletedStudents}</td>
                          <td className="py-3 px-3 text-emerald-400 font-mono text-[11px]">
                            {formatISTDateTime(item.completionDateTime)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowCompletedModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 hover:text-white transition-colors"
              >
                Close Registry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
