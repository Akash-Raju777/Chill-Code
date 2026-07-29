'use client';

import React, { useEffect, useState } from 'react';
import { 
  fetchSubjectLeaderboard, 
  fetchOverallLeaderboard, 
  fetchStudentLeaderboardSummary, 
  apiCall 
} from '../../../utils/api';
import { 
  Trophy, 
  Award, 
  Clock, 
  CheckCircle2, 
  User, 
  Search, 
  Sparkles, 
  Loader2, 
  Flame, 
  Layers, 
  Filter 
} from 'lucide-react';

interface Subject {
  id: number;
  name: string;
}

export default function StudentLeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'OVERALL' | 'SUBJECT'>('OVERALL');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  
  const [summary, setSummary] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [subjData, sumData] = await Promise.all([
        apiCall('/api/subjects'),
        fetchStudentLeaderboardSummary().catch(() => null)
      ]);
      setSubjects(subjData || []);
      if (subjData && subjData.length > 0) {
        setSelectedSubjectId(subjData[0].id);
      }
      setSummary(sumData);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard settings');
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
        const data = await fetchOverallLeaderboard(timeFilter, departmentFilter);
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
  }, [activeTab, selectedSubjectId, timeFilter, departmentFilter]);

  const filteredLeaderboard = leaderboardData.filter((item: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.studentName && item.studentName.toLowerCase().includes(q)) ||
      (item.registerNumber && item.registerNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans">
      {/* Student View Summary Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/30 via-slate-900 to-indigo-900/30 border border-white/10 p-6 md:p-8 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block mb-2">
              Chill Code Hall of Fame
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight">Platform Leaderboard</h1>
            <p className="text-xs text-gray-400">Live rankings derived from test marks, test cases passed, and speed</p>
          </div>

          {/* Student Stats Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 space-y-0.5">
              <div className="text-[10px] text-gray-400 uppercase font-bold">Overall Rank</div>
              <div className="text-xl font-black text-amber-400">#{summary?.overallRank || 1}</div>
            </div>
            <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 space-y-0.5">
              <div className="text-[10px] text-gray-400 uppercase font-bold">Current Rank</div>
              <div className="text-xl font-black text-emerald-400">#{summary?.myCurrentRank || 1}</div>
            </div>
            <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 space-y-0.5">
              <div className="text-[10px] text-gray-400 uppercase font-bold">Total Badges</div>
              <div className="text-xl font-black text-purple-400">{summary?.totalBadgesEarned || 0}</div>
            </div>
            <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 space-y-0.5 truncate">
              <div className="text-[10px] text-gray-400 uppercase font-bold truncate">Recent Badge</div>
              <div className="text-xs font-bold text-white truncate">{summary?.recentAchievement?.badgeName || 'None'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-[#11131c] p-1.5 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('OVERALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'OVERALL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:text-white'}`}
          >
            Overall Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('SUBJECT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'SUBJECT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-400 hover:text-white'}`}
          >
            Subject-wise Leaderboard
          </button>
        </div>

        <div className="flex items-center gap-3">
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

          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student..."
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
          <h3 className="font-bold text-white text-lg">No Rankings Available</h3>
          <p className="text-xs text-gray-500">Rankings will update dynamically as students submit test attempts.</p>
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
                  <th className="py-4 px-6 text-center">Total Marks</th>
                  <th className="py-4 px-6 text-center">Tests / Test Cases Passed</th>
                  <th className="py-4 px-6 text-center">Time Taken</th>
                  <th className="py-4 px-6 text-center">Badges Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredLeaderboard.map((item, idx) => {
                  const rank = item.rankPosition || idx + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;

                  return (
                    <tr 
                      key={item.studentId || idx}
                      className={`hover:bg-white/5 transition-all ${isTop1 ? 'bg-amber-500/5' : isTop2 ? 'bg-slate-400/5' : isTop3 ? 'bg-amber-700/5' : ''}`}
                    >
                      <td className="py-4 px-6 text-center">
                        {isTop1 ? (
                          <span className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400 text-amber-400 font-black flex items-center justify-center mx-auto text-base">
                            🥇
                          </span>
                        ) : isTop2 ? (
                          <span className="w-8 h-8 rounded-full bg-slate-400/20 border border-slate-300 text-slate-300 font-black flex items-center justify-center mx-auto text-base">
                            🥈
                          </span>
                        ) : isTop3 ? (
                          <span className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600 text-amber-500 font-black flex items-center justify-center mx-auto text-base">
                            🥉
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-gray-400">#{rank}</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-extrabold text-white">{item.studentName || 'Student'}</div>
                        <div className="text-[10px] text-gray-500">{item.department || 'CS'}</div>
                      </td>

                      <td className="py-4 px-6 font-mono text-gray-400 font-bold">
                        {item.registerNumber || 'N/A'}
                      </td>

                      <td className="py-4 px-6 text-center font-black text-amber-400 text-sm">
                        {item.totalMarks ?? item.totalScore ?? 0}
                      </td>

                      <td className="py-4 px-6 text-center font-bold text-slate-200 font-mono">
                        {item.totalTestsPassed ?? item.testCasesPassed ?? 0}
                      </td>

                      <td className="py-4 px-6 text-center font-mono text-gray-400">
                        {item.avgTimeSec ? `${Math.round(item.avgTimeSec)}s avg` : `${item.totalTimeTakenSeconds || 0}s`}
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 font-bold text-xs">
                          <Award className="w-3.5 h-3.5" />
                          {item.totalBadges ?? item.badgesEarned ?? 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
