'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiCall } from '../utils/api';
import { useRouter } from 'next/navigation';
import { BookOpen, User as UserIcon, Lock, Code2, Mail, Phone } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuthStore();
  
  const [role, setRole] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [username, setUsername] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isRegister) {
        // Register flow
        const registerPayload = {
          name,
          email,
          phone,
          password,
          role,
          registerNumber: role === 'STUDENT' ? registerNumber : undefined,
          username: role === 'ADMIN' ? username : undefined,
        };
        await apiCall('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(registerPayload),
        });
        setSuccess('Registration successful! Please log in.');
        setIsRegister(false);
        setIdentifier(role === 'STUDENT' ? registerNumber : username);
        setPassword('');
      } else {
        // Login flow
        const loginResponse = await apiCall('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, password }),
        });
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
    <main className="min-h-screen flex items-center justify-center bg-[#0b0c10] p-4 relative overflow-hidden">
      {/* Background glowing decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-950/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-950/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-lg glass-panel glow-card p-8 rounded-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-xl mb-3 text-indigo-400">
            <Code2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Chill-<span className="gradient-text">Code</span>
          </h1>
          <p className="text-gray-400">AI Coding Assessment Platform</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex border-b border-white/5 mb-6">
          <button
            type="button"
            className={`flex-1 py-3 text-center font-medium transition-all ${
              role === 'STUDENT'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => {
              setRole('STUDENT');
              setError('');
            }}
          >
            Student Panel
          </button>
          <button
            type="button"
            className={`flex-1 py-3 text-center font-medium transition-all ${
              role === 'ADMIN'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => {
              setRole('ADMIN');
              setError('');
            }}
          >
            Admin Panel
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter name"
                    className="w-full glass-input py-3 pl-10 pr-4 rounded-xl text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@college.edu"
                    className="w-full glass-input py-3 pl-10 pr-4 rounded-xl text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    placeholder="Phone number (optional)"
                    className="w-full glass-input py-3 pl-10 pr-4 rounded-xl text-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Identifier Field (Logins or Registration Keys) */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              {role === 'STUDENT' ? 'Register Number' : 'Username'}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                required
                placeholder={role === 'STUDENT' ? 'Enter register number' : 'Enter username'}
                className="w-full glass-input py-3 pl-10 pr-4 rounded-xl text-sm"
                value={isRegister ? (role === 'STUDENT' ? registerNumber : username) : identifier}
                onChange={(e) => {
                  if (isRegister) {
                    if (role === 'STUDENT') setRegisterNumber(e.target.value);
                    else setUsername(e.target.value);
                  } else {
                    setIdentifier(e.target.value);
                  }
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
              <input
                type="password"
                required
                placeholder="Enter password"
                className="w-full glass-input py-3 pl-10 pr-4 rounded-xl text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gradient-btn transition duration-200 mt-2 font-medium"
          >
            {loading ? 'Processing...' : isRegister ? 'Register Account' : 'Access Account'}
          </button>
        </form>

        {!isRegister && (
          <div className="space-y-3 mt-6 pt-6 border-t border-white/5">
            <div className="text-center text-xs font-semibold uppercase text-gray-500 tracking-wider">Demo Quick Access</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDemoLogin('STUDENT')}
                className="py-2.5 rounded-xl border border-white/5 hover:border-indigo-500/20 text-xs font-bold bg-[#11131c]/60 text-indigo-300 hover:text-white transition-all shadow-sm"
              >
                Login as Demo Student
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('ADMIN')}
                className="py-2.5 rounded-xl border border-white/5 hover:border-indigo-500/20 text-xs font-bold bg-[#11131c]/60 text-indigo-300 hover:text-white transition-all shadow-sm"
              >
                Login as Demo Admin
              </button>
            </div>
          </div>
        )}

        <div className="text-center mt-6 text-sm text-gray-500">
          {isRegister ? (
            <p>
              Already registered?{' '}
              <button
                type="button"
                className="text-indigo-400 font-semibold hover:underline"
                onClick={() => setIsRegister(false)}
              >
                Log In
              </button>
            </p>
          ) : (
            <p>
              New account needed?{' '}
              <button
                type="button"
                className="text-indigo-400 font-semibold hover:underline"
                onClick={() => setIsRegister(true)}
              >
                Register
              </button>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
