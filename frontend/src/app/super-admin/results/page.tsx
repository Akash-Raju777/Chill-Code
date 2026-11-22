'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import {
  Award,
  Medal,
  Trophy,
  Crown,
  Search,
  Filter,
  RefreshCw,
  User,
  GraduationCap,
  BookOpen,
  ChevronRight,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  X,
  ChevronLeft,
  ArrowUpDown,
  Zap,
  Star,
  ExternalLink
} from 'lucide-react';

interface StudentMedal {
  type: string;
  icon: string;
  title: string;
  subject: string;
  rank: number;
}

interface StudentBadgeItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  subject: string;
  rankAchieved?: string;
  awardedDate: string | null;
}

interface SubjectBreakdown {
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  testsCompleted: number;
  marks: number;
  maxMarks: number;
  percentage: number;
  rank: number | null;
  medal: string | null;
}

interface StudentEntry {
  id: number;
  name: string;
  registerNumber: string;
  email: string;
  department: string;
  status: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  testsCompleted: number;
  totalTimeSeconds: number;
  lastCompletedAt: string | null;
  rank: number;
  medal: string | null;
  medalType: string | null;
  subjectsParticipated: string[];
  medalsWonCount: number;
  medals: StudentMedal[];
  badgesCount: number;
  badges: StudentBadgeItem[];
  subjectBreakdown: SubjectBreakdown[];
}

interface SubjectStudentEntry {
  studentId: number;
  studentName: string;
  registerNumber: string;
  department: string;
  marks: number;
  maxMarks: number;
  percentage: number;
  testsCompleted: number;
  timeTakenSeconds: number;
  rank: number;
  medal?: string;
  medalType?: string;
  lastCompletedAt: string | null;
}

interface SubjectLeaderboardData {
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  students: SubjectStudentEntry[];
}

interface HallOfFameItem {
  id: string;
  studentId: number;
  studentName: string;
  studentRegisterNumber: string;
  department: string;
  awardName: string;
  badgeIcon: string;
  subject: string;
  achievementType: 'MEDAL' | 'LANGUAGE_MASTER' | 'BADGE' | string;
  rank: number | null;
  awardedDate: string | null;
}

interface OverviewData {
  summary: {
    totalStudents: number;
    activeParticipants: number;
    totalTestsConducted: number;
    totalMedalsAwarded: number;
    totalBadgesEarned: number;
  };
  topThree: StudentEntry[];
  departmentLeaderboard: StudentEntry[];
  subjectLeaderboards: Record<string, SubjectLeaderboardData>;
  subjects: Array<{ id: number; name: string; color: string }>;
  hallOfFame: HallOfFameItem[];
}

