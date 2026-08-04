'use client';
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      btnBg: 'bg-red-500 hover:bg-red-600',
      borderColor: 'border-red-500/30',
      glowColor: 'shadow-red-500/10',
    },
    warning: {
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      btnBg: 'bg-amber-500 hover:bg-amber-600',
      borderColor: 'border-amber-500/30',
      glowColor: 'shadow-amber-500/10',
    },
    info: {
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      btnBg: 'bg-blue-500 hover:bg-blue-600',
      borderColor: 'border-blue-500/30',
      glowColor: 'shadow-blue-500/10',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md mx-4 bg-[#0d0f17] border ${styles.borderColor} rounded-2xl shadow-2xl ${styles.glowColor} animate-scaleIn`}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className={`p-3 rounded-2xl ${styles.iconBg}`}>
              <AlertTriangle className={`w-7 h-7 ${styles.iconColor}`} />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-white text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-400 text-center leading-relaxed mb-6">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 hover:bg-white/5 transition-all duration-200"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 ${styles.btnBg} rounded-xl text-sm font-bold text-white transition-all duration-200 shadow-lg`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
