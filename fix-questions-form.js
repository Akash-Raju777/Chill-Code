const fs = require('fs');

const path = './frontend/src/app/admin/questions/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

// 1. Remove the entire badgeStepActive ternary block
const startTernaryStr = `      ) : badgeStepActive ? (
        <div className="space-y-6 glass-panel p-6 md:p-8 rounded-2xl border border-amber-500/20 bg-[#11131c]">`;

const endTernaryStr = `            </button>
          </div>
        </div>
      ) : (
        /* Form view */
        <form onSubmit={handleSubmit} className="space-y-8 glass-panel p-6 md:p-8 rounded-2xl">`;

const startIdx = content.indexOf(startTernaryStr);
if (startIdx === -1) throw new Error("Could not find start ternary string");
const endIdx = content.indexOf(endTernaryStr, startIdx);
if (endIdx === -1) throw new Error("Could not find end ternary string");

// Extract the badge UI block
let badgeBlock = content.substring(startIdx + startTernaryStr.length, endIdx);
// Remove the buttons from the bottom of the badge block
badgeBlock = badgeBlock.replace(/<div className="flex justify-end gap-3 border-t border-white\/5 pt-6">[\s\S]+?<\/button>\s*<\/div>/, '');

// The replacement text for the top
const newTop = `      ) : (
        /* Form view */
        <form onSubmit={handleSubmit} className="space-y-8 glass-panel p-6 md:p-8 rounded-2xl">`;

// 2. Add the badge block below the toggle switch inside the form
const toggleStr = `              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableBadgeManagement}
                  onChange={(e) => handleToggleEnableBadgeManagementInstantly(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>`;

const newBadgeBlock = `
          {enableBadgeManagement && (
            <div className="space-y-6 glass-panel p-6 md:p-8 rounded-2xl border border-amber-500/20 bg-[#11131c] mt-6">
              ${badgeBlock.trim()}
            </div>
          )}
`;

// Perform replacements
content = content.replace(content.substring(startIdx, endIdx + endTernaryStr.length), newTop);
content = content.replace(toggleStr, toggleStr + newBadgeBlock);

// Remove handleSaveBadgeSetAndFinish and badgeStepActive state
// wait, badgeStepActive state is at line 76: const [badgeStepActive, setBadgeStepActive] = useState(false);
// it's used inside handleToggleEnableBadgeManagementInstantly, so we should just let it be unused or remove it.
content = content.replace(/const \[badgeStepActive, setBadgeStepActive\] = useState\(false\);/, '');
content = content.replace(/setBadgeStepActive\(true\);/g, '');
content = content.replace(/setBadgeStepActive\(false\);/g, '');

fs.writeFileSync(path, content);
console.log('Successfully restructured questions page!');
