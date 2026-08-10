'use client';

import React, { useEffect, useState, useCallback } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import { 
  apiCall, 
  fetchBadgeSets, 
  createBadgeSet, 
  updateBadgeSet, 
  deleteBadgeSet, 
  toggleBadgeSetStatus, 
  fetchBadgeSetWinners,
  fetchAllBadges,
  createBadge,
  deleteBadge,
  toggleBadgeStatus,
  assignBadgeManually,
  removeBadgeManually,
  fetchAllEarnedBadges,
  formatISTDateTime,
  formatISTDate
} from '../../../utils/api';
import { toast } from '../../../store/toastStore';
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
  Sparkles,
  Users,
  Eye,
  Calendar,
  Medal,
  Star,
  ShieldCheck,
  Coffee,
  Terminal,
  Code2,
  Flame,
  Globe
} from 'lucide-react';

interface BadgeWinner {
  id: number;
  studentId: number;
  studentName: string;
  studentRegisterNumber: string;
  badgeName: string;
  badgeIcon: string;
  badgeCategory: string;
  testId: number;
  testCode: string;
  testName: string;
  subjectName: string;
  rankAchieved: string;
  awardedAt: string;
  status: string;
}

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
  testName: string;
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

interface StudentOption {
  id: number;
  name: string;
  registerNumber: string;
  status: string;
}

interface ManualBadgeDef {
  id: number;
  name: string;
  description: string;
  icon: string;
  type: string;
  status: string;
}

interface ManualBadgeAssignment {
  id: number;
  studentId: number;
  studentName: string;
  studentRegisterNumber: string;
  badge: {
    id: number;
    name: string;
    icon: string;
    type: string;
    description: string;
  };
  earnedAt: string;
  sourceTestId?: number;
  sourceTestName?: string;
  status: string;
}

