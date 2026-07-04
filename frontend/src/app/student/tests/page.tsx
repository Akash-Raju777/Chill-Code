'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/authStore';
import { useTestStore } from '../../../store/testStore';
import { useSecurityStore } from '../../../store/securityStore';
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
  Loader2
} from 'lucide-react';

interface Test {
  id: number;
  name: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  maxMarks: number;
  instructions: string;
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
}

export default function TestsWorkspace() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [studentTests, setStudentTests] = useState<StudentTest[]>([]);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [solvedQuestionIds, setSolvedQuestionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTest, setSelectedTest] = useState<StudentTest | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);


  // Search & Filter state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<number | 'ALL'>('ALL');
  const [hideSolved, setHideSolved] = useState(false);

  const { startTestSession } = useTestStore();
  const { resetWarnings } = useSecurityStore();

  const fetchTests = async (isInitial = true) => {
    if (isInitial) setLoading(true);
    setError('');
    try {
      const [testsData, questionsData, subjectsData, solvedData, profileData] = await Promise.all([
        apiCall('/api/student/tests'),
        apiCall('/api/student/questions'),
        apiCall('/api/student/subjects'),
        apiCall('/api/student/submissions/solved'),
        apiCall('/api/student/profile'),
      ]);
      setStudentTests(testsData);
      setQuestionsList(questionsData);
      setSubjects(subjectsData);
      setSolvedQuestionIds(solvedData || []);
      if (profileData) {
        useAuthStore.getState().setUser(profileData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch practice challenges.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests(true);

    // Auto-refresh questions list when the student returns to/focuses this browser tab
    const handleFocus = () => {
      fetchTests(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const getAssociatedTest = (subjectId: number) => {
    const matched = studentTests.filter((st) => st.test.subject.id === subjectId);
    if (matched.length === 0) return null;
    const active = matched.find((st) => ['STARTED', 'ASSIGNED'].includes(st.status));
    return active || matched[0];
  };

  const handleStartQuestionAttempt = (q: any) => {
    const associatedTest = getAssociatedTest(q.subjectId);
    if (associatedTest) {
      if (associatedTest.status === 'SUBMITTED' || associatedTest.status === 'EVALUATED') {
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
    const associatedTest = getAssociatedTest(q.subjectId);
    if (!associatedTest) return;
    try {
      startTestSession(
        associatedTest.test.id,
        associatedTest.id,
        q.title,
        [q],
        0,
        true // isViewMode = true
      );
      router.push(`/student/tests/${associatedTest.test.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to enter view mode.');
    }
  };

  const handleRequestReattempt = async (testId: number) => {
    if (!confirm('Are you sure you want to request another attempt from the admin? This will let you write the test again once approved.')) return;
    try {
      await apiCall(`/api/student/tests/${testId}/request-reattempt`, {
        method: 'POST',
      });
      alert('Your reattempt request has been submitted to the admin successfully.');
      fetchTests(false);
    } catch (err: any) {
      alert(err.message || 'Failed to submit reattempt request.');
    }
  };

  const confirmStart = async () => {
    if (!selectedTest || !selectedQuestion) return;
    try {
      // Auto fullscreen request on interaction gesture
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        }
      } catch (fsErr) {
        console.warn("Fullscreen request was rejected/unsupported", fsErr);
      }

      const updatedSt = await apiCall(`/api/student/tests/${selectedTest.test.id}/start`, {
        method: 'POST',
      });
      resetWarnings();

      startTestSession(
        selectedTest.test.id,
        updatedSt.id,
        selectedQuestion.title,
        [selectedQuestion],
        selectedTest.test.durationMinutes,
        false // isViewMode = false
      );

      setShowConfirmModal(false);
      router.push(`/student/tests/${selectedTest.test.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start test session.');
      setShowConfirmModal(false);
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

    const associatedTest = getAssociatedTest(q.subjectId);
    const isSubmitted = associatedTest ? (associatedTest.status === 'SUBMITTED' || associatedTest.status === 'EVALUATED') : false;
    const isSolved = solvedQuestionIds.includes(q.id) || isSubmitted;
    const matchesSolved = !hideSolved || !isSolved;

    return matchesSearch && matchesDifficulty && matchesSubject && matchesSolved;
  });

  const completedQuestions = questionsList.filter((q) => {
    const title = q.title || '';
    const subject = subjects.find((s) => s.id === q.subjectId);
    const subjectName = subject ? subject.name : '';
    const tags = q.tags || '';

    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tags.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDifficulty = difficultyFilter === 'ALL' || q.difficulty === difficultyFilter;
    const matchesSubject = subjectFilter === 'ALL' || q.subjectId === subjectFilter;

    const associatedTest = getAssociatedTest(q.subjectId);
    const isSubmitted = associatedTest ? (associatedTest.status === 'SUBMITTED' || associatedTest.status === 'EVALUATED') : false;
    const isSolved = solvedQuestionIds.includes(q.id) || isSubmitted;

    return matchesSearch && matchesDifficulty && matchesSubject && isSolved;
  });

  const notCompletedQuestions = filteredQuestions.filter((q) => {
    const associatedTest = getAssociatedTest(q.subjectId);
    const isSubmitted = associatedTest ? (associatedTest.status === 'SUBMITTED' || associatedTest.status === 'EVALUATED') : false;
    return !solvedQuestionIds.includes(q.id) && !isSubmitted;
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
                <th className="p-4 w-32">Difficulty</th>
                <th className="p-4">Tags</th>
                <th className="p-4 w-28 text-center">Points</th>
                <th className="p-4 w-40 text-center">Last Attempt</th>
                {isCompletedTable && <th className="p-4 w-40 text-center">Solved Time</th>}
                <th className="p-4 w-36 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-gray-400">
              {list.map((q) => {
                const associatedTest = getAssociatedTest(q.subjectId);
                const isSolved = solvedQuestionIds.includes(q.id);
                const isSuspended = (associatedTest ? (associatedTest.isSuspended || associatedTest.status === 'SUSPENDED') : false) && user?.status === 'ACTIVE';
                const isStarted = associatedTest ? associatedTest.status === 'STARTED' : false;
                const isSubmitted = associatedTest ? (associatedTest.status === 'SUBMITTED' || associatedTest.status === 'EVALUATED') : false;
                const subject = subjects.find((s) => s.id === q.subjectId);
                const subjectName = subject ? subject.name : 'Unknown';

                let statusStr = "Not Solved";
                if (isSolved) statusStr = "Solved";
                else if (isSuspended) statusStr = "Suspended";
                else if (isSubmitted) statusStr = "Submitted";
                else if (isStarted) statusStr = "In Progress";

                let lastAttemptStr = "No attempt yet";
                if (associatedTest) {
                  const dateVal = associatedTest.submittedAt || associatedTest.startedAt;
                  if (dateVal) {
                    lastAttemptStr = new Date(dateVal).toLocaleDateString();
                  } else {
                    lastAttemptStr = isStarted ? "Active Session" : "Recent";
                  }
                }

                let solvedTimeStr = "-";
                if (isSolved && associatedTest && associatedTest.submittedAt) {
                  solvedTimeStr = new Date(associatedTest.submittedAt).toLocaleString();
                }

                return (
                  <tr 
                    key={q.id} 
                    className="hover:bg-white/5 transition-all group cursor-pointer"
                    onClick={() => {
                      if (isSolved || isSubmitted) {
                        handleViewQuestionAttempt(q);
                      } else if (!isSuspended) {
                        handleStartQuestionAttempt(q);
                      }
                    }}
                  >
                    <td className="p-4 pl-6 text-center">
                      <div className="inline-flex items-center justify-center">
                        {isSolved || isSubmitted ? (
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
                        </div>
                      </div>
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
                        <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-semibold text-gray-400 capitalize">
                          {subjectName}
                        </span>
                        {q.tags && q.tags.split(',').map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-semibold text-gray-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4 text-center text-white font-semibold">
                      {q.marks} pts
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSolved || isSubmitted) {
                            handleViewQuestionAttempt(q);
                          } else if (!isSuspended) {
                            handleStartQuestionAttempt(q);
                          }
                        }}
                        disabled={isSuspended}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none ${
                          isSolved || isSubmitted
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400'
                            : isSuspended
                            ? 'bg-red-500/10 text-red-400 border border-red-500/10 cursor-not-allowed opacity-50'
                            : 'bg-[#7c3aed] hover:bg-[#8b5cf6] text-white shadow-md'
                        }`}
                      >
                        {isSolved || isSubmitted ? 'View Attempt' : isSuspended ? 'Suspended' : 'Write Test'}
                      </button>

                      {isSubmitted && associatedTest && (
                        <>
                          {!associatedTest.reattemptStatus && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestReattempt(associatedTest.test.id);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 text-indigo-400 transition-all select-none"
                            >
                              Another Attempt
                            </button>
                          )}
                          {associatedTest.reattemptStatus === 'PENDING' && (
                            <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none">
                              Pending Approval
                            </span>
                          )}
                          {associatedTest.reattemptStatus === 'REJECTED' && (
                            <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 select-none">
                              Rejected
                            </span>
                          )}
                        </>
                      )}
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Practice Arena</h1>
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
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 select-none cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded bg-[#0b0c10] border-white/5 text-[#7c3aed] focus:ring-0"
              checked={hideSolved}
              onChange={(e) => setHideSolved(e.target.checked)}
            />
            Hide Solved
          </label>
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
          {/* Category 1: Not Completed */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-[#8b5cf6] uppercase tracking-wider flex items-center gap-2 font-sans select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] animate-pulse"></span>
              Not Completed ({notCompletedQuestions.length})
            </h2>
            {renderQuestionsTable(notCompletedQuestions, false)}
          </div>

          {/* Category 2: Completed */}
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



      {/* Daily Challenge floating glow button (Exactly matches Image 1) */}
      <button 
        onClick={() => questionsList.length > 0 && handleStartQuestionAttempt(questionsList[0])}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs tracking-wider transition-all shadow-xl shadow-[#7c3aed]/20 border border-white/10 glow-card hover:scale-105 active:scale-95 z-40"
      >
        <Zap className="w-4 h-4 fill-white" />
        DAILY CHALLENGE
      </button>

      {/* Confirm Start Assessment Modal */}
      {showConfirmModal && selectedTest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#11131c] border border-white/10 p-6 rounded-2xl text-center shadow-2xl relative">
            <AlertCircle className="w-12 h-12 text-[#7c3aed] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Initiate Coding Examination</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              You are about to start <strong className="text-white">{selectedTest.test.name}</strong>.<br />
              This exam has strict anti-cheating controls. 
              <br /><br />
              <strong className="text-red-400 font-semibold">Warning:</strong> Leaving full-screen mode, switching tabs, or opening developer tools will record warning logs. Accumulating 3 warnings will result in automatic submission and account suspension.
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
                className="px-5 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white text-xs font-bold shadow-lg shadow-[#7c3aed]/10"
              >
                Agree & Start
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
