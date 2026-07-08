'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Timer, 
  ClipboardCheck, 
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Code2,
  Settings,
  Bell
} from 'lucide-react';
import Link from 'next/link';

import { useTestStore } from '../../store/testStore';
import { apiCall } from '../../utils/api';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isSessionActive = useTestStore((s) => s.isSessionActive);
  const isViewMode = useTestStore((s) => s.isViewMode);
  const securityShieldEnabled = useTestStore((s) => s.securityShieldEnabled);

  const isSecurityActive = isSessionActive && !isViewMode && user?.status === 'ACTIVE' && securityShieldEnabled;
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    setMounted(true);

    const syncProfile = () => {
      apiCall('/api/student/profile')
        .then((data) => {
          if (data) {
            setUser(data);
          }
        })
        .catch((err) => {
          console.error('Failed to sync student status', err);
        });
    };

    syncProfile();

    // Poll status every 5 seconds
    const interval = setInterval(syncProfile, 5000);
    return () => clearInterval(interval);
  }, [setUser]);

  useEffect(() => {
    // If not authenticated or not STUDENT, redirect to home
    if (mounted && (!isAuthenticated || !user || user.role !== 'STUDENT')) {
      router.push('/');
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || !user || user.role !== 'STUDENT') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0c10]">
        <div className="text-gray-400">Loading Session...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#0b0c10] flex font-sans ${isSecurityActive ? 'select-none' : ''}`}>
      {/* Sidebar navigation */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#11131c] border-r border-white/5 flex flex-col justify-between p-6 transition-transform duration-300 md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <Link href="/student/dashboard" className="flex items-center gap-2 text-indigo-400 font-bold text-xl tracking-wider">
              <Code2 className="w-6 h-6" />
              Chill Code
            </Link>
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1">
            <Link
              href="/student/dashboard"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider transition-all ${
                pathname === '/student/dashboard'
                  ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              DASHBOARD
            </Link>
            <Link
              href="/student/tests"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider transition-all ${
                pathname.startsWith('/student/tests')
                  ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Code2 className="w-4 h-4" />
              PRACTICE
            </Link>
            <Link
              href="/student/results"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider transition-all ${
                pathname === '/student/results'
                  ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              RESULTS
            </Link>
            <Link
              href="/student/notifications"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider transition-all ${
                pathname === '/student/notifications'
                  ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Bell className="w-4 h-4" />
              NOTIFICATIONS
            </Link>
          </nav>
        </div>

        {/* Profile Card / Action info */}
        <div className="border-t border-white/5 pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm uppercase">
              {user.name ? user.name[0] : 'S'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{user.name}</div>
              <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-white/5 hover:border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all w-full"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-grow flex flex-col min-w-0 md:pl-64">
        <header className="glass-panel border-x-0 border-t-0 py-4 px-6 md:px-8 flex justify-between items-center">
          <button className="md:hidden text-gray-400 hover:text-white mr-4" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-white">Student Assessment Portal</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              {isSessionActive ? (
                <>
                  <div className="text-xs text-gray-500">Security Shield</div>
                  <div className={`text-sm font-semibold transition-colors duration-200 ${isSecurityActive ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`}>
                    {isSecurityActive ? 'Active' : 'Inactive'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-gray-500">Security Status</div>
                  <div className={`text-sm font-semibold transition-colors duration-200 ${user?.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {user?.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-grow p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