export default function AdminBadgeSetsPage() {
  const [activeTab, setActiveTab] = useState<'sets' | 'manual'>('manual');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Badge Sets States ---
  const [badgeSets, setBadgeSets] = useState<BadgeSet[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<BadgeSet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });

  // View Students modal
  const [winnersModalOpen, setWinnersModalOpen] = useState(false);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [winners, setWinners] = useState<BadgeWinner[]>([]);
  const [selectedBadgeSetForWinners, setSelectedBadgeSetForWinners] = useState<BadgeSet | null>(null);

  // Badge Sets Form states
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

  // --- Manual Badge Assignment States ---
  const [definedBadges, setDefinedBadges] = useState<ManualBadgeDef[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [manualAssignments, setManualAssignments] = useState<ManualBadgeAssignment[]>([]);
  const [manualLoading, setManualLoading] = useState(false);

  // Create Badge Def Form
  const [newBadgeName, setNewBadgeName] = useState('');
  const [newBadgeIcon, setNewBadgeIcon] = useState('Award');
  const [newBadgeDesc, setNewBadgeDesc] = useState('');
  const [newBadgeType, setNewBadgeType] = useState('CUSTOM');

  // Assign Badge Form
  const [assignStudentId, setAssignStudentId] = useState<number | ''>('');
  const [assignBadgeId, setAssignBadgeId] = useState<number | ''>('');
  const [assignTestId, setAssignTestId] = useState<number | ''>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [testSearch, setTestSearch] = useState('');
  const [showTestDropdown, setShowTestDropdown] = useState(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [setsData, testsData] = await Promise.all([
        fetchBadgeSets(),
        apiCall('/api/admin/tests'),
      ]);
      setBadgeSets(setsData || []);

      const formattedTests: TestOption[] = (testsData || []).map((t: any) => {
        const subName = t.subjectName || t.subject?.name || 'General';
        return {
          id: t.id,
          testCode: t.testCode || 'N/A',
          name: t.name,
          subjectId: t.subject?.id || t.subjectId,
          subjectName: subName
        };
      });
      setTests(formattedTests);
      setError('');
    } catch (err: any) {
      if (!isSilent) setError(err.message || 'Failed to load badge sets data');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const loadManualData = useCallback(async (isSilent = false) => {
    if (!isSilent) setManualLoading(true);
    try {
      const [badgesData, studentsData, earnedData] = await Promise.all([
        fetchAllBadges(),
        apiCall('/api/admin/students'),
        fetchAllEarnedBadges(),
      ]);
      setDefinedBadges(badgesData || []);
      setStudents(studentsData || []);
      setManualAssignments(earnedData || []);
    } catch (err: any) {
      toast.error('Failed to load manual badge data');
    } finally {
      if (!isSilent) setManualLoading(false);
    }
  }, []);

  useEffect(() => {
    const initLoad = async () => {
      try {
        await Promise.all([
          loadData(false),
          loadManualData(false)
        ]);
      } catch (e) {
        console.error("Initial load failed", e);
      }
    };
    initLoad();
  }, [loadData, loadManualData]);

  // Auto-refresh manual lists in background silently
  useEffect(() => {
    const interval = setInterval(() => {
      loadManualData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadManualData]);

  const selectedTestObj = tests.find(t => t.id === Number(selectedTestId));

  const availableTests = tests.filter((t) => 
    !badgeSets.some((bs) => bs.testId === t.id && (!editingSet || editingSet.id !== bs.id))
  );

  const filteredStudents = students.filter(s => {
    const term = studentSearch.toLowerCase();
    return (s.name || '').toLowerCase().includes(term) || (s.registerNumber || '').toLowerCase().includes(term);
  });

  const filteredTests = tests.filter(t => {
    const term = testSearch.toLowerCase();
    return (t.name || '').toLowerCase().includes(term) || (t.testCode || '').toLowerCase().includes(term);
  });

  // --- Dynamic sets handlers ---
  const handleOpenCreateModal = () => {
    setEditingSet(null);
    setSetName('');
    const available = tests.filter((t) => !badgeSets.some((bs) => bs.testId === t.id));
    setSelectedTestId(available.length > 0 ? available[0].id : '');
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

  const handleViewWinners = async (set: BadgeSet) => {
    setSelectedBadgeSetForWinners(set);
    setWinnersModalOpen(true);
    setWinnersLoading(true);
    try {
      const data = await fetchBadgeSetWinners(set.id);
      setWinners(data || []);
    } catch (err: any) {
      toast.error('Failed to load badge winners');
      setWinners([]);
    } finally {
      setWinnersLoading(false);
    }
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
      toast.warning('Please select a Test ID.');
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
      status: editingSet ? editingSet.status : 'ACTIVE',
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
      toast.success('Badge set saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save badge set.');
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmDelete({ open: true, id });
  };

  const executeDelete = async () => {
    if (!confirmDelete.id) return;
    const id = confirmDelete.id;
    setConfirmDelete({ open: false, id: null });
    try {
      await deleteBadgeSet(id);
      loadData();
      toast.success('Badge set deleted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete badge set.');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await toggleBadgeSetStatus(id, nextStatus);
      loadData();
      toast.success(`Badge set status updated to ${nextStatus}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    }
  };

  // --- Manual assignment handlers ---
  const handleCreateBadgeDef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBadgeName.trim()) {
      toast.warning('Please enter a badge name.');
      return;
    }
    try {
      await createBadge({
        name: newBadgeName.trim(),
        icon: newBadgeIcon,
        description: newBadgeDesc.trim(),
        type: newBadgeType,
        status: 'ACTIVE'
      });
      setNewBadgeName('');
      setNewBadgeDesc('');
      setNewBadgeIcon('Award');
      setNewBadgeType('CUSTOM');
      loadManualData();
      toast.success('Badge definition created successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create badge definition.');
    }
  };

  const handleDeleteBadgeDef = async (id: number) => {
    try {
      await deleteBadge(id);
      loadManualData();
      toast.success('Badge definition deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete badge definition.');
    }
  };

  const handleAssignBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentId) {
      toast.warning('Please select a student.');
      return;
    }
    if (!assignBadgeId) {
      toast.warning('Please select a badge.');
      return;
    }
    try {
      const testIdVal = assignTestId ? Number(assignTestId) : undefined;
      await assignBadgeManually(Number(assignStudentId), Number(assignBadgeId), testIdVal);
      setAssignStudentId('');
      setAssignBadgeId('');
      setAssignTestId('');
      setStudentSearch('');
      setTestSearch('');
      loadManualData();
      toast.success('Badge assigned successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign badge.');
    }
  };

  const handleRemoveAssignment = async (studentId: number, badgeId: number) => {
    try {
      await removeBadgeManually(studentId, badgeId);
      loadManualData();
      toast.success('Badge assignment revoked.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke badge assignment.');
    }
  };

  const getRankBadgeLabel = (rankStr: string) => {
    if (!rankStr) return 'N/A';
    if (rankStr.includes('1')) return '🥇 Gold';
    if (rankStr.includes('2')) return '🥈 Silver';
    if (rankStr.includes('3')) return '🥉 Bronze';
    return rankStr;
  };

  const renderBadgeIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'coffee': case '☕': return <Coffee className="w-5 h-5 text-amber-400" />;
      case 'terminal': case '💻': return <Terminal className="w-5 h-5 text-emerald-400" />;
      case 'code2': case '💻 code': return <Code2 className="w-5 h-5 text-blue-400" />;
      case 'flame': case '🔥': return <Flame className="w-5 h-5 text-orange-500" />;
      case 'globe': case '🌐': return <Globe className="w-5 h-5 text-cyan-400" />;
      default: return <Award className="w-5 h-5 text-purple-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0b0c10]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed] mx-auto" />
          <p className="text-gray-400 font-sans text-xs">Loading badge dashboard...</p>
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
            Badge & Gamification control
          </h1>
          <p className="text-xs text-gray-400">Configure dynamic test winner sets or manually reward outstanding student achievements</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Section Subheader */}
      <div className="flex border-b border-white/10 pb-3">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          Badge Definitions & Manual Awards
        </h2>
      </div>

      {activeTab === 'sets' ? (
        <>
          {/* Create Button */}
          <div className="flex justify-end">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 flex items-center gap-2 hover:from-purple-500 hover:to-indigo-500 transition-all text-xs"
            >
              <Plus className="w-4 h-4" />
              Configure New Set
            </button>
          </div>

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
                        <h2 className="text-xl font-extrabold text-white">{set.testName || set.name}</h2>
                        <p className="text-xs text-gray-400 font-medium">
                          {set.subjectName} • {set.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewWinners(set)}
                          title="View Badge Winners"
                          className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-lg transition-all"
                        >
                          <Users className="w-4 h-4" />
                        </button>
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

                    {/* View Students Button */}
                    <button
                      onClick={() => handleViewWinners(set)}
                      className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      View Students
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Manual badge and assignment tab views */
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Create Badge Definition Form */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-[#11131c] space-y-4 shadow-xl">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                Define a New Badge
              </h2>
              <p className="text-xs text-gray-400">Configure global badge definitions for manual distribution</p>

              <form onSubmit={handleCreateBadgeDef} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Badge Name</label>
                  <input
                    type="text"
                    required
                    value={newBadgeName}
                    onChange={(e) => setNewBadgeName(e.target.value)}
                    placeholder="e.g. Java Specialist, Contest winner"
                    className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Icon Emoji/Lucide</label>
                    <select
                      value={newBadgeIcon}
                      onChange={(e) => setNewBadgeIcon(e.target.value)}
                      className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="Award">🏆 Award</option>
                      <option value="Medal">🎖️ Medal</option>
                      <option value="Star">⭐️ Star</option>
                      <option value="Coffee">☕ Coffee</option>
                      <option value="Terminal">💻 Terminal</option>
                      <option value="Code2">💻 Code</option>
                      <option value="Flame">🔥 Flame</option>
                      <option value="Globe">🌐 Globe</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Category Type</label>
                    <select
                      value={newBadgeType}
                      onChange={(e) => setNewBadgeType(e.target.value)}
                      className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="CUSTOM">Custom Badge</option>
                      <option value="LANGUAGE_MASTER">Language Master</option>
                      <option value="CONTEST">Contest Winner</option>
                      <option value="SUBJECT_RANKING">Subject Ranking</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Description</label>
                  <textarea
                    rows={2}
                    value={newBadgeDesc}
                    onChange={(e) => setNewBadgeDesc(e.target.value)}
                    placeholder="Award criteria details or notes..."
                    className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 hover:from-purple-500 hover:to-indigo-500 transition-all text-xs"
                >
                  <Check className="w-4 h-4" />
                  Define Badge
                </button>
              </form>
            </div>

            {/* Manual Assignment Form */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-[#11131c] space-y-4 shadow-xl">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                Assign Badge to Student
              </h2>
              <p className="text-xs text-gray-400">Award a defined badge directly to a student's profile</p>

              <form onSubmit={handleAssignBadge} className="space-y-4 text-xs">
                <div className="space-y-1.5 relative">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Select Student</label>
                  {assignStudentId ? (
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">👤</span>
                        <div>
                          <p className="font-semibold text-xs">{students.find(s => s.id === assignStudentId)?.name}</p>
                          <p className="text-[10px] text-gray-400">{students.find(s => s.id === assignStudentId)?.registerNumber}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignStudentId('');
                          setStudentSearch('');
                        }}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="🔍 Type student name or register number to search..."
                        value={studentSearch}
                        onFocus={() => setShowStudentDropdown(true)}
                        onChange={(e) => {
                          setStudentSearch(e.target.value);
                          setShowStudentDropdown(true);
                        }}
                        className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 text-xs transition-all"
                      />
                      {showStudentDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowStudentDropdown(false)}
                          />
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#181a25] border border-white/10 rounded-xl shadow-2xl z-50 divide-y divide-white/5 scrollbar-thin">
                            {filteredStudents.length === 0 ? (
                              <div className="px-4 py-3 text-gray-500 text-center">No students found</div>
                            ) : (
                              filteredStudents.map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setAssignStudentId(s.id);
                                    setShowStudentDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-amber-500/10 hover:text-amber-400 text-white transition-colors flex flex-col gap-0.5"
                                >
                                  <span className="font-semibold text-xs">{s.name}</span>
                                  <span className="text-[10px] text-gray-400">{s.registerNumber}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Select Badge</label>
                    <select
                      required
                      value={assignBadgeId}
                      onChange={(e) => setAssignBadgeId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- Choose Badge --</option>
                      {definedBadges.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.icon} {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 relative">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Select Test (Optional)</label>
                    {assignTestId ? (
                      <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-2.5 text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-400">📋</span>
                          <div>
                            <p className="font-semibold text-xs">{tests.find(t => t.id === assignTestId)?.name}</p>
                            <p className="text-[10px] text-gray-400">{tests.find(t => t.id === assignTestId)?.testCode}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTestId('');
                            setTestSearch('');
                          }}
                          className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="🔍 Type test name to search..."
                          value={testSearch}
                          onFocus={() => setShowTestDropdown(true)}
                          onChange={(e) => {
                            setTestSearch(e.target.value);
                            setShowTestDropdown(true);
                          }}
                          className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 text-xs transition-all"
                        />
                        {showTestDropdown && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setShowTestDropdown(false)}
                            />
                            <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#181a25] border border-white/10 rounded-xl shadow-2xl z-50 divide-y divide-white/5 scrollbar-thin">
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignTestId('');
                                  setShowTestDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-orange-500/10 hover:text-orange-400 text-gray-400 transition-colors"
                              >
                                -- No Test Reference --
                              </button>
                              {filteredTests.length === 0 ? (
                                <div className="px-4 py-3 text-gray-500 text-center">No tests found</div>
                              ) : (
                                filteredTests.map(t => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      setAssignTestId(t.id);
                                      setShowTestDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-orange-500/10 hover:text-orange-400 text-white transition-colors flex flex-col gap-0.5"
                                  >
                                    <span className="font-semibold text-xs">{t.name}</span>
                                    <span className="text-[10px] text-gray-400">{t.testCode}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl shadow-lg flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all text-xs"
                >
                  <Check className="w-4 h-4" />
                  Assign Badge
                </button>
              </form>
            </div>
          </div>

          {/* Assignments Table & Definition list */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Table of Manual Assignments */}
            <div className="xl:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 bg-[#11131c]/50 space-y-4 shadow-xl">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Active Manual Badge Assignments
              </h2>

              {manualLoading ? (
                <div className="py-8 text-center text-slate-500">Loading assignments...</div>
              ) : manualAssignments.length === 0 ? (
                <div className="py-8 text-center text-slate-500">No manual assignments found.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-xs text-slate-300">
                    <thead className="bg-[#181a25] text-gray-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3 text-left">Student</th>
                        <th className="px-4 py-3 text-left">Badge Name</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Test Reference</th>
                        <th className="px-4 py-3 text-left">Award Date</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {manualAssignments.map((ma) => (
                        <tr key={ma.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{ma.studentName}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{ma.studentRegisterNumber}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{renderBadgeIcon(ma.badge.icon)}</span>
                              <span className="font-extrabold text-white">{ma.badge.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 uppercase tracking-wider">
                              {ma.badge.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 font-medium">
                            {ma.sourceTestName ? ma.sourceTestName : <span className="text-gray-600">-</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-400 flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3 text-indigo-400" />
                            {formatISTDate(ma.earnedAt)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemoveAssignment(ma.studentId, ma.badge.id)}
                              title="Revoke Badge Assignment"
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* List of Definitions */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-[#11131c]/50 space-y-4 shadow-xl">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Medal className="w-4 h-4 text-purple-400" />
                Defined Badge Library
              </h2>

              {manualLoading ? (
                <div className="py-8 text-center text-slate-500">Loading library...</div>
              ) : definedBadges.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-semibold">No badge definitions created yet.</div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {definedBadges.map((badge) => (
                    <div key={badge.id} className="p-3 bg-[#181a25] border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-lg">
                          {renderBadgeIcon(badge.icon)}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-white leading-tight">{badge.name}</h4>
                          <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">{badge.type}</span>
                          {badge.description && <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{badge.description}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteBadgeDef(badge.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Students / Badge Winners Modal (For Dynamic sets tab) */}
      {winnersModalOpen && selectedBadgeSetForWinners && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#11131c] border border-white/10 rounded-2xl p-6 max-w-3xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Badge Winners
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  <span className="text-emerald-400 font-mono font-bold">{selectedBadgeSetForWinners.testCode}</span> — {selectedBadgeSetForWinners.testName || selectedBadgeSetForWinners.name}
                </p>
              </div>
              <button onClick={() => setWinnersModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {winnersLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                <p className="text-gray-400 text-xs mt-2">Loading badge winners...</p>
              </div>
            ) : winners.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Award className="w-12 h-12 text-gray-600 mx-auto opacity-40" />
                <p className="text-gray-400 text-sm font-bold">No students have received this badge yet.</p>
                <p className="text-gray-500 text-xs">Badges will be awarded automatically when students complete this test.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-gray-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Student Name</th>
                      <th className="px-4 py-3 text-left">Register No.</th>
                      <th className="px-4 py-3 text-left">Badge</th>
                      <th className="px-4 py-3 text-left">Badge Rank</th>
                      <th className="px-4 py-3 text-left">Awarded Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {winners.map((w, idx) => (
                      <tr key={w.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-500 text-slate-900' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-orange-400 text-slate-900' : 'bg-white/10 text-gray-300'}`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-white">{w.studentName}</td>
                        <td className="px-4 py-3 text-gray-400 font-mono">{w.studentRegisterNumber}</td>
                        <td className="px-4 py-3 text-amber-400 font-bold">{w.badgeName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${w.rankAchieved?.includes('1') ? 'bg-amber-500/20 text-amber-400' : w.rankAchieved?.includes('2') ? 'bg-slate-300/20 text-slate-300' : w.rankAchieved?.includes('3') ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-gray-300'}`}>
                            {getRankBadgeLabel(w.rankAchieved)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatISTDateTime(w.awardedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Create / Edit Badge Set (Dynamic sets tab) */}
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
              {/* Linked Test ID Display */}
              <div className="space-y-1.5">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Test ID (from Question Management)</label>
                <div className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-3 text-emerald-400 font-mono font-bold text-sm flex items-center justify-between shadow-inner">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {editingSet?.testCode || selectedTestObj?.testCode || 'Select a test below'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-sans font-semibold bg-white/5 px-2 py-0.5 rounded border border-white/10">Unique ID</span>
                </div>
              </div>

              {/* Select Test (for new badge sets) */}
              {!editingSet && (
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Select Question/Test</label>
                  <select
                    value={selectedTestId}
                    onChange={(e) => setSelectedTestId(Number(e.target.value))}
                    className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- Select a Question --</option>
                    {availableTests.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.testCode} — {t.name} ({t.subjectName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Auto-filled details */}
              {(selectedTestObj || editingSet) && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                  <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Question Details</div>
                  <div className="text-white font-extrabold text-base flex items-center justify-between gap-2">
                    <span>{editingSet ? editingSet.testName : selectedTestObj?.name || 'N/A'}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                      {editingSet?.testCode || selectedTestObj?.testCode || 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                    <span className="text-indigo-400 font-bold">
                      Subject: {selectedTestObj?.subjectName || editingSet?.subjectName || 'N/A'}
                    </span>
                  </div>
                </div>
              )}

              {/* Badge Set Name */}
              <div className="space-y-1.5">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Badge Set Name</label>
                <input
                  type="text"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="e.g. Inheritance Badge Set"
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
                      value={def.badgeName || ''}
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
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="Delete Badge Set"
        message="Are you sure you want to delete this badge set? This action cannot be undone and all associated badge definitions will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({ open: false, id: null })}
      />
    </div>
  );
}
