package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.SubmissionResultDto;
import com.chillcode.assessment.dto.SubmitRequest;
import com.chillcode.assessment.entity.Question;
import com.chillcode.assessment.repository.QuestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
public class CodeExecutionEngineTest {

    @Autowired
    private CodeExecutionService codeExecutionService;

    @MockBean
    private QuestionRepository questionRepository;

    @MockBean
    private com.chillcode.assessment.repository.TestCaseRepository testCaseRepository;

    private Question question;

    @BeforeEach
    public void setup() {
        question = new Question();
        question.setId(9999L);
        question.setAllowedLanguages("java,python,cpp,c,javascript");

        Mockito.when(questionRepository.findById(9999L)).thenReturn(Optional.of(question));

        com.chillcode.assessment.entity.TestCase testCase = new com.chillcode.assessment.entity.TestCase();
        testCase.setId(101L);
        testCase.setInputData("5");
        testCase.setExpectedOutput("25");
        testCase.setIsHidden(false);

        Mockito.when(testCaseRepository.findByQuestionId(9999L)).thenReturn(java.util.List.of(testCase));
    }

    private SubmitRequest createRequest(String lang, String code, String input, boolean runOnly) {
        SubmitRequest req = new SubmitRequest();
        req.setQuestionId(9999L);
        req.setLanguage(lang);
        req.setCode(code);
        req.setCustomInput(input);
        req.setRunOnly(runOnly);
        return req;
    }

