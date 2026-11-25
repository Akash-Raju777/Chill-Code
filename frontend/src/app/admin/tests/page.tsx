'use client';

import React, { useEffect, useState } from 'react';
import { apiCall, formatISTDateTime } from '../../../utils/api';
import { toast } from '../../../store/toastStore';
import { Plus, Timer, Calendar, CheckSquare, Loader2, Award, Clipboard, UserCheck, Edit3, RefreshCw } from 'lucide-react';

interface Subject {
  id: number;
  name: string;
}

interface Question {
  id: number;
  title: string;
  difficulty: string;
}

interface StaffMember {
  id: number;
  name: string;
  staffId: string;
  department: string;
  email: string;
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
  assignedStaffId?: number;
  assignedStaffName?: string;
}

export default function TestManagement() {
  const [tests, setTests] = useState<Test[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  // Reassign staff modal state
  const [editingTestStaff, setEditingTestStaff] = useState<Test | null>(null);
  const [newStaffId, setNewStaffId] = useState<number | null>(null);
  const [updatingStaff, setUpdatingStaff] = useState(false);

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

  const fetchInitialData = async (isInitial = false, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (isInitial || tests.length === 0) {
      setLoading(true);
    }
    try {
      // Parallel: tests, subjects, and staff are independent — sequential
      // awaits tripled the load time for this page.
      const opts = { skipLocalCache: isRefresh };
      const [testsData, subs, staffData] = await Promise.all([
        apiCall('/api/admin/tests', opts),
        apiCall('/api/admin/subjects', opts),
        apiCall('/api/admin/staff', opts).catch(() => []),
      ]);

      setTests(testsData);
      setSubjects(subs);
      if (subs.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subs[0].id);
      }

      if (staffData && Array.isArray(staffData)) {
        setStaffList(staffData);
        if (staffData.length > 0 && !selectedStaffId) {
          setSelectedStaffId(staffData[0].id);
        }
      }
    } catch (err: any) {
      setError('Failed to fetch scheduled tests');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    if (testCode.trim()) {
      const formattedCode = testCode.trim().toUpperCase();
      const codeExists = tests.some((t) => t.testCode?.toUpperCase() === formattedCode);
      if (codeExists) {
        setError(`Test ID '${formattedCode}' already exists. Please specify a unique Test ID.`);
        return;
      }
    }

    const payload = {
      subjectId: selectedSubjectId,
      assignedStaffId: selectedStaffId || undefined,
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
      toast.success('Test scheduled and assigned successfully');
      fetchInitialData();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule test');
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTestStaff || !newStaffId) return;
    setUpdatingStaff(true);
    try {
      await apiCall(`/api/admin/tests/${editingTestStaff.id}/staff`, {
        method: 'PUT',
        body: JSON.stringify({ staffId: newStaffId }),
      });
      toast.success('Assigned staff updated successfully');
      setEditingTestStaff(null);
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update assigned staff');
    } finally {
      setUpdatingStaff(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Test Scheduler</h1>
          <p className="text-sm text-gray-500">Plan, assign responsible educators, and schedule examination instances</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchInitialData(false, true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
            title="Refresh tests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-btn text-sm"
          >
            <Plus className="w-4 h-4" />
            Schedule Test
          </button>
        </div>
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

              {/* Staff Member Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Responsible Staff Member <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  className="w-full glass-input p-3 rounded-xl text-sm"
                  value={selectedStaffId || ''}
                  onChange={(e) => setSelectedStaffId(Number(e.target.value))}
                >
                  <option value="">Select Staff Member Responsible</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId}) - {s.department}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  This test will be attributed to the selected staff member in performance tracking.
                </p>
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

      {/* Edit Assigned Staff Modal */}
      {editingTestStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl relative">
            <h2 className="text-lg font-bold text-white mb-2">Reassign Test Staff</h2>
            <p className="text-xs text-gray-400 mb-4">
              Select the responsible staff member for &ldquo;{editingTestStaff.name}&rdquo;.
            </p>

            <form onSubmit={handleUpdateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Staff Member</label>
                <select
                  required
                  className="w-full glass-input p-3 rounded-xl text-sm"
                  value={newStaffId || ''}
                  onChange={(e) => setNewStaffId(Number(e.target.value))}
                >
                  <option value="">Select Staff Member</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staffId}) - {s.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingTestStaff(null)}
                  className="px-4 py-2 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/5 text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStaff || !newStaffId}
                  className="px-4 py-2 rounded-xl gradient-btn text-xs font-semibold flex items-center gap-1.5"
                >
                  {updatingStaff && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Assignment
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
                    {t.testCode || `TEST-${String(t.id).padStart(3, '0')}`}
                  </span>
                  <h3 className="font-bold text-white text-lg">{t.name}</h3>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed font-sans">{t.instructions || 'No instructions provided.'}</p>
                
                {/* Staff Assignment Display */}
                <div className="pt-2 flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-gray-400">Assigned Staff:</span>
                    <strong className="text-white font-medium">{t.assignedStaffName || 'Unassigned'}</strong>
                  </div>
                  <button
                    onClick={() => {
                      setEditingTestStaff(t);
                      setNewStaffId(t.assignedStaffId || null);
                    }}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                </div>
              </div>

              <div className="border-t border-white/5 mt-6 pt-4 space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Start: {formatISTDateTime(t.startTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    End: {formatISTDateTime(t.endTime)}
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
