'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Award,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ClipboardList,
  BarChart3,
  Activity,
  Shield,
  FileText,
  GraduationCap,
  Bell,
  Megaphone,
} from 'lucide-react';
import Link from 'next/link';
import BackendStatusBanner from '@/components/BackendStatusBanner';
import ToastContainer from '@/components/ToastContainer';
import BrandedLoader from '@/components/BrandedLoader';

import { apiCall } from '@/utils/api';
import { getAuthorizedDashboard } from '@/store/authStore';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    const verifySuperAdmin = async () => {
      const state = useAuthStore.getState();
      if (!state.isAuthenticated || !state.token || !state.user) {
        router.replace('/login');
        return;
      }

      if (state.user.role !== 'SUPER_ADMIN') {
        router.replace(getAuthorizedDashboard(state.user.role));
        return;
      }

      try {
        const verified = await apiCall('/api/auth/me');
        if (!verified || verified.role !== 'SUPER_ADMIN') {
          router.replace(getAuthorizedDashboard(verified?.role));
          return;
        }
        useAuthStore.getState().setUser(verified);
        setAuthorized(true);
      } catch (err: any) {
        // ONLY log out if backend explicitly returns 401 Unauthorized or 403 Forbidden
        if (err?.isAuthError || err?.status === 401 || err?.status === 403) {
          useAuthStore.getState().logout();
          router.replace('/login');
        } else {
          // Backend may be sleeping or cold start: DO NOT destroy valid session!
          setAuthorized(true);
        }
      }
    };

    verifySuperAdmin();
  }, [router]);

  useEffect(() => {
    if (mounted && (!isAuthenticated || !user)) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  if (!mounted || !authorized || !isAuthenticated || !user || user.role !== 'SUPER_ADMIN') {
    return <BrandedLoader message="Verifying Super Admin Authorization..." fullScreen />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard },
    { name: 'Student Management', path: '/super-admin/students', icon: GraduationCap },
    { name: 'Staff Management', path: '/super-admin/staff', icon: Users },
    { name: 'Staff Performance', path: '/super-admin/staff-performance', icon: TrendingUp },
    { name: 'Instructions', path: '/super-admin/instructions', icon: Megaphone },
    { name: 'Assessment Overview', path: '/super-admin/assessments', icon: BarChart3 },
    { name: 'Department Leaderboard', path: '/super-admin/results', icon: Award },
    { name: 'Department Settings', path: '/super-admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#c5c6c7] flex">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col`}>
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-bold tracking-tight text-white">
              Chill <span className="text-[#8b5cf6]">Code</span>
            </span>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                prefetch={true}
                onMouseEnter={() => router.prefetch(item.path)}
                onClick={(e) => {
                  if (isActive) {
                    e.preventDefault();
                    return;
                  }
                  setSidebarOpen(false);
                }}
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
        <div className="mt-auto p-4 pb-8 border-t border-white/5">
          <div className="flex items-center justify-between gap-2 p-2 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-[#8b5cf6]/20 rounded-lg text-[#8b5cf6] border border-[#8b5cf6]/20 flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-white truncate">{user.name}</h4>
                <p className="text-[10px] text-[#8b5cf6] capitalize truncate">Super Administrator</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <BackendStatusBanner />
        <header className="border-x-0 border-t-0 py-4 px-6 md:px-8 flex justify-between items-center bg-[#0b0c10]/50 backdrop-blur">
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-white">Super Admin Control Room</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-500">Current Session</div>
              <div className="text-sm font-medium text-[#8b5cf6]">Super Admin Node</div>
            </div>
          </div>
        </header>
        <main className="flex-grow p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
        <ToastContainer />
      </div>
    </div>
  );
}