export default function DepartmentLeaderboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Navigation tab: 'overall' | 'subjects' | 'hall-of-fame'
  const [activeTab, setActiveTab] = useState<'overall' | 'subjects' | 'hall-of-fame'>('overall');

  // Filters for Department Leaderboard
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PARTICIPATED' | 'ZERO'
  const [subjectParticipationFilter, setSubjectParticipationFilter] = useState('ALL');

  // Subject View State
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');

  // Hall of Fame Filters
  const [hofTypeFilter, setHofTypeFilter] = useState('ALL'); // 'ALL' | 'MEDAL' | 'LANGUAGE_MASTER' | 'BADGE'
  const [hofSubjectFilter, setHofSubjectFilter] = useState('ALL');
  const [hofSearchQuery, setHofSearchQuery] = useState('');

  // Pagination for main table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Student details modal
  const [selectedStudent, setSelectedStudent] = useState<StudentEntry | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLeaderboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall('/api/super-admin/leaderboard/overview');
      setData(res as OverviewData);

      // Default selected subject to first available
      if (res && res.subjects && res.subjects.length > 0 && selectedSubjectId === null) {
        setSelectedSubjectId(res.subjects[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load department leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  // Unique departments for filter dropdown
  const uniqueDepartments = useMemo(() => {
    if (!data?.departmentLeaderboard) return [];
    const depts = new Set<string>();
    data.departmentLeaderboard.forEach((s) => {
      if (s.department && s.department.trim()) depts.add(s.department.trim());
    });
    return Array.from(depts).sort();
  }, [data]);

  // Filtered department leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (!data?.departmentLeaderboard) return [];

    return data.departmentLeaderboard.filter((student) => {
      // Search by name or register number
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = student.name?.toLowerCase().includes(query);
        const matchesReg = student.registerNumber?.toLowerCase().includes(query);
        if (!matchesName && !matchesReg) return false;
      }

      // Department filter
      if (deptFilter !== 'ALL' && student.department !== deptFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'PARTICIPATED' && student.testsCompleted === 0) return false;
      if (statusFilter === 'ZERO' && student.testsCompleted > 0) return false;

      // Subject participation filter
      if (
        subjectParticipationFilter !== 'ALL' &&
        !student.subjectsParticipated?.includes(subjectParticipationFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [data, searchQuery, deptFilter, statusFilter, subjectParticipationFilter]);

  // Paginated records
  const paginatedStudents = useMemo(() => {
    if (pageSize === -1) return filteredLeaderboard; // All
    const start = (currentPage - 1) * pageSize;
    return filteredLeaderboard.slice(start, start + pageSize);
  }, [filteredLeaderboard, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredLeaderboard.length / pageSize) || 1;

  // Selected subject data
  const currentSubjectData = useMemo(() => {
    if (!data?.subjectLeaderboards || selectedSubjectId === null) return null;
    return data.subjectLeaderboards[String(selectedSubjectId)] || null;
  }, [data, selectedSubjectId]);

  // Filtered subject students
  const filteredSubjectStudents = useMemo(() => {
    if (!currentSubjectData?.students) return [];
    if (!subjectSearchQuery.trim()) return currentSubjectData.students;
    const q = subjectSearchQuery.toLowerCase();
    return currentSubjectData.students.filter(
      (s) => s.studentName.toLowerCase().includes(q) || s.registerNumber.toLowerCase().includes(q)
    );
  }, [currentSubjectData, subjectSearchQuery]);

  // Filtered Hall of Fame
  const filteredHallOfFame = useMemo(() => {
    if (!data?.hallOfFame) return [];
    return data.hallOfFame.filter((item) => {
      if (hofTypeFilter !== 'ALL' && item.achievementType !== hofTypeFilter) return false;
      if (hofSubjectFilter !== 'ALL' && item.subject !== hofSubjectFilter) return false;
      if (hofSearchQuery.trim()) {
        const q = hofSearchQuery.toLowerCase();
        const matchName = item.studentName?.toLowerCase().includes(q);
        const matchReg = item.studentRegisterNumber?.toLowerCase().includes(q);
        const matchAward = item.awardName?.toLowerCase().includes(q);
        if (!matchName && !matchReg && !matchAward) return false;
      }
      return true;
    });
  }, [data, hofTypeFilter, hofSubjectFilter, hofSearchQuery]);

  // Active podium students based on tab/subject
  const activePodium = useMemo(() => {
    if (activeTab === 'subjects' && currentSubjectData?.students) {
      const top3 = currentSubjectData.students.filter((s) => s.rank <= 3 && s.marks > 0);
      const r1 = top3.find((s) => s.rank === 1);
      const r2 = top3.find((s) => s.rank === 2);
      const r3 = top3.find((s) => s.rank === 3);
      return { r1, r2, r3, title: `${currentSubjectData.subjectName} Top Performers` };
    }

    // Default to overall top 3
    if (data?.topThree) {
      const r1 = data.topThree.find((s) => s.rank === 1);
      const r2 = data.topThree.find((s) => s.rank === 2);
      const r3 = data.topThree.find((s) => s.rank === 3);
      return { r1, r2, r3, title: 'Department Championship Podium' };
    }

    return { r1: undefined, r2: undefined, r3: undefined, title: 'Department Championship Podium' };
  }, [activeTab, currentSubjectData, data]);

  if (loading || !mounted) {
    return (
      <div className="space-y-6 pb-12">
        <div className="h-10 w-96 bg-white/5 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-96 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const summary = data?.summary || {
    totalStudents: 0,
    activeParticipants: 0,
    totalTestsConducted: 0,
    totalMedalsAwarded: 0,
    totalBadgesEarned: 0,
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
              <Crown className="w-3 h-3 text-amber-400" /> Department Rankings & Honors
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1.5 flex items-center gap-3">
            Department Leaderboard & Student Achievement Hall
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Complete student rankings, verified test scores, subject-wise medals, and the institutional Hall of Fame.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLeaderboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-white transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            {refreshing ? 'Updating...' : 'Sync Leaderboard'}
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Students */}
        <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <GraduationCap className="w-16 h-16 text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Enrolled Students
          </span>
          <div className="text-3xl font-black text-white mt-1.5 tracking-tight">
            {summary.totalStudents}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>100% Student Roster Tracked</span>
          </div>
        </div>

        {/* Active Participants */}
        <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-16 h-16 text-cyan-400" />
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Active Participants
          </span>
          <div className="text-3xl font-black text-white mt-1.5 tracking-tight">
            {summary.activeParticipants}
          </div>
          <div className="text-xs text-gray-400 font-medium mt-2">
            <span className="text-cyan-400 font-bold">
              {summary.totalStudents > 0
                ? Math.round((summary.activeParticipants / summary.totalStudents) * 100)
                : 0}
              %
            </span>{' '}
            participation rate
          </div>
        </div>

        {/* Total Medals */}
        <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Medal className="w-16 h-16 text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Medals Awarded
          </span>
          <div className="text-3xl font-black text-amber-400 mt-1.5 tracking-tight flex items-center gap-2">
            {summary.totalMedalsAwarded}
            <span className="text-base">🥇🥈🥉</span>
          </div>
          <div className="text-xs text-gray-400 font-medium mt-2">
            Overall & Subject Champions
          </div>
        </div>

        {/* Badges & Honors */}
        <div className="bg-[#12141c] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Award className="w-16 h-16 text-purple-400" />
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Badges & Honors
          </span>
          <div className="text-3xl font-black text-purple-400 mt-1.5 tracking-tight">
            {summary.totalBadgesEarned}
          </div>
          <div className="text-xs text-gray-400 font-medium mt-2">
            Masteries & Milestone Badges
          </div>
        </div>
      </div>

      {/* 3. Top Performers Podium */}
      <div className="bg-[#12141c] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-white/5 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {activePodium.title}
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Top 3 verified performers based on verified marks, speed, and completion time.
            </p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-xs text-gray-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Priority: Marks &rarr; Time &rarr; Submission</span>
          </div>
        </div>

        {/* Podium Layout */}
        <div className="pt-8 sm:pt-12 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto">
            {/* Rank 2: Silver (Left) */}
            <div className="order-2 md:order-1 flex flex-col items-center">
              {activePodium.r2 ? (
                <div
                  onClick={() => {
                    const st = data?.departmentLeaderboard.find(
                      (s) => s.id === ('studentId' in activePodium.r2! ? (activePodium.r2 as any).studentId : (activePodium.r2 as any).id)
                    );
                    if (st) setSelectedStudent(st);
                  }}
                  className="cursor-pointer group flex flex-col items-center w-full transition-transform hover:-translate-y-1 duration-200"
                >
                  <div className="relative mb-3">
                    <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center text-xl font-black text-slate-200 shadow-lg shadow-slate-500/20 group-hover:scale-105 transition-transform">
                      🥈
                    </div>
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-slate-300 text-slate-900 text-[10px] font-black rounded-full shadow">
                      #2
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base text-center group-hover:text-slate-200 transition-colors">
                    {(activePodium.r2 as any).studentName || (activePodium.r2 as any).name}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {activePodium.r2.registerNumber}
                  </p>
                  <div className="mt-2 text-center">
                    <span className="text-sm font-black text-slate-200">
                      {'marks' in activePodium.r2 ? (activePodium.r2 as any).marks : (activePodium.r2 as any).totalMarks} pts
                    </span>
                    <span className="text-[11px] text-gray-400 ml-1.5">
                      ({activePodium.r2.percentage}%)
                    </span>
                  </div>
                  {/* Pedestal Base */}
                  <div className="w-full mt-4 h-24 bg-gradient-to-t from-slate-900/90 to-slate-800/60 border-t-2 border-slate-400/50 rounded-t-xl flex flex-col items-center justify-center shadow-inner">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-slate-300">
                      Silver Medal
                    </span>
                    <span className="text-[11px] text-gray-400 mt-0.5">
                      {activePodium.r2.testsCompleted} tests completed
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center py-8 border border-dashed border-white/10 rounded-2xl text-gray-500 text-xs">
                  <div className="text-2xl mb-1 opacity-50">🥈</div>
                  <span>Silver Podium Open</span>
                </div>
              )}
            </div>

            {/* Rank 1: Gold (Center - Highest) */}
            <div className="order-1 md:order-2 flex flex-col items-center">
              {activePodium.r1 ? (
                <div
                  onClick={() => {
                    const st = data?.departmentLeaderboard.find(
                      (s) => s.id === ('studentId' in activePodium.r1! ? (activePodium.r1 as any).studentId : (activePodium.r1 as any).id)
                    );
                    if (st) setSelectedStudent(st);
                  }}
                  className="cursor-pointer group flex flex-col items-center w-full transition-transform hover:-translate-y-1.5 duration-200"
                >
                  <div className="relative mb-3">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-300 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-amber-500/30 group-hover:scale-105 transition-transform ring-4 ring-amber-500/20">
                      🥇
                    </div>
                    <span className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-amber-400 text-amber-950 text-xs font-black rounded-full shadow-lg">
                      #1
                    </span>
                  </div>
                  <h3 className="font-extrabold text-white text-lg text-center group-hover:text-amber-300 transition-colors">
                    {(activePodium.r1 as any).studentName || (activePodium.r1 as any).name}
                  </h3>
                  <p className="text-xs text-amber-400/80 font-mono font-medium mt-0.5">
                    {activePodium.r1.registerNumber} &bull; {activePodium.r1.department}
                  </p>
                  <div className="mt-2 text-center">
                    <span className="text-base font-black text-amber-300">
                      {'marks' in activePodium.r1 ? (activePodium.r1 as any).marks : (activePodium.r1 as any).totalMarks} pts
                    </span>
                    <span className="text-xs text-gray-300 ml-1.5 font-bold">
                      ({activePodium.r1.percentage}%)
                    </span>
                  </div>
                  {/* Pedestal Base */}
                  <div className="w-full mt-4 h-32 bg-gradient-to-t from-amber-950/80 to-amber-900/40 border-t-2 border-amber-400 rounded-t-xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-amber-500/5 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-400" /> Champion Gold
                    </span>
                    <span className="text-[11px] text-amber-200/70 mt-1 font-medium">
                      {activePodium.r1.testsCompleted} tests completed
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center py-12 border border-dashed border-amber-500/20 rounded-2xl text-gray-500 text-xs">
                  <div className="text-3xl mb-1 opacity-50">🥇</div>
                  <span>Gold Podium Open</span>
                </div>
              )}
            </div>

            {/* Rank 3: Bronze (Right) */}
            <div className="order-3 flex flex-col items-center">
              {activePodium.r3 ? (
                <div
                  onClick={() => {
                    const st = data?.departmentLeaderboard.find(
                      (s) => s.id === ('studentId' in activePodium.r3! ? (activePodium.r3 as any).studentId : (activePodium.r3 as any).id)
                    );
                    if (st) setSelectedStudent(st);
                  }}
                  className="cursor-pointer group flex flex-col items-center w-full transition-transform hover:-translate-y-1 duration-200"
                >
                  <div className="relative mb-3">
                    <div className="w-16 h-16 rounded-full bg-amber-950/80 border-2 border-amber-700 flex items-center justify-center text-xl font-black text-amber-500 shadow-lg shadow-amber-800/20 group-hover:scale-105 transition-transform">
                      🥉
                    </div>
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-amber-700 text-amber-100 text-[10px] font-black rounded-full shadow">
                      #3
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base text-center group-hover:text-amber-500 transition-colors">
                    {(activePodium.r3 as any).studentName || (activePodium.r3 as any).name}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {activePodium.r3.registerNumber}
                  </p>
                  <div className="mt-2 text-center">
                    <span className="text-sm font-black text-amber-500">
                      {'marks' in activePodium.r3 ? (activePodium.r3 as any).marks : (activePodium.r3 as any).totalMarks} pts
                    </span>
                    <span className="text-[11px] text-gray-400 ml-1.5">
                      ({activePodium.r3.percentage}%)
                    </span>
                  </div>
                  {/* Pedestal Base */}
                  <div className="w-full mt-4 h-20 bg-gradient-to-t from-amber-950/60 to-stone-900 border-t-2 border-amber-700/60 rounded-t-xl flex flex-col items-center justify-center shadow-inner">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-amber-600">
                      Bronze Medal
                    </span>
                    <span className="text-[11px] text-gray-400 mt-0.5">
                      {activePodium.r3.testsCompleted} tests completed
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center py-8 border border-dashed border-white/10 rounded-2xl text-gray-500 text-xs">
                  <div className="text-2xl mb-1 opacity-50">🥉</div>
                  <span>Bronze Podium Open</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation Switcher */}
      <div className="flex border-b border-white/10 gap-2 sm:gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overall')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'overall'
              ? 'border-emerald-400 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Trophy className="w-4 h-4 text-emerald-400" />
          Department Leaderboard ({filteredLeaderboard.length})
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'subjects'
              ? 'border-cyan-400 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <BookOpen className="w-4 h-4 text-cyan-400" />
          Subject-Wise Leaderboards
        </button>

        <button
          onClick={() => setActiveTab('hall-of-fame')}
          className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'hall-of-fame'
              ? 'border-amber-400 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-400" />
          Student Achievement Hall & Medals ({filteredHallOfFame.length})
        </button>
      </div>

      {/* 5. TAB 1: Department Leaderboard (ALL Students) */}
      {activeTab === 'overall' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student or register no..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#181b26] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Department Filter */}
              <div>
                <select
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Participated Filter */}
              <div>
                <select
                  value={subjectParticipationFilter}
                  onChange={(e) => {
                    setSubjectParticipationFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="ALL">All Subjects</option>
                  {data?.subjects?.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      Participated in {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Participation Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="ALL">All Students ({summary.totalStudents})</option>
                  <option value="PARTICIPATED">Active Participants ({summary.activeParticipants})</option>
                  <option value="ZERO">Zero Tests / Inactive ({summary.totalStudents - summary.activeParticipants})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  Official Department Standings
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Displaying {filteredLeaderboard.length} enrolled student(s) ranked according to priority rules.
                </p>
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#181b26] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>All ({filteredLeaderboard.length})</option>
                </select>
              </div>
            </div>

            {filteredLeaderboard.length === 0 ? (
              <div className="p-12 text-center text-gray-500 text-sm">
                No students match your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                      <th className="py-3.5 px-4">Student</th>
                      <th className="py-3.5 px-4">Department</th>
                      <th className="py-3.5 px-4 text-right">Total Marks</th>
                      <th className="py-3.5 px-4 text-center">Overall %</th>
                      <th className="py-3.5 px-4 text-center">Tests</th>
                      <th className="py-3.5 px-4">Subjects Handled</th>
                      <th className="py-3.5 px-4 text-center">Medals Won</th>
                      <th className="py-3.5 px-4 text-center">Badges</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {paginatedStudents.map((st) => (
                      <tr
                        key={st.id}
                        onClick={() => setSelectedStudent(st)}
                        className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        {/* Rank & Medal */}
                        <td className="py-3.5 px-4 text-center">
                          {st.rank === 1 && (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 text-sm shadow-sm">
                              🥇
                            </span>
                          )}
                          {st.rank === 2 && (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/20 text-slate-200 font-black border border-slate-400/40 text-sm shadow-sm">
                              🥈
                            </span>
                          )}
                          {st.rank === 3 && (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-900/30 text-amber-500 font-black border border-amber-700/40 text-sm shadow-sm">
                              🥉
                            </span>
                          )}
                          {st.rank > 3 && (
                            <span className="text-gray-400 font-mono font-bold text-xs">
                              #{st.rank}
                            </span>
                          )}
                        </td>

                        {/* Student Name & Register Number */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {st.name}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            {st.registerNumber}
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4">
                          <span className="text-gray-300">{st.department}</span>
                        </td>

                        {/* Total Marks */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-black text-sm ${
                              st.totalMarks > 0 ? 'text-emerald-400' : 'text-gray-500'
                            }`}
                          >
                            {st.totalMarks}
                          </span>
                        </td>

                        {/* Percentage */}
                        <td className="py-3.5 px-4 text-center">
                          {st.testsCompleted > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`font-extrabold text-xs ${
                                  st.percentage >= 75
                                    ? 'text-emerald-400'
                                    : st.percentage >= 50
                                    ? 'text-cyan-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {st.percentage}%
                              </span>
                              <div className="w-12 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-400 rounded-full"
                                  style={{ width: `${Math.min(100, st.percentage)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-600 font-mono">-</span>
                          )}
                        </td>

                        {/* Tests Completed */}
                        <td className="py-3.5 px-4 text-center font-bold text-cyan-400">
                          {st.testsCompleted}
                        </td>

                        {/* Subjects Participated */}
                        <td className="py-3.5 px-4">
                          {st.subjectsParticipated && st.subjectsParticipated.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {st.subjectsParticipated.map((sub, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 border border-white/10 text-gray-300"
                                >
                                  {sub}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-600 text-[11px] italic">None yet</span>
                          )}
                        </td>

                        {/* Medals Won */}
                        <td className="py-3.5 px-4 text-center">
                          {st.medalsWonCount > 0 ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs">
                              <Medal className="w-3.5 h-3.5 text-amber-400" />
                              <span>{st.medalsWonCount}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600 font-mono">-</span>
                          )}
                        </td>

                        {/* Badges and Awards */}
                        <td className="py-3.5 px-4 text-center">
                          {st.badgesCount > 0 ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold text-xs">
                              <Award className="w-3.5 h-3.5 text-purple-400" />
                              <span>{st.badgesCount}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600 font-mono">-</span>
                          )}
                        </td>

                        {/* Action View Profile */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudent(st);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-gray-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                          >
                            <span>Profile</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
                <div>
                  Showing {(currentPage - 1) * pageSize + 1} to{' '}
                  {Math.min(currentPage * pageSize, filteredLeaderboard.length)} of{' '}
                  {filteredLeaderboard.length} students
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 bg-white/5 rounded-lg font-mono text-white">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 2: Subject-Wise Leaderboards */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          {/* Subject Pills Selector */}
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                Select Subject Domain
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {data?.subjects?.map((sub) => {
                const isSelected = selectedSubjectId === sub.id;
                const subData = data.subjectLeaderboards?.[String(sub.id)];
                const studentCount = subData?.students?.length || 0;

                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubjectId(sub.id);
                      setSubjectSearchQuery('');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md shadow-cyan-500/10'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                    }`}
                  >
                    <span>{sub.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isSelected ? 'bg-cyan-400 text-cyan-950' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {studentCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject Ranked Table */}
          {currentSubjectData && (
            <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: currentSubjectData.subjectColor || '#06b6d4' }}
                    />
                    {currentSubjectData.subjectName} Subject Standings
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Ranked by marks &gt; test cases &gt; speed &gt; submission time. Non-participants are excluded.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search candidate..."
                    value={subjectSearchQuery}
                    onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    className="w-full bg-[#181b26] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {filteredSubjectStudents.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-sm">
                  No student records found for {currentSubjectData.subjectName}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                        <th className="py-3.5 px-4">Student</th>
                        <th className="py-3.5 px-4">Department</th>
                        <th className="py-3.5 px-4 text-right">Subject Marks</th>
                        <th className="py-3.5 px-4 text-center">Percentage</th>
                        <th className="py-3.5 px-4 text-center">Tests Taken</th>
                        <th className="py-3.5 px-4 text-center">Subject Medal</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {filteredSubjectStudents.map((st) => (
                        <tr
                          key={st.studentId}
                          onClick={() => {
                            const full = data?.departmentLeaderboard.find(
                              (s) => s.id === st.studentId
                            );
                            if (full) setSelectedStudent(full);
                          }}
                          className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                        >
                          {/* Rank */}
                          <td className="py-3.5 px-4 text-center">
                            {st.rank === 1 && (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-500/40 text-sm">
                                🥇
                              </span>
                            )}
                            {st.rank === 2 && (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/20 text-slate-200 font-black border border-slate-400/40 text-sm">
                                🥈
                              </span>
                            )}
                            {st.rank === 3 && (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-900/30 text-amber-500 font-black border border-amber-700/40 text-sm">
                                🥉
                              </span>
                            )}
                            {st.rank > 3 && (
                              <span className="text-gray-400 font-mono font-bold text-xs">
                                #{st.rank}
                              </span>
                            )}
                          </td>

                          {/* Student */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                              {st.studentName}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              {st.registerNumber}
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-4 text-gray-400">{st.department}</td>

                          {/* Marks */}
                          <td className="py-3.5 px-4 text-right font-black text-cyan-400 text-sm">
                            {st.marks} / {st.maxMarks}
                          </td>

                          {/* Percentage */}
                          <td className="py-3.5 px-4 text-center font-bold text-white">
                            {st.percentage}%
                          </td>

                          {/* Tests Completed */}
                          <td className="py-3.5 px-4 text-center font-bold text-emerald-400">
                            {st.testsCompleted}
                          </td>

                          {/* Medal Won */}
                          <td className="py-3.5 px-4 text-center">
                            {st.medal ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-extrabold text-xs">
                                <span>{st.medal}</span>
                                <span>{st.medalType}</span>
                              </span>
                            ) : (
                              <span className="text-gray-500 text-xs font-mono">Participant</span>
                            )}
                          </td>

                          {/* Profile Button */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const full = data?.departmentLeaderboard.find(
                                  (s) => s.id === st.studentId
                                );
                                if (full) setSelectedStudent(full);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-400 border border-white/10 hover:border-cyan-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                            >
                              <span>Profile</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 3: Student Achievement Hall (Hall of Fame) */}
      {activeTab === 'hall-of-fame' && (
        <div className="space-y-6">
          {/* Hall of Fame Filter Controls */}
          <div className="bg-[#12141c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search award, student or reg no..."
                  value={hofSearchQuery}
                  onChange={(e) => setHofSearchQuery(e.target.value)}
                  className="w-full bg-[#181b26] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Award Type Filter */}
              <div>
                <select
                  value={hofTypeFilter}
                  onChange={(e) => setHofTypeFilter(e.target.value)}
                  className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Honors & Awards</option>
                  <option value="MEDAL">🥇 Medals Only (Gold, Silver, Bronze)</option>
                  <option value="LANGUAGE_MASTER">🎖️ Language Masters (Java, Python...)</option>
                  <option value="BADGE">⚡ Custom Badges & Milestones</option>
                </select>
              </div>

              {/* Subject Filter */}
              <div>
                <select
                  value={hofSubjectFilter}
                  onChange={(e) => setHofSubjectFilter(e.target.value)}
                  className="w-full bg-[#181b26] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Subject Domains</option>
                  <option value="Overall Department">Overall Department</option>
                  {data?.subjects?.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Hall of Fame Honors Cards Grid */}
          {filteredHallOfFame.length === 0 ? (
            <div className="bg-[#12141c] border border-white/10 rounded-2xl p-12 text-center text-gray-500 text-sm shadow-xl">
              No honors match your criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHallOfFame.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    const full = data?.departmentLeaderboard.find((s) => s.id === item.studentId);
                    if (full) setSelectedStudent(full);
                  }}
                  className="bg-[#12141c] border border-white/10 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg transition-all hover:-translate-y-1 cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {item.badgeIcon}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm group-hover:text-amber-400 transition-colors">
                          {item.awardName}
                        </h4>
                        <span className="text-[11px] text-gray-400 font-medium">
                          {item.subject}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        item.achievementType === 'MEDAL'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : item.achievementType === 'LANGUAGE_MASTER'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}
                    >
                      {item.achievementType === 'MEDAL'
                        ? 'Championship Medal'
                        : item.achievementType === 'LANGUAGE_MASTER'
                        ? 'Language Master'
                        : 'Badge'}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-gray-200">{item.studentName}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {item.studentRegisterNumber}
                      </div>
                    </div>

                    {item.awardedDate && (
                      <div className="text-right text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span>{new Date(item.awardedDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. Individual Student Performance Profile Modal */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="bg-[#12141c] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-2xl font-black text-emerald-400">
                  {selectedStudent.medal || selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">
                    {selectedStudent.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    <span className="font-mono text-emerald-400 font-semibold">
                      {selectedStudent.registerNumber}
                    </span>
                    <span>&bull;</span>
                    <span>{selectedStudent.department}</span>
                    <span>&bull;</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300">
                      {selectedStudent.status}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Overall Rank
                </span>
                <span className="text-xl font-black text-amber-400 mt-1 block">
                  #{selectedStudent.rank} {selectedStudent.medal}
                </span>
              </div>

              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Total Marks
                </span>
                <span className="text-xl font-black text-emerald-400 mt-1 block">
                  {selectedStudent.totalMarks} pts
                </span>
              </div>

              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Percentage
                </span>
                <span className="text-xl font-black text-cyan-400 mt-1 block">
                  {selectedStudent.percentage}%
                </span>
              </div>

              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Tests Taken
                </span>
                <span className="text-xl font-black text-white mt-1 block">
                  {selectedStudent.testsCompleted}
                </span>
              </div>

              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Medals Won
                </span>
                <span className="text-xl font-black text-amber-400 mt-1 block">
                  {selectedStudent.medalsWonCount}
                </span>
              </div>

              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Badges Earned
                </span>
                <span className="text-xl font-black text-purple-400 mt-1 block">
                  {selectedStudent.badgesCount}
                </span>
              </div>
            </div>

            {/* Subject-Wise Performance Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Subject-Wise Performance Breakdown
              </h4>

              {selectedStudent.subjectBreakdown && selectedStudent.subjectBreakdown.length > 0 ? (
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3 text-center">Tests</th>
                        <th className="py-2.5 px-3 text-right">Marks</th>
                        <th className="py-2.5 px-3 text-center">Percentage</th>
                        <th className="py-2.5 px-3 text-right">Subject Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {selectedStudent.subjectBreakdown.map((sb, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {sb.subjectName}
                          </td>
                          <td className="py-2.5 px-3 text-center">{sb.testsCompleted}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                            {sb.marks}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">{sb.percentage}%</td>
                          <td className="py-2.5 px-3 text-right">
                            {sb.medal ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                                <span>{sb.medal}</span> #{sb.rank}
                              </span>
                            ) : sb.rank ? (
                              <span className="font-mono text-gray-400">#{sb.rank}</span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
                  No tests attempted in any subject yet.
                </div>
              )}
            </div>

            {/* Medals & Achievements History */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-400" />
                Medals & Badges Portfolio
              </h4>

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {/* Medals */}
                {selectedStudent.medals?.map((med, idx) => (
                  <div
                    key={`m-${idx}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold"
                  >
                    <span className="text-base">{med.icon}</span>
                    <span>{med.title}</span>
                  </div>
                ))}

                {/* Badges */}
                {selectedStudent.badges?.map((bg) => (
                  <div
                    key={bg.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold"
                  >
                    <span className="text-base">{bg.icon}</span>
                    <span>{bg.name}</span>
                    <span className="text-[10px] text-purple-400/80 font-mono">
                      ({bg.category})
                    </span>
                  </div>
                ))}

                {(!selectedStudent.medals || selectedStudent.medals.length === 0) &&
                  (!selectedStudent.badges || selectedStudent.badges.length === 0) && (
                    <div className="w-full text-center py-4 text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
                      No medals or badges earned yet.
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
