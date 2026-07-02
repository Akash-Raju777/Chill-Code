'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { useRouter } from 'next/navigation';
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
}

export default function TestsWorkspace() {
  const router = useRouter();
  const [studentTests, setStudentTests] = useState<StudentTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTest, setSelectedTest] = useState<StudentTest | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Search & Filter state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'EASY' | 'MEDIUM' | 'HARD'>('ALL');
  const [hideSolved, setHideSolved] = useState(false);

  const { startTestSession } = useTestStore();
  const { resetWarnings } = useSecurityStore();

  const fetchTests = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/student/tests');
      setStudentTests(data);
    } catch (err: any) {
      setError('Failed to fetch assigned exams list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleStartAttempt = (st: StudentTest) => {
    setSelectedTest(st);
    setShowConfirmModal(true);
  };

  const confirmStart = async () => {
    if (!selectedTest) return;
    try {
      const updatedSt = await apiCall(`/api/student/tests/${selectedTest.test.id}/start`, {
        method: 'POST',
      });
      const questions = await apiCall(`/api/student/subjects/${selectedTest.test.subject.id}/questions`);
      resetWarnings();

      startTestSession(
        selectedTest.test.id,
        updatedSt.id,
        selectedTest.test.name,
        questions,
        selectedTest.test.durationMinutes
      );

      setShowConfirmModal(false);
      router.push(`/student/tests/${selectedTest.test.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start test session.');
      setShowConfirmModal(false);
    }
  };

  // Filter Logic
  const filteredTests = studentTests.filter((st) => {
    if (!st || !st.test) return false;
    const testName = st.test.name || '';
    const subjectName = st.test.subject?.name || '';
    
    const matchesSearch = testName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      subjectName.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check difficulty filter (mapping marks/difficulty context mock values)
    const diff = (st.test.maxMarks || 0) > 60 ? 'HARD' : (st.test.maxMarks || 0) > 30 ? 'MEDIUM' : 'EASY';
    const matchesDifficulty = difficultyFilter === 'ALL' || diff === difficultyFilter;

    // Check solved status
    const isSolved = ['SUBMITTED', 'EVALUATED'].includes(st.status || '');
    const matchesSolved = !hideSolved || !isSolved;

    return matchesSearch && matchesDifficulty && matchesSolved;
  });

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
          <button className="p-2 border border-white/5 rounded-xl bg-[#11131c] text-gray-400 hover:text-white transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
          </button>
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
            <button className="flex items-center gap-2 px-3 py-2 bg-[#0b0c10] border border-white/5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition-colors">
              All Topics
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
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
          Showing <strong className="text-white">{filteredTests.length}</strong> of {studentTests.length} assessments
        </span>
      </div>

      {/* Main Problems Table (High fidelity matching Image 1) */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="bg-[#11131c] border border-white/5 rounded-2xl p-16 text-center space-y-4 shadow-xl">
          <ClipboardListIcon className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="font-bold text-white text-lg">No assessments fit query</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">Adjust filters or search parameters to discover assigned assessments.</p>
        </div>
      ) : (
        <div className="bg-[#11131c] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] text-gray-500 uppercase font-bold tracking-wider select-none bg-[#11131c]">
                  <th className="p-4 pl-6 w-20 text-center">Status</th>
                  <th className="p-4">Title</th>
                  <th className="p-4 w-32">Difficulty</th>
                  <th className="p-4">Tags</th>
                  <th className="p-4 w-36 pr-6 text-right">Acceptance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-400">
                {filteredTests.map((st) => {
                  const isSolved = ['SUBMITTED', 'EVALUATED'].includes(st.status);
                  const isSuspended = st.isSuspended || st.status === 'SUSPENDED';
                  const isStarted = st.status === 'STARTED';
                  const difficulty = st.test.maxMarks > 60 ? 'HARD' : st.test.maxMarks > 30 ? 'MEDIUM' : 'EASY';

                  return (
                    <tr 
                      key={st.id} 
                      className="hover:bg-white/5 transition-all group cursor-pointer"
                      onClick={() => !isSolved && !isSuspended && handleStartAttempt(st)}
                    >
                      {/* Status Icon */}
                      <td className="p-4 pl-6 text-center">
                        <div className="inline-flex items-center justify-center">
                          {isSolved ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/5" />
                          ) : isSuspended ? (
                            <XCircle className="w-5 h-5 text-red-500 fill-red-500/5" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-600 hover:text-indigo-400 transition-colors" />
                          )}
                        </div>
                      </td>

                      {/* Problem Title & Subtitles details */}
                      <td className="p-4 py-5">
                        <div className="space-y-1">
                          <span className="font-bold text-white text-sm group-hover:text-[#8b5cf6] transition-colors leading-tight">
                            {st.test.name}
                          </span>
                          <div className="text-[10px] text-gray-500 font-semibold">
                            {isSolved ? (
                              <span className="text-emerald-400">Solved on 1st attempt</span>
                            ) : isSuspended ? (
                              <span className="text-red-400 font-medium">Suspended on warnings violation</span>
                            ) : isStarted ? (
                              <span className="text-amber-400">Attempts in progress</span>
                            ) : (
                              <span>Duration: {st.test.durationMinutes} mins | Not yet attempted</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Difficulty level badge */}
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          difficulty === 'EASY' ? 'bg-emerald-500/10 text-emerald-400' :
                          difficulty === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {difficulty}
                        </span>
                      </td>

                      {/* Subject tags */}
                      <td className="p-4">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-semibold text-gray-400 capitalize">
                            {st.test.subject.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-semibold text-gray-400">
                            {st.test.durationMinutes}min
                          </span>
                        </div>
                      </td>

                      {/* Action status button (right-aligned) */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-semibold text-gray-500 group-hover:text-white transition-colors">
                            {isSolved ? `${st.score}/${st.test.maxMarks} pts` : '42.1%'}
                          </span>
                          {!isSolved && !isSuspended && (
                            <ArrowRight className="w-3.5 h-3.5 text-gray-500 opacity-0 group-hover:opacity-100 group-hover:text-[#8b5cf6] translate-x-[-4px] group-hover:translate-x-0 transition-all" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Challenge floating glow button (Exactly matches Image 1) */}
      <button 
        onClick={() => studentTests.length > 0 && handleStartAttempt(studentTests[0])}
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
