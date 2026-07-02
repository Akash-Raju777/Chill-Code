import { useAuthStore } from '../store/authStore';

const BASE_URL = 'http://localhost:8080';

// Mock database store in memory for client-side fallback
const mockSubjects = [
  { id: 1, name: 'Java Programming', description: 'Core Java concepts, collections, and algorithms.', icon: 'Code2', color: '#3B82F6', status: 'ACTIVE' },
  { id: 2, name: 'Python Basics', description: 'Variables, loops, functions, and file I/O.', icon: 'Terminal', color: '#10B981', status: 'ACTIVE' },
  { id: 3, name: 'JavaScript & Node.js', description: 'Asynchronous actions, event loops, and arrays.', icon: 'Cpu', color: '#F59E0B', status: 'ACTIVE' }
];

const mockQuestions = [
  {
    id: 101,
    subjectId: 1,
    title: 'Two Sum Problem',
    difficulty: 'EASY' as const,
    problemStatement: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.',
    constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9',
    inputFormat: 'The first line contains N, the size of the array.\nThe second line contains N integers separated by space.\nThe third line contains the target sum.',
    outputFormat: 'Print the two indices separated by a space (indices are 0-based).',
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    marks: 10,
    negativeMarks: 0,
    allowedLanguages: 'java,python,javascript',
    tags: 'Arrays,Hashing',
    testCases: [
      { id: 1001, inputData: '4\n2 7 11 15\n9', expectedOutput: '0 1', isHidden: false },
      { id: 1002, inputData: '3\n3 2 4\n6', expectedOutput: '1 2', isHidden: false },
      { id: 1003, inputData: '2\n3 3\n6', expectedOutput: '0 1', isHidden: true }
    ]
  },
  {
    id: 102,
    subjectId: 1,
    title: 'Reverse String',
    difficulty: 'EASY' as const,
    problemStatement: 'Write a function that reverses a string. The input string is given as an array of characters s.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.',
    constraints: '1 <= s.length <= 10^5\ns[i] is a printable ascii character.',
    inputFormat: 'Single line containing the string s.',
    outputFormat: 'Print the reversed string.',
    timeLimitMs: 1500,
    memoryLimitMb: 128,
    marks: 10,
    negativeMarks: 0,
    allowedLanguages: 'java,python',
    tags: 'Strings,TwoPointers',
    testCases: [
      { id: 1004, inputData: 'hello', expectedOutput: 'olleh', isHidden: false },
      { id: 1005, inputData: 'Hannah', expectedOutput: 'hannaH', isHidden: false }
    ]
  }
];

const mockTests = [
  {
    id: 501,
    name: 'Mid-Term Core Java Exam',
    durationMinutes: 60,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
    maxMarks: 50,
    instructions: '1. Access from safe workspace.\n2. Do not leave full-screen mode.\n3. Do not switch tabs.',
    subject: { id: 1, name: 'Java Programming', color: '#3B82F6' }
  },
  {
    id: 502,
    name: 'Python Basics Class Quiz',
    durationMinutes: 30,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
    maxMarks: 30,
    instructions: '1. Enter fullscreen mode immediately.\n2. Do not right click.',
    subject: { id: 2, name: 'Python Basics', color: '#10B981' }
  },
  {
    id: 503,
    name: 'JavaScript Data Structures Challenge',
    durationMinutes: 90,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
    maxMarks: 100,
    instructions: 'Solve all questions under given timeout limits.',
    subject: { id: 3, name: 'JavaScript & Node.js', color: '#F59E0B' }
  }
];

const mockStudentTests = [
  {
    id: 601,
    status: 'ASSIGNED',
    score: 0,
    warningsCount: 0,
    isSuspended: false,
    test: mockTests[0]
  },
  {
    id: 602,
    status: 'ASSIGNED',
    score: 0,
    warningsCount: 0,
    isSuspended: false,
    test: mockTests[1]
  },
  {
    id: 603,
    status: 'SUBMITTED',
    score: 85,
    warningsCount: 0,
    isSuspended: false,
    test: mockTests[2]
  }
];

const mockNotifications = [
  { id: 701, title: 'Exam Assigned', message: 'You have been assigned to Mid-Term Core Java Exam. Start when ready.', type: 'TEST_ALERT', createdAt: new Date().toISOString() }
];

const mockAchievements = [
  { id: 801, title: 'Fast Learner', type: 'GOLD', badgeIcon: 'Award' }
];

