'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, formatISTDate, formatISTDateTime } from '../../../utils/api';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/authStore';
import { useTestStore } from '../../../store/testStore';
import { useSecurityStore } from '../../../store/securityStore';
import { toast } from '../../../store/toastStore';
import { 
  CheckCircle2, 
  Circle, 
  XCircle, 
  Search, 
  Bell, 
  ChevronDown, 
  ArrowRight, 
  AlertCircle,
  Zap,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface Test {
  id: number;
  name: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  maxMarks: number;
  instructions: string;
  securityShieldEnabled?: boolean;
  subject: {
    id: number;
    name: string;
    color: string;
  };
}

interface StudentTest {
  id: number;
  status: string;
  score: number;
  warningsCount: number;
  isSuspended: boolean;
  test: Test;
  submittedAt?: string;
  startedAt?: string;
  reattemptStatus?: string | null;
  reattemptQuestionId?: number | null;
}

export default function TestsWorkspace() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [studentTests, setStudentTests] = useState<StudentTest[]>([]);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [solvedQuestionIds, setSolvedQuestionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTest, setSelectedTest] = useState<StudentTest | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [startingTest, setStartingTest] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });


  // Search & Filter state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<number | 'ALL'>('ALL');
  const [hideSolved, setHideSolved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchingRef = React.useRef(false);
  const pendingReattemptQuestionIdsRef = React.useRef<Set<number>>(new Set());

  const { startTestSession } = useTestStore();
  const { resetWarnings } = useSecurityStore();

  const applyPendingReattempts = (questions: any[]) => {
    return (questions || []).map((q: any) => {
      if (pendingReattemptQuestionIdsRef.current.has(q.id)) {
        if (q.status === 'NOT_STARTED') {
          pendingReattemptQuestionIdsRef.current.delete(q.id);
          return q;
        }
        return { ...q, status: 'PENDING_REATTEMPT' };
      }
      return q;
    });
  };

  const fetchTests = async (isInitial = true) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      if (isInitial) {
        const [testsData, questionsData, subjectsData] = await Promise.all([
          apiCall('/api/student/tests'),
          apiCall('/api/student/questions'),
          apiCall('/api/student/subjects'),
        ]);
        setStudentTests(testsData);
        setQuestionsList(applyPendingReattempts(questionsData));
        setSubjects(subjectsData);
      } else {
        const [testsData, questionsData] = await Promise.all([
          apiCall('/api/student/tests'),
          apiCall('/api/student/questions'),
        ]);
        setStudentTests(testsData);
        setQuestionsList(applyPendingReattempts(questionsData));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch practice challenges.');
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  };

  const fetchTestsRef = React.useRef(fetchTests);
  useEffect(() => {
    fetchTestsRef.current = fetchTests;
  });

  useEffect(() => {
    router.refresh();
    fetchTestsRef.current(true);

    const interval = setInterval(() => {
      fetchTestsRef.current(false);
    }, 10000);

    // Auto-refresh questions list when the student returns to/focuses this browser tab
    const handleFocus = () => {
      fetchTestsRef.current(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const getAssociatedTest = (subjectId: number, questionId?: number) => {
    if (questionId) {
      const specific = studentTests.find((st) =>
        (st.test as any)?.questions?.some((tq: any) => tq.id === questionId)
      );
      if (specific) return specific;
    }
    const matched = studentTests.filter((st) => st.test?.subject?.id === subjectId);
    if (matched.length === 0) return null;
    const active = matched.find((st) => ['STARTED', 'ASSIGNED'].includes(st.status));
    return active || matched[0];
  };

  const handleStartQuestionAttempt = (q: any) => {
    const associatedTest = getAssociatedTest(q.subjectId, q.id);
    if (associatedTest) {
      if ((associatedTest.status === 'SUBMITTED' || associatedTest.status === 'EVALUATED') && q.status === 'COMPLETED') {
        handleViewQuestionAttempt(q);
        return;
      }
      setSelectedQuestion(q);
      setSelectedTest(associatedTest);
      setShowConfirmModal(true);
    } else {
      setError('No active practice block assigned for this subject.');
    }
  };

  const handleViewQuestionAttempt = async (q: any) => {
    const associatedTest = getAssociatedTest(q.subjectId, q.id);
    if (!associatedTest) return;
    try {
      resetWarnings();
      router.push(`/student/tests/${associatedTest.test.id}?question=${q.id}&view=true`);
    } catch (err: any) {
      setError(err.message || 'Failed to enter view mode.');
    }
  };

  const handleRequestReattempt = (testId: number, questionId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Reattempt Request',
      message: 'Are you sure you want to request another attempt from the admin? This will let you write this problem again once approved.',
      onConfirm: async () => {
        pendingReattemptQuestionIdsRef.current.add(questionId);
        setQuestionsList((prev) =>
          prev.map((q) => (q.id === questionId ? { ...q, status: 'PENDING_REATTEMPT' } : q))
        );
        setStudentTests((prev) =>
          prev.map((t) => (t.test.id === testId ? { ...t, reattemptStatus: 'PENDING', reattemptQuestionId: questionId } : t))
        );
        try {
          await apiCall(`/api/student/tests/${testId}/request-reattempt?questionId=${questionId}`, {
            method: 'POST',
          });
          toast.success('Your reattempt request has been submitted to the admin successfully.');
          fetchTests(false);
        } catch (err: any) {
          toast.error(err.message || 'Failed to submit reattempt request.');
          fetchTests(false);
        }
      }
    });
  };

  const handleAnotherAttempt = (questionId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Question Attempt',
      message: 'Are you sure you want to attempt this question again? Only this question will be reset.',
      onConfirm: async () => {
        try {
          await apiCall(`/api/student/question/${questionId}/another-attempt`, {
            method: 'POST',
          });
          setQuestionsList((prev) =>
            prev.map((q) =>
              q.id === questionId
                ? { ...q, status: 'NOT_STARTED' }
                : q
            )
          );
          toast.success('Attempt reset successfully. You can now write the test again.');
          fetchTests(false);
        } catch (err: any) {
          toast.error(err.message || 'Failed to reset attempt.');
        }
      }
    });
  };

  const confirmStart = async () => {
    if (!selectedTest || !selectedQuestion) return;
    setStartingTest(true);
    try {
      const latestUser = useAuthStore.getState().user;
      const isSecActive = latestUser?.status === 'ACTIVE';

      // Auto fullscreen request on interaction gesture if security shield enabled
      if (isSecActive) {
        try {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();
          }
        } catch (fsErr) {
          console.warn("Fullscreen request was rejected/unsupported", fsErr);
        }
      }

      resetWarnings();

      // Calculate remaining time
      const baseMinutes = selectedQuestion.timer || selectedTest.test.durationMinutes || 60;
      const totalSeconds = (typeof baseMinutes === 'number' && !isNaN(baseMinutes) && baseMinutes > 0) ? baseMinutes * 60 : 3600;
      let remainingSeconds = totalSeconds;
      if (selectedTest.startedAt && selectedQuestion.status !== 'NOT_STARTED' && selectedQuestion.status) {
        let startTimeMs: number | null = null;
        if (Array.isArray(selectedTest.startedAt)) {
          const [y, m, d, h = 0, min = 0, s = 0] = selectedTest.startedAt;
          const pad = (n: number) => String(n).padStart(2, '0');
          const isoStr = `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}+05:30`;
          startTimeMs = new Date(isoStr).getTime();
        } else {
          const trimmed = selectedTest.startedAt.trim();
          const hasTimezone = trimmed.endsWith('Z') || /[-+]\d{2}:?\d{2}$/.test(trimmed);
          const dateStr = hasTimezone ? trimmed : trimmed.replace(' ', 'T') + '+05:30';
          startTimeMs = new Date(dateStr).getTime();
        }

        if (startTimeMs && !isNaN(startTimeMs)) {
          const elapsedSeconds = Math.floor((Date.now() - startTimeMs) / 1000);
          remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        }
      }

      // 1. INSTANT TEST SESSION START - Zero latency UI transition
      startTestSession(
        selectedTest.test.id,
        selectedTest.id,
        selectedQuestion.title,
        [selectedQuestion],
        remainingSeconds,
        false, // isViewMode = false
        selectedTest.test.securityShieldEnabled ?? false,
        latestUser?.id
      );

      // Check local code backup for this user & question
      if (latestUser?.id) {
        const backup = localStorage.getItem(`chillcode_code_backup_${latestUser.id}_${selectedQuestion.id}`);
        if (backup) {
          useTestStore.getState().updateCode(selectedQuestion.id, backup);
        }
      }

      // Close modal and navigate immediately
      setShowConfirmModal(false);
      router.push(`/student/tests/${selectedTest.test.id}?question=${selectedQuestion.id}`);

      // 2. BACKGROUND ASYNC SYNC (Non-blocking)
      apiCall(`/api/student/tests/${selectedTest.test.id}/start?questionId=${selectedQuestion.id}`, {
        method: 'POST',
      }).then((updatedSt) => {
        if (updatedSt && updatedSt.id) {
          useTestStore.setState({ activeStudentTestId: updatedSt.id });
        }
      }).catch((err) => {
        console.warn("Background start sync notice:", err);
      });

      apiCall('/api/student/profile').then((updatedProfile) => {
        if (updatedProfile) {
          useAuthStore.getState().setUser(updatedProfile);
        }
      }).catch(() => {});

    } catch (err: any) {
      toast.error(err.message || 'Failed to start test session.');
      setShowConfirmModal(false);
    } finally {
      setStartingTest(false);
    }
  };


  // Filter Logic
  const filteredQuestions = questionsList.filter((q) => {
    const title = q.title || '';
    const subject = subjects.find((s) => s.id === q.subjectId);
    const subjectName = subject ? subject.name : '';
    const tags = q.tags || '';

    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tags.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDifficulty = difficultyFilter === 'ALL' || q.difficulty === difficultyFilter;

    const matchesSubject = subjectFilter === 'ALL' || q.subjectId === subjectFilter;

    const isSolved = q.status === 'COMPLETED' || q.overallResult === 'PASS' || q.isSolved === true;
    const matchesSolved = !hideSolved || !isSolved;

    return matchesSearch && matchesDifficulty && matchesSubject && matchesSolved;
  });

  const completedQuestions = filteredQuestions.filter((q) => {
    const hasPassed = (q.score !== undefined && q.score !== null ? q.score : 0) >= (q.passingMarks || 10);
    const isPassStatus = q.overallResult === 'PASS' || q.status === 'COMPLETED';
    return hasPassed && isPassStatus;
  });

  const notAttendedQuestions = filteredQuestions.filter((q) => {
    const isSolved = (q.score !== undefined && q.score !== null ? q.score : 0) >= (q.passingMarks || 10) && (q.overallResult === 'PASS' || q.status === 'COMPLETED');
    return !isSolved && q.status === 'NOT_STARTED';
  });

  const inProgressQuestions = filteredQuestions.filter((q) => {
    const isSolved = (q.score !== undefined && q.score !== null ? q.score : 0) >= (q.passingMarks || 10) && (q.overallResult === 'PASS' || q.status === 'COMPLETED');
    return !isSolved && q.status === 'IN_PROGRESS';
  });

  const pendingQuestions = filteredQuestions.filter((q) => {
    const isSolved = (q.score !== undefined && q.score !== null ? q.score : 0) >= (q.passingMarks || 10) && (q.overallResult === 'PASS' || q.status === 'COMPLETED');
    return !isSolved && ['PENDING', 'FAILED', 'SUSPENDED', 'PENDING_REATTEMPT', 'IN_PROGRESS'].includes(q.status);
  });

  const renderQuestionsTable = (list: any[], isCompletedTable: boolean) => {
    if (list.length === 0) {
      return (
        <div className="bg-[#11131c]/30 border border-white/5 rounded-xl p-8 text-center text-xs text-gray-500 font-medium font-sans">
          No challenges in this category matching current filters.
        </div>
      );
    }

    return (
      <div className="bg-[#11131c] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] text-gray-500 uppercase font-bold tracking-wider select-none bg-[#11131c]">
                <th className="p-4 pl-6 w-20 text-center">Status</th>
                <th className="p-4">Problem Name</th>
                <th className="p-4 w-24 text-center">Attempts</th>
                <th className="p-4 w-32">Difficulty</th>
                <th className="p-4">Tags</th>
                <th className="p-4 w-40 text-center">Last Attempt</th>
                {isCompletedTable && <th className="p-4 w-40 text-center">Solved Time</th>}
                <th className="p-4 w-36 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-gray-400">
              {list.map((q) => {
                const associatedTest = getAssociatedTest(q.subjectId);
                const isSolved = q.status === 'COMPLETED';
                const isTestSuspendedFlag = (associatedTest ? (associatedTest.isSuspended || associatedTest.status === 'SUSPENDED') : false) && user?.status === 'ACTIVE';
                // A question is suspended if it was explicitly suspended, or if the test is suspended and it was the active in-progress question
                const isSuspended = q.status === 'SUSPENDED' || (isTestSuspendedFlag && (q.status === 'IN_PROGRESS' || q.status === 'SUSPENDED'));
                const isStarted = q.status === 'IN_PROGRESS';
                const subject = subjects.find((s) => s.id === q.subjectId);
                const subjectName = subject ? subject.name : 'Unknown';

                let statusStr = "Not Attended";
                if (isSolved) statusStr = "Completed";
                else if (isSuspended) statusStr = "Suspended";
                else if (isStarted) statusStr = "In Progress";
                else if (q.status !== 'NOT_STARTED') statusStr = "Pending";

                let lastAttemptStr = "No attempt yet";
                if (q.lastAttemptAt) {
                  lastAttemptStr = formatISTDate(q.lastAttemptAt);
                } else if (associatedTest && isStarted) {
                  lastAttemptStr = "Active Session";
                }

                let solvedTimeStr = "-";
                if (isSolved && q.lastAttemptAt) {
                  solvedTimeStr = formatISTDateTime(q.lastAttemptAt);
                }

                return (
                  <tr 
                    key={q.id} 
                    className="hover:bg-white/5 transition-all group cursor-pointer"
                    onClick={() => {
                      if (isSolved) {
                        handleViewQuestionAttempt(q);
                      } else if (q.status === 'NOT_STARTED' || !q.status) {
                        if (!isSuspended) {
                          handleStartQuestionAttempt(q);
                        }
                      }
                    }}
                  >
                    <td className="p-4 pl-6 text-center">
                      <div className="inline-flex items-center justify-center">
                        {isSolved ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/5" />
                        ) : isSuspended ? (
                          <XCircle className="w-5 h-5 text-red-500 fill-red-500/5" />
                        ) : isStarted ? (
                          <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          </div>
                        ) : !isCompletedTable ? (
                          <Circle className="w-5 h-5 text-gray-600 hover:text-indigo-400 transition-colors" />
                        ) : null}
                      </div>
                    </td>

                    <td className="p-4 py-5">
                      <div className="space-y-1">
                        <span className="font-bold text-white text-sm group-hover:text-[#8b5cf6] transition-colors leading-tight">
                          {q.title}
                        </span>
                        <div className="text-[10px] text-gray-500 font-semibold flex items-center gap-1.5">
                          <span>{statusStr}</span>
                          <span>•</span>
                          <span>{subjectName}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span className="font-semibold text-gray-300">
                        {q.attemptCount ?? 0}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        q.difficulty === 'EASY' ? 'bg-emerald-500/10 text-emerald-400' :
                        q.difficulty === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {q.tags && q.tags.split(',').map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-semibold text-gray-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4 text-center text-gray-500">
                      {lastAttemptStr}
                    </td>

                    {isCompletedTable && (
                      <td className="p-4 text-center text-[#10b981] font-medium">
                        {solvedTimeStr}
                      </td>
                    )}

                    <td className="p-4 pr-6 text-right flex items-center justify-end gap-2">
                      {isCompletedTable ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewQuestionAttempt(q);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400"
                          >
                            View Code
                          </button>
                        </div>
                      ) : (q.status === 'NOT_STARTED' || !q.status) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSuspended) {
                              handleStartQuestionAttempt(q);
                            }
                          }}
                          disabled={isSuspended}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none ${
                            isSuspended
                              ? 'bg-red-500/10 text-red-400 border border-red-500/10 cursor-not-allowed opacity-50'
                              : 'bg-[#7c3aed] hover:bg-[#8b5cf6] text-white shadow-md'
                          }`}
                        >
                          {isSuspended ? 'Suspended' : 'Write Test'}
                        </button>
                      ) : (() => {
                        const associatedTest = getAssociatedTest(q.subjectId);
                        const isReattemptPending = q.status === 'PENDING_REATTEMPT';
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isReattemptPending && associatedTest) {
                                handleRequestReattempt(associatedTest.test.id, q.id);
                              }
                            }}
                            disabled={isReattemptPending || isSuspended}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none ${
                              isReattemptPending
                                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 cursor-not-allowed opacity-75'
                                : 'bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-400'
                            }`}
                          >
                            {isReattemptPending ? 'Pending' : 'Another Attempt'}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                );
                
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 relative font-sans">
      {/* Top Header Panel (Matches Practice Arena) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Chill Code</h1>
          <p className="text-xs text-gray-500 mt-1">Select an assigned assessment block to start coding.</p>
        </div>
        
        {/* Search Bar */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by problem title or tags..."
              className="w-full bg-[#11131c] border border-white/5 py-2 pl-10 pr-4 rounded-xl text-xs text-white focus:outline-none focus:border-[#7c3aed] transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filter Control Dashboard (Exactly matches Image 1) */}
      <div className="bg-[#11131c]/50 p-4 rounded-xl border border-white/5 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Difficulty filter pills */}
          <div className="flex items-center gap-1.5 bg-[#0b0c10] p-1 rounded-lg border border-white/5 text-xs font-semibold select-none">
            <button
              onClick={() => setDifficultyFilter('ALL')}
              className={`px-3 py-1 rounded-md transition-all ${
                difficultyFilter === 'ALL' ? 'bg-[#7c3aed]/20 text-[#8b5cf6]' : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setDifficultyFilter('EASY')}
              className={`px-3 py-1 rounded-md transition-all ${
                difficultyFilter === 'EASY' ? 'bg-emerald-500/15 text-emerald-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => setDifficultyFilter('MEDIUM')}
              className={`px-3 py-1 rounded-md transition-all ${
                difficultyFilter === 'MEDIUM' ? 'bg-amber-500/15 text-amber-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setDifficultyFilter('HARD')}
              className={`px-3 py-1 rounded-md transition-all ${
                difficultyFilter === 'HARD' ? 'bg-red-500/15 text-red-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              Hard
            </button>
          </div>

          {/* Subject Filter dropdown */}
          <div className="relative">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="px-3 py-2 bg-[#0b0c10] border border-white/5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition-colors focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Topics</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Hide solved toggle */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 select-none cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded bg-[#0b0c10] border-white/5 text-[#7c3aed] focus:ring-0"
                checked={hideSolved}
                onChange={(e) => setHideSolved(e.target.checked)}
              />
              Hide Solved
            </label>

            <button
              onClick={() => fetchTests(false)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 font-bold rounded-lg text-xs transition-all disabled:opacity-50 select-none cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Counter label */}
        <span className="text-xs font-medium text-gray-500">
          Showing <strong className="text-white">{filteredQuestions.length}</strong> of {questionsList.length} problems
        </span>
      </div>

      {/* Main Problems Tables categorized by Completed vs Not Completed */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-[#11131c] border border-white/5 rounded-2xl p-16 text-center space-y-4 shadow-xl">
          <ClipboardListIcon className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="font-bold text-white text-lg">No challenges fit query</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">Adjust filters or search parameters to discover coding challenges.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Category 1: Not Attended */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 font-sans select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-500"></span>
              Not Attended ({notAttendedQuestions.length})
            </h2>
            {renderQuestionsTable(notAttendedQuestions, false)}
          </div>



          {/* Category 3: Pending */}
          <div className="space-y-4 pt-4">
            <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-sans select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              Pending ({pendingQuestions.length})
            </h2>
            {renderQuestionsTable(pendingQuestions, false)}
          </div>

          {/* Category 4: Completed */}
          {!hideSolved && (
            <div className="space-y-4 pt-4">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 font-sans select-none">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                Completed ({completedQuestions.length})
              </h2>
              {renderQuestionsTable(completedQuestions, true)}
            </div>
          )}
        </div>
      )}

      {/* Confirm Start Assessment Modal */}
      {showConfirmModal && selectedTest && (() => {
        const isSecActive = user?.status === 'ACTIVE';
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#11131c] border border-white/10 p-6 rounded-2xl text-center shadow-2xl relative">
              <AlertCircle className="w-12 h-12 text-[#7c3aed] mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">
                {isSecActive ? 'Initiate Coding Examination' : 'Start Practice Challenge'}
              </h3>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                You are about to start <strong className="text-white">{selectedQuestion?.title || selectedTest.test.name}</strong>.<br />
                {isSecActive ? (
                  <>
                    This exam has strict anti-cheating controls. 
                    <br /><br />
                    <strong className="text-red-400 font-semibold">Warning:</strong> Leaving full-screen mode, switching tabs, or opening developer tools will record warning logs. Accumulating 3 warnings will result in automatic submission and account suspension.
                  </>
                ) : (
                  <>
                    {user?.status === 'NO_SECURITY' ? (
                      <>
                        Security checks are <strong className="text-emerald-400 font-semibold">disabled</strong> for your account. You can solve the problem at your own pace without anti-cheating restrictions.
                      </>
                    ) : (
                      <>
                        This is a practice environment. Feel free to reference documentation, copy/paste code snippets, and solve the problem at your own pace.
                      </>
                    )}
                  </>
                )}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-[#0b0c10] border border-white/5 rounded-xl text-xs font-semibold hover:bg-white/5 text-gray-300"
                >
                  Go Back
                </button>
                <button
                  onClick={confirmStart}
                  disabled={startingTest}
                  className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-xs font-bold shadow-lg shadow-[#7c3aed]/10 flex items-center gap-2 disabled:opacity-50 select-none"
                >
                  {startingTest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {startingTest ? 'Initiating...' : 'Agree & Start'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Custom Confirm Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#11131c] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white tracking-wide">{confirmDialog.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all select-none"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  await confirmDialog.onConfirm();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all select-none"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon helper wrapper
function ClipboardListIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}
