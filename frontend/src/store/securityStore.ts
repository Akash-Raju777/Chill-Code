import { create } from 'zustand';

interface SecurityState {
  warnings: number;
  warningsLimit: number;
  lastWarningReason: string;
  showWarningModal: boolean;
  isTestSuspended: boolean;
  incrementWarnings: (reason: string) => void;
  resetWarnings: () => void;
  setWarningModal: (show: boolean) => void;
  suspendTest: () => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  warnings: 0,
  warningsLimit: 3,
  lastWarningReason: '',
  showWarningModal: false,
  isTestSuspended: false,
  incrementWarnings: (reason) => set((state) => {
    const nextWarnings = state.warnings + 1;
    const isSuspended = nextWarnings >= state.warningsLimit;
    return {
      warnings: nextWarnings,
      lastWarningReason: reason,
      showWarningModal: !isSuspended, // Don't show warning modal if they are suspended (show suspension screen instead)
      isTestSuspended: isSuspended,
    };
  }),
  resetWarnings: () => set({
    warnings: 0,
    lastWarningReason: '',
    showWarningModal: false,
    isTestSuspended: false,
  }),
  setWarningModal: (show) => set({ showWarningModal: show }),
  suspendTest: () => set({ isTestSuspended: true }),
}));
