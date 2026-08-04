const fs = require('fs');

const filepath = 'frontend/src/app/admin/questions/page.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

const startStr = '  const handleSaveBadgeSetAndFinish = async () => {';
const endStr = `    } finally {
      setSavingBadgeSet(false);
    }
  };`;

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + content.substring(endIndex + endStr.length);
    fs.writeFileSync(filepath, newContent, 'utf-8');
    console.log('Successfully deleted handleSaveBadgeSetAndFinish');
} else {
    console.log('Could not find start or end bounds.');
}
