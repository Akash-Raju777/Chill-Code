const fs = require('fs');

const filepath = 'frontend/src/app/admin/questions/page.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

const handleSubmitStart = content.indexOf('const handleSubmit = async (e: React.FormEvent) => {');
const handleSubmitEnd = content.indexOf('  const handleSaveBadgeSetAndFinish = async () => {');

let handleSubmitBody = content.substring(handleSubmitStart, handleSubmitEnd);

// Find step 2 refresh
const step2start = handleSubmitBody.indexOf('      // Step 2: Refresh question list');
const step2end = handleSubmitBody.indexOf('    } catch (err: any) {');

const customBadgeLogic = `      // Step 2: Handle Custom Badges if enabled
      if (enableBadgeManagement) {
        let resolvedTestId = targetTestId;
        let resolvedTestCode = targetTestCode;
        let resolvedTestName = targetTestName;
        const subId = formSubjectId || selectedSubjectId;

        const testsData = await apiCall('/api/admin/tests');
        const subjectTests = (testsData || []).filter((t: any) => (t.subject?.id || t.subjectId) === subId);
        let testObj = subjectTests.length > 0 ? subjectTests[0] : (testsData && testsData.length > 0 ? testsData[0] : null);

        if (testObj) {
          if (!resolvedTestId) resolvedTestId = testObj.id;
          const subName = subjects.find((s: any) => s.id === subId)?.name || 'Subject';
          const prefix = subName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) || 'TEST';
          if (!resolvedTestCode) resolvedTestCode = questionCode.trim() ? questionCode.trim().toUpperCase() : (testObj.testCode || \`\${prefix}-\${testObj.id}\`);
          if (!resolvedTestName) resolvedTestName = title.trim() ? title.trim() : (testObj.name || \`\${subName} Practice Arena\`);

          // Fetch fresh badge sets to find the auto-created one
          const badgeSets = await fetchBadgeSets();
          const existingSet = (badgeSets || []).find((bs: any) => bs.testId === testObj.id);

          const badgePayload = {
            name: badgeSetName || \`\${resolvedTestName} Badge Set\`,
            testId: resolvedTestId,
            testCode: resolvedTestCode,
            testName: resolvedTestName,
            numberOfWinners: badgeWinnersCount,
            enableLanguageBadge,
            languageName,
            languageBadgeName,
            languageBadgeIcon,
            languageAwardRank: Number(languageAwardRank),
            status: 'ACTIVE',
            badges: badgeDefs,
          };

          if (existingSet) {
            await updateBadgeSet(existingSet.id, badgePayload);
          } else {
            await createBadgeSet(badgePayload);
          }
        }
      }

      // Step 3: Refresh question list
      const activeSubjectId = formSubjectId || selectedSubjectId;
      if (activeSubjectId) {
        setSelectedSubjectId(activeSubjectId);
        fetchQuestions(activeSubjectId); // non-blocking
      }

      showToast(editingQuestion ? 'Question updated successfully!' : 'Question uploaded successfully!');
      setShowForm(false);
`;

handleSubmitBody = handleSubmitBody.substring(0, step2start) + customBadgeLogic + handleSubmitBody.substring(step2end);

const handleSaveBadgeSetAndFinishEnd = content.indexOf('  const [confirmDeleteQuestion', handleSubmitEnd);

content = content.substring(0, handleSubmitStart) + handleSubmitBody + content.substring(handleSaveBadgeSetAndFinishEnd);

// Also let's fix handleOpenEdit to make it instant!
// We can pre-load badgeSets and testsData into a global variable or fetch them on page load.
// But since the user wants it INSTANTLY, the easiest way is to let the edit form open instantly, 
// and just show a tiny inline "Loading badge info..." if we haven't checked it yet, OR
// prefetch it in fetchQuestions.
// Let's modify handleOpenEdit so it doesn't await BEFORE opening.
const handleOpenEditStart = content.indexOf('  const handleOpenEdit = (q: Question) => {');
const handleOpenEditEnd = content.indexOf('  const handleAddTestCase = () => {');

let handleOpenEditBody = content.substring(handleOpenEditStart, handleOpenEditEnd);

const setEnableBadgeManagementFalse = 'setEnableBadgeManagement(false);';
const setShowFormTrue = 'setShowForm(true);';

// We just move setShowForm(true) to the TOP of handleOpenEdit, so the UI switches instantly.
// And the badge check runs asynchronously. The toggle will pop to true a millisecond later.
// But to prevent the toggle pop-in, we could just prefetch.
// Let's modify fetchQuestions to also prefetch badgeSets and tests.
const fetchQuestionsStr = \`  const fetchQuestions = async (subjectId: number, isInitial = false) => {
    if (isInitial || questions.length === 0) {
      setLoading(true);
    }
    try {
      const data = await apiCall(\\\`/api/admin/subjects/\${subjectId}/questions\\\`);
      setQuestions(data);
      // PREFETCH for instant edit
      apiCall('/api/admin/tests').catch(() => {});
      fetchBadgeSets().catch(() => {});
    } catch (err: any) {
      setError('Failed to fetch questions list');
    } finally {
      setLoading(false);
    }
  };\`;

content = content.replace(/  const fetchQuestions = async [\s\S]+?  };/, fetchQuestionsStr);

// To make edit instant without pop-in, we can just check the cache since apiCall / fetchBadgeSets might cache or return fast.
// But better, just put setShowForm(true) before the async IIFE in handleOpenEdit.
handleOpenEditBody = handleOpenEditBody.replace('setShowForm(true);', '');
handleOpenEditBody = handleOpenEditBody.replace('setFormSubjectId(q.subjectId);', 'setFormSubjectId(q.subjectId);\n    setShowForm(true); // Open instantly\n');

content = content.substring(0, handleOpenEditStart) + handleOpenEditBody + content.substring(handleOpenEditEnd);


fs.writeFileSync(filepath, content, 'utf-8');
console.log("Fixed handleSubmit and handleOpenEdit!");
