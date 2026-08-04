const fs = require('fs');

const filepath = 'frontend/src/app/admin/questions/page.tsx';
let lines = fs.readFileSync(filepath, 'utf-8').split('\n');

let badge_step_active_start = -1;
let badge_step_active_end = -1;
let badge_config_start = -1;
let badge_config_end = -1;
let form_toggle_line = -1;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(') : badgeStepActive ? (')) {
        badge_step_active_start = i;
    }
    if (line.includes('{/* Auto-Loaded Details */}') && badge_step_active_start !== -1 && badge_config_start === -1) {
        badge_config_start = i;
    }
    if (line.includes('<div className="flex justify-end gap-3 border-t border-white/5 pt-6">') && badge_step_active_start !== -1 && badge_step_active_end === -1) {
        badge_config_end = i;
    }
    if (line.includes('/* Form view */') && badge_step_active_start !== -1) {
        badge_step_active_end = i - 1;
    }
    if (line.includes('{/* Submission options */}') && i > badge_step_active_end) {
        form_toggle_line = i;
    }
}

console.log(`Start: ${badge_step_active_start}`);
console.log(`End: ${badge_step_active_end}`);
console.log(`Badge Config Start: ${badge_config_start}`);
console.log(`Badge Config End: ${badge_config_end}`);
console.log(`Form toggle line: ${form_toggle_line}`);

if (badge_step_active_start === -1) {
  console.log("Already run or string not found");
  process.exit(0);
}

const badge_config_lines = lines.slice(badge_config_start, badge_config_end);
const wrapped_badge_config = [
    '          {enableBadgeManagement && (',
    '            <div className="space-y-6 glass-panel p-6 md:p-8 rounded-2xl border border-amber-500/20 bg-[#11131c] mt-6">',
    ...badge_config_lines,
    '            </div>',
    '          )}',
    ''
];

const new_lines = [];
let i = 0;
while (i < lines.length) {
    if (i === badge_step_active_start) {
        new_lines.push('      ) : (');
        i = badge_step_active_end + 1;
        continue;
    }
    
    if (i === form_toggle_line) {
        new_lines.push(...wrapped_badge_config);
        new_lines.push(lines[i]);
        i++;
        continue;
    }
        
    new_lines.push(lines[i]);
    i++;
}

const final_lines = new_lines.filter(line => {
    if (line.includes('const [badgeStepActive, setBadgeStepActive] = useState(false);')) return false;
    if (line.includes('setBadgeStepActive(true);')) return false;
    if (line.includes('setBadgeStepActive(false);')) return false;
    return true;
});

fs.writeFileSync(filepath, final_lines.join('\n'), 'utf-8');
console.log("Done replacing.");
