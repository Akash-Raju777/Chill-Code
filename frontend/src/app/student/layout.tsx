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

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const navItems = [
    { name: 'DASHBOARD', path: '/student/dashboard', icon: LayoutDashboard },
    { name: 'PRACTICE', path: '/student/tests', icon: Code2 },
    { name: 'RESULTS', path: '/student/results', icon: ClipboardCheck },
    { name: 'NOTIFICATIONS', path: '/student/notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#c5c6c7] flex">
      {/* Sidebar */}
      <aside className={`bg-[#11131c] border-r border-white/5 fixed md:static inset-y-0 left-0 z-30 w-64 transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        {/* Brand Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#11131c]">
          <div className="flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#7c3aed]" />
            <span className="text-xl font-extrabold tracking-tight text-white font-sans">
              Chill <span className="text-[#7c3aed]">Code</span>
            </span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto bg-[#11131c]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || (item.path !== '/student/dashboard' && pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-xs tracking-wider transition-all ${
                  isActive 
                    ? 'bg-[#7c3aed]/15 text-[#8b5cf6]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#8b5cf6]' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Profile Card & Logout (Styled matching Alex Rivera profile block) */}
        <div className="p-4 border-t border-white/5 bg-[#11131c] space-y-3">
          <div className="bg-white/5 border border-white/5 p-3 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md border border-white/10">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-sm font-bold text-white truncate leading-tight">{user.name}</h4>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">STUDENT MEMBER</p>
            </div>
          </div>
          
          <div className="space-y-1 text-xs">
            <Link
              href="/student/settings"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Settings className="w-4 h-4 text-gray-400" />
              Settings
            </Link>
            <button
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-red-400 hover:bg-red-500/5 hover:text-red-300 transition-all text-left"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass-panel border-x-0 border-t-0 py-4 px-6 md:px-8 flex justify-between items-center">
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-white">Student Assessment Portal</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">Security Shield</div>
              <div className="text-sm font-semibold text-emerald-400">Enabled</div>
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
