const fs = require('fs');
const filepath = 'frontend/src/app/admin/badges/page.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

// 1. Add interface StudentAchievement
const interface_str = `
interface StudentAchievement {
  id: number;
  studentId: number;
  studentName: string;
  studentRegisterNumber: string;
  badgeName: string;
  badgeIcon: string;
  badgeCategory: string;
  testId: number;
  testCode: string;
  testName: string;
  subjectName: string;
  rankAchieved: string;
  awardedAt: string;
  awardedBy: string;
  status: string;
}
`;
if (!content.includes("interface StudentAchievement")) {
    content = content.replace("interface TestOption {", interface_str + "\ninterface TestOption {");
}

// 2. Add state
const state_str = `  const [achievements, setAchievements] = useState<StudentAchievement[]>([]);
  const [selectedBadgeSetForWinners, setSelectedBadgeSetForWinners] = useState<BadgeSet | null>(null);`;
if (!content.includes("const [achievements")) {
    content = content.replace("const [error, setError] = useState('');", "const [error, setError] = useState('');\n" + state_str);
}

// 3. Add to loadData
const load_data_old = `      const [setsData, testsData] = await Promise.all([
        fetchBadgeSets(),
        apiCall('/api/admin/tests')
      ]);`;
const load_data_new = `      const [setsData, testsData, achievementsData] = await Promise.all([
        fetchBadgeSets(),
        apiCall('/api/admin/tests'),
        apiCall('/api/admin/achievements').catch(() => [])
      ]);
      setAchievements(achievementsData || []);`;
if (content.includes(load_data_old)) {
    content = content.replace(load_data_old, load_data_new);
}

// 4. Add "See badge obtained students" button inside the Badge Set card
const buttons_old = `                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleOpenEditModal(set)}`;
const buttons_new = `                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                    <button
                      onClick={() => setSelectedBadgeSetForWinners(set)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold hover:bg-indigo-500/20 transition-colors w-full sm:w-auto"
                    >
                      See badge obtained students
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(set)}`;
if (!content.includes("See badge obtained students")) {
    content = content.replace(buttons_old, buttons_new);
}

// 5. Add Winners Modal at the bottom
const winners_modal = `
      {/* Winners Modal */}
      {selectedBadgeSetForWinners && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b0c10] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-white/5 bg-[#11131c] flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  {selectedBadgeSetForWinners.name} Winners
                </h2>
                <p className="text-xs text-gray-500 mt-1">Students who earned badges in this test</p>
              </div>
              <button onClick={() => setSelectedBadgeSetForWinners(null)} className="text-gray-400 hover:text-white transition-colors">
                <span className="text-xl">&times;</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {(() => {
                const winners = achievements.filter(a => a.testId === selectedBadgeSetForWinners.testId);
                if (winners.length === 0) {
                  return (
                    <div className="text-center py-10 text-gray-500">
                      <Award className="w-12 h-12 mx-auto opacity-20 mb-3" />
                      <p>No students have obtained badges for this test yet.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {winners.map(w => (
                      <div key={w.id} className="flex items-center justify-between p-4 rounded-xl bg-[#11131c] border border-white/5 hover:border-indigo-500/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-xl">
                            {w.badgeIcon || '🏅'}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{w.studentName}</div>
                            <div className="text-xs text-gray-400">{w.studentRegisterNumber}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-amber-400">{w.badgeName}</div>
                          <div className="text-[10px] text-gray-500">{new Date(w.awardedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 border-t border-white/5 bg-[#11131c] flex justify-end">
              <button 
                onClick={() => setSelectedBadgeSetForWinners(null)}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
`;
if (!content.includes("Winners Modal")) {
    content = content.replace("{/* Delete Confirmation Modal */}", winners_modal + "\n      {/* Delete Confirmation Modal */}");
}

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Added UI successfully!");
