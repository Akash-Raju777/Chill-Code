'use client';

import React, { useState, useEffect } from 'react';
import { fetchAllStudentAchievements, fetchAllBadges } from '@/utils/api';
import { Award, Users, Calendar, Sparkles, Search, Coffee, Terminal, Code2, Flame, Globe } from 'lucide-react';

interface StudentBadge {
  id: number;
  studentId: number;
  studentName: string;
  studentRegisterNumber: string;
  badge: {
    id: number;
    name: string;
    description: string;
    icon: string;
    type: string;
  };
  earnedAt: string;
  sourceTestName?: string;
}

export default function AdminAchievementsOverviewPage() {
  const [achievements, setAchievements] = useState<StudentBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    try {
      setLoading(true);
      const res = await fetchAllStudentAchievements();
      setAchievements(res || []);
    } catch (err) {
      console.error('Failed to load achievements:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderBadgeIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'coffee': return <Coffee className="w-5 h-5 text-amber-400" />;
      case 'terminal': return <Terminal className="w-5 h-5 text-emerald-400" />;
      case 'code2': return <Code2 className="w-5 h-5 text-blue-400" />;
      case 'flame': return <Flame className="w-5 h-5 text-orange-500" />;
      case 'globe': return <Globe className="w-5 h-5 text-cyan-400" />;
      default: return <Award className="w-5 h-5 text-purple-400" />;
    }
  };

  const filteredAchievements = achievements.filter(a => 
    a.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.studentRegisterNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.badge?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 p-8 border border-purple-500/20 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Global Gamification Feed
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
            Student Achievements Overview
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base max-w-xl">
            Monitor all earned student badges, subject rankings, and language master achievements across the platform.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center min-w-[140px] backdrop-blur-md">
          <span className="text-3xl font-black text-purple-400">{achievements.length}</span>
          <span className="text-xs text-slate-400 block mt-1 uppercase font-semibold">Total Earned Badges</span>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search by student name, register number, or badge..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Achievements Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Loading all student achievements...</div>
        ) : filteredAchievements.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No student achievements found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Badge Earned</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Earned Date</th>
                  <th className="px-6 py-4">Source Test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAchievements.map(a => (
                  <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-100">{a.studentName}</div>
                      <div className="text-xs text-slate-500 font-mono">{a.studentRegisterNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                          {renderBadgeIcon(a.badge?.icon)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-100">{a.badge?.name}</div>
                          <div className="text-xs text-slate-400 line-clamp-1">{a.badge?.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-purple-500/10 border border-purple-500/30 text-purple-300">
                        {a.badge?.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {new Date(a.earnedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {a.sourceTestName || 'System Evaluation'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
