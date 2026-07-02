'use client';

import React, { useState } from 'react';
import { apiCall } from '../../../utils/api';
import { Megaphone, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function SendInstructions() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      await apiCall('/api/student/notifications', {
        method: 'POST',
        body: JSON.stringify({ title, message }),
      });
      setSuccess('Instruction broadcasted successfully to all students!');
      setTitle('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to broadcast instruction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 min-h-screen bg-[#0b0c10] text-[#c5c6c7] p-2 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Send Instructions</h1>
        <p className="text-sm text-gray-500">Broadcast notices and security guidelines directly to student panels</p>
      </div>

      <div className="max-w-2xl bg-[#11131c] border border-white/5 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
          <Megaphone className="w-5 h-5 animate-bounce" />
          <div className="text-xs">
            Instructions sent here will appear immediately in the **Notifications** tab of all active student portals.
          </div>
        </div>

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Instruction Title</label>
            <input
              type="text"
              required
              placeholder="e.g., Exam Postponement or Urgent Security Notice"
              className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">Instruction Body Message</label>
            <textarea
              required
              rows={6}
              placeholder="Write detailed instructions, rules, guidelines, or notices here..."
              className="w-full bg-[#0b0c10] border border-white/5 py-2.5 px-4 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs tracking-wider rounded-xl transition-all shadow-md shadow-[#7c3aed]/10 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Broadcasting...
              </>
            ) : (
              'Broadcast Instruction'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
