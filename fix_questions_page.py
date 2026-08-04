import os

filepath = 'frontend/src/app/admin/questions/page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update UI text
old_ui_text = """<h4 className="text-sm font-bold text-white">Enable Badge Management</h4>
                  <p className="text-[11px] text-gray-400">
                    If enabled, saving will pause completion until winner badges (Gold, Silver, Bronze) are assigned for this subject's test.
                  </p>"""
new_ui_text = """<h4 className="text-sm font-bold text-white">Configure Subject Arena Badge Set</h4>
                  <p className="text-[11px] text-gray-400">
                    If enabled, you can configure the winner badges (Gold, Silver, Bronze) for this entire Subject's Arena test. Note: This badge set is shared by all questions in this subject.
                  </p>"""
content = content.replace(old_ui_text, new_ui_text)

# 2. Update handleToggleEnableBadgeManagementInstantly
old_toggle = """const actualTitle = title.trim() || `${subName} Practice Arena`;
    const actualCode = questionCode.trim() ? questionCode.trim().toUpperCase() : '';"""
new_toggle = """const actualTitle = `${subName} Practice Arena`;
    const actualCode = '';"""
content = content.replace(old_toggle, new_toggle)

# 3. Update handleSubmit
old_submit_code = "if (!resolvedTestCode) resolvedTestCode = questionCode.trim() ? questionCode.trim().toUpperCase() : (testObj.testCode || `${prefix}-${testObj.id}`);"
new_submit_code = "if (!resolvedTestCode) resolvedTestCode = testObj.testCode || `${prefix}-${testObj.id}`;"
content = content.replace(old_submit_code, new_submit_code)

old_submit_name = "if (!resolvedTestName) resolvedTestName = title.trim() ? title.trim() : (testObj.name || `${subName} Practice Arena`);"
new_submit_name = "if (!resolvedTestName) resolvedTestName = testObj.name || `${subName} Practice Arena`;"
content = content.replace(old_submit_name, new_submit_name)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
