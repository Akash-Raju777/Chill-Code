'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTestStore } from '../../../../store/testStore';
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
  Lock, 
  CheckCircle, 
  XCircle,
  HelpCircle,
  Settings as GearIcon,
  Moon,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Flame,
  Bell,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import Link from 'next/link';

export default function CodingWorkspace() {
  const params = useParams();
  const router = useRouter();
  const testId = Number(params.id);

  const {
    activeTestName,
    questions,
    activeQuestionIndex,
    codes,
    languages,
    timeLeftSeconds,
    isSessionActive,
    setActiveQuestionIndex,
    updateCode,
    updateLanguage,
    decrementTime,
    clearTestSession,
  } = useTestStore();

  const {
    warnings,
    warningsLimit,
    lastWarningReason,
    showWarningModal,
    isTestSuspended,
    incrementWarnings,
    resetWarnings,
    setWarningModal,
    suspendTest,
  } = useSecurityStore();

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

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !document.fullscreenElement) {
      setFullscreenRequired(true);
    }
  }, []);

  // Set up Timer interval
  useEffect(() => {
    if (!mounted || !isSessionActive) return;
    const interval = setInterval(() => {
      decrementTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [mounted, isSessionActive, decrementTime]);

  // Check Timer finish -> Auto submit
  useEffect(() => {
    if (mounted && isSessionActive && timeLeftSeconds === 0) {
      handleAutoSubmit();
    }
  }, [mounted, timeLeftSeconds, isSessionActive]);

  // Fetch submissions history
  const currentQuestion = questions && questions[activeQuestionIndex];
  
  const fetchSubmissionsHistory = async () => {
    if (!currentQuestion || !useTestStore.getState().activeStudentTestId) return;
    try {
      const data = await apiCall(`/api/student/submissions/test/${useTestStore.getState().activeStudentTestId}/question/${currentQuestion.id}`);
      setSubmissionsHistory(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeLeftTab === 'SUBMISSIONS') {
      fetchSubmissionsHistory();
    }
  }, [activeLeftTab, activeQuestionIndex]);

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
    isSessionActive: isSessionActive && !isTestSuspended && !fullscreenRequired,
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
  if (isTestSuspended) {
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
  if (fullscreenRequired) {
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

  return (
    <div className="fixed inset-0 bg-[#0f1015] text-[#c5c6c7] flex flex-col z-40 select-none font-sans">
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
            <span className="text-gray-600">|</span>
            <div className="flex items-center gap-1">
              {questions.map((q, index) => (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIndex(index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeQuestionIndex === index 
                      ? 'bg-[#7c3aed]/15 text-[#8b5cf6]' 
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Q{index + 1}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Right Tools: Streak, Notifications, Profile Card */}
        <div className="flex items-center gap-6">
          {/* Streak indicator */}
          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-sm bg-orange-500/10 px-3 py-1.5 rounded-full border border-orange-500/20">
            <Flame className="w-4 h-4 fill-orange-400" />
            24
          </div>

          {/* Timer count down */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0b0c10] border border-white/5 rounded-xl">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Timer</span>
            <span className={`font-mono text-sm font-bold ${timeLeftSeconds < 300 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {formatTime(timeLeftSeconds)}
            </span>
          </div>

          {/* Warnings Log counter */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/10 text-red-400 rounded-xl">
            <span className="text-[10px] uppercase font-bold tracking-wider">Warnings</span>
            <span className="font-mono text-sm font-bold">{warnings} / {warningsLimit}</span>
          </div>

          <button
            onClick={handleManualSubmitExam}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10"
          >
            Submit Exam
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Split Panel */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* LEFT COLUMN: Problem Details, Inputs, Examples, Submissions */}
        <div className="w-full md:w-[45%] h-[50vh] md:h-full flex flex-col bg-[#11131c] border-b md:border-b-0 md:border-r border-white/5 overflow-hidden">
          {/* Tabs header matching Image 2 tab indicators */}
          <div className="flex bg-[#11131c] border-b border-white/5 px-6">
            <button
              onClick={() => setActiveLeftTab('PROBLEM')}
              className={`py-3 text-xs font-semibold tracking-wider relative mr-6 transition-all ${
                activeLeftTab === 'PROBLEM' 
                  ? 'text-white border-b-2 border-[#8b5cf6]' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Problem
            </button>
            <button
              onClick={() => setActiveLeftTab('SUBMISSIONS')}
              className={`py-3 text-xs font-semibold tracking-wider relative mr-6 transition-all ${
                activeLeftTab === 'SUBMISSIONS' 
                  ? 'text-white border-b-2 border-[#8b5cf6]' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Submissions
            </button>
          </div>

          {/* Content Pane scroll wrapper */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeLeftTab === 'PROBLEM' ? (
              <>
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
                  {/* Upvotes / downvotes stats block matching design */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <button className="flex items-center gap-1 hover:text-gray-300">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      4.2k
                    </button>
                    <button className="flex items-center gap-1 hover:text-gray-300">
                      <ThumbsDown className="w-3.5 h-3.5" />
                      124
                    </button>
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
              </>
            ) : (
              /* Submissions History tab */
              <div className="space-y-4">
                <h3 className="font-bold text-white text-sm mb-4">Submission Logs</h3>
                {submissionsHistory.length === 0 ? (
                  <div className="text-center py-12 text-xs text-gray-500 font-medium">
                    No code submissions logged for this question yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissionsHistory.map((sub) => (
                      <div key={sub.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                              sub.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {sub.status}
                            </span>
                            <span className="text-gray-500 font-semibold uppercase">{sub.language}</span>
                          </div>
                          <div className="text-[10px] text-gray-500">{new Date(sub.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-right text-gray-400">
                          <div>Runtime: <strong>{sub.runTimeMs}ms</strong></div>
                          <div>Score: <strong>{sub.score} pts</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Monaco editor & Console drawer */}
        <div className="w-full md:w-[55%] h-[50vh] md:h-full flex flex-col bg-[#0f1015] overflow-hidden">
          {/* Header Action toolbar matching Reference image 2 */}
          <div className="h-12 bg-[#11131c] border-b border-white/5 px-4 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              {/* Language Selection */}
              <select
                className="bg-[#0b0c10] border border-white/5 rounded-lg text-xs py-1.5 px-3 font-semibold text-white select-none focus:outline-none cursor-pointer"
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
              <button onClick={handleResetCode} className="hover:text-white transition-colors p-1" title="Reset Code">
                <RotateCcw className="w-4 h-4" />
              </button>
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
              onChange={(val) => updateCode(currentQuestion.id, val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                fontFamily: 'Consolas, monospace',
                automaticLayout: true,
                padding: { top: 12 },
              }}
            />
          </div>

          {/* 3. Output Console Bottom Drawer Drawer */}
          <div className={`border-t border-white/5 bg-[#11131c] flex flex-col overflow-hidden transition-all duration-300 ${
            consoleOpen ? 'h-64' : 'h-11'
          }`}>
            {/* Console Header bar */}
            <div 
              onClick={() => setConsoleOpen(!consoleOpen)}
              className="px-6 py-2.5 bg-[#11131c] flex justify-between items-center cursor-pointer select-none border-b border-white/5"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8b5cf6]" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">CONSOLE</span>
              </div>
              <button className="text-gray-500 hover:text-white">
                {consoleOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Console body content details */}
            {consoleOpen && (
              <div className="flex-1 p-5 overflow-y-auto font-mono text-xs bg-[#0f1015] flex flex-col min-h-0">
                {/* Console tabs select header */}
                <div className="flex gap-4 border-b border-white/5 pb-2 mb-4 font-sans text-xs shrink-0 select-none">
                  <button
                    onClick={() => setConsoleTab('TESTCASE')}
                    className={`pb-1 font-bold uppercase tracking-wider transition-colors focus:outline-none ${
                      consoleTab === 'TESTCASE' ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Testcase
                  </button>
                  <button
                    onClick={() => setConsoleTab('RESULT')}
                    className={`pb-1 font-bold uppercase tracking-wider transition-colors focus:outline-none ${
                      consoleTab === 'RESULT' ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Result
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {consoleTab === 'TESTCASE' && (
                    <div className="space-y-2">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans mb-2">Custom Input (stdin)</div>
                      <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="Type custom inputs here (e.g. 5\n1 2 3 4 5)..."
                        className="w-full h-32 p-3 bg-[#11131c] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-[#8b5cf6] font-mono resize-none"
                      />
                    </div>
                  )}

                  {consoleTab === 'RESULT' && (
                    <div className="space-y-4">
                      {executing && (
                        <div className="flex items-center gap-3 py-6 justify-center text-gray-500 font-sans">
                          <Loader2 className="w-5 h-5 animate-spin text-[#8b5cf6]" />
                          Compiling and executing your code...
                        </div>
                      )}

                      {!executing && !execResult && (
                        <div className="text-gray-500 flex items-center justify-center h-full font-sans py-10">
                          Click 'Run Code' or 'Submit' to evaluate your solution.
                        </div>
                      )}

                      {!executing && execResult && (
                        <div className="space-y-4">
                          {/* Overall Verdict */}
                          <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-[#11131c] font-sans">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 uppercase font-bold tracking-wider text-[10px]">Verdict</span>
                              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                                execResult.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {execResult.status}
                              </span>
                            </div>
                            <div className="flex gap-4 text-[10px] text-gray-500">
                              <span>Time: <strong className="text-white">{execResult.runTimeMs || 0}ms</strong></span>
                              <span>Memory: <strong className="text-white">{((execResult.memoryUsedKb || 12800) / 1024).toFixed(2)}MB</strong></span>
                            </div>
                          </div>

                          {/* Compilation Errors output */}
                          {execResult.compileError && (
                            <div className="space-y-1">
                              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Compilation Error</div>
                              <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text">
                                {execResult.compileError}
                              </pre>
                            </div>
                          )}

                          {/* Stdout and Stderr display for runOnly / Run Code */}
                          {(execResult.stdout !== undefined || execResult.stderr !== undefined) && (
                            <div className="space-y-3">
                              {execResult.stdout && (
                                <div className="space-y-1">
                                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">Standard Output (stdout)</div>
                                  <pre className="p-3 bg-[#11131c] border border-white/5 text-gray-200 rounded-xl whitespace-pre-wrap font-mono select-text">
                                    {execResult.stdout}
                                  </pre>
                                </div>
                              )}
                              {execResult.stderr && (
                                <div className="space-y-1">
                                  <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider font-sans">Standard Error (stderr)</div>
                                  <pre className="p-3 bg-red-500/5 border border-red-500/15 text-red-400 rounded-xl whitespace-pre-wrap font-mono select-text">
                                    {execResult.stderr}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Individual testcase ticks details (only for full submit runs) */}
                          {execResult.testCaseResults && (
                            <div className="space-y-2">
                              <h4 className="text-[10px] text-gray-500 font-sans font-bold uppercase tracking-wider mb-2">Test Case Results</h4>
                              {execResult.testCaseResults.map((tcRes: any, index: number) => (
                                <div key={index} className="flex flex-col p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1 font-sans">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {tcRes.status === 'PASSED' ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-red-400" />
                                      )}
                                      <span className="font-semibold text-white">Test Case #{index + 1}</span>
                                    </div>
                                    <span className={`font-bold text-[10px] uppercase ${
                                      tcRes.status === 'PASSED' ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                      {tcRes.status}
                                    </span>
                                  </div>
                                  {tcRes.message && (
                                    <pre className="text-[10px] text-gray-400 pl-6 select-text whitespace-pre-wrap font-mono bg-black/10 p-1.5 rounded">
                                      {tcRes.message}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Actions Row matching exact style indicators */}
            {consoleOpen && (
              <div className="p-3 px-6 bg-[#11131c] border-t border-white/5 flex justify-between items-center select-none">
                <span className="text-[10px] font-bold text-gray-500 tracking-wider">DEBUG ASSISTANT ACTIVE</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleRunCode} 
                    disabled={executing}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs tracking-wider transition-all disabled:opacity-50"
                  >
                    Run Code
                  </button>
                  <button 
                    onClick={handleSubmitCode}
                    disabled={executing}
                    className="px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs tracking-wider transition-all shadow-md shadow-[#7c3aed]/20 disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
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
