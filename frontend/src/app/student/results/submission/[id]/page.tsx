'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiCall, formatISTDateTime } from '../../../../../utils/api';
import { toast } from '../../../../../store/toastStore';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database, 
  Terminal, 
  ArrowLeft, 
  Play, 
  RotateCcw,
  Loader2,
  Calendar
} from 'lucide-react';

const formatDuration = (seconds?: number) => {
  let actualSec = seconds;
  if (actualSec === undefined || actualSec === null || actualSec < 0) return 'N/A';
  if (actualSec === 0) return '0 sec';
  
  // Calculate: Actual Time Taken = Exam Duration - Remaining/Timer Difference
  // Exam Duration is assumed to be 60 minutes (3600 seconds) for these records
  if (actualSec > 1800) {
    actualSec = 3600 - actualSec;
  }
  
  const hrs = Math.floor(actualSec / 3600);
  const mins = Math.floor((actualSec % 3600) / 60);
  const secs = actualSec % 60;

  if (hrs > 0) {
    return `${hrs} hr ${mins} min ${secs} sec`;
  }
  if (mins > 0) {
    return `${mins} min ${secs} sec`;
  }
  return `${secs} sec`;
};

export default function SubmissionResultPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submission, setSubmission] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!submissionId) return;

    let intervalId: any = null;

    const fetchSubmissionDetails = async (showSpinner: boolean = true) => {
      if (showSpinner) setLoading(true);
      try {
        const data = await apiCall(`/api/student/submissions/${submissionId}`);
        setSubmission(data);
        if (data && data.status === 'PENDING') {
          if (!intervalId) {
            intervalId = setInterval(() => {
              fetchSubmissionDetails(false);
            }, 1000);
          }
        } else {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch submission details.');
        setLoading(false);
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    fetchSubmissionDetails(true);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [submissionId]);



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed] mx-auto" />
          <p className="text-gray-400 font-sans text-xs">Loading submission results...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10] p-4 text-center">
        <div className="max-w-md bg-[#11131c] p-8 rounded-2xl border border-red-500/20 space-y-6">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Error Loading Verdict</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            {error || 'The requested submission record was not found or has expired.'}
          </p>
          <button 
            onClick={() => { router.push('/student/results'); router.refresh(); }}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-white border border-white/10 transition-all w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Results
          </button>
        </div>
      </div>
    );
  }

  const isPass = submission.overallResult === 'PASS' || submission.status === 'ACCEPTED';
  let verdictText = isPass ? 'PASS' : 'FAIL';
  let verdictColor = isPass ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-red-400 border-red-500/20 bg-red-500/10';
  let VerdictIcon = isPass ? CheckCircle2 : XCircle;

  if (submission.status === 'COMPILATION_ERROR') {
    verdictText = "Compilation Error (FAIL)";
    verdictColor = "text-amber-400 border-amber-500/20 bg-amber-500/10";
  } else if (submission.status === 'RUNTIME_ERROR') {
    verdictText = "Runtime Error (FAIL)";
    verdictColor = "text-red-400 border-red-500/20 bg-red-500/10";
  } else if (submission.status === 'TIME_LIMIT_EXCEEDED') {
    verdictText = "Time Limit Exceeded (FAIL)";
    verdictColor = "text-orange-400 border-orange-500/20 bg-orange-500/10";
  } else if (submission.status === 'MEMORY_LIMIT_EXCEEDED') {
    verdictText = "Memory Limit Exceeded (FAIL)";
    verdictColor = "text-purple-400 border-purple-500/20 bg-purple-500/10";
  } else if (submission.status === 'WRONG_ANSWER') {
    verdictText = isPass ? "Output Mismatched (PASS)" : "Output Mismatched (FAIL)";
  }

  const score = submission.score ?? 0;
  const totalMarks = submission.totalMarks ?? 20;
  const passingMarks = submission.passingMarks ?? 10;
  const percentage = submission.percentage ?? (totalMarks > 0 ? Math.round(((score * 100.0) / totalMarks) * 100) / 100 : 0);
  const passedTests = submission.passedTests ?? 0;
  const totalTests = submission.totalTests ?? 0;
  const failedTests = Math.max(0, totalTests - passedTests);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 font-sans">
      {/* Header and Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { router.push('/student/results'); router.refresh(); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 transition-all select-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Results
        </button>

      </div>

      {/* Verdict Panel Card */}
      <div className={`p-6 rounded-2xl border ${verdictColor} backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl`}>
        <div className="flex items-center gap-4">
          <VerdictIcon className="w-12 h-12" />
          <div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Submission Status & Overall Result</div>
            <h1 className="text-2xl font-black tracking-tight">{verdictText}</h1>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-left md:text-right">
          <span className="text-sm text-white font-bold">{submission.questionName}</span>
          <div className="flex items-center gap-2 md:justify-end text-[10px] text-gray-400 uppercase font-bold tracking-wider">
            <span>Subject: <strong className="text-gray-200">{submission.subjectName}</strong></span>
            <span>•</span>
            <span>Lang: <strong className="text-indigo-400 uppercase">{submission.language}</strong></span>
          </div>
        </div>
      </div>

      {/* Module 5 Overview Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* Overall Status */}
        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Overall Result</span>
          <div className={`text-lg font-black tracking-wider uppercase ${isPass ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPass ? 'PASS' : 'FAIL'}
          </div>
        </div>

        {/* Final Score */}
        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Final Score</span>
          <div className="text-lg font-black text-amber-300 font-mono">
            {score} <span className="text-xs text-gray-500 font-semibold">/ {totalMarks}</span>
          </div>
        </div>

        {/* Passing Marks */}
        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Passing Marks</span>
          <div className="text-lg font-black text-indigo-400 font-mono">
            {passingMarks}
          </div>
        </div>

        {/* Percentage */}
        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Percentage</span>
          <div className="text-lg font-black text-white font-mono">
            {percentage}%
          </div>
        </div>

        {/* Passed Test Cases */}
        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Passed Tests</span>
          <div className="text-lg font-black text-emerald-400 font-mono">
            {passedTests} / {totalTests}
          </div>
        </div>

        {/* Failed Test Cases */}
        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Failed Tests</span>
          <div className="text-lg font-black text-red-400 font-mono">
            {failedTests}
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Time Taken</div>
            <div className="text-xs font-semibold text-gray-200 font-mono">
              {formatDuration(submission.timeTakenSeconds, submission.startedAt, submission.submittedAt || submission.createdAt)}
            </div>
          </div>
        </div>

        <div className="bg-[#11131c] border border-white/5 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Submission Time</div>
            <div className="text-xs font-semibold text-gray-300">{submission.createdAt ? formatISTDateTime(submission.createdAt) : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Module 5 Detailed Test Case Summary Breakdown */}
      {submission.testCaseResults && submission.testCaseResults.length > 0 && (
        <div className="bg-[#11131c] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Detailed Test Case Breakdown</h3>
              <p className="text-[11px] text-gray-500">Individual status and marks allocated per test case.</p>
            </div>
            <div className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              Score: {score} / {totalMarks}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Test Case</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Marks Awarded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {submission.testCaseResults.map((tc: any, idx: number) => {
                  const isTcPassed = tc.status === 'PASSED';
                  const tcMaxMarks = tc.marks ?? 5;
                  const tcAwarded = tc.marksAwarded ?? (isTcPassed ? tcMaxMarks : 0);

                  return (
                    <tr key={tc.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">
                        Test Case {idx + 1} {tc.isHidden ? '(Hidden)' : ''}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          isTcPassed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {isTcPassed ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Passed
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              {tc.status || 'Failed'}
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={isTcPassed ? 'text-emerald-400' : 'text-gray-500'}>
                          {tcAwarded}
                        </span>
                        <span className="text-gray-600 font-normal"> / {tcMaxMarks} Marks</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Module 5 Summary Box */}
      <div className="bg-gradient-to-r from-[#11131c] via-[#161926] to-[#11131c] border border-white/10 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Evaluation Summary</div>
          <div className="text-xl font-bold text-white flex items-center gap-3">
            <span>Final Score: <strong className="text-amber-300 font-mono">{score} / {totalMarks}</strong></span>
            <span>•</span>
            <span>Passing Marks: <strong className="text-indigo-400 font-mono">{passingMarks}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium">Final Decision:</span>
          <span className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md ${
            isPass ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300' : 'bg-red-500/20 border border-red-400/40 text-red-300'
          }`}>
            {isPass ? 'PASS' : 'FAIL'}
          </span>
        </div>
      </div>

      {/* Compiler logs */}
      {submission.compileError && (
        <div className="space-y-2">
          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5" />
            Compiler Output logs
          </div>
          <pre className="p-4 bg-[#08090f]/90 border border-amber-500/10 text-amber-300 rounded-xl whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[300px] overflow-y-auto">
            {submission.compileError}
          </pre>
        </div>
      )}

      {/* Runtime errors logs */}
      {submission.stderr && (
        <div className="space-y-2">
          <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5" />
            Runtime Stderr Trace
          </div>
          <pre className="p-4 bg-[#08090f]/90 border border-red-500/10 text-red-400 rounded-xl whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[300px] overflow-y-auto">
            {submission.stderr}
          </pre>
        </div>
      )}

      {/* Expected vs Actual comparison block */}
      {submission.status === 'WRONG_ANSWER' && submission.expectedOutput && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Expected Output</div>
            <pre className="p-4 bg-[#08090f]/80 border border-white/5 text-emerald-300 rounded-xl whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[250px] overflow-y-auto">
              {submission.expectedOutput}
            </pre>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Your Output</div>
            <pre className="p-4 bg-[#08090f]/80 border border-white/5 text-red-300 rounded-xl whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[250px] overflow-y-auto">
              {submission.actualOutput || submission.stdout}
            </pre>
          </div>
        </div>
      )}

      {/* Display stdout for accepted/other runs if compile output doesn't exist */}
      {!submission.compileError && submission.stdout && (
        <div className="space-y-2">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5" />
            Stdout Output Logs
          </div>
          <pre className="p-4 bg-[#08090f]/90 border border-white/5 text-emerald-300 rounded-xl whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[250px] overflow-y-auto">
            {submission.stdout}
          </pre>
        </div>
      )}

      {/* Code Editor Preview */}
      <div className="space-y-2">
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Submitted Code ({submission.language})</div>
        <pre className="p-5 bg-[#11131c] border border-white/5 rounded-xl text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed select-text">
          <code>{submission.code}</code>
        </pre>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4 pt-4 border-t border-white/5">
        <button
          onClick={() => { router.push('/student/tests'); router.refresh(); }}
          className="flex-1 py-3 px-6 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg"
        >
          <Play className="w-4 h-4" />
          Back to Challenges
        </button>
      </div>
    </div>
  );
}
