'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  BookOpen, 
  Code2, 
  Timer, 
  Users, 
  Award, 
  TrendingUp, 
  Settings, 
  LogOut,
  Menu,
  X,
  User as UserIcon,
  Megaphone,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import BackendStatusBanner from '../../components/BackendStatusBanner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // If not authenticated or not ADMIN, redirect to home/login
    if (mounted && (!isAuthenticated || !user || user.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10]">
        <div className="text-gray-400">Loading Session...</div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Subject Management', path: '/admin/subjects', icon: BookOpen },
    { name: 'Question Management', path: '/admin/questions', icon: Code2 },
    { name: 'Badge Management', path: '/admin/badges', icon: Award },
    { name: 'Student Achievements', path: '/admin/achievements', icon: TrendingUp },
    { name: 'Send Instructions', path: '/admin/instructions', icon: Megaphone },
    { name: 'Students', path: '/admin/students', icon: Users },
    { name: 'Chat with Ash', path: '/admin/ash', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#c5c6c7] flex">
      {/* Sidebar */}
      <aside className={`glass-panel border-y-0 border-l-0 fixed md:static inset-y-0 left-0 z-30 w-64 transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        {/* Brand Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Chill Code Logo" className="w-7 h-7 object-contain filter invert brightness-150 drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
            <span className="text-xl font-bold tracking-tight text-white">
              Chill <span className="gradient-text">Code</span>
            </span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/10' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile & Logout */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold text-white truncate">{user.name}</h4>
              <p className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-400 hover:bg-red-500/5 hover:text-red-300 transition-all text-left"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <BackendStatusBanner />
        {/* Top Navbar */}
        <header className="glass-panel border-x-0 border-t-0 py-4 px-6 md:px-8 flex justify-between items-center">
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-white">Administrator Control Room</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-500">Current Local Session</div>
              <div className="text-sm font-medium text-indigo-400">Active Node</div>
            </div>
          </div>
        </header>

        {/* Dynamic page contents wrapper */}
        <main className="flex-grow p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
