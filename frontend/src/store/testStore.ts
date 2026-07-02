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
      const allowed = q.allowedLanguages.split(',');
      const defaultLang = allowed[0] || 'java';
      languages[q.id] = defaultLang;

      // Boilerplates
      if (defaultLang === 'java') {
        codes[q.id] = `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your code here\n        \n    }\n}`;
      } else if (defaultLang === 'python') {
        codes[q.id] = `# Write your Python code here\nimport sys\n\ndef main():\n    # Read input from sys.stdin\n    pass\n\nif __name__ == '__main__':\n    main()`;
      } else if (defaultLang === 'javascript') {
        codes[q.id] = `// Write your Node.js JavaScript code here\nconst fs = require('fs');\n\nfunction main() {\n    const input = fs.readFileSync('/dev/stdin', 'utf-8');\n    \n}`;
      } else {
        codes[q.id] = `// Write your code here`;
      }
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
    const prevCode = state.codes[questionId];
    let newCode = prevCode;
    
    // Auto replace boilerplate if code is still default/empty
    if (!prevCode || prevCode.trim().length < 50 || prevCode.includes('public class Solution') || prevCode.includes('# Write your Python code') || prevCode.includes('// Write your Node.js')) {
      if (language === 'java') {
        newCode = `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your code here\n        \n    }\n}`;
      } else if (language === 'python') {
        newCode = `# Write your Python code here\nimport sys\n\ndef main():\n    # Read input from sys.stdin\n    pass\n\nif __name__ == '__main__':\n    main()`;
      } else if (language === 'javascript') {
        newCode = `// Write your Node.js JavaScript code here\nconst fs = require('fs');\n\nfunction main() {\n    const input = fs.readFileSync('/dev/stdin', 'utf-8');\n    \n}`;
      } else if (language === 'cpp') {
        newCode = `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    return 0;\n}`;
      } else if (language === 'c') {
        newCode = `#include <stdio.h>\n\nint main() {\n    // Write your C code here\n    return 0;\n}`;
      } else {
        newCode = `// Write code here`;
      }
    }

    return {
      languages: { ...state.languages, [questionId]: language },
      codes: { ...state.codes, [questionId]: newCode }
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
