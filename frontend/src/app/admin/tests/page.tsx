'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { Plus, Timer, Calendar, CheckSquare, Loader2, Award, Clipboard } from 'lucide-react';

interface Subject {
  id: number;
  name: string;
}

interface Question {
  id: number;
  title: string;
  difficulty: string;
}

interface Test {
  id: number;
  testCode?: string;
  name: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  maxMarks: number;
  instructions: string;
}

export default function TestManagement() {
  const [tests, setTests] = useState<Test[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [securityShieldEnabled, setSecurityShieldEnabled] = useState(true);
  const [testCode, setTestCode] = useState('');

  const fetchInitialData = async (isInitial = false) => {
    if (isInitial || tests.length === 0) {
      setLoading(true);
    }
    try {
      const testsData = await apiCall('/api/admin/tests');
      setTests(testsData);

      const subs = await apiCall('/api/admin/subjects');
      setSubjects(subs);
      if (subs.length > 0) {
        setSelectedSubjectId(subs[0].id);
      }
    } catch (err: any) {
      setError('Failed to fetch scheduled tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData(true);
  }, []);

  const fetchQuestionsForSubject = async (subId: number) => {
    try {
      const data = await apiCall(`/api/admin/subjects/${subId}/questions`);
      setQuestions(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedSubjectId) {
      fetchQuestionsForSubject(selectedSubjectId);
      setSelectedQuestionIds([]);
    }
  }, [selectedSubjectId]);

  const handleToggleQuestion = (id: number) => {
    if (selectedQuestionIds.includes(id)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((qid) => qid !== id));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, id]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) return;
    if (selectedQuestionIds.length === 0) {
      setError('Please select at least one question for this test.');
      return;
    }

    const payload = {
      subjectId: selectedSubjectId,
      name,
      testCode: testCode.trim().toUpperCase() || undefined,
      durationMinutes,
      startTime,
      endTime,
      instructions,
      questionIds: selectedQuestionIds,
      shuffleQuestions,
      autoSubmit,
      negativeMarking,
      securityShieldEnabled,
      maxMarks: selectedQuestionIds.length * 10,
    };

    try {
      await apiCall('/api/admin/tests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setName('');
      setTestCode('');
      setInstructions('');
      setShowAddForm(false);
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule test');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Test Scheduler</h1>
          <p className="text-sm text-gray-500">Plan and assign online examination blocks</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-btn text-sm"
        >
          <Plus className="w-4 h-4" />
          Schedule Test
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Schedule Test modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl glass-panel p-6 rounded-2xl relative my-8">
            <h2 className="text-xl font-bold text-white mb-4">Schedule New Exam</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Test Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Java Basics Midterm"
                    className="w-full glass-input p-3 rounded-xl text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Subject</label>
                  <select
                    className="w-full glass-input p-3 rounded-xl text-sm"
                    value={selectedSubjectId || ''}
                    onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Test ID (Unique)</label>
                  <input
                    type="text"
                    placeholder="e.g. JAVA-1, HTML-2, PYTHON-3"
                    className="w-full glass-input p-3 rounded-xl text-sm font-mono tracking-wider"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                    maxLength={20}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Leave blank to auto-generate. Must be unique.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Duration</label>
                  <select
                    className="w-full glass-input p-3 rounded-xl text-sm"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={90}>90 Minutes (1.5 Hours)</option>
                    <option value={120}>120 Minutes (2 Hours)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Start Window</label>
                  <input
                    type="datetime-local"
                    required
                    className="w-full glass-input p-3 rounded-xl text-sm"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">End Window</label>
                  <input
                    type="datetime-local"
                    required
                    className="w-full glass-input p-3 rounded-xl text-sm"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Instructions</label>
                <textarea
                  placeholder="Exam instructions..."
                  className="w-full glass-input p-3 rounded-xl text-sm h-16"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>

              {/* Toggles */}
              <div className="flex gap-6 py-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                  />
                  Shuffle
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={autoSubmit}
                    onChange={(e) => setAutoSubmit(e.target.checked)}
                  />
                  Auto Submit
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                  />
                  Negative Marking
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                  <input
                    type="checkbox"
                    checked={securityShieldEnabled}
                    onChange={(e) => setSecurityShieldEnabled(e.target.checked)}
                  />
                  🛡️ Security Shield (Strict)
                </label>
              </div>

              {/* Question list selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Select Questions</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-white/5 rounded-xl p-3 bg-white/5">
                  {questions.map((q) => (
                    <label key={q.id} className="flex items-center gap-3 cursor-pointer text-sm text-white">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={() => handleToggleQuestion(q.id)}
                      />
                      <span>{q.title}</span>
                    </label>
                  ))}
                  {questions.length === 0 && (
                    <div className="text-center text-xs text-gray-500 py-4">No questions created under this subject yet.</div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl gradient-btn text-sm">
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : tests.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
          <Timer className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="font-bold text-white text-lg">No tests scheduled</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Create a test instance to deploy coding questions to students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tests.map((t) => (
            <div key={t.id} className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Timer className="w-5 h-5" />
                    <span className="text-xs font-semibold tracking-wider uppercase">Exam Batch</span>
                  </div>
                  <span className="text-xs text-gray-500 font-semibold">{t.durationMinutes} Mins</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                    {t.testCode || `TEST-${t.id}`}
                  </span>
                  <h3 className="font-bold text-white text-lg">{t.name}</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed font-sans">{t.instructions || 'No instructions provided.'}</p>
              </div>

              <div className="border-t border-white/5 mt-6 pt-4 space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Start: {new Date(t.startTime).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    End: {new Date(t.endTime).toLocaleString()}
                  </span>
                  <span className="font-semibold text-white">Max Marks: {t.maxMarks}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
