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
  timeLimitMs: number;
  memoryLimitMb: number;
  marks: number;
  allowedLanguages: string; // Comma separated
  tags?: string;
  testCases: TestCase[];
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

  startTestSession: (
    testId: number,
    studentTestId: number,
    testName: string,
    questions: Question[],
    durationMinutes: number
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

  startTestSession: (testId, studentTestId, testName, questions, durationMinutes) => {
    // Initial codes and languages mapping
    const codes: Record<number, string> = {};
    const languages: Record<number, string> = {};

    questions.forEach((q) => {
      const allowed = q.allowedLanguages.split(',').map(l => l.trim().toLowerCase());
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
      timeLeftSeconds: durationMinutes * 60,
      isSessionActive: true,
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
      isSessionActive: nextTime > 0,
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
  }),
}));