    // ==========================================
    // JAVA TESTS
    // ==========================================
    @Test
    public void testJavaSuccess() {
        String code = "public class Solution {\n" +
                      "    public static void main(String[] args) {\n" +
                      "        java.util.Scanner sc = new java.util.Scanner(System.in);\n" +
                      "        int n = sc.nextInt();\n" +
                      "        int sum = 0;\n" +
                      "        for (int i = 0; i < n; i++) {\n" +
                      "            sum += sc.nextInt();\n" +
                      "        }\n" +
                      "        System.out.println(sum);\n" +
                      "    }\n" +
                      "}";
        SubmitRequest req = createRequest("java", code, "5\n1 2 3 4 5", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("ACCEPTED");
        assertThat(res.getStdout().trim()).isEqualTo("15");
        assertThat(res.getExitCode()).isEqualTo(0);
    }

    @Test
    public void testJavaCompileError() {
        String code = "public class Solution {\n" +
                      "    public static void main(String[] args) {\n" +
                      "        System.out.println(\"missing semi\")\n" +
                      "    }\n" +
                      "}";
        SubmitRequest req = createRequest("java", code, "", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("COMPILATION_ERROR");
        assertThat(res.getCompileError()).contains("error: ';'");
        assertThat(res.getAiExplanation()).contains("semicolon");
    }

    @Test
    public void testJavaRuntimeError() {
        String code = "public class Solution {\n" +
                      "    public static void main(String[] args) {\n" +
                      "        int x = 5 / 0;\n" +
                      "    }\n" +
                      "}";
        SubmitRequest req = createRequest("java", code, "", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("RUNTIME_ERROR");
        assertThat(res.getExitCode()).isNotEqualTo(0);
        assertThat(res.getAiExplanation().toLowerCase()).contains("zero");
    }


    // ==========================================
    // PYTHON TESTS
    // ==========================================
    @Test
    public void testPythonSuccess() {
        String code = "import sys\n" +
                      "lines = sys.stdin.read().split()\n" +
                      "if len(lines) > 0:\n" +
                      "    n = int(lines[0])\n" +
                      "    nums = [int(x) for x in lines[1:n+1]]\n" +
                      "    print(sum(nums))\n" +
                      "else:\n" +
                      "    print(\"Hello World\")";
        SubmitRequest req = createRequest("python", code, "4\n10 20 30 40", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("ACCEPTED");
        assertThat(res.getStdout().trim()).isEqualTo("100");
    }

    @Test
    public void testPythonRuntimeError() {
        String code = "x = [1, 2]\nprint(x[5])";
        SubmitRequest req = createRequest("python", code, "", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("RUNTIME_ERROR");
        assertThat(res.getExitCode()).isNotEqualTo(0);
    }

    private boolean isCommandAvailable(String cmd) {
        try {
            Process p = System.getProperty("os.name").toLowerCase().contains("win")
                ? new ProcessBuilder("cmd.exe", "/c", cmd, "--version").start()
                : new ProcessBuilder(cmd, "--version").start();
            return p.waitFor(2, java.util.concurrent.TimeUnit.SECONDS) && p.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    // ==========================================
    // C TESTS
    // ==========================================
    @Test
    public void testCSuccess() {
        org.junit.jupiter.api.Assumptions.assumeTrue(isCommandAvailable("gcc"), "GCC compiler is not available on this system");
        String code = "#include <stdio.h>\n" +
                      "int main() {\n" +
                      "    int n;\n" +
                      "    if (scanf(\"%d\", &n) == 1) {\n" +
                      "        int sum = 0;\n" +
                      "        for (int i = 0; i < n; i++) {\n" +
                      "            int x;\n" +
                      "            scanf(\"%d\", &x);\n" +
                      "            sum += x;\n" +
                      "        }\n" +
                      "        printf(\"%d\\n\", sum);\n" +
                      "    }\n" +
                      "    return 0;\n" +
                      "}";
        SubmitRequest req = createRequest("c", code, "3\n5 10 15", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("ACCEPTED");
        assertThat(res.getStdout().trim()).isEqualTo("30");
    }

    // ==========================================
    // C++ TESTS
    // ==========================================
    @Test
    public void testCppSuccess() {
        org.junit.jupiter.api.Assumptions.assumeTrue(isCommandAvailable("g++"), "G++ compiler is not available on this system");
        String code = "#include <iostream>\n" +
                      "#include <vector>\n" +
                      "using namespace std;\n" +
                      "int main() {\n" +
                      "    int n;\n" +
                      "    if (cin >> n) {\n" +
                      "        vector<int> nums(n);\n" +
                      "        int sum = 0;\n" +
                      "        for (int i = 0; i < n; i++) {\n" +
                      "            cin >> nums[i];\n" +
                      "            sum += nums[i];\n" +
                      "        }\n" +
                      "        cout << sum << endl;\n" +
                      "    }\n" +
                      "    return 0;\n" +
                      "}";
        SubmitRequest req = createRequest("cpp", code, "2\n50 50", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        System.out.println("CPP TEST VERDICT: " + res.getStatus());
        System.out.println("CPP TEST STDERR: " + res.getStderr());
        System.out.println("CPP TEST STDOUT: " + res.getStdout());
        assertThat(res.getStatus()).isEqualTo("ACCEPTED");
        assertThat(res.getStdout().trim()).isEqualTo("100");
    }


    // ==========================================
    // JAVASCRIPT TESTS
    // ==========================================
    @Test
    public void testJavaScriptSuccess() {
        String code = "const fs = require('fs');\n" +
                      "const input = fs.readFileSync(0, 'utf-8').trim();\n" +
                      "if (input) {\n" +
                      "    const parts = input.split(/\\s+/).map(Number);\n" +
                      "    const n = parts[0];\n" +
                      "    const nums = parts.slice(1, n + 1);\n" +
                      "    const sum = nums.reduce((a, b) => a + b, 0);\n" +
                      "    console.log(sum);\n" +
                      "}";
        SubmitRequest req = createRequest("javascript", code, "5\n1 1 1 1 1", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("ACCEPTED");
        assertThat(res.getStdout().trim()).isEqualTo("5");
    }

    // ==========================================
    // SECURITY & LIMIT TESTS
    // ==========================================
    @Test
    public void testInfiniteLoopTimeout() {
        // Test infinite loop in Python
        String code = "import time\n" +
                      "while True:\n" +
                      "    time.sleep(0.1)";
        SubmitRequest req = createRequest("python", code, "", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("TIME_LIMIT_EXCEEDED");
    }

    @Test
    public void testMemoryLimitExceeded() {
        // Test memory limit error in Python by allocating 300MB with a 256MB limit
        String code = "import time\n" +
                      "arr = bytearray(300 * 1024 * 1024)\n" +
                      "time.sleep(1.0)";
        SubmitRequest req = createRequest("python", code, "", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("MEMORY_LIMIT_EXCEEDED");
    }
    @Test
    public void testCustomInputMatchingExpectedOutputFails() {
        String code = "public class Solution {\n" +
                      "    public static void main(String[] args) {\n" +
                      "        java.util.Scanner sc = new java.util.Scanner(System.in);\n" +
                      "        int n = sc.nextInt();\n" +
                      "        System.out.println(n * 2);\n" +
                      "    }\n" +
                      "}";
        SubmitRequest req = createRequest("java", code, "5", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("WRONG_ANSWER");
        assertThat(res.getExpectedOutput()).isEqualTo("25");
        assertThat(res.getActualOutput().trim()).isEqualTo("10");
    }

    @Test
    public void testCustomInputMatchingExpectedOutputPasses() {
        String code = "public class Solution {\n" +
                      "    public static void main(String[] args) {\n" +
                      "        java.util.Scanner sc = new java.util.Scanner(System.in);\n" +
                      "        int n = sc.nextInt();\n" +
                      "        System.out.println(n * n);\n" +
                      "    }\n" +
                      "}";
        SubmitRequest req = createRequest("java", code, "5", true);
        SubmissionResultDto res = codeExecutionService.submitCode(req);
        assertThat(res.getStatus()).isEqualTo("ACCEPTED");
    }
}
