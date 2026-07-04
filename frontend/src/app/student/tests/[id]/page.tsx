'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTestStore } from '../../../../store/testStore';
import { useAuthStore } from '../../../../store/authStore';
import { useSecurityStore } from '../../../../store/securityStore';
import { useExamSecurity } from '../../../../hooks/useExamSecurity';
import { apiCall } from '../../../../utils/api';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[#1e1e24] text-gray-500 text-xs font-mono">
      Loading Editor Canvas...
    </div>
  ),
});
import { 
  AlertTriangle, 
  Play, 
  Send, 
  Maximize2, 
  Terminal, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Settings as GearIcon,
  Moon,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Sparkles
} from 'lucide-react';

import Link from 'next/link';

export default function CodingWorkspace() {
  const params = useParams();
  const router = useRouter();
  const testId = Number(params.id);

  const activeTestName = useTestStore((s) => s.activeTestName);
  const questions = useTestStore((s) => s.questions);
  const activeQuestionIndex = useTestStore((s) => s.activeQuestionIndex);
  const codes = useTestStore((s) => s.codes);
  const languages = useTestStore((s) => s.languages);
  const isSessionActive = useTestStore((s) => s.isSessionActive);
  const isViewMode = useTestStore((s) => s.isViewMode);
  const user = useAuthStore((s) => s.user);
  const isSecurityStatusActive = user?.status === 'ACTIVE';
  const setActiveQuestionIndex = useTestStore((s) => s.setActiveQuestionIndex);
  const updateCode = useTestStore((s) => s.updateCode);
  const updateLanguage = useTestStore((s) => s.updateLanguage);
  const decrementTime = useTestStore((s) => s.decrementTime);
  const clearTestSession = useTestStore((s) => s.clearTestSession);
  const startTestSession = useTestStore((s) => s.startTestSession);

  const {
    warnings,
    warningsLimit,
    lastWarningReason,
    showWarningModal,
    isTestSuspended,
    incrementWarnings,
    setWarnings,
    resetWarnings,
    setWarningModal,
    suspendTest,
  } = useSecurityStore();

  const lastWarningTimeRef = useRef<number>(0);

  // Page layout toggles
  const [mounted, setMounted] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<'PROBLEM' | 'SUBMISSIONS'>('PROBLEM');
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [fullscreenRequired, setFullscreenRequired] = useState(false);
  const [submissionsHistory, setSubmissionsHistory] = useState<any[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [customInput, setCustomInput] = useState('');
  const [consoleTab, setConsoleTab] = useState<'TESTCASE' | 'RESULT'>('TESTCASE');

  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    setMounted(true);
    apiCall('/api/student/profile')
      .then((data) => {
        if (data) {
          setUser(data);
          if (typeof window !== 'undefined' && !useTestStore.getState().isViewMode && data.status === 'ACTIVE') {
            // Delay fullscreen check slightly to allow transition animation to finish
            const timer = setTimeout(() => {
              if (!document.fullscreenElement) {
                setFullscreenRequired(true);
              }
            }, 1000);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to sync student user profile on workspace mount', err);
      });
  }, [setUser]);

  // Auto-restore test session state on direct URL loads/reloads
  useEffect(() => {
    if (!mounted) return;
    if (isSessionActive && questions && questions.length > 0) return;

    const recoverSession = async () => {
      try {
        const tests = await apiCall('/api/student/tests');
        const activeTest = tests.find((st: any) => st.test.id === testId);
        if (!activeTest) {
          router.push('/student/tests');
          return;
        }

        if ((activeTest.isSuspended || activeTest.status === 'SUSPENDED') && isSecurityStatusActive) {
          suspendTest();
          clearTestSession();
          return;
        }

        setWarnings(activeTest.warningsCount || 0);

        const subjectId = activeTest.test.subject.id;
        const allQuestions = await apiCall(`/api/student/subjects/${subjectId}/questions`);

        if (allQuestions && allQuestions.length > 0) {
          // Calculate remaining time
          const totalSeconds = activeTest.test.durationMinutes * 60;
          let remainingSeconds = totalSeconds;
          if (activeTest.startedAt) {
            const startTime = new Date(activeTest.startedAt).getTime();
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
          }

          startTestSession(
            activeTest.test.id,
            activeTest.id,
            allQuestions[0].title,
            allQuestions,
            remainingSeconds / 60,
            activeTest.status === 'SUBMITTED' || activeTest.status === 'EVALUATED'
          );
        } else {
          router.push('/student/tests');
        }
      } catch (err) {
        console.error('Failed to recover exam session', err);
        router.push('/student/tests');
      }
    };

    recoverSession();
  }, [mounted, isSessionActive, testId, startTestSession, router]);

  // Set up Timer interval (without subscribing to time changes here to avoid re-renders)
  useEffect(() => {
    if (!mounted || !isSessionActive) return;
    const interval = setInterval(() => {
      decrementTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [mounted, isSessionActive, decrementTime]);

  // Check Timer finish -> Auto submit (using transient subscriber to avoid re-rendering workspace)
  useEffect(() => {
    if (!mounted) return;
    const unsubscribe = useTestStore.subscribe(
      (state) => {
        if (state.isSessionActive && state.timeLeftSeconds === 0) {
          handleAutoSubmit();
        }
      }
    );
    return () => unsubscribe();
  }, [mounted, isSessionActive]);

  // Fetch submissions history
  const currentQuestion = questions && questions[activeQuestionIndex];
  
  const fetchSubmissionsHistory = async () => {
    if (!currentQuestion || !useTestStore.getState().activeStudentTestId) return;
    try {
      const data = await apiCall(`/api/student/submissions/test/${useTestStore.getState().activeStudentTestId}/question/${currentQuestion.id}`);
      setSubmissionsHistory(data || []);
      
      // In view mode, populate the editor with the latest submission code if empty
      if (useTestStore.getState().isViewMode && data && data.length > 0 && !codes[currentQuestion.id]) {
        updateCode(currentQuestion.id, data[0].code);
        if (data[0].language) {
          updateLanguage(currentQuestion.id, data[0].language);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSubmissionsHistory();
  }, [activeQuestionIndex]);

  useEffect(() => {
    if (mounted && currentQuestion && !isViewMode && !codes[currentQuestion.id]) {
      const backup = localStorage.getItem(`chillcode_code_backup_${currentQuestion.id}`);
      if (backup) {
        updateCode(currentQuestion.id, backup);
      }
    }
  }, [mounted, activeQuestionIndex, currentQuestion]);


  // Format Time
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAutoSubmit = async () => {
    try {
      await apiCall(`/api/student/tests/${testId}/submit`, { method: 'POST' });
      clearTestSession();
      resetWarnings();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      alert('Time is up! Your exam attempt has been auto-submitted.');
      router.push('/student/tests');
    } catch (e) {
      console.error('Auto submit failed', e);
    }
  };

  const handleManualSubmitExam = async () => {
    if (!confirm('Are you sure you want to finish and submit your exam?')) return;
    try {
      await apiCall(`/api/student/tests/${testId}/submit`, { method: 'POST' });
      clearTestSession();
      resetWarnings();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      router.push('/student/tests');
    } catch (e) {
      alert('Failed to submit exam. Please try again.');
    }
  };

  const handleWarningTrigger = async (type: string, reason: string) => {
    if (!isSessionActive || isTestSuspended) return;

    // Rate-limiting check: ignore warnings within 2 seconds of each other to prevent auto-repeat triggers
    const nowTime = Date.now();
    if (nowTime - lastWarningTimeRef.current < 2000) {
      console.log('Ignored duplicate/rapid warning trigger:', type, reason);
      return;
    }
    lastWarningTimeRef.current = nowTime;

    if (type === 'FULLSCREEN_EXIT') {
      setFullscreenRequired(true);
    }

    try {
      const st = await apiCall(`/api/student/tests/${testId}/warning?type=${type}&reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
      });
      
      incrementWarnings(reason);

      if (st.isSuspended) {
        suspendTest();
        clearTestSession();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      }
    } catch (e) {
      console.error('Failed to report warnings to security logs', e);
    }
  };

  useExamSecurity({
    testId,
    onWarning: handleWarningTrigger,
    isSessionActive: isSessionActive && !isViewMode && isSecurityStatusActive && !isTestSuspended && !fullscreenRequired,
  });

  const handleReEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenRequired(false);
    } catch (e) {
      console.error('Fullscreen re-entry failed', e);
    }
  };

  const handleRunCode = async () => {
    if (!currentQuestion) return;

    // Check if question has input and user has not populated customInput
    const firstTestcase = currentQuestion.testCases?.find((tc: any) => !tc.isHidden);
    if (firstTestcase && firstTestcase.inputData && !customInput.trim()) {
      setCustomInput(firstTestcase.inputData);
      setConsoleOpen(true);
      setConsoleTab('TESTCASE');
      alert('This question requires input. We have pre-populated the input method with the sample input. Review it, then click "Compile & Run" again.');
      return;
    }

    setExecuting(true);
    setExecResult(null);
    setConsoleOpen(true);
    setConsoleTab('RESULT');

    const payload = {
      code: codes[currentQuestion.id],
      language: languages[currentQuestion.id],
      questionId: currentQuestion.id,
      studentTestId: useTestStore.getState().activeStudentTestId,
      customInput: customInput,
      runOnly: true,
    };

    try {
      const response = await apiCall('/api/student/submissions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setExecResult(response);
    } catch (err: any) {
      setExecResult({
        status: 'RUNTIME_ERROR',
        compileError: err.message || 'Network execution error.',
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!currentQuestion) return;
    setExecuting(true);
    setExecResult(null);
    setConsoleOpen(true);
    setConsoleTab('RESULT');

    const payload = {
      code: codes[currentQuestion.id],
      language: languages[currentQuestion.id],
      questionId: currentQuestion.id,
      studentTestId: useTestStore.getState().activeStudentTestId,
      runOnly: false,
    };

    try {
      const response = await apiCall('/api/student/submissions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setExecResult(response);
      fetchSubmissionsHistory();
    } catch (err: any) {
      setExecResult({
        status: 'RUNTIME_ERROR',
        compileError: err.message || 'Network submission error.',
      });
    } finally {
      setExecuting(false);
    }
  };

  // Reset boilerplate code
  const handleResetCode = () => {
    if (!currentQuestion) return;
    if (confirm('Are you sure you want to reset your code to the default template?')) {
      updateLanguage(currentQuestion.id, languages[currentQuestion.id] || 'java');
    }
  };

  // Suspension Screen
  if (isTestSuspended && isSecurityStatusActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10] p-4 text-center">
        <div className="max-w-md bg-[#11131c] p-8 rounded-2xl border border-red-500/20 glow-card space-y-6">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Exam Session Suspended</h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your attempt on this assessment has been suspended due to consecutive security violations. 
            Your logs have been forwarded to the administrator.
            <br /><br />
            Your account is locked for 30 minutes.
          </p>
          <button 
            onClick={() => { resetWarnings(); router.push('/student/tests'); }} 
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold text-white transition-all w-full"
          >
            Return to Workspace
          </button>
        </div>
      </div>
    );
  }

  // Fullscreen Lock Overlay
  if (fullscreenRequired && !isViewMode && isSecurityStatusActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10] p-4 text-center">
        <div className="max-w-md bg-[#11131c] p-8 rounded-2xl border border-indigo-500/20 space-y-6">
          <Maximize2 className="w-16 h-16 text-indigo-400 mx-auto animate-pulse" />
          <h1 className="text-2xl font-bold text-white">Fullscreen Required</h1>
          <p className="text-sm text-gray-400">
            This coding examination is locked inside full-screen view. You must return to fullscreen to resume writing your solution.
          </p>
          <button
            onClick={handleReEnterFullscreen}
            className="px-6 py-2.5 bg-[#7c3aed] hover:bg-[#8b5cf6] rounded-xl text-sm w-full text-white font-bold tracking-wider shadow-lg"
          >
            Re-enter Fullscreen
          </button>
        </div>
      </div>
    );
  }

  if (!mounted || !isSessionActive || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed] mx-auto" />
          <p className="text-gray-400">Initializing Exam Session...</p>
        </div>
      </div>
    );
  }

  const renderResultContent = () => {
    if (executing) {
      return (
        <div className="flex items-center gap-3 py-6 justify-center text-gray-500 font-sans">
          <Loader2 className="w-5 h-5 animate-spin text-[#8b5cf6]" />
          Compiling and executing your code...
        </div>
      );
    }

    if (!execResult) {
      return (
        <div className="text-gray-500 flex items-center justify-center py-8 font-sans">
          Click 'Compile & Run' or 'Submit' to evaluate your solution.
        </div>
      );
    }

    const status = execResult.status;

    return (
      <div className="space-y-4 font-sans text-xs">
        {/* Overall Verdict Header */}
        <div className="flex justify-between items-center p-3.5 rounded-xl border border-white/5 bg-[#11131c]">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 uppercase font-bold tracking-wider text-[10px]">Verdict</span>
            <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase ${
              status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {status === 'ACCEPTED' ? 'Accepted' :
               status === 'WRONG_ANSWER' ? 'Wrong Answer' :
               status === 'COMPILATION_ERROR' ? 'Compilation Error' :
               status === 'RUNTIME_ERROR' ? 'Runtime Error' :
               status === 'TIME_LIMIT_EXCEEDED' ? 'Time Limit Exceeded' :
               status === 'MEMORY_LIMIT_EXCEEDED' ? 'Memory Limit Exceeded' :
               status}
            </span>
          </div>
          <div className="flex gap-4 text-[10px] text-gray-500">
            {execResult.exitCode !== undefined && (
              <span>Exit Code: <strong className="text-white">{execResult.exitCode}</strong></span>
            )}
          </div>
        </div>

        {/* AI Explanation from Grok / Local Fallback */}
        {execResult.aiExplanation && (
          <div className="space-y-1.5 p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider font-sans">
              <Sparkles className="w-3.5 h-3.5 fill-indigo-400 animate-pulse" />
              AI Tutor Explanation (Grok)
            </div>
            <p className="text-xs leading-relaxed font-sans select-text whitespace-pre-wrap">
              {execResult.aiExplanation}
            </p>
          </div>
        )}

        {/* Case 1: Compilation Error */}
        {status === 'COMPILATION_ERROR' && (
          <div className="space-y-2">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Compilation Error</div>
            <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed">
              {execResult.compileError || "Unknown compilation error."}
            </pre>
          </div>
        )}

        {/* Case 2: Runtime Error */}
        {status === 'RUNTIME_ERROR' && (
          <div className="space-y-2">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Runtime Error</div>
            <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed">
              {execResult.stderr || "Runtime exception or non-zero exit code."}
            </pre>
          </div>
        )}

        {/* Case 3: Wrong Answer */}
        {status === 'WRONG_ANSWER' && (
          <div className="space-y-3">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Wrong Answer</div>
            {execResult.testCaseResults && execResult.testCaseResults.length > 0 ? (
              <div className="space-y-2.5">
                {execResult.testCaseResults.map((tcRes: any, idx: number) => {
                  if (tcRes.status === 'PASSED') return null;
                  return (
                    <div key={idx} className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl space-y-2 text-xs leading-relaxed">
                      <div className="font-bold text-red-400 font-sans">Failed Test Case #{idx + 1}</div>
                      <pre className="font-mono text-gray-300 bg-black/10 p-2 rounded whitespace-pre-wrap">
                        {tcRes.message}
                      </pre>
                    </div>
                  );
                })}
              </div>
            ) : (
              <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed">
                {execResult.stderr || "Output mismatch."}
              </pre>
            )}
          </div>
        )}

        {/* Case 4: Accepted */}
        {status === 'ACCEPTED' && (
          <div className="space-y-3">
            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-sans flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Accepted
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 rounded-xl text-xs font-sans space-y-1.5">
              <div>✅ Accepted</div>
              <div>✅ Test Cases Passed</div>
              {execResult.testCaseResults && (
                <div>Passed Test Cases: <strong>{execResult.testCaseResults.length} / {execResult.testCaseResults.length}</strong></div>
              )}
            </div>
          </div>
        )}

        {/* Case 5: Time Limit Exceeded */}
        {status === 'TIME_LIMIT_EXCEEDED' && (
          <div className="space-y-2">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Time Limit Exceeded</div>
            <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed">
              Your code took too long to execute and exceeded the maximum allowed limit (5000ms).
            </pre>
          </div>
        )}

        {/* Case 6: Memory Limit Exceeded */}
        {status === 'MEMORY_LIMIT_EXCEEDED' && (
          <div className="space-y-2">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Memory Limit Exceeded</div>
            <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed">
              Your code allocated more memory than allowed by the platform limits (256MB).
            </pre>
          </div>
        )}

        {/* Standard stdout / stderr output details */}
        {status !== 'COMPILATION_ERROR' && status !== 'RUNTIME_ERROR' && (execResult.stdout || execResult.stderr) && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            {execResult.stdout && (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">Program Output (stdout)</div>
                <pre className="p-3 bg-[#11131c] border border-white/5 text-gray-200 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed">
                  {execResult.stdout}
                </pre>
              </div>
            )}
            {execResult.stderr && (
              <div className="space-y-1">
                <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Standard Error (stderr)</div>
                <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed">
                  {execResult.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };


  return (
    <div className={`fixed inset-0 bg-[#0f1015] text-[#c5c6c7] flex flex-col z-40 font-sans ${isViewMode || !isSecurityStatusActive ? '' : 'select-none'}`}>
      {/* 1. Header Navigation Bar (Matches CodeJudge Pro visual frame) */}
      <header className="h-14 bg-[#11131c] border-b border-white/5 flex justify-between items-center px-6 relative z-50">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-white font-sans tracking-tight">
              Chill <span className="text-[#8b5cf6]">Code</span>
            </span>
          </div>

          {/* Breadcrumbs or active states indicator */}
          <nav className="flex items-center gap-6 text-xs font-semibold text-gray-400">
            <span className="text-white relative py-4 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#8b5cf6]">{activeTestName}</span>
          </nav>
        </div>

        {/* Right Tools: Timer, Warnings, Submit */}
        <div className="flex items-center gap-6">


          {/* Timer count down */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0b0c10] border border-white/5 rounded-xl">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{isViewMode ? 'Status' : 'Timer'}</span>
            <TimerDisplay isViewMode={isViewMode} />
          </div>

          {/* Warnings Log counter */}
          {!isViewMode && isSecurityStatusActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/10 text-red-400 rounded-xl">
              <span className="text-[10px] uppercase font-bold tracking-wider">Warnings</span>
              <span className="font-mono text-sm font-bold">{warnings} / {warningsLimit}</span>
            </div>
          )}

          {!isViewMode ? (
            <button
              onClick={handleManualSubmitExam}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10"
            >
              Submit Exam
            </button>
          ) : (
            <button
              onClick={() => router.push('/student/tests')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition-all"
            >
              Exit View
            </button>
          )}
        </div>
      </header>

      {/* 2. Main Workspace Split Panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* LEFT COLUMN: Problem Details, Inputs, Examples */}
        <div className="w-full md:w-[45%] h-[50vh] md:h-full flex flex-col bg-[#11131c] border-b md:border-b-0 md:border-r border-white/5 overflow-hidden">
          {/* Content Pane scroll wrapper */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title and stats bar */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400">
                  {currentQuestion.difficulty}
                </span>
                <h2 className="text-2xl font-bold text-white leading-tight font-sans">
                  {currentQuestion.title}
                </h2>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Marks: <strong className="text-indigo-400">{currentQuestion.marks} Marks</strong></span>
              </div>
            </div>

            {/* Problem Statement details */}
            <div className="space-y-6 text-sm leading-relaxed text-gray-300 font-sans border-t border-white/5 pt-5">
              <div>
                <p className="whitespace-pre-line leading-relaxed">{currentQuestion.problemStatement}</p>
              </div>

              {/* Constraints Section */}
              {currentQuestion.constraints && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Constraints</h3>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-gray-400 font-sans">
                    {currentQuestion.constraints.split('\n').map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Input Format Section */}
              {currentQuestion.inputFormat && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Input Format</h3>
                  <p className="text-xs text-gray-400 font-sans leading-relaxed whitespace-pre-wrap">{currentQuestion.inputFormat}</p>
                </div>
              )}

              {/* Output Format Section */}
              {currentQuestion.outputFormat && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Output Format</h3>
                  <p className="text-xs text-gray-400 font-sans leading-relaxed whitespace-pre-wrap">{currentQuestion.outputFormat}</p>
                </div>
              )}

              {/* Sample Input box */}
              {currentQuestion.testCases && currentQuestion.testCases.filter((tc) => !tc.isHidden).map((tc, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Sample Input {idx + 1}</h4>
                    <div className="bg-[#0b0c10] p-3.5 rounded-xl border border-white/5 font-mono text-xs text-white leading-relaxed whitespace-pre-wrap">
                      {tc.inputData}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Sample Output {idx + 1}</h4>
                    <div className="bg-[#0b0c10] p-3.5 rounded-xl border border-white/5 font-mono text-xs text-[#10b981] leading-relaxed whitespace-pre-wrap">
                      {tc.expectedOutput}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>


        {/* RIGHT COLUMN: Monaco editor & Console drawer */}
        <div className="w-full md:w-[55%] h-[50vh] md:h-full flex flex-col bg-[#0f1015] overflow-hidden">
          {/* Header Action toolbar matching Reference image 2 */}
          <div className="h-12 bg-[#11131c] border-b border-white/5 px-4 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              {/* Language Selection */}
              <select
                disabled={isViewMode}
                className="bg-[#0b0c10] border border-white/5 rounded-lg text-xs py-1.5 px-3 font-semibold text-white select-none focus:outline-none cursor-pointer disabled:opacity-50"
                value={languages[currentQuestion.id] || 'java'}
                onChange={(e) => updateLanguage(currentQuestion.id, e.target.value)}
              >
                {currentQuestion.allowedLanguages.split(',').map((l) => (
                  <option key={l} value={l} className="bg-[#11131c] text-white">
                    {l === 'cpp' ? 'C++' : l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Editor tools buttons: Settings, night mode, reset, fullscreen */}
            <div className="flex items-center gap-3 text-gray-500">
              <button 
                onClick={() => setFontSize(fontSize >= 18 ? 12 : fontSize + 2)} 
                className="hover:text-white transition-colors p-1" 
                title={`Change font size (current: ${fontSize}px)`}
              >
                <GearIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')} 
                className="hover:text-white transition-colors p-1" 
                title="Toggle editor theme"
              >
                <Moon className={`w-4 h-4 ${editorTheme === 'light' ? 'fill-indigo-500 text-indigo-500' : 'fill-gray-500'}`} />
              </button>
              {!isViewMode && (
                <button onClick={handleResetCode} className="hover:text-white transition-colors p-1" title="Reset Code">
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button onClick={handleReEnterFullscreen} className="hover:text-white transition-colors p-1" title="Force Fullscreen">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Monaco Editor canvas */}
          <div className="flex-1 min-h-0 relative bg-[#1e1e24]">
            <Editor
              key={`monaco-${currentQuestion.id}`}
              height="100%"
              theme={editorTheme}
              language={languages[currentQuestion.id] === 'cpp' || languages[currentQuestion.id] === 'c' ? 'cpp' : languages[currentQuestion.id]}
              value={codes[currentQuestion.id] || ''}
              onChange={(val) => {
                if (!isViewMode) {
                  updateCode(currentQuestion.id, val || '');
                  localStorage.setItem(`chillcode_code_backup_${currentQuestion.id}`, val || '');
                }
              }}
              options={{
                minimap: { enabled: true },
                fontSize: fontSize,
                fontFamily: 'Fira Code, Consolas, Monaco, monospace',
                automaticLayout: true,
                padding: { top: 12 },
                readOnly: isViewMode,
                lineNumbers: "on",
                matchBrackets: "always",
                quickSuggestions: { other: true, comments: true, strings: true },
                suggestOnTriggerCharacters: true,
                parameterHints: { enabled: true },
                snippetSuggestions: "inline",
                wordBasedSuggestions: "allDocuments",
                formatOnType: true,
                formatOnPaste: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on"
              }}

            />
          </div>          {/* 3. Output Console Bottom Drawer */}
          <div className={`border-t border-white/5 bg-[#11131c] flex flex-col overflow-hidden transition-all duration-300 ${
            consoleOpen ? 'h-[28rem]' : 'h-11'
          }`}>
            {/* Console Header bar */}
            <div 
              onClick={() => setConsoleOpen(!consoleOpen)}
              className="px-6 py-2.5 bg-[#11131c] flex justify-between items-center cursor-pointer select-none border-b border-white/5"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8b5cf6]" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">RESULT</span>
              </div>
              <button className="text-gray-500 hover:text-white">
                {consoleOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Console body content details */}
            {consoleOpen && (
              <div className="flex-1 p-5 overflow-y-auto font-mono text-xs bg-[#0f1015] flex flex-col min-h-0 space-y-4">
                {/* Dynamically show Custom Input if required by the question */}
                {(currentQuestion.inputFormat || (currentQuestion.testCases && currentQuestion.testCases.some((t: any) => t.inputData))) && (
                  <div className="space-y-1.5 shrink-0 select-none">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">Custom Input (stdin)</div>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Type custom inputs here (e.g. 5\n1 2 3 4 5)..."
                      className="w-full h-20 p-3 bg-[#11131c] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-[#8b5cf6] font-mono resize-none"
                    />
                  </div>
                )}

                {/* Render the output result content */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {renderResultContent()}
                </div>
              </div>
            )}

            {/* Bottom Actions Row matching exact style indicators */}
            {consoleOpen && (
              <div className="p-3 px-4 sm:px-6 bg-[#11131c] border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 select-none">
                <span className="text-[10px] font-bold text-gray-500 tracking-wider">ONLINE JUDGE ACTIVE</span>
                
                {isViewMode ? (
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider italic">
                    Viewing completed exam attempt. Re-submission disabled.
                  </div>
                ) : (
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button 
                      onClick={handleRunCode} 
                      disabled={executing}
                      className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs tracking-wider transition-all disabled:opacity-50"
                    >
                      Compile & Run
                    </button>
                    <button 
                      onClick={handleSubmitCode}
                      disabled={executing}
                      className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs tracking-wider transition-all shadow-md shadow-[#7c3aed]/20 disabled:opacity-50"
                    >
                      Submit
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Security Warning Modal Overlay */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#11131c] border border-red-500/20 p-6 rounded-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Security Warning Violation</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              System detected: <strong className="text-white">{lastWarningReason}</strong>.
              <br /><br />
              Warning Count: <strong className="text-red-400">{warnings} / {warningsLimit}</strong>.
              <br />
              Reaching <strong className="text-white">3 warnings</strong> will suspend your attempt immediately.
            </p>
            <button
              onClick={() => {
                setWarningModal(false);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(console.error);
                }
              }}
              className="px-6 py-2 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-xl text-xs font-bold transition-all w-full"
            >
              Understand & Resume Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TimerDisplay = React.memo(function TimerDisplay({ isViewMode }: { isViewMode: boolean }) {
  const timeLeftSeconds = useTestStore((s) => s.timeLeftSeconds);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <span className={`font-mono text-sm font-bold ${!isViewMode && timeLeftSeconds < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
      {isViewMode ? 'COMPLETED' : formatTime(timeLeftSeconds)}
    </span>
  );
});
