'use client';

import React, { useEffect, useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import { apiCall, fetchBadgeSets, createBadgeSet, updateBadgeSet } from '../../../utils/api';
import { Plus, Trash2, Edit2, Code2, Loader2, ArrowLeft, Check, AlertCircle, Award, Trophy, Layers } from 'lucide-react';

interface Subject {
  id: number;
  name: string;
}

interface TestCase {
  id?: number;
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
  marks: number;
}

interface Question {
  id: number;
  subjectId: number;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  problemStatement: string;
  constraints?: string;
  inputFormat?: string;
  outputFormat?: string;
  allowedLanguages: string;
  tags?: string;
  totalMarks?: number;
  passingMarks?: number;
  questionCode?: string;
  timer?: number;
  testCases: TestCase[];
}

export default function QuestionManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formSubjectId, setFormSubjectId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Form Fields
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('EASY');
  const [problemStatement, setProblemStatement] = useState('');
  const [constraints, setConstraints] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [passingMarks, setPassingMarks] = useState<number>(10);
  const [questionCode, setQuestionCode] = useState('');
  const [timer, setTimer] = useState<number | ''>('');

  // Enable Badge Management states
  const [enableBadgeManagement, setEnableBadgeManagement] = useState(false);
  const [badgeStepActive, setBadgeStepActive] = useState(false);
  const [targetTestId, setTargetTestId] = useState<number | null>(null);
  const [targetTestCode, setTargetTestCode] = useState<string>('');
  const [targetTestName, setTargetTestName] = useState<string>('');
  const [targetSubjectName, setTargetSubjectName] = useState<string>('');
  const [existingBadgeSetId, setExistingBadgeSetId] = useState<number | null>(null);
  const [badgeSetName, setBadgeSetName] = useState('');
  const [badgeWinnersCount, setBadgeWinnersCount] = useState(3);
  const [badgeDefs, setBadgeDefs] = useState([
    { rankPosition: 1, badgeName: '🥇 Gold Champion', badgeIcon: 'Award', badgeColor: '#f59e0b', badgeOrder: 1 },
    { rankPosition: 2, badgeName: '🥈 Silver Champion', badgeIcon: 'Award', badgeColor: '#94a3b8', badgeOrder: 2 },
    { rankPosition: 3, badgeName: '🥉 Bronze Champion', badgeIcon: 'Award', badgeColor: '#b45309', badgeOrder: 3 },
  ]);

  // Language Master Badge Form States
  const [enableLanguageBadge, setEnableLanguageBadge] = useState(false);
  const [languageName, setLanguageName] = useState('Java');
  const [languageBadgeName, setLanguageBadgeName] = useState('☕ Java Expert');
  const [languageBadgeIcon, setLanguageBadgeIcon] = useState('☕');
  const [languageAwardRank, setLanguageAwardRank] = useState(1);
  const [savingBadgeSet, setSavingBadgeSet] = useState(false);

  const [allowedLangs, setAllowedLangs] = useState({
    java: true,
    python: true,
    cpp: false,
    c: false,
    javascript: false,
  });
  const [tags, setTags] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([
    { inputData: '', expectedOutput: '', isHidden: false, marks: 5 },
  ]);

  // Compute Total Marks automatically by summing all test case marks
  const computedTotalMarks = testCases.reduce((sum, tc) => sum + (Number(tc.marks) || 0), 0);

  const loadInitialData = async () => {
    try {
      const subs = await apiCall('/api/admin/subjects');
      setSubjects(subs);
      if (subs.length > 0) {
        setSelectedSubjectId(subs[0].id);
      }
    } catch (err: any) {
      setError('Failed to load initial configurations');
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const fetchQuestions = async (subjectId: number, isInitial = false) => {
    if (isInitial || questions.length === 0) {
      setLoading(true);
    }
    try {
      const data = await apiCall(`/api/admin/subjects/${subjectId}/questions`);
      setQuestions(data);
    } catch (err: any) {
      setError('Failed to fetch questions list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSubjectId) {
      fetchQuestions(selectedSubjectId, true);
    }
  }, [selectedSubjectId]);

  const handleOpenCreate = () => {
    setEditingQuestion(null);
    setTitle('');
    setDifficulty('EASY');
    setProblemStatement('');
    setConstraints('');
    setInputFormat('');
    setOutputFormat('');
    setPassingMarks(10);
    setQuestionCode('');
    setTimer('');
    setEnableBadgeManagement(false);
    setBadgeStepActive(false);
    setExistingBadgeSetId(null);
    setTargetTestId(null);

    setAllowedLangs({ java: true, python: true, cpp: false, c: false, javascript: false });
    setTags('');
    setTestCases([{ inputData: '', expectedOutput: '', isHidden: false, marks: 5 }]);
    setFormSubjectId(selectedSubjectId);
    setShowForm(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingQuestion(q);
    setTitle(q.title);
    setDifficulty(q.difficulty);
    setProblemStatement(q.problemStatement);
    setConstraints(q.constraints || '');
    setInputFormat(q.inputFormat || '');
    setOutputFormat(q.outputFormat || '');
    setTags(q.tags || '');
    setQuestionCode(q.questionCode || '');
    setTimer(q.timer || '');
    setPassingMarks(q.passingMarks || 10);
    setTestCases(
      q.testCases?.map((tc) => ({
        ...tc,
        marks: tc.marks ?? 5,
      })) || [{ inputData: '', expectedOutput: '', isHidden: false, marks: 5 }]
    );
    
    // Allowed languages parsing
    const langs = q.allowedLanguages ? q.allowedLanguages.split(',').map(l => l.trim().toLowerCase()) : [];
    setAllowedLangs({
      java: langs.includes('java'),
      python: langs.includes('python'),
      cpp: langs.includes('cpp'),
      c: langs.includes('c'),
      javascript: langs.includes('javascript'),
    });
    
    setEnableBadgeManagement(false);
    setBadgeStepActive(false);
    setExistingBadgeSetId(null);
    setTargetTestId(null);
    setFormSubjectId(q.subjectId);

    // Check if badges were previously configured for this subject or question
    (async () => {
      try {
        const testsData = await apiCall('/api/admin/tests');
        const subjectTests = (testsData || []).filter((t: any) => (t.subject?.id || t.subjectId) === q.subjectId);
        const badgeSets = await fetchBadgeSets();
        const qCode = q.questionCode ? q.questionCode.trim().toUpperCase() : null;
        const existing = (badgeSets || []).find((bs: any) => 
          (subjectTests.length > 0 && bs.testId === subjectTests[0].id) ||
          (qCode && bs.testCode === qCode) ||
          (bs.subjectId === q.subjectId)
        );
        if (existing) {
          setEnableBadgeManagement(true);
          setExistingBadgeSetId(existing.id);
          if (existing.name) setBadgeSetName(existing.name);
          if (existing.numberOfWinners) setBadgeWinnersCount(existing.numberOfWinners);
          if (existing.enableLanguageBadge !== undefined) setEnableLanguageBadge(existing.enableLanguageBadge);
          if (existing.languageName) setLanguageName(existing.languageName);
          if (existing.languageBadgeName) setLanguageBadgeName(existing.languageBadgeName);
          if (existing.languageBadgeIcon) setLanguageBadgeIcon(existing.languageBadgeIcon);
          if (existing.languageAwardRank) setLanguageAwardRank(existing.languageAwardRank);
          if (existing.badges && existing.badges.length > 0) setBadgeDefs(existing.badges);
        }
      } catch (err) {
        // silent fallback
      }
    })();

    setShowForm(true);
  };

  const handleAddTestCase = () => {
    setTestCases([...testCases, { inputData: '', expectedOutput: '', isHidden: true, marks: 5 }]);
  };

  const handleRemoveTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const handleToggleEnableBadgeManagementInstantly = (checked: boolean) => {
    setEnableBadgeManagement(checked);
    if (!checked) {
      setBadgeStepActive(false);
      return;
    }

    // Show badge UI INSTANTLY with default values - no API calls needed
    const subId = formSubjectId || selectedSubjectId;
    const subName = subjects.find(s => s.id === subId)?.name || 'Subject';
    const actualTitle = title.trim() || `${subName} Practice Arena`;
    const actualCode = questionCode.trim() ? questionCode.trim().toUpperCase() : '';

    setTargetTestCode(actualCode);
    setTargetTestName(actualTitle);
    setTargetSubjectName(subName);

    // Set defaults immediately
    if (!badgeSetName) setBadgeSetName(`${actualTitle} Champions`);
    if (!badgeWinnersCount) setBadgeWinnersCount(3);
    setBadgeDefs([
      { rankPosition: 1, badgeName: `🥇 ${actualTitle} Gold Winner`, badgeIcon: 'Award', badgeColor: '#f59e0b', badgeOrder: 1 },
      { rankPosition: 2, badgeName: `🥈 ${actualTitle} Silver Winner`, badgeIcon: 'Award', badgeColor: '#94a3b8', badgeOrder: 2 },
      { rankPosition: 3, badgeName: `🥉 ${actualTitle} Bronze Winner`, badgeIcon: 'Award', badgeColor: '#b45309', badgeOrder: 3 },
    ]);

    const defaultLang = subName.includes('Python') ? 'Python' : subName.includes('C++') ? 'C++' : subName.includes('C') ? 'C' : subName.includes('JavaScript') ? 'JavaScript' : 'Java';
    if (!enableLanguageBadge) {
      setLanguageName(defaultLang);
      setLanguageBadgeName(defaultLang === 'Java' ? '☕ Java Expert' : defaultLang === 'Python' ? '🐍 Python Master' : '🎖️ Language Expert');
      setLanguageBadgeIcon(defaultLang === 'Java' ? '☕' : defaultLang === 'Python' ? '🐍' : '🎖️');
      setLanguageAwardRank(1);
    }

    // Show badge step UI instantly
    setBadgeStepActive(true);

    // Load existing badge data in background (non-blocking)
    (async () => {
      try {
        const testsData = await apiCall('/api/admin/tests');
        const subjectTests = (testsData || []).filter((t: any) => (t.subject?.id || t.subjectId) === subId);
        const testObj = subjectTests.length > 0 ? subjectTests[0] : null;
        if (testObj) {
          setTargetTestId(testObj.id);
          if (!actualCode) setTargetTestCode(testObj.testCode || '');

          const badgeSets = await fetchBadgeSets();
          const existingSet = (badgeSets || []).find((bs: any) =>
            bs.testId === testObj.id || (actualCode && bs.testCode === actualCode) || bs.subjectId === subId
          );
          if (existingSet) {
            setExistingBadgeSetId(existingSet.id);
            if (existingSet.name) setBadgeSetName(existingSet.name);
            if (existingSet.numberOfWinners) setBadgeWinnersCount(existingSet.numberOfWinners);
            if (existingSet.badges?.length > 0) setBadgeDefs(existingSet.badges);
            if (existingSet.enableLanguageBadge !== undefined) setEnableLanguageBadge(existingSet.enableLanguageBadge);
            if (existingSet.languageName) setLanguageName(existingSet.languageName);
            if (existingSet.languageBadgeName) setLanguageBadgeName(existingSet.languageBadgeName);
            if (existingSet.languageBadgeIcon) setLanguageBadgeIcon(existingSet.languageBadgeIcon);
            if (existingSet.languageAwardRank) setLanguageAwardRank(existingSet.languageAwardRank);
          }
        }
      } catch (_) {
        // Silently fail - defaults are already shown
      }
    })();
  };

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  const handleBadgeWinnersCountChange = (count: number) => {
    setBadgeWinnersCount(count);
    const newDefs: any[] = [];
    for (let i = 1; i <= count; i++) {
      const existing = badgeDefs.find((b) => b.rankPosition === i);
      if (existing) {
        newDefs.push(existing);
      } else {
        const icon = i === 1 ? '🥇' : i === 2 ? '🥈' : i === 3 ? '🥉' : '🎖️';
        newDefs.push({
          rankPosition: i,
          badgeName: `${icon} Rank ${i} Award`,
          badgeIcon: 'Award',
          badgeColor: i === 1 ? '#f59e0b' : i === 2 ? '#94a3b8' : i === 3 ? '#b45309' : '#6366f1',
          badgeOrder: i,
        });
      }
    }
    setBadgeDefs(newDefs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!formSubjectId) {
      setError('Please select a subject before saving a question.');
      return;
    }

    // MODULE 2 Validation Rules
    if (passingMarks < 0) {
      setError('Passing Marks cannot be negative.');
      return;
    }
    if (passingMarks > computedTotalMarks) {
      setError(`Passing Marks (${passingMarks}) cannot exceed Total Marks (${computedTotalMarks}).`);
      return;
    }

    setSaving(true);
    setError('');

    const langsStr = Object.keys(allowedLangs)
      .filter((k) => allowedLangs[k as keyof typeof allowedLangs])
      .join(',');

    const payload = {
      subjectId: formSubjectId,
      title,
      difficulty,
      problemStatement,
      constraints,
      inputFormat,
      outputFormat,

      totalMarks: computedTotalMarks,
      passingMarks: Number(passingMarks),
      questionCode: questionCode.trim() || undefined,
      timer: timer === '' ? undefined : Number(timer),
      allowedLanguages: langsStr,
      tags,
      testCases,
    };

    try {
      // Step 1: Save the question (backend auto-creates Test + BadgeSet)
      if (editingQuestion) {
        await apiCall(`/api/admin/questions/${editingQuestion.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiCall('/api/admin/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      // Step 2: Refresh question list
      const activeSubjectId = formSubjectId || selectedSubjectId;
      if (activeSubjectId) {
        setSelectedSubjectId(activeSubjectId);
        fetchQuestions(activeSubjectId); // non-blocking
      }

      showToast(editingQuestion ? 'Question updated successfully!' : 'Question uploaded successfully!');
      setShowForm(false);
      setBadgeStepActive(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
      showToast('Failed to save question', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBadgeSetAndFinish = async () => {
    setSavingBadgeSet(true);

    try {
      let resolvedTestId = targetTestId;
      let resolvedTestCode = targetTestCode;
      let resolvedTestName = targetTestName;

      const subId = formSubjectId || selectedSubjectId;
      const testsData = await apiCall('/api/admin/tests');
      const subjectTests = (testsData || []).filter((t: any) => (t.subject?.id || t.subjectId) === subId);
      let testObj = subjectTests.length > 0 ? subjectTests[0] : (testsData && testsData.length > 0 ? testsData[0] : null);

      if (testObj) {
        if (!resolvedTestId) resolvedTestId = testObj.id;
        const subName = subjects.find(s => s.id === subId)?.name || 'Subject';
        const prefix = subName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) || 'TEST';
        if (!resolvedTestCode) resolvedTestCode = questionCode.trim() ? questionCode.trim().toUpperCase() : (testObj.testCode || `${prefix}-${testObj.id}`);
        if (!resolvedTestName) resolvedTestName = title.trim() ? title.trim() : (testObj.name || `${subName} Practice Arena`);
      }

      if (!resolvedTestId) {
        showToast('No test found to associate badge set.', 'error');
        return;
      }

      const badgePayload = {
        name: badgeSetName || `${resolvedTestName} Badge Set`,
        testId: resolvedTestId,
        testCode: resolvedTestCode,
        testName: resolvedTestName,
        numberOfWinners: badgeWinnersCount,
        enableLanguageBadge,
        languageName,
        languageBadgeName,
        languageBadgeIcon,
        languageAwardRank: Number(languageAwardRank),
        status: 'ACTIVE',
        badges: badgeDefs,
      };

      if (existingBadgeSetId) {
        await updateBadgeSet(existingBadgeSetId, badgePayload);
      } else {
        await createBadgeSet(badgePayload);
      }

      showToast('Question and Badge Set allocated successfully!', 'success');
      setBadgeStepActive(false);
      setShowForm(false);
      if (subId) {
        setSelectedSubjectId(subId);
        await fetchQuestions(subId);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to assign badge set', 'error');
    } finally {
      setSavingBadgeSet(false);
    }
  };

  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });

  const handleDelete = async (id: number) => {
    setConfirmDeleteQuestion({ open: true, id });
  };

  const executeDeleteQuestion = async () => {
    if (!confirmDeleteQuestion.id) return;
    const id = confirmDeleteQuestion.id;
    const backup = [...questions];
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    showToast('Question deleted successfully!');
    try {
      await apiCall(`/api/admin/questions/${id}`, { method: 'DELETE' });
    } catch (err: any) {
      setQuestions(backup);
      setError('Failed to delete question');
      showToast('Failed to delete question', 'error');
    } finally {
      setConfirmDeleteQuestion({ open: false, id: null });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      {!showForm ? (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Question Bank</h1>
            <p className="text-sm text-gray-500">Design coding problems with verification test cases</p>
          </div>
          <div className="flex gap-3 items-center w-full sm:w-auto">
            {/* Subject Filter Dropdown */}
            <select
              className="glass-input p-2 rounded-xl text-sm w-full sm:w-48 bg-[#11131c] text-white border border-white/5"
              value={selectedSubjectId || ''}
              onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id} className="bg-[#11131c] text-white">
                  {sub.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-btn text-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              New Problem
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowForm(false)} 
            className="p-2 border border-white/5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {editingQuestion ? 'Edit Problem Configuration' : 'Create New Problem'}
            </h1>
            <p className="text-sm text-gray-500">Specify details, languages, and test validations</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Questions list display */}
      {!showForm ? (
        loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse border border-white/5">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-16 bg-white/10 rounded-full" />
                    <div className="h-6 w-1/3 bg-white/10 rounded-lg" />
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div className="h-4 w-20 bg-white/5 rounded" />
                    <div className="h-4 w-24 bg-white/5 rounded" />
                    <div className="h-4 w-32 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-white/5 rounded-xl" />
                  <div className="w-8 h-8 bg-white/5 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
            <Code2 className="w-12 h-12 text-gray-600 mx-auto" />
            <h3 className="font-bold text-white text-lg">No questions found</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">Create a coding problem to populate the assessment platform.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      q.difficulty === 'EASY' ? 'bg-emerald-500/10 text-emerald-400' :
                      q.difficulty === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {q.difficulty}
                    </span>
                    <h3 className="font-bold text-white text-lg">{q.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                    <span>Allowed: <strong className="text-white capitalize">{q.allowedLanguages.replaceAll(',', ', ')}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(q)}
                    className="p-2 border border-white/5 rounded-xl text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/5"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 border border-white/5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : badgeStepActive ? (
        <div className="space-y-6 glass-panel p-6 md:p-8 rounded-2xl border border-amber-500/20 bg-[#11131c]">
          {/* Header Progress Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  Step 2: Assign Winner Badges
                </h3>
                <p className="text-xs text-amber-300">
                  Target Test ID: <span className="font-mono font-bold text-white bg-amber-500/20 px-2 py-0.5 rounded">{targetTestCode}</span> ({targetTestName})
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 self-start md:self-auto flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Question Uploaded
            </span>
          </div>

          {/* Auto-Loaded Details */}
          <div className="p-4 bg-[#181a25] border border-white/10 rounded-xl space-y-2">
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Auto-Loaded Details</div>
            <div className="text-white font-extrabold text-base flex items-center justify-between gap-2">
              <span>{targetTestName}</span>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                Test ID: {targetTestCode}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              <span className="text-indigo-400 font-bold">Subject: {targetSubjectName}</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Programming Languages: {Object.keys(allowedLangs).filter(k => allowedLangs[k as keyof typeof allowedLangs]).map(l => l === 'cpp' ? 'C++' : l === 'javascript' ? 'JavaScript' : l.toUpperCase()).join(', ') || 'Java'}
              </span>
            </div>
          </div>

          {/* Badge Set Customizer */}
          <div className="space-y-5 text-xs">
            <div className="space-y-1.5">
              <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Badge Set Name</label>
              <input
                type="text"
                value={badgeSetName}
                onChange={(e) => setBadgeSetName(e.target.value)}
                placeholder="e.g. Java Mid-Term Champions"
                className="w-full bg-[#181a25] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-400 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Number of Winners</label>
              <div className="grid grid-cols-4 gap-3">
                {[1, 3, 5, 10].map((num) => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => handleBadgeWinnersCountChange(num)}
                    className={`py-2.5 rounded-xl font-bold border transition-all ${
                      badgeWinnersCount === num ? 'bg-amber-500/20 border-amber-400 text-amber-400 shadow-md shadow-amber-500/10' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    Top {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Customize Winner Badges</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {badgeDefs.map((def, idx) => (
                  <div key={def.rankPosition} className="p-4 bg-[#181a25] border border-white/10 rounded-xl space-y-2 text-center">
                    <div className="text-2xl mb-1">{def.badgeName.includes('🥇') ? '🥇' : def.badgeName.includes('🥈') ? '🥈' : def.badgeName.includes('🥉') ? '🥉' : '🎖️'}</div>
                    <div className="text-slate-300 font-bold text-xs">Rank {def.rankPosition} Winner</div>
                    <input
                      type="text"
                      value={def.badgeName}
                      onChange={(e) => {
                        const updated = [...badgeDefs];
                        updated[idx].badgeName = e.target.value;
                        setBadgeDefs(updated);
                      }}
                      placeholder="Badge Name"
                      className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold text-center focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Language Master Badge Configuration Section */}
            <div className="p-4 bg-[#181a25] border border-white/10 rounded-xl space-y-4 pt-4">
              <div className="text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/10 pb-2 flex items-center justify-between">
                <span>Language Master Badge</span>
                {enableLanguageBadge && (
                  <span className="text-emerald-400 font-mono font-bold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Enabled
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="text-white font-bold cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enableLanguageBadge}
                    onChange={(e) => setEnableLanguageBadge(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-[#11131c] text-amber-500 focus:ring-0"
                  />
                  Enable Language Master Badge
                </label>
              </div>

              {enableLanguageBadge && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-gray-400 font-bold text-[10px] uppercase">Language</label>
                    <select
                      value={languageName}
                      onChange={(e) => {
                        const lang = e.target.value;
                        setLanguageName(lang);
                        if (lang === 'Java') { setLanguageBadgeName('☕ Java Expert'); setLanguageBadgeIcon('☕'); }
                        else if (lang === 'Python') { setLanguageBadgeName('🐍 Python Master'); setLanguageBadgeIcon('🐍'); }
                        else if (lang === 'C') { setLanguageBadgeName('⚙️ C Programmer'); setLanguageBadgeIcon('⚙️'); }
                        else if (lang === 'C++') { setLanguageBadgeName('💻 C++ Expert'); setLanguageBadgeIcon('💻'); }
                        else if (lang === 'JavaScript') { setLanguageBadgeName('🌐 JavaScript Ninja'); setLanguageBadgeIcon('🌐'); }
                      }}
                      className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold mt-1"
                    >
                      <option value="Java">☕ Java</option>
                      <option value="Python">🐍 Python</option>
                      <option value="C">⚙️ C</option>
                      <option value="C++">💻 C++</option>
                      <option value="JavaScript">🌐 JavaScript</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 font-bold text-[10px] uppercase">Badge Title</label>
                      <input
                        type="text"
                        value={languageBadgeName}
                        onChange={(e) => setLanguageBadgeName(e.target.value)}
                        className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 font-bold text-[10px] uppercase">Badge Icon / Emoji</label>
                      <input
                        type="text"
                        value={languageBadgeIcon}
                        onChange={(e) => setLanguageBadgeIcon(e.target.value)}
                        className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-400 font-bold text-[10px] uppercase">Award Rank Cutoff</label>
                    <select
                      value={languageAwardRank}
                      onChange={(e) => setLanguageAwardRank(Number(e.target.value))}
                      className="w-full bg-[#11131c] border border-white/10 rounded-lg px-3 py-2 text-white font-bold mt-1"
                    >
                      <option value={1}>Rank 1 Only</option>
                      <option value={3}>Top 3</option>
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-white/5 pt-6">
            <button
              type="button"
              onClick={() => {
                setBadgeStepActive(false);
                setShowForm(false);
                showToast('Question uploaded cleanly without badge allocation.', 'success');
              }}
              className="px-5 py-2.5 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/5 text-gray-400"
            >
              Skip Badge Allocation
            </button>
            <button
              type="button"
              onClick={handleSaveBadgeSetAndFinish}
              disabled={savingBadgeSet}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {savingBadgeSet ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Assigning Badges...
                </>
              ) : (
                <>
                  <Award className="w-4 h-4" />
                  Assign Badges & Complete Upload
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Form view */
        <form onSubmit={handleSubmit} className="space-y-8 glass-panel p-6 md:p-8 rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Subject Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Subject / Topic</label>
              <select
                required
                className="w-full glass-input p-3 rounded-xl text-sm cursor-pointer"
                value={formSubjectId || ''}
                onChange={(e) => setFormSubjectId(Number(e.target.value))}
              >
                <option value="" disabled className="bg-[#11131c] text-gray-400">Select Subject</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id} className="bg-[#11131c] text-white font-sans">{sub.name}</option>
                ))}
              </select>
            </div>
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Problem Title</label>
              <input
                type="text"
                required
                className="w-full glass-input p-3 rounded-xl text-sm"
                placeholder="e.g. Find Maximum Subarray Sum"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {/* Difficulty */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Difficulty Level</label>
              <select
                className="w-full glass-input p-3 rounded-xl text-sm cursor-pointer"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
              >
                <option value="EASY" className="bg-[#11131c] text-white font-sans">Easy</option>
                <option value="MEDIUM" className="bg-[#11131c] text-white font-sans">Medium</option>
                <option value="HARD" className="bg-[#11131c] text-white font-sans">Hard</option>
              </select>
            </div>
          </div>

          {/* Statement details */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Problem Statement</label>
              <textarea
                required
                rows={4}
                className="w-full glass-input p-3 rounded-xl text-sm h-36 font-sans leading-relaxed"
                placeholder="Describe the coding challenge in detail..."
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Constraints</label>
                <textarea
                  className="w-full glass-input p-3 rounded-xl text-sm h-24"
                  placeholder="e.g. 1 <= N <= 10^5"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Input Format</label>
                <textarea
                  className="w-full glass-input p-3 rounded-xl text-sm h-24"
                  placeholder="e.g. First line contains N"
                  value={inputFormat}
                  onChange={(e) => setInputFormat(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Output Format</label>
                <textarea
                  className="w-full glass-input p-3 rounded-xl text-sm h-24"
                  placeholder="e.g. Print single integer"
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Configuration constraints */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/5 pt-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Question ID (Unique)</label>
              <input
                type="text"
                placeholder="e.g. JAVA-1"
                className="w-full glass-input p-3 rounded-xl text-sm font-mono tracking-wider uppercase"
                value={questionCode}
                onChange={(e) => setQuestionCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Timer (Min)</label>
              <input
                type="number"
                placeholder="Optional"
                className="w-full glass-input p-3 rounded-xl text-sm"
                value={timer}
                onChange={(e) => setTimer(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div className="col-span-2 md:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Tags</label>
              <input
                type="text"
                placeholder="Arrays,DP,Sorting"
                className="w-full glass-input p-3 rounded-xl text-sm"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          {/* Languages selection checkboxes */}
          <div className="border-t border-white/5 pt-6 space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase">Allowed Languages</label>
            <div className="flex flex-wrap gap-6">
              {Object.keys(allowedLangs).map((key) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm font-semibold capitalize text-white">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-indigo-500 rounded border-white/10"
                    checked={allowedLangs[key as keyof typeof allowedLangs]}
                    onChange={(e) => setAllowedLangs({
                      ...allowedLangs,
                      [key]: e.target.checked
                    })}
                  />
                  {key === 'cpp' ? 'C++' : key}
                </label>
              ))}
            </div>
          </div>

          {/* Testcases panel */}
          <div className="border-t border-white/5 pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase">Verification Test Cases & Marks Allocation</label>
                <p className="text-[11px] text-gray-500">Configure individual test cases with their designated marks.</p>
              </div>
              <button
                type="button"
                onClick={handleAddTestCase}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-indigo-400 font-semibold hover:bg-white/5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Test Case
              </button>
            </div>

            <div className="space-y-4">
              {testCases.map((tc, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-white/5 border border-white/5 relative items-end">
                  <div className="flex-1 space-y-1">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase">Test Case {index + 1} - Standard Input (stdin)</label>
                    <textarea
                      placeholder="Input data feed (leave blank if no input)"
                      className="w-full glass-input p-2 rounded-lg text-xs h-16 font-mono"
                      value={tc.inputData}
                      onChange={(e) => handleTestCaseChange(index, 'inputData', e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase">Expected Output (stdout)</label>
                    <textarea
                      required
                      placeholder="Expected output data"
                      className="w-full glass-input p-2 rounded-lg text-xs h-16 font-mono"
                      value={tc.expectedOutput}
                      onChange={(e) => handleTestCaseChange(index, 'expectedOutput', e.target.value)}
                    />
                  </div>
                  <div className="w-full md:w-28 space-y-1">
                    <label className="block text-[10px] font-semibold text-indigo-400 uppercase">Marks</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={tc.marks ?? 5}
                      onChange={(e) => handleTestCaseChange(index, 'marks', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full glass-input p-2 rounded-lg text-xs font-mono text-center font-bold text-indigo-300"
                    />
                  </div>
                  <div className="flex items-center gap-4 justify-between w-full md:w-auto md:h-16 pb-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-indigo-500 rounded"
                        checked={tc.isHidden}
                        onChange={(e) => handleTestCaseChange(index, 'isHidden', e.target.checked)}
                      />
                      Hidden
                    </label>
                    {testCases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTestCase(index)}
                        className="p-2 border border-white/5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Module 1 & 2: Marks Summary & Passing Marks Configuration */}
          <div className="border-t border-white/5 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.02] p-5 rounded-2xl border">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-300 uppercase">Total Marks</label>
                <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Auto-Calculated
                </span>
              </div>
              <input
                type="number"
                disabled
                readOnly
                value={computedTotalMarks}
                className="w-full glass-input p-3 rounded-xl text-sm font-bold text-white bg-white/5 border border-white/10 cursor-not-allowed font-mono opacity-80"
              />
              <p className="text-[11px] text-gray-500 mt-1">Automatically computed by summing all test case marks.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Passing Marks</label>
              <input
                type="number"
                min="0"
                max={computedTotalMarks}
                required
                value={passingMarks}
                onChange={(e) => setPassingMarks(parseInt(e.target.value) || 0)}
                className={`w-full glass-input p-3 rounded-xl text-sm font-bold font-mono ${
                  passingMarks > computedTotalMarks || passingMarks < 0 
                    ? 'border-red-500 text-red-400 bg-red-500/10' 
                    : 'text-emerald-400'
                }`}
              />
              {passingMarks > computedTotalMarks && (
                <p className="text-[11px] text-red-400 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Passing Marks cannot exceed Total Marks ({computedTotalMarks}).
                </p>
              )}
              {passingMarks < 0 && (
                <p className="text-[11px] text-red-400 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Passing Marks cannot be negative.
                </p>
              )}
              {passingMarks >= 0 && passingMarks <= computedTotalMarks && (
                <p className="text-[11px] text-gray-500 mt-1">Student must score at least this mark to PASS.</p>
              )}
            </div>
          </div>

          {/* Enable Badge Management Toggle */}
          <div className="border-t border-white/5 pt-6">
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Enable Badge Management</h4>
                  <p className="text-[11px] text-gray-400">
                    If enabled, saving will pause completion until winner badges (Gold, Silver, Bronze) are assigned for this subject's test.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableBadgeManagement}
                  onChange={(e) => handleToggleEnableBadgeManagementInstantly(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* Submission options */}
          <div className="flex justify-end gap-3 border-t border-white/5 pt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/5 text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2.5 rounded-xl gradient-btn text-sm flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Problem'
              )}
            </button>
          </div>
        </form>
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 bg-[#11131c] border border-white/5 shadow-2xl rounded-2xl animate-bounce">
          <div className={`p-1 rounded-lg ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            <Check className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-white">{toast.message}</span>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDeleteQuestion.open}
        title="Delete Question"
        message="Are you sure you want to delete this question? All associated test cases and submissions will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={executeDeleteQuestion}
        onCancel={() => setConfirmDeleteQuestion({ open: false, id: null })}
      />
    </div>
  );
}
