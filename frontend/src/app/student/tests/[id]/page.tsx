'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  Type as FontSizeIcon,
  Moon,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Sparkles
} from 'lucide-react';

import Link from 'next/link';
import GloryCelebrationModal from '../../../../components/GloryCelebrationModal';
import FailResultModal from '../../../../components/FailResultModal';

export default function CodingWorkspace() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = Number(params.id);
  const questionIdParam = searchParams.get('question');

  const activeTestName = useTestStore((s) => s.activeTestName);
  const questions = useTestStore((s) => s.questions);
  const activeQuestionIndex = useTestStore((s) => s.activeQuestionIndex);
  const codes = useTestStore((s) => s.codes);
  const languages = useTestStore((s) => s.languages);
  const isSessionActive = useTestStore((s) => s.isSessionActive);
  const isViewMode = useTestStore((s) => s.isViewMode);
  const activeStudentTestId = useTestStore((s) => s.activeStudentTestId);
  const user = useAuthStore((s) => s.user);

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
  const [customInput2, setCustomInput2] = useState('');
  const [customInput3, setCustomInput3] = useState('');
  const [consoleTab, setConsoleTab] = useState<'TESTCASE' | 'RESULT'>('TESTCASE');
  const [securityShieldEnabled, setSecurityShieldEnabled] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [showExternalPasteWarning, setShowExternalPasteWarning] = useState(false);

  // Module 6 & 7 Modal & Evaluation Stage States
  const [evaluationStage, setEvaluationStage] = useState<'IDLE' | 'EVALUATING' | 'RUNNING_TESTS' | 'CALCULATING_SCORE' | 'CONFIRMED'>('IDLE');
  const [showGloryModal, setShowGloryModal] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [submissionResponse, setSubmissionResponse] = useState<any>(null);

  const isSecurityStatusActive = user?.status === 'ACTIVE' && securityShieldEnabled;

  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    setMounted(true);
    apiCall('/api/student/profile')
      .then((data) => {
        if (data) {
          setUser(data);
        }
      })
      .catch((err) => {
        console.error('Failed to sync student user profile on workspace mount', err);
      });
  }, [setUser]);

  // Guard ref to prevent duplicate recoverSession calls from dependency changes
  const recoverSessionCalledRef = useRef<boolean>(false);

  // Auto-restore test session state and configure security immediately before interactions
  useEffect(() => {
    if (!mounted || !user?.id) return;
    // Only skip re-fetch if the store belongs to THIS user for THIS test
    const store = useTestStore.getState();
    if (store.isSessionActive && store.questions.length > 0 && store.activeTestId === testId && store.lastUserId === user.id) return;
    // Prevent duplicate async calls
    if (recoverSessionCalledRef.current) return;
    recoverSessionCalledRef.current = true;

    // If stale session from different user or test, force-clear before re-init
    if (store.isSessionActive && (store.lastUserId !== user.id || store.activeTestId !== testId)) {
      store.clearTestSession();
    }

    const recoverSession = async () => {
      try {
        // Sync profile immediately to get the latest student status (e.g. NO_SECURITY)
        const updatedProfile = await apiCall('/api/student/profile');
        if (updatedProfile) {
          useAuthStore.getState().setUser(updatedProfile);
        }
        const currentUserStatus = updatedProfile?.status || user?.status || 'ACTIVE';

        const tests = await apiCall('/api/student/tests');
        const activeTest = tests.find((st: any) => st.test.id === testId);
        if (!activeTest) {
          router.push('/student/tests');
          return;
        }

        const isEnabled = activeTest.test.securityShieldEnabled ?? false;
        setSecurityShieldEnabled(isEnabled);

        const isSecActive = currentUserStatus === 'ACTIVE' && isEnabled;

        if ((activeTest.isSuspended || activeTest.status === 'SUSPENDED') && isSecActive) {
          suspendTest();
          clearTestSession();
          return;
        }

        setWarnings(activeTest.warningsCount || 0);

        const subjectId = activeTest.test.subject.id;
        const allQuestions = await apiCall(`/api/student/subjects/${subjectId}/questions`);

        // If this is a brand new start, clear any leftover local storage backups
        if (activeTest.status === 'ASSIGNED' && user?.id) {
          allQuestions.forEach((q: any) => {
            localStorage.removeItem(`chillcode_code_backup_${user.id}_${q.id}`);
          });
        }

        if (allQuestions && allQuestions.length > 0) {
          let targetQuestions = allQuestions;
          if (questionIdParam) {
            const qId = Number(questionIdParam);
            targetQuestions = allQuestions.filter((q: any) => q.id === qId);
            if (targetQuestions.length === 0) {
              targetQuestions = [allQuestions[0]];
            }
          }

          // Calculate remaining time
          const totalSeconds = activeTest.test.durationMinutes * 60;
          let remainingSeconds = totalSeconds;
          if (activeTest.startedAt) {
            const startTime = new Date(activeTest.startedAt).getTime();
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
          }

          // View mode ONLY for already submitted/evaluated tests
          const isDone = activeTest.status === 'SUBMITTED' || activeTest.status === 'EVALUATED';
          // If time expired but not submitted, restart with full duration
          if (remainingSeconds <= 0 && !isDone) {
            remainingSeconds = totalSeconds;
          }

          startTestSession(
            activeTest.test.id,
            activeTest.id,
            targetQuestions[0]?.title || '',
            targetQuestions,
            isDone ? 0 : remainingSeconds / 60,
            isDone,
            isEnabled,
            user?.id
          );

          // For returning students (STARTED), restore their last submitted code per question
          if (activeTest.status === 'STARTED' || activeTest.status === 'IN_PROGRESS') {
            for (const q of targetQuestions) {
              try {
                const subs = await apiCall(`/api/student/submissions/test/${activeTest.id}/question/${q.id}`);
                if (subs && subs.length > 0) {
                  const sorted = [...subs].sort((a: any, b: any) => b.id - a.id);
                  const latestCode = sorted[0].code || '';
                  const latestLang = sorted[0].language || 'java';
                  if (latestCode) {
                    useTestStore.getState().updateCode(q.id, latestCode);
                    useTestStore.getState().updateLanguage(q.id, latestLang);
                  }
                }
              } catch (e) {
                // If fetch fails, check localStorage backup
                const backup = localStorage.getItem(`chillcode_code_backup_${user.id}_${q.id}`);
                if (backup) {
                  useTestStore.getState().updateCode(q.id, backup);
                }
              }
            }
          }
        } else {
          router.push('/student/tests');
        }
      } catch (err) {
        console.error('Failed to recover exam session', err);
        router.push('/student/tests');
      } finally {
        recoverSessionCalledRef.current = false;
      }
    };

    recoverSession();
  }, [mounted, testId, startTestSession, router, user]);

  // Trigger fullscreen whenever security status becomes active
  useEffect(() => {
    if (!mounted || isViewMode) return;
    if (isSecurityStatusActive && typeof window !== 'undefined') {
      if (!document.fullscreenElement) {
        // Auto-enter fullscreen when secure session starts
        document.documentElement.requestFullscreen().catch(() => {
          setFullscreenRequired(true);
        });
      }
    }
  }, [mounted, isSecurityStatusActive, isViewMode]);

  // Prevent accidental navigation / refresh during active secure session
  useEffect(() => {
    if (!mounted || !isSessionActive || !isSecurityStatusActive || isViewMode) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Your exam is in progress. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Push a dummy state so browser back navigates to this page
    history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [mounted, isSessionActive, isSecurityStatusActive, isViewMode]);

  // Set up Timer interval (without subscribing to time changes here to avoid re-renders)
  useEffect(() => {
    if (!mounted || !isSessionActive || isViewMode) return;
    const interval = setInterval(() => {
      decrementTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [mounted, isSessionActive, isViewMode, decrementTime]);

  // Check Timer finish & warning checkpoints -> Auto submit & warnings
  const timerStartedRef = useRef<boolean>(false);
  const warnedTimesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!mounted || isViewMode) return;
    warnedTimesRef.current.clear();
    const unsubscribe = useTestStore.subscribe(
      (state, prevState) => {
        const seconds = state.timeLeftSeconds;
        if (!state.isViewMode && state.isSessionActive) {
          if (seconds === 600 && !warnedTimesRef.current.has(600)) {
            warnedTimesRef.current.add(600);
            alert('⚠️ Timer Warning: 10 minutes remaining in your test!');
          } else if (seconds === 300 && !warnedTimesRef.current.has(300)) {
            warnedTimesRef.current.add(300);
            alert('⚠️ Timer Warning: 5 minutes remaining in your test!');
          } else if (seconds === 60 && !warnedTimesRef.current.has(60)) {
            warnedTimesRef.current.add(60);
            alert('⚠️ Timer Warning: 1 minute remaining! Please finalize your code.');
          }

          if (seconds === 0 && prevState.timeLeftSeconds > 0) {
            handleAutoSubmit();
          }
        }
      }
    );
    return () => unsubscribe();
  }, [mounted, isSessionActive, isViewMode]);

  // Fetch submissions history
  const currentQuestion = questions && questions[activeQuestionIndex];
  
  const fetchSubmissionsHistory = async () => {
    if (!currentQuestion || !activeStudentTestId) return;
    try {
      const data = await apiCall(`/api/student/submissions/test/${activeStudentTestId}/question/${currentQuestion.id}`);
      setSubmissionsHistory(data || []);
      
      // In view mode, populate the editor with the latest submission code (sorted descending by id)
      const currentIsViewMode = useTestStore.getState().isViewMode;
      if (currentIsViewMode && data && data.length > 0) {
        const sortedData = [...data].sort((a: any, b: any) => b.id - a.id);
        const latestCode = sortedData[0].code || '';
        const latestLang = sortedData[0].language || 'java';
        updateCode(currentQuestion.id, latestCode);
        updateLanguage(currentQuestion.id, latestLang);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSubmissionsHistory();
    if (mounted && currentQuestion && !isViewMode) {
      apiCall(`/api/student/question/${currentQuestion.id}/status`).catch((err) =>
        console.error('Failed to update question status to IN_PROGRESS', err)
      );
    }
  }, [activeQuestionIndex, activeStudentTestId, questions, mounted, currentQuestion, isViewMode]);

  useEffect(() => {
    if (mounted && currentQuestion && !isViewMode && !codes[currentQuestion.id] && user?.id) {
      const backup = localStorage.getItem(`chillcode_code_backup_${user.id}_${currentQuestion.id}`);
      if (backup) {
        updateCode(currentQuestion.id, backup);
      }
    }
  }, [mounted, activeQuestionIndex, currentQuestion, user]);


  // Format Time
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const autoSubmittedRef = useRef<boolean>(false);

  const handleAutoSubmit = async () => {
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    useTestStore.setState({ isSessionActive: false });
    
    setSubmittingExam(true);
    try {
      const questionCodes: Record<string, { code: string; language: string }> = {};
      Object.keys(codes).forEach((qId) => {
        questionCodes[qId] = {
          code: codes[Number(qId)],
          language: languages[Number(qId)] || 'java',
        };
      });

      await apiCall(`/api/student/tests/${testId}/submit`, {
        method: 'POST',
        body: JSON.stringify(questionCodes),
      });
      if (user?.id) {
        Object.keys(codes).forEach((qId) => {
          localStorage.removeItem(`chillcode_code_backup_${user.id}_${qId}`);
        });
      }
      clearTestSession();
      resetWarnings();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      alert('Time is up! Your exam attempt has been auto-submitted.');
      router.push('/student/results');
    } catch (e) {
      console.error('Auto submit failed', e);
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleManualSubmitExam = async () => {
    if (!confirm('Are you sure you want to finish and submit your exam?')) return;
    setSubmittingExam(true);
    try {
      const questionCodes: Record<string, { code: string; language: string }> = {};
      Object.keys(codes).forEach((qId) => {
        questionCodes[qId] = {
          code: codes[Number(qId)],
          language: languages[Number(qId)] || 'java',
        };
      });

      await apiCall(`/api/student/tests/${testId}/submit`, {
        method: 'POST',
        body: JSON.stringify(questionCodes),
      });
      if (user?.id) {
        Object.keys(codes).forEach((qId) => {
          localStorage.removeItem(`chillcode_code_backup_${user.id}_${qId}`);
        });
      }
      clearTestSession();
      resetWarnings();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      router.push('/student/results');
    } catch (e) {
      alert('Failed to submit exam. Please try again.');
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleWarningTrigger = async (type: string, reason: string) => {
    if (!isSessionActive || isTestSuspended) return;

    // External paste: show local toast only, no server call (no points deduction)
    if (type === 'EXTERNAL_PASTE') {
      setShowExternalPasteWarning(true);
      setTimeout(() => setShowExternalPasteWarning(false), 4000);
      return;
    }

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
      const st = await apiCall(`/api/student/tests/${testId}/warning?type=${type}&reason=${encodeURIComponent(reason)}${currentQuestion ? `&questionId=${currentQuestion.id}` : ''}`, {
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

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        setFullscreenRequired(false);
      }
    } catch (e) {
      console.error('Fullscreen toggle failed', e);
    }
  };

  const handleRunCode = async () => {
    if (!currentQuestion) return;

    // Check if question has input and user has not populated customInput
    const sampleTestcases = currentQuestion.testCases?.filter((tc: any) => !tc.isHidden) || [];
    if (sampleTestcases.length > 0 && !customInput.trim() && !customInput2.trim() && !customInput3.trim()) {
      if (sampleTestcases[0]) setCustomInput(sampleTestcases[0].inputData || '');
      if (sampleTestcases[1]) setCustomInput2(sampleTestcases[1].inputData || '');
      if (sampleTestcases[2]) setCustomInput3(sampleTestcases[2].inputData || '');
      setConsoleOpen(true);
      setConsoleTab('TESTCASE');
      alert('This question requires input. We have pre-populated the input methods with the sample inputs. Review them, then click "Compile & Run" again.');
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
      customInput2: customInput2,
      customInput3: customInput3,
      runOnly: true,
    };

    try {
      const response = await apiCall(`/api/student/question/${currentQuestion.id}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setExecResult(response);
    } catch (err: any) {
      setExecResult({
        status: 'RUNTIME_ERROR',
        compilerOutput: null,
        runtimeOutput: err.message || 'Network execution error.',
        aiHint: null
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
    setEvaluationStage('EVALUATING');

    const payload = {
      code: codes[currentQuestion.id],
      language: languages[currentQuestion.id],
      questionId: currentQuestion.id,
      studentTestId: useTestStore.getState().activeStudentTestId,
      runOnly: false,
    };

    try {
      await new Promise((r) => setTimeout(r, 400));
      setEvaluationStage('RUNNING_TESTS');

      const response = await apiCall(`/api/student/question/${currentQuestion.id}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      setExecResult(response);
      setSubmissionResponse(response);
      fetchSubmissionsHistory();

      setEvaluationStage('CALCULATING_SCORE');
      await new Promise((r) => setTimeout(r, 400));
      setEvaluationStage('CONFIRMED');

      if (response && response.submissionId) {
        // MODULE 6 & 7: Check Pass/Fail decision to launch appropriate animation experience
        const isPass = response.overallResult === 'PASS' || response.status === 'ACCEPTED';
        if (isPass) {
          setShowGloryModal(true);
        } else {
          setShowFailModal(true);
        }
      }
    } catch (err: any) {
      setEvaluationStage('IDLE');
      setExecResult({
        status: 'RUNTIME_ERROR',
        compilerOutput: null,
        runtimeOutput: err.message || 'Network submission error.',
        aiHint: null
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleAnimationComplete = () => {
    if (submissionResponse && submissionResponse.submissionId) {
      clearTestSession();
      resetWarnings();
      if (document.fullscreenElement) {
        try {
          document.exitFullscreen();
        } catch (e) {}
      }
      router.push(`/student/results/submission/${submissionResponse.submissionId}`);
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
            onClick={handleToggleFullscreen}
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
        <div className="text-gray-500 flex items-center justify-center py-12 font-sans select-none flex-col gap-2">
          <Terminal className="w-8 h-8 text-gray-600 animate-pulse" />
          <span>Click 'Compile & Run' to evaluate your solution.</span>
        </div>
      );
    }

    const status = execResult.status;
    const isAccepted = status === 'ACCEPTED' || status === 'FINISHED';
    
    // Check if it has any custom inputs (where expectedOutput is N/A or null/undefined)
    const hasCustomInputResult = execResult.testCaseResults && execResult.testCaseResults.some((tc: any) => tc.expectedOutput === null || tc.expectedOutput === undefined || tc.expectedOutput === 'N/A');

    // Status colors and text
    let statusText = 'test case failed';
    if (isAccepted) {
      statusText = hasCustomInputResult ? 'Run Completed' : 'Pass';
    } else if (status === 'COMPILATION_ERROR') {
      statusText = 'Compilation Error';
    } else if (status === 'RUNTIME_ERROR') {
      statusText = 'Runtime Error';
    } else if (status === 'TIME_LIMIT_EXCEEDED') {
      statusText = 'Time Limit Exceeded';
    } else if (status === 'MEMORY_LIMIT_EXCEEDED') {
      statusText = 'Memory Limit Exceeded';
    } else if (status === 'WRONG_ANSWER') {
      statusText = 'test case failed';
    }

    let statusColor = isAccepted 
      ? (hasCustomInputResult ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" : "text-emerald-400 bg-[#10b981]/10 border-[#10b981]/20") 
      : "text-red-400 bg-red-500/10 border-red-500/20";

    // Extraction helper for statistics
    const executionTime = execResult.executionTimeMs !== undefined ? execResult.executionTimeMs : execResult.runTimeMs;
    const memoryUsed = execResult.memoryUsedKb !== undefined ? execResult.memoryUsedKb : execResult.memoryUsedKb;
    const passedCount = execResult.passedTests !== undefined ? execResult.passedTests : 
                        (execResult.testCaseResults ? execResult.testCaseResults.filter((tc: any) => tc.status === 'PASSED').length : 0);
    const totalCount = execResult.totalTests !== undefined ? execResult.totalTests : 
                       (execResult.testCaseResults ? execResult.testCaseResults.length : 0);
    const failedCount = totalCount - passedCount;

    return (
      <div className="space-y-4 font-sans text-xs pb-6">
        {/* Main Verdict Header Card */}
        <div className={`p-4 rounded-xl border ${statusColor} backdrop-blur-md flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            {isAccepted ? (
              hasCustomInputResult ? (
                <Terminal className="w-6 h-6 text-indigo-400" />
              ) : (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              )
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Evaluation Verdict</div>
              <div className="text-base font-extrabold font-sans tracking-tight">{statusText}</div>
            </div>
          </div>
          {execResult.judge0Status && (
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Engine Status</div>
              <div className="font-mono text-xs font-bold text-gray-300">{execResult.judge0Status}</div>
            </div>
          )}
        </div>

        {/* 4-Column Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Passed Cases */}
          <div className="p-3 bg-[#11131c] border border-white/5 rounded-xl flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Passed Tests</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {passedCount} / {totalCount}
            </span>
          </div>

          {/* Failed Cases */}
          <div className="p-3 bg-[#11131c] border border-white/5 rounded-xl flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Failed Tests</span>
            <span className={`text-base font-extrabold font-mono ${failedCount > 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {failedCount}
            </span>
          </div>

          {/* Run Time */}
          <div className="p-3 bg-[#11131c] border border-white/5 rounded-xl flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Execution Time</span>
            <span className="text-base font-extrabold text-white font-mono">
              {executionTime !== null && executionTime !== undefined ? `${executionTime} ms` : 'N/A'}
            </span>
          </div>

          {/* Memory Used */}
          <div className="p-3 bg-[#11131c] border border-white/5 rounded-xl flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Memory Used</span>
            <span className="text-base font-extrabold text-white font-mono">
              {memoryUsed !== null && memoryUsed !== undefined ? `${memoryUsed} KB` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Output Console for successful runs (ACCEPTED or FINISHED) */}
        {(status === 'ACCEPTED' || status === 'FINISHED') && execResult.runtimeOutput && (
          <div className="space-y-2">
            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" />
              Standard Output (stdout)
            </div>
            <pre className="p-3.5 bg-[#08090f]/90 border border-white/5 text-emerald-300 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed max-h-[300px] overflow-y-auto">
              {execResult.runtimeOutput}
            </pre>
          </div>
        )}

        {/* Compilation Error Console */}
        {status === 'COMPILATION_ERROR' && (
          <div className="space-y-2">
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" />
              Compiler Output
            </div>
            <pre className="p-3.5 bg-[#08090f]/90 border border-amber-500/10 text-amber-300 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed max-h-[300px] overflow-y-auto">
              {execResult.compilerOutput || "Unknown compilation error."}
            </pre>
          </div>
        )}

        {/* Runtime Error Console */}
        {status === 'RUNTIME_ERROR' && (
          <div className="space-y-2">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" />
              Runtime Error Trace
            </div>
            <pre className="p-3.5 bg-[#08090f]/90 border border-red-500/10 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed max-h-[300px] overflow-y-auto">
              {execResult.runtimeOutput || "Runtime exception or non-zero exit code."}
            </pre>
          </div>
        )}

        {/* Output Comparison (Expected vs Actual) */}
        {status === 'WRONG_ANSWER' && (
          <div className="space-y-3">
            {execResult.failedTestCaseNumber !== null && execResult.failedTestCaseNumber !== undefined && (
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                Failed at Test Case: #{execResult.failedTestCaseNumber}
              </div>
            )}
            
            {execResult.expectedOutput !== null && execResult.expectedOutput !== undefined ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Expected Output Card */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Expected Output</div>
                  <pre className="p-3 bg-[#08090f]/80 border border-white/5 text-emerald-300 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed max-h-[200px] overflow-y-auto">
                    {execResult.expectedOutput}
                  </pre>
                </div>
                {/* Actual Output Card */}
                <div className="space-y-1.5">
                  <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Your Output</div>
                  <pre className="p-3 bg-[#08090f]/80 border border-white/5 text-red-300 rounded-xl whitespace-pre-wrap font-mono select-text text-xs leading-relaxed max-h-[200px] overflow-y-auto">
                    {execResult.actualOutput}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-400 flex items-center justify-center font-bold">
                🔒 Hidden Test Case Failed
              </div>
            )}
          </div>
        )}

        {/* Detailed Individual Test Cases results render list */}
        {execResult.testCaseResults && execResult.testCaseResults.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Verification Test Cases</div>
            <div className="space-y-3">
              {execResult.testCaseResults.map((tc: any, index: number) => {
                const isPassed = tc.status === 'PASSED';
                // If it is hidden, we obscure message details
                const isHidden = tc.message && tc.message.includes("(Hidden testcase failed)");
                return (
                  <div key={tc.testCaseId || index} className="p-4 rounded-xl border border-white/5 bg-[#11131c] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isPassed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="font-bold text-white font-sans text-xs">Test Case {index + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {tc.runTimeMs !== null && tc.runTimeMs !== undefined && (
                          <span className="text-gray-500 font-mono text-[10px]">{tc.runTimeMs} ms</span>
                        )}
                        {tc.memoryUsedKb !== null && tc.memoryUsedKb !== undefined && (
                          <span className="text-gray-500 font-mono text-[10px]">{tc.memoryUsedKb} KB</span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isPassed ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]'
                        }`}>
                          {tc.status === 'PASSED' ? 'Passed' : tc.status === 'FAILED' ? 'Failed' : tc.status}
                        </span>
                      </div>
                    </div>

                    {!isHidden && tc.inputData && (
                      <div className="space-y-1">
                        <div className="text-[10px] text-gray-500 font-bold uppercase font-sans">Input (stdin)</div>
                        <pre className="p-2 bg-[#08090f]/80 border border-white/5 text-gray-300 rounded-lg whitespace-pre-wrap font-mono text-[11px] max-h-[80px] overflow-y-auto">
                          {tc.inputData}
                        </pre>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Expected Output */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-emerald-400 font-bold uppercase font-sans">Expected Output</div>
                        <pre className="p-2.5 bg-[#08090f]/80 border border-white/5 text-emerald-300 rounded-lg whitespace-pre-wrap font-mono text-[11px] leading-normal max-h-[120px] overflow-y-auto">
                          {isHidden ? "🔒 Hidden" : tc.expectedOutput || "N/A"}
                        </pre>
                      </div>
                      {/* Actual Output */}
                      <div className="space-y-1">
                        <div className={`text-[10px] font-bold uppercase font-sans ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>Your Output</div>
                        <pre className={`p-2.5 bg-[#08090f]/80 border border-white/5 rounded-lg whitespace-pre-wrap font-mono text-[11px] leading-normal max-h-[120px] overflow-y-auto ${isPassed ? 'text-emerald-300' : 'text-red-300'}`}>
                          {isHidden ? "🔒 Hidden" : tc.actualOutput || "No output"}
                        </pre>
                      </div>
                    </div>

                    {tc.message && !isPassed && !isHidden && !tc.message.includes("Output doesn't match") && (
                      <pre className="p-2.5 bg-[#0b0c10] border border-white/5 text-red-300 rounded-lg whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                        {tc.message}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Hint Panel */}
        {execResult.aiHint && (
          <div className="space-y-1.5 p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-indigo-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 fill-indigo-400 animate-pulse text-indigo-400" />
              Ash's Hint 😉
            </div>
            <p className="text-xs leading-relaxed select-text whitespace-pre-wrap font-mono">
              {execResult.aiHint}
            </p>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className={`fixed inset-0 bg-[#0f1015] text-[#c5c6c7] flex flex-col z-40 font-sans ${isViewMode || !isSecurityStatusActive ? '' : 'select-none'}`}>
      {/* External Paste Warning Toast */}
      {showExternalPasteWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-900/95 border border-red-500/60 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-semibold animate-bounce" role="alert">
          <span className="text-lg">🚫</span>
          <span>External paste is not allowed during secure assessments.</span>
        </div>
      )}

      {/* 1. Header Navigation Bar (Matches CodeJudge Pro visual frame) */}
      <header className="h-14 bg-[#11131c] border-b border-white/5 flex justify-between items-center px-6 relative z-50">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Chill Code Logo" className="w-5 h-5 object-contain filter invert brightness-150 drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]" />
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

          {/* Security Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0b0c10] border border-white/5 rounded-xl">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
              {securityShieldEnabled ? 'Security Shield' : 'Security Status'}
            </span>
             <span className={`text-xs font-bold ${(user?.status === 'ACTIVE' || user?.status === 'NO_SECURITY') ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`}>
               {user?.status === 'NO_SECURITY' ? 'Off' : (user?.status === 'ACTIVE' ? 'Active' : 'Inactive')}
             </span>
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
              disabled={submittingExam}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submittingExam && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submittingExam ? 'Submitting...' : 'Submit Exam'}
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
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400">
                  {currentQuestion.difficulty}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-gray-400">
                  Attempts: {currentQuestion.attemptCount ?? 0}
                </span>
                <h2 className="text-2xl font-bold text-white leading-tight font-sans">
                  {currentQuestion.title}
                </h2>
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
                <FontSizeIcon className="w-4 h-4" />
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
              <button onClick={handleToggleFullscreen} className="hover:text-white transition-colors p-1" title="Toggle Fullscreen">
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
                  if (user?.id) {
                    localStorage.setItem(`chillcode_code_backup_${user.id}_${currentQuestion.id}`, val || '');
                  }
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
          <div className={`border-t border-white/5 bg-[#11131c] flex flex-col overflow-hidden transition-all duration-300 shrink-0 ${
            consoleOpen ? 'h-[280px]' : 'h-[96px]'
          }`}>
            {/* Console Header bar */}
            <div 
              onClick={() => setConsoleOpen(!consoleOpen)}
              className="px-6 py-2.5 bg-[#11131c] flex justify-between items-center cursor-pointer select-none border-b border-white/5 shrink-0"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8b5cf6]" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Console</span>
              </div>
              <button className="text-gray-500 hover:text-white">
                {consoleOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Console body content details */}
            {consoleOpen && (
              <div className="flex-1 overflow-hidden bg-[#0f1015] flex flex-col min-h-0 border-b border-white/5">
                {/* Tab selector */}
                <div className="flex border-b border-white/5 bg-[#11131c] px-6 select-none shrink-0">
                  <button
                    onClick={() => setConsoleTab('TESTCASE')}
                    className={`py-2 px-4 text-[10px] uppercase tracking-wider font-bold border-b-2 transition-all ${
                      consoleTab === 'TESTCASE' 
                        ? 'border-[#8b5cf6] text-white' 
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Testcase
                  </button>
                  <button
                    onClick={() => setConsoleTab('RESULT')}
                    className={`py-2 px-4 text-[10px] uppercase tracking-wider font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                      consoleTab === 'RESULT' 
                        ? 'border-[#8b5cf6] text-white' 
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Result
                    {execResult && (
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        execResult.status === 'ACCEPTED' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                    )}
                  </button>
                </div>

                <div className="flex-1 p-5 overflow-y-auto font-mono text-xs flex flex-col min-h-0">
                  {consoleTab === 'TESTCASE' ? (
                    <>
                      {(() => {
                        const sampleTestcases = currentQuestion.testCases?.filter((tc: any) => !tc.isHidden) || [];
                        const hasInput = currentQuestion.inputFormat || sampleTestcases.length > 0;
                        if (!hasInput) {
                          return (
                            <div className="text-gray-500 flex items-center justify-center py-8 font-sans">
                              This question does not require standard input.
                            </div>
                          );
                        }
                        
                        const count = Math.max(1, Math.min(3, sampleTestcases.length));
                        const inputs = [
                          { val: customInput, setVal: setCustomInput, label: "Custom Input 1 (stdin)" },
                          { val: customInput2, setVal: setCustomInput2, label: "Custom Input 2 (stdin)" },
                          { val: customInput3, setVal: setCustomInput3, label: "Custom Input 3 (stdin)" }
                        ];

                        return (
                          <div className="space-y-4 shrink-0 select-none">
                            <div className={`grid grid-cols-1 ${
                              count === 2 ? 'md:grid-cols-2' : count === 3 ? 'md:grid-cols-3' : 'md:grid-cols-1'
                            } gap-4`}>
                              {inputs.slice(0, count).map((inp, idx) => (
                                <div key={idx} className="space-y-1.5">
                                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">{inp.label}</div>
                                  <textarea
                                    value={inp.val}
                                    onChange={(e) => inp.setVal(e.target.value)}
                                    placeholder={`Type custom input ${idx + 1} here...`}
                                    className="w-full h-24 p-3 bg-[#11131c] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-[#8b5cf6] font-mono resize-none"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {renderResultContent()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Actions Row matching exact style indicators - Always visible */}
            <div className="p-3 px-4 sm:px-6 bg-[#11131c] flex flex-col sm:flex-row justify-between items-center gap-3 select-none shrink-0">
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
                    className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {executing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {executing ? 'Running...' : 'Compile & Run'}
                  </button>
                </div>
              )}
            </div>
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

      {/* MODULE 6: Glory Victory Celebration Modal */}
      {showGloryModal && submissionResponse && (
        <GloryCelebrationModal
          score={submissionResponse.score ?? 0}
          totalMarks={submissionResponse.totalMarks ?? 20}
          passingMarks={submissionResponse.passingMarks ?? 10}
          percentage={submissionResponse.percentage ?? 0}
          questionName={currentQuestion?.title || 'Coding Challenge'}
          onComplete={handleAnimationComplete}
        />
      )}

      {/* MODULE 7: Fail Result Animation Modal */}
      {showFailModal && submissionResponse && (
        <FailResultModal
          score={submissionResponse.score ?? 0}
          totalMarks={submissionResponse.totalMarks ?? 20}
          passingMarks={submissionResponse.passingMarks ?? 10}
          percentage={submissionResponse.percentage ?? 0}
          questionName={currentQuestion?.title || 'Coding Challenge'}
          onComplete={handleAnimationComplete}
        />
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
