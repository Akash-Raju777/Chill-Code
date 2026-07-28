'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, fetchBadgeSets, createBadgeSet, updateBadgeSet, deleteBadgeSet, toggleBadgeSetStatus } from '../../../utils/api';
import { 
  Award, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Power, 
  BookOpen, 
  Hash, 
  Trophy, 
  Loader2, 
  Layers,
  Sparkles
} from 'lucide-react';

interface TestOption {
  id: number;
  testCode: string;
  name: string;
  subjectId: number;
  subjectName?: string;
}

interface BadgeDef {
  id?: number;
  rankPosition: number;
  badgeName: string;
  badgeIcon: string;
  badgeColor: string;
  badgeOrder: number;
}

interface BadgeSet {
  id: number;
  name: string;
  testId: number;
  testCode: string;
  testName: String;
  subjectId: number;
  subjectName: string;
  numberOfWinners: number;
  enableLanguageBadge?: boolean;
  languageName?: string;
  languageBadgeName?: string;
  languageBadgeIcon?: string;
  languageAwardRank?: number;
  status: string;
  badges: BadgeDef[];
}

export default function AdminBadgeSetsPage() {
  const [badgeSets, setBadgeSets] = useState<BadgeSet[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<BadgeSet | null>(null);

  // Form states
  const [setName, setSetName] = useState('');
  const [selectedTestId, setSelectedTestId] = useState<number | ''>('');
  const [numberOfWinners, setNumberOfWinners] = useState(3);
  const [badgeDefs, setBadgeDefs] = useState<BadgeDef[]>([
    { rankPosition: 1, badgeName: '🥇 Gold Champion', badgeIcon: 'Award', badgeColor: '#f59e0b', badgeOrder: 1 },
    { rankPosition: 2, badgeName: '🥈 Silver Champion', badgeIcon: 'Award', badgeColor: '#94a3b8', badgeOrder: 2 },
    { rankPosition: 3, badgeName: '🥉 Bronze Champion', badgeIcon: 'Award', badgeColor: '#b45309', badgeOrder: 3 },
  ]);

  // Language Master Badge Form States
  const [enableLanguageBadge, setEnableLanguageBadge] = useState(false);
  const [languageName, setLanguageName] = useState('Java');
  const [languageBadgeName, setLanguageBadgeName] = useState('☕ Java Expert');
  const [languageBadgeIcon, setLanguageBadgeIcon] = useState('☕');
  const [languageAwardRank, setLanguageAwardRank] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [setsData, testsData] = await Promise.all([
        fetchBadgeSets(),
        apiCall('/api/admin/tests')
      ]);
      setBadgeSets(setsData || []);

      const formattedTests: TestOption[] = (testsData || []).map((t: any) => ({
        id: t.id,
        testCode: t.testCode || `TEST-${t.id}`,
        name: t.name,
        subjectId: t.subjectId,
        subjectName: t.subjectName || t.subject?.name || 'General'
      }));
      setTests(formattedTests);
    } catch (err: any) {
      setError(err.message || 'Failed to load badge sets data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedTestObj = tests.find(t => t.id === Number(selectedTestId));

  const handleOpenCreateModal = () => {
    setEditingSet(null);
    setSetName('');
    setSelectedTestId(tests.length > 0 ? tests[0].id : '');
    setNumberOfWinners(3);
    setBadgeDefs([
      { rankPosition: 1, badgeName: '🥇 Gold Champion', badgeIcon: 'Award', badgeColor: '#f59e0b', badgeOrder: 1 },
      { rankPosition: 2, badgeName: '🥈 Silver Champion', badgeIcon: 'Award', badgeColor: '#94a3b8', badgeOrder: 2 },
      { rankPosition: 3, badgeName: '🥉 Bronze Champion', badgeIcon: 'Award', badgeColor: '#b45309', badgeOrder: 3 },
    ]);
    setEnableLanguageBadge(false);
    setLanguageName('Java');
    setLanguageBadgeName('☕ Java Expert');
    setLanguageBadgeIcon('☕');
    setLanguageAwardRank(1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (set: BadgeSet) => {
    setEditingSet(set);
    setSetName(set.name);
    setSelectedTestId(set.testId);
    setNumberOfWinners(set.numberOfWinners);
    setBadgeDefs(set.badges && set.badges.length > 0 ? set.badges : [
      { rankPosition: 1, badgeName: '🥇 Gold Champion', badgeIcon: 'Award', badgeColor: '#f59e0b', badgeOrder: 1 },
      { rankPosition: 2, badgeName: '🥈 Silver Champion', badgeIcon: 'Award', badgeColor: '#94a3b8', badgeOrder: 2 },
      { rankPosition: 3, badgeName: '🥉 Bronze Champion', badgeIcon: 'Award', badgeColor: '#b45309', badgeOrder: 3 },
    ]);
    setEnableLanguageBadge(set.enableLanguageBadge || false);
    setLanguageName(set.languageName || 'Java');
    setLanguageBadgeName(set.languageBadgeName || '☕ Java Expert');
    setLanguageBadgeIcon(set.languageBadgeIcon || '☕');
    setLanguageAwardRank(set.languageAwardRank || 1);
    setIsModalOpen(true);
  };

  const handleWinnersCountChange = (count: number) => {
    setNumberOfWinners(count);
    const newDefs: BadgeDef[] = [];
    for (let i = 1; i <= count; i++) {
      const existing = badgeDefs.find(b => b.rankPosition === i);
      if (existing) {
        newDefs.push(existing);
      } else {
        const icon = i === 1 ? '🥇' : i === 2 ? '🥈' : i === 3 ? '🥉' : '🎖️';
        newDefs.push({
          rankPosition: i,
          badgeName: `${icon} Rank ${i} Award`,
          badgeIcon: 'Award',
          badgeColor: i === 1 ? '#f59e0b' : i === 2 ? '#94a3b8' : i === 3 ? '#b45309' : '#6366f1',
          badgeOrder: i
        });
      }
    }
    setBadgeDefs(newDefs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTestId) {
      alert('Please select a Test ID.');
      return;
    }

    const payload = {
      name: setName || `${selectedTestObj?.name || 'Test'} Badge Set`,
      testId: Number(selectedTestId),
      numberOfWinners: Number(numberOfWinners),
      enableLanguageBadge,
      languageName,
      languageBadgeName,
      languageBadgeIcon,
      languageAwardRank: Number(languageAwardRank),
      badges: badgeDefs
    };

    try {
      if (editingSet) {
        await updateBadgeSet(editingSet.id, payload);
      } else {
        await createBadgeSet(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save badge set.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this badge set?')) return;
    try {
      await deleteBadgeSet(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete badge set.');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await toggleBadgeSetStatus(id, nextStatus);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0b0c10]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed] mx-auto" />
          <p className="text-gray-400 font-sans text-xs">Loading badge set management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900/30 via-slate-900 to-indigo-900/30 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-400" />
            Badge Set Management
          </h1>
          <p className="text-xs text-gray-400">Configure dynamic test winner badge sets linked to Test IDs</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 select-none"
        >
          <Plus className="w-4 h-4" />
          Create Badge Set
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Badge Sets List */}
      {badgeSets.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl text-center space-y-4 border border-white/5 bg-[#11131c]/50">
          <Award className="w-16 h-16 text-gray-600 mx-auto opacity-40" />
          <h3 className="font-bold text-white text-lg">No Badge Sets Configured</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Create a badge set linked to a Test ID to automatically assign Gold, Silver, and Bronze badges to test winners!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {badgeSets.map((set) => {
            const isActive = set.status === 'ACTIVE';

            return (
              <div 
                key={set.id}
                className={`glass-panel p-6 rounded-2xl border ${isActive ? 'border-amber-500/30 bg-[#11131c]' : 'border-white/5 bg-[#11131c]/40 opacity-75'} space-y-5 transition-all`}
              >
                {/* Header Info */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {set.testCode}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {set.status}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-white">{set.name}</h2>
                    <p className="text-xs text-gray-400 font-medium">{set.testName} ({set.subjectName})</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(set.id, set.status)}
                      title={isActive ? 'Disable Badge Set' : 'Enable Badge Set'}
                      className={`p-2 rounded-lg border text-xs font-bold transition-all ${isActive ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(set)}
                      className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(set.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="h-px bg-white/5 w-full" />

                {/* Configured Badges */}
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Configured Winner Badges ({set.badges?.length || 0})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {set.badges?.map((b) => (
                      <div key={b.rankPosition} className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-1 text-center">
                        <div className="text-2xl">{b.badgeName.includes('🥇') ? '🥇' : b.badgeName.includes('🥈') ? '🥈' : b.badgeName.includes('🥉') ? '🥉' : '🎖️'}</div>
                        <div className="text-xs font-bold text-white truncate">{b.badgeName}</div>
                        <div className="text-[10px] text-amber-400 font-bold">Rank {b.rankPosition}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Create / Edit Badge Set */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#11131c] border border-white/10 rounded-2xl p-6 max-w-xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-white">
                {editingSet ? 'Edit Badge Set' : 'Create New Badge Set'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Select Test ID */}
              <div className="space-y-1.5">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Select Test ID</label>
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(Number(e.target.value))}
                  required
                  className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Choose Test ID --</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.testCode} - {t.name} ({t.subjectName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-filled details */}
              {selectedTestObj && (
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Auto-Loaded Details</div>
                  <div className="text-white font-bold text-sm">{selectedTestObj.name}</div>
                  <div className="text-indigo-400 text-xs font-semibold">Subject: {selectedTestObj.subjectName}</div>
                </div>
              )}

              {/* Badge Set Name */}
              <div className="space-y-1.5">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Badge Set Name</label>
                <input
                  type="text"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="e.g. Java Mid-Term Champions"
                  className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Number of Winners */}
              <div className="space-y-1.5">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Number of Winners</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 5, 10].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => handleWinnersCountChange(num)}
                      className={`py-2 rounded-xl font-bold border transition-all ${numberOfWinners === num ? 'bg-amber-500/20 border-amber-400 text-amber-400' : 'bg-white/5 border-white/5 text-gray-400'}`}
                    >
                      Top {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customize Badges */}
              <div className="space-y-3 pt-2">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Customize Winner Badges</label>
                {badgeDefs.map((def, idx) => (
                  <div key={def.rankPosition} className="p-3 bg-[#181a25] border border-white/10 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-slate-300 font-bold">
                      <span>Rank {def.rankPosition} Winner</span>
                    </div>
                    <input
                      type="text"
                      value={def.badgeName}
                      onChange={(e) => {
                        const updated = [...badgeDefs];
                        updated[idx].badgeName = e.target.value;
                        setBadgeDefs(updated);
                      }}
                      placeholder="Badge Name (e.g. 🥇 Gold Champion)"
                      className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Language Master Badge Configuration Section */}
              <div className="p-4 bg-[#181a25] border border-white/10 rounded-xl space-y-4 pt-4">
                <div className="text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/10 pb-2 flex items-center justify-between">
                  <span>Language Master Badge</span>
                  {enableLanguageBadge && (
                    <span className="text-emerald-400 font-mono font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Enabled
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-white font-bold cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enableLanguageBadge}
                      onChange={(e) => setEnableLanguageBadge(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10 bg-[#11131c] text-amber-500 focus:ring-0"
                    />
                    Enable Language Master Badge
                  </label>
                </div>

                {enableLanguageBadge && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-gray-400 font-bold text-[10px] uppercase">Language</label>
                      <select
                        value={languageName}
                        onChange={(e) => {
                          const lang = e.target.value;
                          setLanguageName(lang);
                          if (lang === 'Java') { setLanguageBadgeName('☕ Java Expert'); setLanguageBadgeIcon('☕'); }
                          else if (lang === 'Python') { setLanguageBadgeName('🐍 Python Master'); setLanguageBadgeIcon('🐍'); }
                          else if (lang === 'C') { setLanguageBadgeName('⚙️ C Programmer'); setLanguageBadgeIcon('⚙️'); }
                          else if (lang === 'C++') { setLanguageBadgeName('💻 C++ Expert'); setLanguageBadgeIcon('💻'); }
                          else if (lang === 'JavaScript') { setLanguageBadgeName('🌐 JavaScript Ninja'); setLanguageBadgeIcon('🌐'); }
                        }}
                        className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold mt-1"
                      >
                        <option value="Java">☕ Java</option>
                        <option value="Python">🐍 Python</option>
                        <option value="C">⚙️ C</option>
                        <option value="C++">💻 C++</option>
                        <option value="JavaScript">🌐 JavaScript</option>
                        <option value="Go">🚀 Go</option>
                        <option value="Rust">🦀 Rust</option>
                        <option value="Kotlin">🎯 Kotlin</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-400 font-bold text-[10px] uppercase">Badge Name</label>
                      <input
                        type="text"
                        value={languageBadgeName}
                        onChange={(e) => setLanguageBadgeName(e.target.value)}
                        placeholder="e.g. ☕ Java Expert"
                        className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-gray-400 font-bold text-[10px] uppercase block mb-1">Award To</label>
                      <div className="flex flex-col gap-2 font-bold text-gray-300">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="awardToRank"
                            checked={languageAwardRank === 1}
                            onChange={() => setLanguageAwardRank(1)}
                          />
                          Top 1 Only (Rank 1)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="awardToRank"
                            checked={languageAwardRank === 3}
                            onChange={() => setLanguageAwardRank(3)}
                          />
                          Top 3 (Rank 3)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="awardToRank"
                            checked={languageAwardRank !== 1 && languageAwardRank !== 3}
                            onChange={() => setLanguageAwardRank(2)}
                          />
                          Custom Rank
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-gray-400 font-bold text-[10px] uppercase">Rank Number</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={languageAwardRank}
                        onChange={(e) => setLanguageAwardRank(Number(e.target.value))}
                        className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-mono font-bold mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Save Badge Set
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
