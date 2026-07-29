'use client';

import React, { useEffect, useState } from 'react';
import { 
  fetchOverallLeaderboard, 
  fetchSubjectLeaderboard, 
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
  FileSpreadsheet
} from 'lucide-react';

interface Subject {
  id: number;
  name: string;
}

export default function AdminLeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'OVERALL' | 'SUBJECT'>('OVERALL');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admin Filters
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Student achievements inspection modal
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentAchievements, setStudentAchievements] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const subjData = await apiCall('/api/subjects');
      setSubjects(subjData || []);
      if (subjData && subjData.length > 0) {
        setSelectedSubjectId(subjData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard filters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      if (activeTab === 'OVERALL') {
        const data = await fetchOverallLeaderboard('ALL', departmentFilter);
        setLeaderboardData(data || []);
      } else if (selectedSubjectId) {
        const data = await fetchSubjectLeaderboard(Number(selectedSubjectId));
        setLeaderboardData(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab, selectedSubjectId, departmentFilter]);

  const handleExportCsv = async () => {
    try {
      const res = await fetch(`/api/admin/leaderboard/export?departmentFilter=${departmentFilter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('chillcode_token')}`
        }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chillcode_leaderboard.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert('Failed to export leaderboard CSV.');
    }
  };

  const handleViewAchievements = async (student: any) => {
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

  const filteredLeaderboard = leaderboardData.filter((item: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.studentName && item.studentName.toLowerCase().includes(q)) ||
      (item.registerNumber && item.registerNumber.toLowerCase().includes(q)) ||
      (item.department && item.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900/30 via-slate-900 to-indigo-900/30 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            Admin Platform Leaderboard
          </h1>
          <p className="text-xs text-gray-400">Inspect rankings across departments, filter data, and export records</p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 select-none"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export CSV / Excel
        </button>
      </div>

      {/* Tabs & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-[#11131c] p-1.5 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('OVERALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'OVERALL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:text-white'}`}
          >
            Overall Rankings
          </button>
          <button
            onClick={() => setActiveTab('SUBJECT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'SUBJECT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:text-white'}`}
          >
            Subject Rankings
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'SUBJECT' && (
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
              className="bg-[#11131c] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-[#11131c] border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">All Departments</option>
            <option value="CSE">CSE</option>
            <option value="IT">IT</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="MECH">MECH</option>
          </select>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or reg no..."
              className="bg-[#11131c] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 w-48 md:w-64"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Leaderboard Table */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
        </div>
      ) : filteredLeaderboard.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl text-center space-y-3 border border-white/5 bg-[#11131c]/50">
          <Trophy className="w-16 h-16 text-gray-600 mx-auto opacity-40" />
          <h3 className="font-bold text-white text-lg">No Student Rankings Found</h3>
          <p className="text-xs text-gray-500">Adjust your search or filter parameters to locate student records.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-white/10 bg-[#11131c] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wider text-gray-400 font-extrabold">
                  <th className="py-4 px-6 text-center">Rank</th>
                  <th className="py-4 px-6">Student Name</th>
                  <th className="py-4 px-6">Register Number</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6 text-center">Total Marks</th>
                  <th className="py-4 px-6 text-center">Tests Passed</th>
                  <th className="py-4 px-6 text-center">Total Badges</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredLeaderboard.map((item, idx) => {
                  const rank = item.rankPosition || idx + 1;

                  return (
                    <tr key={item.studentId || idx} className="hover:bg-white/5 transition-all">
                      <td className="py-4 px-6 text-center font-mono font-black text-amber-400">
                        #{rank}
                      </td>
                      <td className="py-4 px-6 font-extrabold text-white">
                        {item.studentName || 'Student'}
                      </td>
                      <td className="py-4 px-6 font-mono text-gray-400 font-bold">
                        {item.registerNumber || 'N/A'}
                      </td>
                      <td className="py-4 px-6 font-semibold text-indigo-400">
                        {item.department || 'CSE'}
                      </td>
                      <td className="py-4 px-6 text-center font-black text-emerald-400">
                        {item.totalMarks ?? item.totalScore ?? 0}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-slate-200">
                        {item.totalTestsPassed ?? item.testCasesPassed ?? 0}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 font-bold text-xs">
                          <Award className="w-3.5 h-3.5" />
                          {item.totalBadges ?? item.badgesEarned ?? 0}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleViewAchievements(item)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 font-bold flex items-center gap-1.5 mx-auto text-xs transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          Badges
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Achievements Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#11131c] border border-white/10 rounded-2xl p-6 max-w-lg w-full space-y-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-white">{selectedStudent.studentName}'s Achievements</h2>
                <p className="text-xs text-gray-400">Register No: {selectedStudent.registerNumber}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#7c3aed] mx-auto" /></div>
            ) : studentAchievements.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500">No achievements recorded for this student yet.</div>
            ) : (
              <div className="space-y-3">
                {studentAchievements.map((a: any) => (
                  <div key={a.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
                    <div className="text-2xl">🥇</div>
                    <div>
                      <div className="text-white font-bold text-xs">{a.badgeName}</div>
                      <div className="text-[10px] text-gray-400">{a.testName} ({a.subjectName}) - {formatISTDate(a.awardedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
