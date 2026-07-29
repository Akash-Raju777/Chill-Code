'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, formatISTDate } from '../../../utils/api';
import { Award, ShieldCheck, Calendar, Trophy, CheckCircle2, Loader2, Sparkles, BookOpen, Hash } from 'lucide-react';

interface StudentAchievement {
  id: number;
  badgeName: string;
  badgeIcon: string;
  badgeCategory: string;
  testId?: number;
  testCode?: string;
  testName?: string;
  subjectName?: string;
  rankAchieved?: string;
  awardedAt: string;
  awardedBy: string;
}

interface LanguageMasterBadge {
  id: number;
  testId: number;
  testCode: string;
  testName: string;
  subject: string;
  badgeName: string;
  badgeIcon: string;
  awardedRank: number;
  awardedDate: string;
}

export default function StudentAchievementsPage() {
  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [languageBadges, setLanguageBadges] = useState<LanguageMasterBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAchievements = async () => {
    setLoading(true);
    try {
      const [data, langData] = await Promise.all([
        apiCall('/api/student/achievements'),
        apiCall('/api/student/language-badges').catch(() => [])
      ]);
      setAchievements(data || []);
      setLanguageBadges(langData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load student achievements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAchievements();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0b0c10]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed] mx-auto" />
          <p className="text-gray-400 font-sans text-xs">Loading earned achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/40 via-slate-900 to-indigo-950/40 border border-white/10 p-6 md:p-8 backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" />
              My Badges & Honors
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Earned Achievements</h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Official record of test honors, badges, and rankings awarded automatically by Chill Code Platform.
            </p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-white/10 bg-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{achievements.length + languageBadges.length}</div>
              <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Badges Earned</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Language Master Badges Section */}
      {languageBadges.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white font-extrabold text-lg">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Language Master Badges ({languageBadges.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {languageBadges.map((lmb) => (
              <div 
                key={lmb.id}
                className="glass-panel p-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-[#181b2c] to-[#11131c] space-y-4 shadow-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border-2 border-indigo-400/50 flex items-center justify-center text-3xl shrink-0">
                    {lmb.badgeIcon || '☕'}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full inline-block mb-1">
                      Language Master
                    </span>
                    <h3 className="font-extrabold text-white text-lg leading-tight">{lmb.badgeName}</h3>
                  </div>
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Awarded for securing <span className="font-bold text-amber-400">Rank {lmb.awardedRank}</span> in <span className="font-bold text-white">{lmb.testName}</span> ({lmb.subject}).
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-white/5">
                  <span>Awarded: {formatISTDate(lmb.awardedDate)}</span>
                  <span className="font-mono text-emerald-400">{lmb.testCode}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Earned Badges Grid */}
      {achievements.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl text-center space-y-4 border border-white/5 bg-[#11131c]/50">
          <Award className="w-16 h-16 text-gray-600 mx-auto opacity-40" />
          <h3 className="font-bold text-white text-lg">No Badges Earned Yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Participate in tests and achieve top rankings to automatically earn badges and honors here!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((item) => {
            const dateStr = formatISTDate(item.awardedAt);

            return (
              <div 
                key={item.id}
                className="glass-panel p-6 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#161926] to-[#11131c] hover:border-amber-500/40 transition-all space-y-5 relative overflow-hidden group shadow-lg shadow-amber-500/5"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full blur-2xl group-hover:bg-amber-400/10 transition-all pointer-events-none" />

                {/* Badge Icon & Name */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-3xl shadow-inner shadow-amber-500/20 shrink-0">
                    {item.badgeName.includes('🥇') ? '🥇' : item.badgeName.includes('🥈') ? '🥈' : item.badgeName.includes('🥉') ? '🥉' : '🎖️'}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                      {item.badgeCategory || 'Test Ranking'}
                    </span>
                    <h2 className="font-extrabold text-white text-base leading-tight truncate">{item.badgeName}</h2>
                    {item.rankAchieved && (
                      <span className="text-xs text-slate-300 font-bold block">{item.rankAchieved}</span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-white/5 w-full" />

                {/* Detailed Information */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      Subject:
                    </span>
                    <span className="font-bold text-white">{item.subjectName || 'General'}</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      Test:
                    </span>
                    <span className="font-bold text-slate-200 truncate max-w-[180px]">{item.testName || 'Test Assessment'}</span>
                  </div>

                  {item.testCode && (
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                        <Hash className="w-3.5 h-3.5 text-emerald-400" />
                        Test ID:
                      </span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                        {item.testCode}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      Awarded:
                    </span>
                    <span className="font-medium text-slate-300">{dateStr}</span>
                  </div>

                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      Awarded By:
                    </span>
                    <span className="font-semibold text-cyan-400 text-[11px]">{item.awardedBy || 'Automatic System'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
