import { create } from 'zustand';

interface TestCase {
  id: number;
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface Question {
  id: number;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  problemStatement: string;
  constraints?: string;
  inputFormat?: string;
  outputFormat?: string;
  marks: number;
  allowedLanguages: string; // Comma separated
  tags?: string;
  testCases: TestCase[];
  attemptCount?: number;
  timer?: number;
}

interface TestState {
  activeTestId: number | null;
  activeStudentTestId: number | null;
  activeTestName: string;
  questions: Question[];
  activeQuestionIndex: number;
  codes: Record<number, string>; // questionId -> code
  languages: Record<number, string>; // questionId -> selected language
  timeLeftSeconds: number;
  isSessionActive: boolean;
  isViewMode: boolean;
  securityShieldEnabled: boolean;
  lastUserId: number | null; // tracks which student owns this session

  startTestSession: (
    testId: number,
    studentTestId: number,
    testName: string,
    questions: Question[],
    durationSeconds: number,
    isViewMode?: boolean,
    securityShieldEnabled?: boolean,
    userId?: number
  ) => void;
  setActiveQuestionIndex: (index: number) => void;
  updateCode: (questionId: number, code: string) => void;
  updateLanguage: (questionId: number, language: string) => void;
  decrementTime: () => void;
  clearTestSession: () => void;
}

export const useTestStore = create<TestState>((set) => ({
  activeTestId: null,
  activeStudentTestId: null,
  activeTestName: '',
  questions: [],
  activeQuestionIndex: 0,
  codes: {},
  languages: {},
  timeLeftSeconds: 0,
  isSessionActive: false,
  isViewMode: false,
  securityShieldEnabled: false,
  lastUserId: null,

  startTestSession: (testId, studentTestId, testName, questions, durationSeconds, isViewMode = false, securityShieldEnabled = false, userId) => {
    // Initial codes and languages mapping
    const codes: Record<number, string> = {};
    const languages: Record<number, string> = {};

    questions.forEach((q) => {
      if (!q) return;
      const allowedStr = q.allowedLanguages || 'java';
      const allowed = allowedStr.split(',').map(l => l.trim().toLowerCase());
      const defaultLang = allowed[0] || 'java';
      languages[q.id] = defaultLang;
      codes[q.id] = ''; // Code starts completely empty
    });

    set({
      activeTestId: testId,
      activeStudentTestId: studentTestId,
      activeTestName: testName,
      questions,
      activeQuestionIndex: 0,
      codes,
      languages,
      timeLeftSeconds: Math.max(0, durationSeconds),
      isSessionActive: true,
      isViewMode,
      securityShieldEnabled,
      lastUserId: userId ?? null,
    });
  },

  setActiveQuestionIndex: (index) => set({ activeQuestionIndex: index }),

  updateCode: (questionId, code) => set((state) => ({
    codes: { ...state.codes, [questionId]: code }
  })),

  updateLanguage: (questionId, language) => set((state) => {
    return {
      languages: { ...state.languages, [questionId]: language }
      // Do not replace with boilerplate, keep what the user typed or keep empty
    };
  }),

  decrementTime: () => set((state) => {
    const nextTime = state.timeLeftSeconds - 1;
    return {
      timeLeftSeconds: Math.max(0, nextTime),
      // Do NOT set isSessionActive to false here — the auto-submit handler
      // needs the session to remain active during submission. It will call
      // clearTestSession() after the API call completes.
    };
  }),

  clearTestSession: () => set({
    activeTestId: null,
    activeStudentTestId: null,
    activeTestName: '',
    questions: [],
    activeQuestionIndex: 0,
    codes: {},
    languages: {},
    timeLeftSeconds: 0,
    isSessionActive: false,
    isViewMode: false,
    securityShieldEnabled: false,
    lastUserId: null,
  }),
}));
