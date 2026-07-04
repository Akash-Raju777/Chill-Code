'use client';

import React, { useState, useRef, useEffect } from 'react';
import { apiCall } from '../../../utils/api';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  Loader2, 
  HelpCircle, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

interface Message {
  role: 'admin' | 'ash';
  content: string;
}

export default function AshChatRoom() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ash',
      content: "Hello! I am Ash, your AI control room assistant. Ask me anything about subjects, assessment questions, student enrollment, test scores, or code submission statistics."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    "Who failed in Java? Show name and roll no.",
    "Who scored the highest in the exam?",
    "Show a summary of all subjects and questions.",
    "Show student test attempt statistics."
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMessage: Message = { role: 'admin', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiCall('/api/admin/ash/chat', {
        method: 'POST',
        body: JSON.stringify({ message: messageText })
      });
      setMessages(prev => [...prev, { role: 'ash', content: data.response }]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'ash', content: `Error: ${err.message || 'Unable to connect to Ash. Please check if the server is online.'}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessageText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Markdown Table parsing
      if (line.trim().startsWith('|')) {
        const parts = line.split('|').map(p => p.trim()).filter((p, i) => i > 0 && i < line.split('|').length - 1);
        // Skip table separator line (contains ---)
        if (parts.some(p => p.includes('---'))) return null;
        return (
          <div key={idx} className="flex gap-4 border-b border-white/5 py-2 px-4 bg-white/5 first:bg-white/10 font-mono text-[11px] select-text">
            {parts.map((p, pIdx) => (
              <div key={pIdx} className="flex-1 truncate text-gray-200 font-medium">{p}</div>
            ))}
          </div>
        );
      }
      // Bullet list parsing
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} className="list-disc ml-5 my-1.5 text-gray-300 text-xs leading-relaxed select-text">
            {line.trim().substring(2)}
          </li>
        );
      }
      // Headings
      if (line.trim().startsWith('### ')) {
        return <h4 key={idx} className="text-xs font-bold text-indigo-400 mt-4 mb-2 uppercase tracking-wider">{line.trim().substring(4)}</h4>;
      }
      if (line.trim().startsWith('## ')) {
        return <h3 key={idx} className="text-sm font-bold text-white mt-5 mb-2.5 border-b border-white/5 pb-1">{line.trim().substring(3)}</h3>;
      }
      if (line.trim().startsWith('# ')) {
        return <h2 key={idx} className="text-base font-extrabold text-white mt-6 mb-3 border-b border-indigo-500/20 pb-1.5">{line.trim().substring(2)}</h2>;
      }
      // Bold text formatting highlights
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={idx} className="my-1.5 text-xs text-gray-300 leading-relaxed min-h-[1em] select-text">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-indigo-300 font-bold">{part}</strong> : part)}
          </p>
        );
      }
      // Regular line
      return <p key={idx} className="my-1.5 text-xs text-gray-300 leading-relaxed min-h-[1em] select-text">{line}</p>;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-5xl mx-auto bg-[#11131c]/50 rounded-2xl border border-white/5 overflow-hidden">
      {/* Bot Chat Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-[#11131c] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Ash Control Room AI</h2>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
              Grok Intelligence Module Connected
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
          Realtime Metrics Fed
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((msg, index) => {
          const isAsh = msg.role === 'ash';
          return (
            <div key={index} className={`flex gap-4 ${isAsh ? 'justify-start' : 'justify-end'}`}>
              {isAsh && (
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs font-sans shadow-sm ${
                isAsh 
                  ? 'bg-[#1a1c29] border border-white/5 text-gray-200' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium'
              }`}>
                {isAsh ? (
                  <div className="space-y-1">{formatMessageText(msg.content)}</div>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap select-text">{msg.content}</p>
                )}
              </div>
              {!isAsh && (
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#1a1c29] border border-white/5 px-4 py-3 rounded-2xl text-xs flex items-center gap-2 text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              Ash is scanning system context and generating response...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length === 1 && !loading && (
        <div className="px-6 py-3 bg-[#11131c]/20 border-t border-white/5">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            Quick Prompts Suggestions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestedPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="text-left px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-white hover:bg-white/10 hover:border-indigo-500/20 transition-all text-xs flex-1 flex items-center justify-between group"
              >
                <span>{p}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 transform group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Message Form */}
      <div className="p-4 border-t border-white/5 bg-[#11131c]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Ash about compilation metrics, failed students, test summaries..."
            className="flex-1 bg-[#0b0c10] border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all placeholder-gray-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 transition-all disabled:opacity-50 disabled:from-gray-800 disabled:to-gray-800"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
