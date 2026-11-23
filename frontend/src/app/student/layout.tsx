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
  Bell,
  Award,
  Trophy
} from 'lucide-react';
import Link from 'next/link';

import { useTestStore } from '../../store/testStore';
import { apiCall } from '../../utils/api';
import { useBackendStore } from '../../store/backendStore';
import BackendStatusBanner from '../../components/BackendStatusBanner';
import ToastContainer from '../../components/ToastContainer';
import { toast } from '../../store/toastStore';
import BrandedLoader from '../../components/BrandedLoader';

import { getAuthorizedDashboard } from '../../store/authStore';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSessionActive = useTestStore((s) => s.isSessionActive);
  const isViewMode = useTestStore((s) => s.isViewMode);
  const isSecurityActive = isSessionActive && !isViewMode && user?.status === 'ACTIVE';
  const setUser = useAuthStore((s) => s.setUser);

  // Authorize student role and verify session with backend
  useEffect(() => {
    setMounted(true);

    const verifyStudent = async () => {
      const state = useAuthStore.getState();
      if (!state.isAuthenticated || !state.token || !state.user) {
        router.replace('/login');
        return;
      }

      if (state.user.role !== 'STUDENT') {
        router.replace(getAuthorizedDashboard(state.user.role));
        return;
      }

      try {
        const verified = await apiCall('/api/auth/me');
        if (!verified || verified.role !== 'STUDENT') {
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

    verifyStudent();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;

    const seenIds = new Set<number>();

    const syncProfile = () => {
      if (useBackendStore.getState().isOffline) return;

      apiCall('/api/student/profile')
        .then((data) => {
          if (data) {
            setUser(data);
          }
        })
        .catch(() => {});
    };

    const syncNotifications = () => {
      if (useBackendStore.getState().isOffline) return;

      apiCall('/api/student/notifications')
        .then((data: any[]) => {
          if (!data || !Array.isArray(data)) return;
          
          const isFirstLoad = seenIds.size === 0;
          
          data.forEach((n) => {
            if (isFirstLoad) {
              seenIds.add(n.id);
            } else if (!n.isRead && !seenIds.has(n.id)) {
              seenIds.add(n.id);
              
              toast.info(`New Broadcast: ${n.title}\n\n${n.message}`);
            }
          });
        })
        .catch(() => {});
    };

    syncProfile();
    syncNotifications();

    const intervalProfile = setInterval(syncProfile, 5000);
    const intervalNotifications = setInterval(syncNotifications, 30000);

    return () => {
      clearInterval(intervalProfile);
      clearInterval(intervalNotifications);
    };
  }, [authorized, setUser]);

  useEffect(() => {
    if (mounted && (!isAuthenticated || !user)) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  if (!mounted || !authorized || !isAuthenticated || !user || user.role !== 'STUDENT') {
    return <BrandedLoader message="Verifying Student Authorization..." fullScreen />;
  }

  return (
    <div className={`min-h-screen bg-[#0b0c10] flex font-sans ${isSecurityActive ? 'select-none' : ''}`}>
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar navigation */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#11131c] border-r border-white/5 flex flex-col justify-between p-6 pb-8 transition-transform duration-300 md:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <Link 
              href="/student/dashboard" 
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 text-indigo-400 font-bold text-xl tracking-wider"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                <img src="/Logobg.png" alt="Chill Code Logo" className="w-full h-full object-cover scale-100 object-center" />
              </div>
              Chill Code
            </Link>
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1">
            <Link
              href="/student/dashboard"
              prefetch={true}
              onMouseEnter={() => router.prefetch('/student/dashboard')}
              onClick={(e) => {
                if (pathname === '/student/dashboard') {
                  e.preventDefault();
                  return;
                }
                setSidebarOpen(false);
              }}
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
              prefetch={true}
              onMouseEnter={() => router.prefetch('/student/tests')}
              onClick={(e) => {
                if (pathname.startsWith('/student/tests')) {
                  e.preventDefault();
                  return;
                }
                setSidebarOpen(false);
              }}
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
              prefetch={true}
              onMouseEnter={() => router.prefetch('/student/results')}
              onClick={(e) => {
                if (pathname === '/student/results') {
                  e.preventDefault();
                  return;
                }
                setSidebarOpen(false);
              }}
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
              href="/student/achievements"
              prefetch={true}
              onMouseEnter={() => router.prefetch('/student/achievements')}
              onClick={(e) => {
                if (pathname === '/student/achievements') {
                  e.preventDefault();
                  return;
                }
                setSidebarOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider transition-all ${
                pathname === '/student/achievements'
                  ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4 text-purple-400" />
              ACHIEVEMENTS
            </Link>
            <Link
              href="/student/leaderboard"
              prefetch={true}
              onMouseEnter={() => router.prefetch('/student/leaderboard')}
              onClick={(e) => {
                if (pathname === '/student/leaderboard') {
                  e.preventDefault();
                  return;
                }
                setSidebarOpen(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wider transition-all ${
                pathname === '/student/leaderboard'
                  ? 'bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              LEADERBOARD
            </Link>
            <Link
              href="/student/notifications"
              prefetch={true}
              onMouseEnter={() => router.prefetch('/student/notifications')}
              onClick={(e) => {
                if (pathname === '/student/notifications') {
                  e.preventDefault();
                  return;
                }
                setSidebarOpen(false);
              }}
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
        <div className="mt-auto border-t border-white/5 pt-4">
          <div className="flex items-center justify-between gap-2 p-2 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm uppercase flex-shrink-0 border border-indigo-500/20">
                {user.name ? user.name[0] : 'S'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{user.name}</div>
                <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0 cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-grow flex flex-col min-w-0 md:pl-64">
        <BackendStatusBanner />
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
                  <div className={`text-sm font-semibold transition-colors duration-200 ${user?.status === 'ACTIVE' ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`}>
                    {user?.status === 'ACTIVE' ? 'Active' : (user?.status === 'NO_SECURITY' ? 'Off' : 'Inactive')}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-gray-500">Security Status</div>
                  <div className={`text-sm font-semibold transition-colors duration-200 ${(user?.status === 'ACTIVE' || user?.status === 'NO_SECURITY') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {user?.status === 'NO_SECURITY' ? 'Off' : (user?.status === 'ACTIVE' ? 'Active' : 'Inactive')}
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
      <ToastContainer />
    </div>
  );
}

