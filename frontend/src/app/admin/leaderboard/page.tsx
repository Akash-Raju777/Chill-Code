'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  fetchOverallLeaderboard, 
  fetchSubjectLeaderboard, 
  fetchAdminAnalyticsOverview,
  apiCall,
  formatISTDate
} from '../../../utils/api';
import { 
  Trophy, 
  Download, 
  Search, 
  Filter, 
  Award, 
  BookOpen, 
  Loader2, 
  User, 
  Eye, 
  X,
  FileSpreadsheet,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Activity,
  Clock,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export default function AdminLeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'OVERALL' | 'SUBJECT'>('OVERALL');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [studentAchievements, setStudentAchievements] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab, selectedSubjectId, departmentFilter]);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(() => {
      loadInitialData(false);
      loadLeaderboard(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, selectedSubjectId, departmentFilter]);

  const loadInitialData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const subjData = await apiCall('/api/subjects');
      setSubjects(subjData || []);
      if (subjData && subjData.length > 0) setSelectedSubjectId(subjData[0].id);

      const stats = await fetchAdminAnalyticsOverview();
      setAnalyticsStats(stats);
    } catch (err: any) {
      console.error(err);
      if (showLoading) setError(err.message || 'Failed to load leaderboard filters/stats');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadLeaderboard = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (activeTab === 'OVERALL') {
        const data = await fetchOverallLeaderboard('ALL', departmentFilter);
        setLeaderboardData(data || []);
      } else if (selectedSubjectId) {
        const data = await fetchSubjectLeaderboard(Number(selectedSubjectId));
        setLeaderboardData(data || []);
      }
    } catch (err: any) {
      if (showLoading) setError(err.message || 'Failed to load leaderboard rankings');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    try {
      // In this version we just export CSV since backend returns CSV directly.
      const res = await fetch(`/api/admin/leaderboard/export?departmentFilter=${departmentFilter}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('chillcode_token')}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chillcode_leaderboard.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert('Failed to export leaderboard.');
    }
  };

  const handleViewDetails = async (student: any) => {
    setSelectedStudent(student);
    setModalLoading(true);
    try {
      const data = await apiCall('/api/admin/achievements');
      const filtered = (data || []).filter((a: any) => a.studentId === student.studentId);
      setStudentAchievements(filtered);
    } catch (err: any) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredLeaderboard = useMemo(() => {
    return leaderboardData.filter((item: any) => {
      let matchesSearch = true;
      let matchesStatus = true;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        matchesSearch = (
          (item.studentName && item.studentName.toLowerCase().includes(q)) ||
          (item.registerNumber && item.registerNumber.toLowerCase().includes(q)) ||
          (item.department && item.department.toLowerCase().includes(q))
        );
      }
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PASS' && item.passPercentage < 100) matchesStatus = false;
        if (statusFilter === 'FAIL' && item.passPercentage === 100 && item.testsAttempted > 0) matchesStatus = false;
        if (statusFilter === 'NOT_ATTENDED' && item.testsAttempted > 0) matchesStatus = false;
      }
      return matchesSearch && matchesStatus;
    });
  }, [leaderboardData, searchQuery, statusFilter]);

  if (loading && !leaderboardData.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0c10]">
        <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Loading advanced analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-4 lg:p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-emerald-900/20 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-400" />
            Advanced Leaderboard Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">Deep analytics, performance charts, and global rankings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('csv')} className="flex items-center gap-2 px-4 py-2 bg-[#1f2937] hover:bg-[#374151] text-white rounded-xl border border-white/10 transition-colors text-sm font-bold">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> CSV
          </button>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      {analyticsStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <StatCard icon={<Users />} title="Total Students" value={analyticsStats.totalStudents} color="blue" />
          <StatCard icon={<BookOpen />} title="Total Tests" value={analyticsStats.totalTests} color="purple" />
          <StatCard icon={<Activity />} title="Total Attempts" value={analyticsStats.totalAttempts} color="indigo" />
          <StatCard icon={<CheckCircle />} title="Passed" value={analyticsStats.totalPassed} color="emerald" />
          <StatCard icon={<XCircle />} title="Failed" value={analyticsStats.totalFailed} color="red" />
          <StatCard icon={<AlertTriangle />} title="Not Attended" value={analyticsStats.totalNotAttended} color="orange" />
          <StatCard icon={<TrendingUp />} title="Pass Rate" value={`${analyticsStats.overallPassRate}%`} color="emerald" />
          <StatCard icon={<TrendingUp />} title="Fail Rate" value={`${analyticsStats.overallFailRate}%`} color="red" />
          <StatCard icon={<Award />} title="Badges Awarded" value={analyticsStats.totalBadgesAwarded} color="amber" />
          <StatCard icon={<User />} title="Active Today" value={analyticsStats.activeStudentsToday} color="cyan" />
        </div>
      )}

      {/* Leaderboard Controls */}
      <div className="bg-[#11131c] border border-white/10 p-4 rounded-2xl flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex bg-[#0b0c10] p-1 rounded-xl border border-white/5 w-full lg:w-auto">
          <button onClick={() => setActiveTab('OVERALL')} className={`flex-1 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'OVERALL' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}>Overall</button>
          <button onClick={() => setActiveTab('SUBJECT')} className={`flex-1 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'SUBJECT' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'}`}>Subject-Wise</button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {activeTab === 'SUBJECT' && (
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(Number(e.target.value))} className="bg-[#0b0c10] border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500 transition-colors">
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="bg-[#0b0c10] border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-amber-500 transition-colors">
            <option value="ALL">All Depts</option>
            <option value="CSE">CSE</option>
            <option value="IT">IT</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="MECH">MECH</option>
          </select>
          <div className="relative flex-1 lg:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#0b0c10] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-amber-500 transition-colors" />
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#11131c] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#0b0c10]/50 border-b border-white/10 text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-4 rounded-tl-2xl">Rank</th>
                <th className="px-6 py-4">Student Info</th>
                <th className="px-6 py-4">Total Score</th>
                <th className="px-6 py-4 rounded-tr-2xl">Badges Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLeaderboard.map((item, idx) => {
                const isGold = item.rankPosition === 1;
                const isSilver = item.rankPosition === 2;
                const isBronze = item.rankPosition === 3;
                
                return (
                  <tr key={item.studentId} className={`transition-colors hover:bg-white/5 ${isGold ? 'bg-amber-900/10' : isSilver ? 'bg-slate-300/5' : isBronze ? 'bg-orange-900/10' : ''}`}>
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${isGold ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : isSilver ? 'bg-slate-300 text-slate-900 shadow-[0_0_15px_rgba(203,213,225,0.5)]' : isBronze ? 'bg-orange-400 text-slate-900' : 'bg-white/10 text-gray-300'}`}>
                        {item.rankPosition}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-base">{item.studentName}</span>
                        <span className="text-xs text-gray-500">{item.registerNumber} • {item.department}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-emerald-400">{item.totalMarks || item.totalScore || 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                        <Award className="w-4 h-4" />
                        {item.totalBadges || 0}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">No students match your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#11131c] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-indigo-900/20 to-[#11131c]">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/20">
                  {selectedStudent.studentName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedStudent.studentName}</h2>
                  <p className="text-sm text-gray-400 mt-1">{selectedStudent.registerNumber} • {selectedStudent.department} • Rank #{selectedStudent.rankPosition}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#0b0c10] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Total Score</div>
                  <div className="text-2xl font-black text-emerald-400">{selectedStudent.totalMarks}</div>
                </div>
                <div className="bg-[#0b0c10] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Pass Rate</div>
                  <div className="text-2xl font-black text-amber-400">{selectedStudent.passPercentage?.toFixed(1) || '0.0'}%</div>
                </div>
                <div className="bg-[#0b0c10] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Tests Passed</div>
                  <div className="text-2xl font-black text-blue-400">{selectedStudent.totalTestsPassed}</div>
                </div>
                <div className="bg-[#0b0c10] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Avg Time</div>
                  <div className="text-2xl font-black text-purple-400">{(selectedStudent.avgTimeSec / 60).toFixed(1)}m</div>
                </div>
              </div>

              {/* Achievements Section */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Earned Badges & Achievements
                </h3>
                {modalLoading ? (
                  <div className="flex items-center justify-center p-8 bg-[#0b0c10] rounded-xl border border-white/5">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                ) : studentAchievements.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {studentAchievements.map((ach: any) => (
                      <div key={ach.id} className="flex items-center gap-3 bg-[#0b0c10] border border-white/5 p-3 rounded-xl hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{ach.badgeName || 'Achievement'}</div>
                          <div className="text-[10px] text-gray-500">{formatISTDate(ach.awardedAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-[#0b0c10] border border-white/5 rounded-xl text-center text-gray-500 italic">
                    No badges earned yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: string | number, color: 'blue' | 'purple' | 'emerald' | 'red' | 'amber' | 'cyan' | 'orange' | 'indigo' }) {
  const colorMap = {
    blue: 'text-blue-400 from-blue-500/20 to-blue-500/5',
    purple: 'text-purple-400 from-purple-500/20 to-purple-500/5',
    emerald: 'text-emerald-400 from-emerald-500/20 to-emerald-500/5',
    red: 'text-red-400 from-red-500/20 to-red-500/5',
    amber: 'text-amber-400 from-amber-500/20 to-amber-500/5',
    cyan: 'text-cyan-400 from-cyan-500/20 to-cyan-500/5',
    orange: 'text-orange-400 from-orange-500/20 to-orange-500/5',
    indigo: 'text-indigo-400 from-indigo-500/20 to-indigo-500/5',
  };

  const bgGradient = colorMap[color].split(' ').slice(1).join(' ');
  const textColor = colorMap[color].split(' ')[0];

  return (
    <div className={`bg-gradient-to-br ${bgGradient} border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${textColor}`}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-400 font-medium mb-1">{title}</div>
        <div className={`text-2xl font-black ${textColor}`}>{value}</div>
      </div>
    </div>
  );
}
