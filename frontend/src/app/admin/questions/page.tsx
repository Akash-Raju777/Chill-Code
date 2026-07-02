'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { Plus, Trash2, Edit2, Code2, Loader2, ArrowLeft, Check, AlertCircle } from 'lucide-react';

interface Subject {
  id: number;
  name: string;
}

interface TestCase {
  id?: number;
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
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
  timeLimitMs: number;
  memoryLimitMb: number;
  marks: number;
  negativeMarks: number;
  allowedLanguages: string;
  tags?: string;
  testCases: TestCase[];
}

export default function QuestionManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('EASY');
  const [problemStatement, setProblemStatement] = useState('');
  const [constraints, setConstraints] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [marks, setMarks] = useState(10);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [allowedLangs, setAllowedLangs] = useState({
    java: true,
    python: true,
    cpp: false,
    c: false,
    javascript: false,
  });
  const [tags, setTags] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([
    { inputData: '', expectedOutput: '', isHidden: false },
  ]);

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

  const fetchQuestions = async (subjectId: number) => {
    setLoading(true);
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
      fetchQuestions(selectedSubjectId);
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
    setTimeLimitMs(2000);
    setMemoryLimitMb(256);
    setMarks(10);
    setNegativeMarks(0);
    setAllowedLangs({ java: true, python: true, cpp: false, c: false, javascript: false });
    setTags('');
    setTestCases([{ inputData: '', expectedOutput: '', isHidden: false }]);
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
    setTimeLimitMs(q.timeLimitMs);
    setMemoryLimitMb(q.memoryLimitMb);
    setMarks(q.marks);
    setNegativeMarks(q.negativeMarks || 0);
    setTags(q.tags || '');
    setTestCases(q.testCases || []);
    
    // Allowed languages parsing
    const langs = q.allowedLanguages.split(',');
    setAllowedLangs({
      java: langs.includes('java'),
      python: langs.includes('python'),
      cpp: langs.includes('cpp'),
      c: langs.includes('c'),
      javascript: langs.includes('javascript'),
    });
    
    setShowForm(true);
  };

  const handleAddTestCase = () => {
    setTestCases([...testCases, { inputData: '', expectedOutput: '', isHidden: true }]);
  };

  const handleRemoveTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) return;

    const langsStr = Object.keys(allowedLangs)
      .filter((k) => allowedLangs[k as keyof typeof allowedLangs])
      .join(',');

    const payload = {
      subjectId: selectedSubjectId,
      title,
      difficulty,
      problemStatement,
      constraints,
      inputFormat,
      outputFormat,
      timeLimitMs,
      memoryLimitMb,
      marks,
      negativeMarks,
      allowedLanguages: langsStr,
      tags,
      testCases,
    };

    try {
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
      setShowForm(false);
      fetchQuestions(selectedSubjectId);
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await apiCall(`/api/admin/questions/${id}`, { method: 'DELETE' });
      if (selectedSubjectId) fetchQuestions(selectedSubjectId);
    } catch (err: any) {
      setError('Failed to delete question');
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
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
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
                    <span>Marks: <strong className="text-white">{q.marks}</strong></span>
                    <span>Penalty: <strong className="text-white">{q.negativeMarks}</strong></span>
                    <span>Limit: <strong className="text-white">{q.timeLimitMs}ms</strong></span>
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
      ) : (
        /* Form view */
        <form onSubmit={handleSubmit} className="space-y-8 glass-panel p-6 md:p-8 rounded-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Problem Title</label>
              <input
                type="text"
                required
                className="w-full glass-input p-3 rounded-xl text-sm"
                placeholder="e.g. Find Missing Elements"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {/* Difficulty */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Difficulty level</label>
              <select
                className="w-full glass-input p-3 rounded-xl text-sm"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>

          {/* Statement details */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Problem Statement</label>
              <textarea
                required
                className="w-full glass-input p-3 rounded-xl text-sm h-36 font-sans leading-relaxed"
                placeholder="Write the comprehensive description..."
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
                  placeholder="Format details..."
                  value={inputFormat}
                  onChange={(e) => setInputFormat(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Output Format</label>
                <textarea
                  className="w-full glass-input p-3 rounded-xl text-sm h-24"
                  placeholder="Expected output details..."
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Configuration constraints */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-white/5 pt-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Time Limit (ms)</label>
              <input
                type="number"
                required
                className="w-full glass-input p-3 rounded-xl text-sm"
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Memory Limit (MB)</label>
              <input
                type="number"
                required
                className="w-full glass-input p-3 rounded-xl text-sm"
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Marks</label>
              <input
                type="number"
                required
                className="w-full glass-input p-3 rounded-xl text-sm"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Negative Marks</label>
              <input
                type="number"
                required
                className="w-full glass-input p-3 rounded-xl text-sm"
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(Number(e.target.value))}
              />
            </div>
            <div className="col-span-2 md:col-span-1">
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
              <label className="block text-xs font-semibold text-gray-400 uppercase">Verification Test Cases</label>
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
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase">Standard Input (stdin)</label>
                    <textarea
                      required
                      placeholder="Input data feed"
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

          {/* Submission options */}
          <div className="flex justify-end gap-3 border-t border-white/5 pt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/5 text-gray-300"
            >
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 rounded-xl gradient-btn text-sm">
              Save Problem
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
