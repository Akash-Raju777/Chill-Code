'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api';
import { BookOpen, Plus, Trash2, Tag, Loader2 } from 'lucide-react';

interface Subject {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: string;
}

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('BookOpen');
  const [error, setError] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjectStats, setSubjectStats] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const handleSelectSubject = async (sub: Subject) => {
    setSelectedSubject(sub);
    setStatsLoading(true);
    try {
      const data = await apiCall(`/api/admin/subjects/${sub.id}/stats`);
      setSubjectStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/admin/subjects');
      setSubjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify({ name, description, color, icon, status: 'ACTIVE' }),
      });
      setName('');
      setDescription('');
      setShowAddForm(false);
      fetchSubjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create subject');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this subject? All related questions will be permanently deleted.')) return;
    try {
      await apiCall(`/api/admin/subjects/${id}`, { method: 'DELETE' });
      fetchSubjects();
    } catch (err: any) {
      setError(err.message || 'Failed to delete subject');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subject Management</h1>
          <p className="text-sm text-gray-500">Add or edit educational programming subjects</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-btn text-sm"
        >
          <Plus className="w-4 h-4" />
          Create Subject
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Add Subject Modal overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">Create New Subject</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Java Programming"
                  className="w-full glass-input p-3 rounded-xl text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Description</label>
                <textarea
                  required
                  placeholder="Subject details..."
                  className="w-full glass-input p-3 rounded-xl text-sm h-24"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Color (Hex)</label>
                  <input
                    type="color"
                    className="w-full h-11 bg-transparent border-0 rounded-lg cursor-pointer"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Icon Identifier</label>
                  <select
                    className="w-full glass-input p-3 rounded-xl text-sm"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                  >
                    <option value="BookOpen">BookOpen</option>
                    <option value="Code2">Code2</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Cpu">Cpu</option>
                    <option value="Database">Database</option>
                  </select>
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
                  Save Subject
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((sub) => (
            <div 
              key={sub.id} 
              onClick={() => handleSelectSubject(sub)}
              className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative group overflow-hidden cursor-pointer hover:border-white/10 hover:shadow-lg transition-all"
            >
              {/* Color Stripe decoration */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: sub.color }} />
              <div>
                <div className="flex justify-between items-start mb-4 pl-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5" style={{ color: sub.color }}>
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-white text-lg">{sub.name}</h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(sub.id);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-400 pl-2 leading-relaxed mb-6">{sub.description}</p>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-4 pl-2 text-xs text-gray-500">
                <span className="flex items-center gap-1.5 capitalize font-medium">
                  <Tag className="w-3.5 h-3.5" style={{ color: sub.color }} />
                  {(sub.status || 'ACTIVE').toLowerCase()}
                </span>
                <span>Active Track</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subject Detailed Performance Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-4xl bg-[#11131c] border border-white/10 p-6 rounded-2xl shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5" style={{ color: selectedSubject.color }}>
                  Subject Tracker Overview
                </span>
                <h2 className="text-xl font-bold text-white mt-1.5">{selectedSubject.name}</h2>
                <p className="text-xs text-gray-500 mt-1">{selectedSubject.description}</p>
              </div>
              <button 
                onClick={() => { setSelectedSubject(null); setSubjectStats(null); }}
                className="px-4 py-2 border border-white/5 rounded-xl text-xs font-semibold hover:bg-white/5 text-gray-400 hover:text-white"
              >
                Close Report
              </button>
            </div>

            {statsLoading && (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            )}

            {!statsLoading && subjectStats && (
              <div className="space-y-6">
                {/* Metrics Cards row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-[#0b0c10] border border-white/5 p-4 rounded-xl">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Topics/Questions</div>
                    <div className="text-lg font-black text-white mt-1">{subjectStats.questionsCount}</div>
                  </div>
                  <div className="bg-[#0b0c10] border border-white/5 p-4 rounded-xl">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Average Score</div>
                    <div className="text-lg font-black text-white mt-1">{subjectStats.avgScore} pts</div>
                  </div>
                  <div className="bg-[#0b0c10] border border-white/5 p-4 rounded-xl">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Rank Holder</div>
                    <div className="text-lg font-black text-indigo-400 mt-1 truncate" title={subjectStats.rankHolder}>
                      {subjectStats.rankHolder}
                    </div>
                  </div>
                  <div className="bg-[#0b0c10] border border-white/5 p-4 rounded-xl">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Attended</div>
                    <div className="text-lg font-black text-emerald-400 mt-1">{subjectStats.attendedCount} students</div>
                  </div>
                  <div className="bg-[#0b0c10] border border-white/5 p-4 rounded-xl">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Not Attended</div>
                    <div className="text-lg font-black text-red-400 mt-1">{subjectStats.notAttendedCount} students</div>
                  </div>
                </div>

                {/* Pass/Fail bar layout */}
                <div className="bg-[#0b0c10] border border-white/5 p-5 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-emerald-400">Pass Rate: {subjectStats.passRate}%</span>
                    <span className="text-red-400">Fail Rate: {subjectStats.failRate}%</span>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: `${subjectStats.passRate}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${subjectStats.failRate}%` }} />
                  </div>
                </div>

                {/* Registry Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Student Performance Registry</h3>
                  <div className="bg-[#0b0c10] border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] text-gray-500 font-bold uppercase bg-white/5">
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Register Number</th>
                          <th className="p-3">Score Obtained</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-400">
                        {subjectStats.studentMarks.map((sm: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="p-3 font-semibold text-white">{sm.name}</td>
                            <td className="p-3 font-mono">{sm.registerNumber}</td>
                            <td className="p-3 font-bold text-white">{sm.score} / {sm.maxMarks}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                sm.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-400' :
                                sm.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                                'bg-gray-500/10 text-gray-400'
                              }`}>
                                {sm.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
