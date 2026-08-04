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

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Fixed handleSubmit!");
