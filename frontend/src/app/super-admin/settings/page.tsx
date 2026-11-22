'use client';

import React, { useEffect, useState } from 'react';
import { apiCall } from '@/utils/api';
import { toast } from '@/store/toastStore';
import { Settings, Building2, User, Activity, BarChart3 } from 'lucide-react';

export default function DepartmentSettings() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [depts, conf] = await Promise.all([
        apiCall('/api/super-admin/settings/departments'),
        apiCall('/api/super-admin/settings/academic-config'),
      ]);
      setDepartments(depts || []);
      setConfig(conf);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Department Settings</h1>
        <p className="text-sm text-gray-400">Manage departments, academic year, and platform configuration.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Total Departments', value: config?.totalDepartments ?? 0, icon: Building2, color: 'text-indigo-400' },
          { title: 'Total Subjects', value: config?.totalSubjects ?? 0, icon: Activity, color: 'text-emerald-400' },
          { title: 'System Version', value: config?.systemVersion ?? '1.0.0', icon: BarChart3, color: 'text-purple-400' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="glass-panel p-5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase">{card.title}</span>
                <div className={`p-2 rounded-lg ${card.color.replace('text-', 'bg-').replace('400', '/10')} ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="glass-panel p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-lg">Departments & Staff Distribution</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xs font-semibold text-gray-400 uppercase">
                <th className="pb-3">Department</th>
                <th className="pb-3 text-center">Staff Count</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-gray-400 text-sm">
                    No departments found.
                  </td>
                </tr>
              ) : (
                departments.map((d) => (
                  <tr key={d.department} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 text-sm font-medium text-white">{d.department}</td>
                    <td className="py-4 text-center text-sm text-gray-300 font-mono">{d.staffCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl">
        <div className="flex items-center gap-2 mb-6">
          <User className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-lg">Academic Configuration</h3>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Academic Year</p>
            <div className="flex items-center gap-3">
              <select className="bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500">
                <option>2024-2025</option>
                <option>2025-2026</option>
                <option>2026-2027</option>
              </select>
              <select className="bg-[#0b0c10] border border-white/10 py-2 px-3 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500">
                <option>Semester 1</option>
                <option>Semester 2</option>
              </select>
            </div>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Platform Settings</p>
            <p className="text-xs text-gray-400">Settings changes require Super Admin authorization.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
