const fs = require('fs');

const filepath = 'frontend/src/app/admin/questions/page.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// The replacement chunk for handleSubmit
const oldHandleSubmitChunk = `      // Step 2: Refresh question list
      const activeSubjectId = formSubjectId || selectedSubjectId;
      if (activeSubjectId) {
        setSelectedSubjectId(activeSubjectId);
        fetchQuestions(activeSubjectId); // non-blocking
      }

      showToast(editingQuestion ? 'Question updated successfully!' : 'Question uploaded successfully!');
      setShowForm(false);
    } catch (err: any) {`;

const newHandleSubmitChunk = `      // Step 2: Handle Custom Badges if enabled
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
        }

        if (resolvedTestId) {
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
          if (existingBadgeSetId) {
            await updateBadgeSet(existingBadgeSetId, badgePayload);
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
    } catch (err: any) {`;

content = content.replace(oldHandleSubmitChunk, newHandleSubmitChunk);

// Now remove the handleSaveBadgeSetAndFinish block completely.
const handleSaveStart = content.indexOf('  const handleSaveBadgeSetAndFinish = async () => {');
const handleSaveEndStr = `    } finally {
      setSavingBadgeSet(false);
    }
  };`;
const handleSaveEnd = content.indexOf(handleSaveEndStr, handleSaveStart);

if (handleSaveStart !== -1 && handleSaveEnd !== -1) {
    content = content.slice(0, handleSaveStart) + content.slice(handleSaveEnd + handleSaveEndStr.length);
}

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Successfully migrated handleSaveBadgeSetAndFinish to handleSubmit");
