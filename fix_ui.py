import os

filepath = 'frontend/src/app/admin/questions/page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the bounds
badge_step_active_start = -1
badge_step_active_end = -1
badge_config_start = -1
badge_config_end = -1
form_toggle_line = -1

for i, line in enumerate(lines):
    if ') : badgeStepActive ? (' in line:
        badge_step_active_start = i
    if '{/* Auto-Loaded Details */}' in line and badge_step_active_start != -1 and badge_config_start == -1:
        badge_config_start = i
    if '{/* Submission options */}' in line and badge_step_active_start != -1:
        badge_config_end = i - 2 # the div before it
    if '/* Form view */' in line and badge_step_active_start != -1:
        badge_step_active_end = i - 1
    if '{/* Submission options */}' in line and i > badge_step_active_end:
        form_toggle_line = i

print(f"Start: {badge_step_active_start}")
print(f"End: {badge_step_active_end}")
print(f"Badge Config Start: {badge_config_start}")
print(f"Badge Config End: {badge_config_end}")
print(f"Form toggle line: {form_toggle_line}")

# Extract badge config
badge_config_lines = lines[badge_config_start:badge_config_end]
# Wrap it
wrapped_badge_config = [
    '          {enableBadgeManagement && (\n',
    '            <div className="space-y-6 glass-panel p-6 md:p-8 rounded-2xl border border-amber-500/20 bg-[#11131c] mt-6">\n'
] + badge_config_lines + [
    '            </div>\n',
    '          )}\n\n'
]

# Construct new lines
new_lines = []
i = 0
while i < len(lines):
    if i == badge_step_active_start:
        new_lines.append('      ) : (\n')
        i = badge_step_active_end + 1
        continue
    
    if i == form_toggle_line:
        new_lines.extend(wrapped_badge_config)
        new_lines.append(lines[i])
        i += 1
        continue
        
    new_lines.append(lines[i])
    i += 1

# Clean up useState hooks and setBadgeStepActive calls
final_lines = []
for line in new_lines:
    if 'const [badgeStepActive, setBadgeStepActive] = useState(false);' in line:
        continue
    if 'setBadgeStepActive(true);' in line:
        continue
    if 'setBadgeStepActive(false);' in line:
        continue
    final_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

print("Done replacing.")
