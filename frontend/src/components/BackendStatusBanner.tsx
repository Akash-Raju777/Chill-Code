'use client';

import React, { useState } from 'react';
import { useBackendStore } from '../store/backendStore';
import { apiCall } from '../utils/api';
import { AlertTriangle, RefreshCw, Server, WifiOff } from 'lucide-react';

export default function BackendStatusBanner() {
  const { isOffline, offlineUrl, isConnecting, setConnecting } = useBackendStore();
  const [retryMessage, setRetryMessage] = useState('');

  if (!isOffline) return null;

  const isLocal = offlineUrl.includes('localhost') || offlineUrl.includes('127.0.0.1');

  const handleRetry = async () => {
    setConnecting(true);
    setRetryMessage('');
    try {
      // Test ping to backend
      await apiCall('/api/admin/subjects');
      setRetryMessage('Connected successfully!');
    } catch (err: any) {
      setRetryMessage(isLocal ? 'Backend server still offline on ' + offlineUrl : 'Cloud backend still warming up...');
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-amber-950/90 via-amber-900/90 to-amber-950/90 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-lg backdrop-blur-md z-[90] relative transition-all animate-fadeIn">
      <div className="flex items-center gap-2.5">
        <div className="p-1 rounded-md bg-amber-500/20 text-amber-400 shrink-0">
          {isLocal ? <WifiOff className="w-4 h-4" /> : <Server className="w-4 h-4 animate-pulse" />}
        </div>
        <div className="leading-tight">
          <span className="font-bold text-white">
            {isLocal ? 'Local Backend Offline' : 'Cloud Server Connection'}
          </span>
          <span className="text-amber-300/80 ml-1.5 font-sans">
            {isLocal
              ? `Backend service is not running on ${offlineUrl || 'http://localhost:8080'}. Please start Spring Boot backend.`
              : `Connecting to ${offlineUrl || 'Render Cloud Backend'}. Please wait a moment for the server to respond.`}
          </span>
          {retryMessage && (
            <span className="block text-[11px] font-semibold text-amber-400 mt-0.5">{retryMessage}</span>
          )}
        </div>
      </div>

      <button
        onClick={handleRetry}
        disabled={isConnecting}
        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
        {isConnecting ? 'Testing...' : 'Check Status'}
      </button>
    </div>
  );
}
