'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Sparkles as SparklesIcon, CheckCircle2, Award, Star } from 'lucide-react';

interface GloryCelebrationModalProps {
  score: number;
  totalMarks: number;
  passingMarks: number;
  percentage: number;
  questionName?: string;
  onComplete: () => void;
}

export default function GloryCelebrationModal({
  score,
  totalMarks,
  passingMarks,
  percentage,
  questionName = 'Coding Challenge',
  onComplete,
}: GloryCelebrationModalProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [displayPct, setDisplayPct] = useState(0);
  const [animateCard, setAnimateCard] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Score counter animation
  useEffect(() => {
    // Card spring entrance
    const cardTimer = setTimeout(() => {
      setAnimateCard(true);
    }, 150);

    // Score counter step
    const steps = 30;
    const duration = 1800; // ms
    const intervalTime = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      setDisplayScore(Math.min(score, Math.round(score * easeProgress)));
      setDisplayPct(Math.min(percentage, Math.round(percentage * easeProgress * 10) / 10));

      if (currentStep >= steps) {
        clearInterval(timer);
        setDisplayScore(score);
        setDisplayPct(percentage);
      }
    }, intervalTime);

    // 4.5 seconds celebration before auto-transitioning to result page
    const autoCompleteTimer = setTimeout(() => {
      onComplete();
    }, 4500);

    return () => {
      clearTimeout(cardTimer);
      clearInterval(timer);
      clearTimeout(autoCompleteTimer);
    };
  }, [score, percentage, onComplete]);

  // Particle canvas for Star Explosion, Sparkles, Floating Stars & Confetti
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#FFD700', '#FFA500', '#FF8C00', '#FFF8DC', '#FFFFFF', '#F0E68C'];

    // Star Burst Particles
    const starParticles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      vRot: number;
      opacity: number;
      fade: number;
    }> = [];

    // Burst 50 golden stars from center
    const centerX = width / 2;
    const centerY = height / 2 - 40;
    for (let i = 0; i < 50; i++) {
      const angle = (Math.PI * 2 * i) / 50 + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 8 + 3;
      starParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.1,
        opacity: 1.0,
        fade: Math.random() * 0.01 + 0.005,
      });
    }

    // Confetti Particles
    const confettiParticles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      vRot: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 90; i++) {
      confettiParticles.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.5) - 100,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.15,
        opacity: 1.0,
      });
    }

    // Upward Floating Stars
    const floatingStars: Array<{
      x: number;
      y: number;
      vy: number;
      size: number;
      color: string;
      twinkle: number;
      rotation: number;
    }> = [];

    for (let i = 0; i < 35; i++) {
      floatingStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: -(Math.random() * 1.5 + 0.5),
        size: Math.random() * 5 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        twinkle: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
      });
    }

    let animationFrameId: number;

    const drawStar = (
      cx: number,
      cy: number,
      spikes: number,
      outerRadius: number,
      innerRadius: number,
      rotation: number
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      let step = Math.PI / spikes;
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        ctx.rotate(step);
        ctx.lineTo(0, -innerRadius);
        ctx.rotate(step);
        ctx.lineTo(0, -outerRadius);
      }
      ctx.closePath();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render Floating Stars
      for (let i = 0; i < floatingStars.length; i++) {
        const p = floatingStars[i];
        p.y += p.vy;
        p.rotation += 0.01;
        p.twinkle += 0.05;
        if (p.y < -20) {
          p.y = height + 20;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(p.twinkle));
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        drawStar(p.x, p.y, 5, p.size, p.size / 2, p.rotation);
        ctx.fill();
        ctx.restore();
      }

      // Render Star Burst
      for (let i = 0; i < starParticles.length; i++) {
        const p = starParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // soft gravity
        p.rotation += p.vRot;
        p.opacity -= p.fade;

        if (p.opacity > 0) {
          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
          drawStar(p.x, p.y, 5, p.size, p.size / 2, p.rotation);
          ctx.fill();
          ctx.restore();
        }
      }

      // Render Confetti
      for (let i = 0; i < confettiParticles.length; i++) {
        const p = confettiParticles[i];
        p.x += p.vx + Math.sin(p.y * 0.02);
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const circumference = 2 * Math.PI * 38;
  const strokeDashoffset = circumference - (displayPct / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fadeIn select-none">
      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Radial Golden Sunburst Rays */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        <div className="w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full bg-radial from-amber-500/20 via-yellow-500/10 to-transparent blur-3xl animate-pulse" />
        <div className="absolute w-[500px] h-[500px] rounded-full border border-amber-500/20 animate-ping opacity-30" />
      </div>

      {/* Main Glory Result Card */}
      <div
        className={`relative z-10 w-full max-w-md bg-[#11131c]/90 border-2 border-amber-500/40 rounded-3xl p-8 text-center shadow-[0_0_80px_rgba(245,158,11,0.35)] backdrop-blur-xl transform transition-all duration-700 ${
          animateCard ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-8'
        }`}
      >
        {/* Floating Glowing Trophy */}
        <div className="relative inline-block mb-3">
          <div className="absolute inset-0 bg-amber-500/40 blur-xl rounded-full animate-pulse" />
          <div className="relative w-20 h-20 mx-auto rounded-2xl bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-600 p-0.5 shadow-2xl animate-bounce">
            <div className="w-full h-full bg-[#11131c] rounded-2xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/20 to-transparent animate-shimmer" />
              <Trophy className="w-10 h-10 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
            </div>
          </div>
          <SparklesIcon className="w-5 h-5 text-yellow-300 absolute -top-2 -right-2 animate-spin" />
          <Star className="w-4 h-4 text-amber-300 absolute -bottom-1 -left-2 animate-pulse" />
        </div>

        {/* PASS Badge */}
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 via-amber-500/20 to-emerald-500/20 border border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.3)] mb-4 relative overflow-hidden">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-black tracking-widest text-amber-300 uppercase">
            CHALLENGE PASSED
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shine" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1 tracking-tight line-clamp-1">{questionName}</h2>
        <p className="text-xs text-amber-300/80 font-medium mb-6">Mastery Confirmed • High Score Achieved!</p>

        {/* Score & Circular Progress Ring */}
        <div className="flex items-center justify-center gap-8 mb-6 bg-white/[0.03] p-4 rounded-2xl border border-amber-500/20">
          {/* Animated Circular Ring */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 90 90">
              <circle
                cx="45"
                cy="45"
                r="38"
                className="text-white/10"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="45"
                cy="45"
                r="38"
                className="text-amber-400 transition-all duration-500 ease-out"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                style={{ filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-black text-white font-mono">{displayPct}%</span>
              <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">Score</span>
            </div>
          </div>

          {/* Score Counter */}
          <div className="text-left space-y-1">
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Marks Awarded</div>
            <div className="text-3xl font-black text-amber-300 font-mono tracking-tight flex items-baseline gap-1">
              <span>{displayScore}</span>
              <span className="text-sm font-semibold text-gray-500">/ {totalMarks}</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              Min Passing: {passingMarks}
            </div>
          </div>
        </div>

        {/* Auto Progress Bar */}
        <div className="space-y-2">
          <button
            onClick={onComplete}
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-[0_0_25px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <SparklesIcon className="w-4 h-4" />
            View Full Report & Breakdown
          </button>
          <p className="text-[10px] text-gray-500">Auto transitioning to result page in 4 seconds...</p>
        </div>
      </div>
    </div>
  );
}
