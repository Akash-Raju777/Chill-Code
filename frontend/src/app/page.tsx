'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiCall } from '../utils/api';
import { useRouter } from 'next/navigation';
import { User as UserIcon, Lock, Mail, Phone, Eye, EyeOff, ArrowRight, Shield, Terminal, Sparkles } from 'lucide-react';
import BackendStatusBanner from '../components/BackendStatusBanner';
import ToastContainer from '../components/ToastContainer';

/* ───────────────────────── 3D Starfield Canvas ───────────────────────── */
function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const stars: { x: number; y: number; z: number; px: number; py: number }[] = [];
    const NUM = 800;
    const SPEED = 0.35;

    const resize = () => {
      const p = canvas.parentElement;
      if (p) { canvas.width = p.clientWidth; canvas.height = p.clientHeight; }
    };
    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < NUM; i++) {
      stars.push({
        x: (Math.random() - 0.5) * canvas.width * 2,
        y: (Math.random() - 0.5) * canvas.height * 2,
        z: Math.random() * 1000,
        px: 0, py: 0
      });
    }

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = 'rgba(6, 11, 25, 0.25)';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2, cy = h / 2;
      for (const s of stars) {
        s.z -= SPEED;
        if (s.z <= 0) {
          s.x = (Math.random() - 0.5) * w * 2;
          s.y = (Math.random() - 0.5) * h * 2;
          s.z = 1000;
          s.px = 0; s.py = 0;
        }
        const sx = cx + (s.x / s.z) * 600;
        const sy = cy + (s.y / s.z) * 600;
        if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

        const r = (1 - s.z / 1000) * 1.8;
        const a = 1 - s.z / 1000;

        // draw trail
        if (s.px && s.py) {
          ctx.beginPath();
          ctx.moveTo(s.px, s.py);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = `rgba(100, 200, 255, ${a * 0.3})`;
          ctx.lineWidth = r * 0.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 230, 255, ${a})`;
        ctx.fill();

        s.px = sx; s.py = sy;
      }
      animId = requestAnimationFrame(draw);
    };

    // initial fill
    ctx.fillStyle = '#060b19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();

    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

/* ───────────────────────── Floating Code Chips ───────────────────────── */
function FloatingChip({ children, className = '', delay = '0s' }: { children: React.ReactNode; className?: string; delay?: string }) {
  return (
    <div
      className={`login-floating-chip ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────── Main Login Page ───────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuthStore();

  const [role, setRole] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [username, setUsername] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleRoleChange = (newRole: 'STUDENT' | 'ADMIN') => {
    setRole(newRole);
    setError('');
    setSuccess('');
    setIdentifier('');
    setPassword('');
    setName('');
    setEmail('');
    setPhone('');
    setRegisterNumber('');
    setUsername('');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('identifier');
      window.sessionStorage.clear();
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData(e.currentTarget);
      const activeRole = role;

      const formName = (formData.get('name') as string) || '';
      const formEmail = (formData.get('email') as string) || '';
      const formPhone = (formData.get('phone') as string) || '';

      const formIdentifier = (formData.get(activeRole === 'STUDENT' ? 'student_register_number' : 'admin_username') as string) || '';
      const formPassword = (formData.get(activeRole === 'STUDENT' ? 'student_password' : 'admin_password') as string) || '';

      if (isRegister) {
        // Register flow
        const registerPayload = {
          name: formName,
          email: formEmail,
          phone: formPhone,
          password: formPassword,
          role: activeRole,
          registerNumber: activeRole === 'STUDENT' ? formIdentifier : undefined,
          username: activeRole === 'ADMIN' ? formIdentifier : undefined,
        };
        await apiCall('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(registerPayload),
        });
        setSuccess('Registration successful! Please log in.');
        setIsRegister(false);
        setIdentifier(formIdentifier);
        setPassword('');
      } else {
        // Login flow
        if (!formIdentifier || !formPassword) {
          setError('Please enter both your identifier and password.');
          setLoading(false);
          return;
        }

        const loginResponse = await apiCall('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier: formIdentifier, password: formPassword }),
        });
        if (loginResponse.role !== activeRole) {
          setError(`Invalid credentials for ${activeRole.toLowerCase()} portal.`);
          setLoading(false);
          return;
        }
        login(loginResponse, loginResponse.token);
        if (loginResponse.role === 'ADMIN') {
          router.push('/admin/dashboard');
        } else {
          router.push('/student/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoRole: 'STUDENT' | 'ADMIN') => {
    setLoading(true);
    setError('');
    try {
      const demoId = demoRole === 'ADMIN' ? 'admin_demo' : 'student_demo';
      const loginResponse = await apiCall('/api/auth/login', {
        body: JSON.stringify({ identifier: demoId, password: 'password' }),
        method: 'POST',
      });
      login(loginResponse, loginResponse.token);
      if (loginResponse.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-split-root">
      <div className="w-full fixed top-0 left-0 right-0 z-50">
        <BackendStatusBanner />
      </div>

      {/* ═══════════════ LEFT PANEL — Branding ═══════════════ */}
      <section className="login-left-panel">
        <Starfield />

        {/* Gradient overlays */}
        <div className="absolute inset-0 z-[1]" style={{
          background: 'radial-gradient(ellipse at 30% 50%, rgba(0,229,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(124,58,237,0.1) 0%, transparent 50%)'
        }} />

        <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-12">
          {/* Top — floating chip */}
          <div className="flex justify-center">
            <FloatingChip delay="0s">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-xs">exam_2026 started</span>
            </FloatingChip>
          </div>

          {/* Center — branding */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Logobg.png" alt="Chill Code Logo" className="w-12 h-12 object-contain drop-shadow-lg" />
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">ChillCode</h2>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400">Student Test Portal</p>
              </div>
            </div>

            <h1 className="login-hero-title mt-6">
              Exams, without<br />the exam{' '}
              <span className="login-hero-stress">stress.</span>
            </h1>

            <p className="text-gray-400 text-sm leading-relaxed mt-5 max-w-md">
              ChillCode powers secure online tests for your college — live proctoring, instant results and a calm, distraction-free experience. Sign in with your roll number to dive into your next assessment.
            </p>

            {/* Floating code chips */}
            <div className="relative mt-8 flex flex-wrap gap-3">
              <FloatingChip className="login-chip-code" delay="0.5s">
                <span className="text-purple-300 font-mono text-xs">const</span>
                <span className="text-cyan-300 font-mono text-xs ml-1">focus</span>
                <span className="text-gray-400 font-mono text-xs ml-1">=</span>
                <span className="text-emerald-400 font-mono text-xs ml-1">true</span>
              </FloatingChip>
            </div>

            {/* Stats row */}
            <div className="flex gap-8 mt-10">
              <div>
                <p className="text-2xl font-bold text-white">120<span className="text-cyan-400 text-lg">+</span></p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">Live test papers</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">12<span className="text-cyan-400 text-lg">K+</span></p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">Students enrolled</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">99<span className="text-cyan-400 text-lg">.9%</span></p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">Uptime last term</p>
              </div>
            </div>

            {/* Rank badge */}
            <div className="mt-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Sparkles className="w-3 h-3" />
                rank #42 • 98.4%
              </span>
            </div>
          </div>

          {/* Bottom — footer */}
          <div className="flex items-center justify-between text-[11px] text-gray-600">
            <span>© 2026 ChillCode · Department of Examinations</span>
            <div className="flex gap-4">
              <span className="hover:text-gray-400 cursor-pointer transition-colors">Support</span>
              <span className="hover:text-gray-400 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-gray-400 cursor-pointer transition-colors">Terms</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ RIGHT PANEL — Form ═══════════════ */}
      <section className="login-right-panel">
        <div className="w-full max-w-md mx-auto px-6 sm:px-8">

          {/* Portal badge */}
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              {role === 'STUDENT' ? 'Student Portal' : 'Admin Portal'}
            </span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-1.5">
            {isRegister ? 'Create Account' : 'Welcome back!'}
          </h2>
          <p className="text-gray-400 text-sm mb-7">
            {isRegister
              ? 'Register to get started with your assessments.'
              : "It's nice to see you again. Ready to code? Log in with your college credentials to continue."}
          </p>

          {/* Role Selector Tabs */}
          <div className="flex mb-6 bg-white/[0.03] rounded-xl p-1 border border-white/5">
            <button
              type="button"
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-300 ${
                role === 'STUDENT'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10 border border-cyan-500/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => handleRoleChange('STUDENT')}
            >
              Student Panel
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-300 ${
                role === 'ADMIN'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10 border border-cyan-500/20'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => handleRoleChange('ADMIN')}
            >
              Admin Panel
            </button>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4 flex items-center gap-2">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-sm mb-4 flex items-center gap-2">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">

            {isRegister && (
              <>
                {/* Full Name */}
                <div>
                  <label className="login-label">Full Name</label>
                  <div className="relative">
                    <UserIcon className="login-input-icon" />
                    <input
                      type="text" required name="name" id="name"
                      placeholder="Enter name"
                      className="login-input"
                      value={name} onChange={(e) => setName(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>
                {/* Email */}
                <div>
                  <label className="login-label">Email Address</label>
                  <div className="relative">
                    <Mail className="login-input-icon" />
                    <input
                      type="email" required name="email" id="email"
                      placeholder="name@college.edu"
                      className="login-input"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>
                {/* Phone */}
                <div>
                  <label className="login-label">Phone Number</label>
                  <div className="relative">
                    <Phone className="login-input-icon" />
                    <input
                      type="tel" name="phone" id="phone"
                      placeholder="Phone number (optional)"
                      className="login-input"
                      value={phone} onChange={(e) => setPhone(e.target.value)}
                      suppressHydrationWarning
                    />
                  </div>
                </div>
              </>
            )}

            {/* Identifier — Roll Number / Username */}
            <div>
              <label className="login-label">
                {role === 'STUDENT' ? 'Roll Number' : 'Username'}
              </label>
              <div className="relative">
                <UserIcon className="login-input-icon" />
                <input
                  type="text" required
                  name={role === 'STUDENT' ? 'student_register_number' : 'admin_username'}
                  id={role === 'STUDENT' ? 'student_register_number' : 'admin_username'}
                  autoComplete="off"
                  placeholder={role === 'STUDENT' ? 'e.g. 21CS1012' : 'Enter username'}
                  className="login-input"
                  value={isRegister ? (role === 'STUDENT' ? registerNumber : username) : identifier}
                  onChange={(e) => {
                    if (isRegister) {
                      if (role === 'STUDENT') setRegisterNumber(e.target.value);
                      else setUsername(e.target.value);
                    } else {
                      setIdentifier(e.target.value);
                    }
                  }}
                  suppressHydrationWarning
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="login-label">Password</label>
              <div className="relative">
                <Lock className="login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  name={role === 'STUDENT' ? 'student_password' : 'admin_password'}
                  id={role === 'STUDENT' ? 'student_password' : 'admin_password'}
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  className="login-input pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            {!isRegister && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-gray-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                    className="login-checkbox"
                  />
                  Remember me
                </label>
                <button type="button" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors text-sm">
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="login-submit-btn group"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  {isRegister ? 'Register Account' : 'Log In'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </button>
          </form>

          {/* Demo Quick Access */}
          {!isRegister && (
            <div className="space-y-3 mt-6 pt-5 border-t border-white/5">
              <div className="text-center text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Demo Quick Access</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleDemoLogin('STUDENT')}
                  className="login-demo-btn"
                >
                  Demo Student
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('ADMIN')}
                  className="login-demo-btn"
                >
                  Demo Admin
                </button>
              </div>
            </div>
          )}

          {/* Toggle Login / Register */}
          <div className="text-center mt-5 text-sm text-gray-500">
            {isRegister ? (
              <p>
                Already registered?{' '}
                <button type="button" className="text-cyan-400 font-semibold hover:underline" onClick={() => setIsRegister(false)}>
                  Log In
                </button>
              </p>
            ) : (
              <p>
                Don&apos;t have an account?{' '}
                <button type="button" className="text-cyan-400 font-semibold hover:underline" onClick={() => setIsRegister(true)}>
                  Contact your examination cell
                </button>
              </p>
            )}
          </div>

          {/* Security footer */}
          <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-gray-600">
            <Shield className="w-3 h-3" />
            <span>Secure 256-bit encrypted session · For authorized students only</span>
          </div>
        </div>
      </section>

      <ToastContainer />
    </main>
  );
}