const mockStudents: Array<{
  id: number;
  registerNumber: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  department: string;
  password?: string;
}> = [
  { id: 20, registerNumber: 'STUD12345', name: 'John Doe Student', email: 'john.doe@student.edu', phone: '9876543210', status: 'ACTIVE', department: 'Computer Science', password: 'password' },
  { id: 21, registerNumber: 'STUD67890', name: 'Jane Smith', email: 'jane.smith@student.edu', phone: '9876543211', status: 'ACTIVE', department: 'Information Technology', password: 'password' }
];

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().token;
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      if (!endpoint.includes('/api/auth/login')) {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `API Error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  } catch (err: any) {
    // Intercept "Failed to fetch" network exceptions and execute client mock fallback
    if (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('failed to fetch'))) {
      console.warn(`Chill-Code API server at port 8080 is unreachable. Executing client-side mock mock-mode fallback for endpoint: ${endpoint}`);
      return handleMockFallback(endpoint, options);
    }
    throw err;
  }
}

function handleMockFallback(endpoint: string, options: RequestInit) {
  const body = options.body ? JSON.parse(options.body as string) : null;

  // Login
  if (endpoint.includes('/api/auth/login')) {
    const identifier = body?.identifier || '';
    const password = body?.password || '';

    const isValAdmin = identifier.toLowerCase().includes('admin');
    if (isValAdmin) {
      return {
        token: 'mock-jwt-token-string-for-chill-code',
        id: 10,
        name: 'Admin Coordinator',
        email: 'admin@college.edu',
        role: 'ADMIN',
        username: identifier,
        status: 'ACTIVE'
      };
    } else {
      // Find in mockStudents registry
      const student = mockStudents.find((s) => s.registerNumber === identifier);
      if (!student) {
        throw new Error('Student account not registered by administrator. Please check your roll number or request access.');
      }
      if (student.password !== password) {
        throw new Error('Invalid student credentials. Please check your password.');
      }
      if (student.status !== 'ACTIVE') {
        throw new Error('Your student account is suspended or inactive.');
      }

      return {
        token: 'mock-jwt-token-string-for-chill-code',
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
        registerNumber: student.registerNumber,
        status: student.status
      };
    }
  }

  // Register
  if (endpoint.includes('/api/auth/register')) {
    return 'Mock registration completed successfully!';
  }

  // Admin Dashboard Metrics
  if (endpoint.includes('/api/admin/dashboard')) {
    return {
      totalStudents: 145,
      totalSubjects: mockSubjects.length,
      totalTests: mockTests.length,
      totalQuestions: mockQuestions.length,
      todayActiveTests: 1,
      pendingEvaluations: 0,
      monthlyTests: [
        { month: 'Jan', tests: 2 },
        { month: 'Feb', tests: 4 },
        { month: 'Mar', tests: 3 },
        { month: 'Apr', tests: 5 },
        { month: 'May', tests: 6 },
        { month: 'Jun', tests: 8 }
      ],
      studentParticipation: [
        { name: 'Java Midterm', assigned: 145, attended: 140 }
      ],
      languagePerformance: [
        { language: 'JAVA', avgScore: 84 },
        { language: 'PYTHON', avgScore: 89 },
        { language: 'JAVASCRIPT', avgScore: 78 }
      ],
      recentActivities: [
        { time: new Date().toISOString(), user: 'Jane Smith', details: 'Triggered warning: TAB_SWITCH - Switched tab', type: 'warning' }
      ]
    };
  }

  // Subject detailed analytics stats
  if (endpoint.includes('/stats') && endpoint.includes('/subjects/')) {
    const match = endpoint.match(/\/subjects\/(\d+)\/stats/);
    const subId = match ? Number(match[1]) : 1;
    
    return {
      questionsCount: subId === 1 ? 5 : subId === 2 ? 3 : 2,
      avgScore: subId === 1 ? 41.5 : subId === 2 ? 22.0 : 75.0,
      passRate: subId === 1 ? 75 : subId === 2 ? 80 : 100,
      failRate: subId === 1 ? 25 : subId === 2 ? 20 : 0,
      rankHolder: 'Alex Rivera',
      rankScore: subId === 1 ? 48 : subId === 2 ? 28 : 85,
      attendedCount: 12,
      notAttendedCount: 3,
      studentMarks: [
        { name: 'Alex Rivera', registerNumber: 'STUD001', score: subId === 1 ? 48 : 28, maxMarks: subId === 1 ? 50 : 30, status: 'PASSED' },
        { name: 'Jane Smith', registerNumber: 'STUD002', score: subId === 1 ? 42 : 24, maxMarks: subId === 1 ? 50 : 30, status: 'PASSED' },
        { name: 'John Doe', registerNumber: 'STUD003', score: subId === 1 ? 15 : 8, maxMarks: subId === 1 ? 50 : 30, status: 'FAILED' },
        { name: 'Sarah Connor', registerNumber: 'STUD004', score: 0, maxMarks: subId === 1 ? 50 : 30, status: 'ABSENT' },
        { name: 'David Miller', registerNumber: 'STUD005', score: subId === 1 ? 38 : 20, maxMarks: subId === 1 ? 50 : 30, status: 'PASSED' }
      ]
    };
  }

  // Admin and Student Subjects lists
  if (endpoint.includes('/subjects') && !endpoint.includes('/questions')) {
    return mockSubjects;
  }

  // Admin list of all tests
  if (endpoint.includes('/api/admin/tests')) {
    return mockTests;
  }

  // Admin list of all students
  if (endpoint.includes('/api/admin/students')) {
    if (options.method === 'POST') {
      const newStud = {
        id: Date.now(),
        registerNumber: body?.registerNumber || '',
        name: body?.name || '',
        email: body?.email || `${body?.registerNumber || 'student'}@college.edu`,
        phone: body?.phone || '',
        status: 'ACTIVE',
        department: body?.department || '',
        password: body?.password || 'password'
      };
      mockStudents.push(newStud);
      return newStud;
    }
    if (options.method === 'PUT') {
      const match = endpoint.match(/\/students\/(\d+)/);
      const studentId = match ? Number(match[1]) : (body?.id || 20);
      const student = mockStudents.find((s) => s.id === studentId);
      if (student) {
        student.name = body?.name || student.name;
        student.registerNumber = body?.registerNumber || student.registerNumber;
        student.email = body?.email || student.email;
        student.phone = body?.phone || student.phone;
        student.department = body?.department || student.department;
        student.status = body?.status || student.status;
        student.password = body?.password || student.password;
      }
      return student;
    }
    return mockStudents;
  }

  // Question listing by subject
  if (endpoint.includes('/questions') && !endpoint.includes('/submissions')) {
    // Subject questions filter
    const match = endpoint.match(/\/subjects\/(\d+)\/questions/);
    if (match) {
      const subId = Number(match[1]);
      return mockQuestions.filter((q) => q.subjectId === subId);
    }
    // Single question fetch
    const qMatch = endpoint.match(/\/questions\/(\d+)/);
    if (qMatch) {
      const qId = Number(qMatch[1]);
      return mockQuestions.find((q) => q.id === qId) || mockQuestions[0];
    }
    return mockQuestions;
  }

  // Forgive Student test attempt warnings
  if (endpoint.includes('/api/admin/student/forgive')) {
    mockStudentTests.forEach((st) => {
      st.warningsCount = 0;
      st.isSuspended = false;
      if (st.status === 'SUSPENDED') {
        st.status = 'STARTED';
      }
    });
    return { success: true };
  }

  // Post alert instructions to students notifications
  if (endpoint.includes('/api/student/notifications') && options.method === 'POST') {
    const newNotif = {
      id: Date.now(),
      title: body?.title || 'Notice Alert',
      message: body?.message || '',
      type: 'TEST_ALERT',
      createdAt: new Date().toISOString(),
      isRead: false
    };
    mockNotifications.unshift(newNotif);
    return newNotif;
  }

  // Student Test Lists
  if (endpoint.includes('/api/student/tests') && !endpoint.includes('/start') && !endpoint.includes('/submit') && !endpoint.includes('/warning')) {
    return mockStudentTests;
  }

  // Student stats
  if (endpoint.includes('/api/student/dashboard/stats')) {
    const completed = mockStudentTests.filter((st) => ['SUBMITTED', 'EVALUATED'].includes(st.status));
    const completedCount = completed.length;
    const avgScore = completedCount > 0 
      ? completed.reduce((sum, st) => sum + st.score, 0) / completedCount 
      : 84.5;

    return {
      upcomingTests: mockStudentTests.filter((st) => st.status === 'ASSIGNED').length,
      completedTests: completedCount,
      averageScore: Math.round(avgScore * 10) / 10,
      rank: 4,
      recentActivities: completed.map((st) => `Completed Test: ${st.test.name} - ${st.score}/${st.test.maxMarks} pts`)
    };
  }

  // Student achievements
  if (endpoint.includes('/api/student/achievements')) {
    return mockAchievements;
  }

  // Student notifications
  if (endpoint.includes('/api/student/notifications')) {
    return mockNotifications;
  }

  // Start Student Test attempt
  if (endpoint.includes('/start')) {
    const match = endpoint.match(/\/tests\/(\d+)\/start/);
    const testId = match ? Number(match[1]) : 501;
    const test = mockTests.find((t) => t.id === testId) || mockTests[0];
    return {
      id: 601,
      status: 'STARTED',
      score: 0,
      warningsCount: 0,
      isSuspended: false,
      test
    };
  }

  // Warning registration trigger
  if (endpoint.includes('/warning')) {
    const match = endpoint.match(/\/tests\/(\d+)\/warning/);
    const testId = match ? Number(match[1]) : 501;
    const url = new URL(`http://localhost${endpoint}`);
    const type = url.searchParams.get('type') || 'TAB_SWITCH';
    const reason = url.searchParams.get('reason') || 'Window switch';

    const testItem = mockStudentTests.find((st) => st.test.id === testId) || mockStudentTests[0];
    testItem.warningsCount += 1;
    if (testItem.warningsCount >= 3) {
      testItem.isSuspended = true;
      testItem.status = 'SUSPENDED';
    }
    return testItem;
  }

  // Submit test manual
  if (endpoint.includes('/submit')) {
    const match = endpoint.match(/\/tests\/(\d+)\/submit/);
    const testId = match ? Number(match[1]) : 501;
    const testItem = mockStudentTests.find((st) => st.test.id === testId) || mockStudentTests[0];
    testItem.status = 'SUBMITTED';
    if (testItem.score === 0) {
      testItem.score = 45; // Auto award score on submit if not already graded
    }
    return testItem;
  }

  // Submission compilation code execution mock simulator
  if (endpoint.includes('/api/student/submissions')) {
    const qId = body?.questionId || 101;
    const q = mockQuestions.find((item) => item.id === qId) || mockQuestions[0];
    
    // Simulate runtime compiler checks
    const codeStr = body?.code || '';
    const hasSyntaxError = codeStr.includes('class') && !codeStr.includes('Solution') && body?.language === 'java';

    if (hasSyntaxError) {
      return {
        status: 'COMPILATION_ERROR',
        runTimeMs: 0,
        memoryUsedKb: 0,
        compileError: 'error: class Solution is public, should be declared in a file named Solution.java',
        testCaseResults: []
      };
    }

    // Correctness checks
    const isTemplate = codeStr.includes('// Write your code here') || 
                       codeStr.includes('// Write code here') || 
                       codeStr.includes('pass') ||
                       codeStr.trim().length < 130;

    const hasLoops = codeStr.includes('for') || codeStr.includes('while') || codeStr.includes('.map') || codeStr.includes('.forEach');
    const hasLogic = codeStr.includes('target') || codeStr.includes('nums') || codeStr.includes('arr') || codeStr.includes('sum');

    const isCorrect = !isTemplate && hasLoops && hasLogic;

    // Track score in memory map
    if (!(globalThis as any).mockScoresMap) {
      (globalThis as any).mockScoresMap = {};
    }
    (globalThis as any).mockScoresMap[qId] = isCorrect ? (q.marks || 10) : 0;

    // Aggregate score on the student test session
    const testItem = mockStudentTests.find((st) => st.id === 601) || mockStudentTests[0];
    const totalScore = Object.values((globalThis as any).mockScoresMap).reduce((sum: number, val: any) => sum + (val || 0), 0);
    testItem.score = totalScore;
    testItem.status = 'STARTED';

    if (!isCorrect) {
      const tcResults = q.testCases.map((tc) => ({
        testCaseId: tc.id,
        status: 'FAILED',
        runTimeMs: 50,
        memoryUsedKb: 12800,
        message: tc.isHidden ? 'Hidden testcase failed.' : `Expected: ${tc.expectedOutput}\nActual: Output mismatch`
      }));
      return {
        status: 'WRONG_ANSWER',
        runTimeMs: 55,
        memoryUsedKb: 12800,
        compileError: null,
        testCaseResults: tcResults
      };
    }

    const tcResults = q.testCases.map((tc) => ({
      testCaseId: tc.id,
      status: 'PASSED',
      runTimeMs: 120,
      memoryUsedKb: 12800,
      message: 'Test Case Passed'
    }));

    return {
      status: 'ACCEPTED',
      runTimeMs: 145,
      memoryUsedKb: 12800,
      compileError: null,
      testCaseResults: tcResults
    };
  }

  return null;
}
