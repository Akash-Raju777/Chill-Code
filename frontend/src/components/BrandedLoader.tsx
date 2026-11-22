'use client';

import React from 'react';

interface BrandedLoaderProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function BrandedLoader({
  message = 'Loading...',
  submessage,
  fullScreen = false,
  size = 'md',
}: BrandedLoaderProps) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0c10] select-none'
    : 'flex-1 flex flex-col items-center justify-center min-h-[50vh] p-6 select-none';

  const ringSizes = {
    sm: { outer: 'w-10 h-10', inner: 'w-7 h-7', logo: 'w-5 h-5' },
    md: { outer: 'w-14 h-14', inner: 'w-10 h-10', logo: 'w-7 h-7' },
    lg: { outer: 'w-20 h-20', inner: 'w-14 h-14', logo: 'w-10 h-10' },
  }[size];

  return (
    <div className={containerClasses} role="status" aria-label={message}>
      {/* Background glow effect */}
      <div className="absolute w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Animated Spinner with Logo */}
      <div className="relative flex items-center justify-center mb-4">
        {/* Outer clockwise spinning ring */}
        <div
          className={`${ringSizes.outer} rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin`}
        />
        {/* Inner counter-clockwise spinning ring */}
        <div
          className={`absolute ${ringSizes.inner} rounded-full border-2 border-cyan-400/20 border-b-cyan-400 animate-spin [animation-direction:reverse] [animation-duration:1s]`}
        />
        {/* Center Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Logobg.png"
          alt="Chill Code"
          className={`${ringSizes.logo} object-contain absolute opacity-90 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]`}
        />
      </div>

      {/* Text Indicators */}
      <p className="text-xs font-semibold tracking-wider text-gray-300 uppercase animate-pulse">
        {message}
      </p>
      {submessage && (
        <p className="text-[11px] text-gray-500 mt-1 max-w-xs text-center">
          {submessage}
        </p>
      )}
    </div>
  );
}
