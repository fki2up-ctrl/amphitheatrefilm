const CATEGORY_MAP = {
  'Crew':       ['Crew', 'Gaffer', 'Grip', 'Pilot', 'G&E', 'crew', 'gaffer'],
  'Equipment':  ['Camera', 'Equipment', 'Drone', 'Transport', 'Rental', 'camera', 'equipment', 'drone'],
  'Location':   ['Location', 'Permit', 'Travel', 'location', 'permit', 'travel'],
  'Production': ['Catering', 'catering', 'Food', 'Wardrobe', 'Props', 'Art'],
};
function categorizeExpense(name) {
  if (!name) return 'Production';
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => name.toLowerCase().includes(k.toLowerCase()))) return cat;
  }
  return 'Production';
}
const expenses = [{ id: '1', description: 'Food', amount: 1000 }];
const grouped = { Crew: [], Equipment: [], Location: [], Production: [], Other: [] };
expenses.forEach(ex => grouped[categorizeExpense(ex.description || ex.expense_name)].push(ex));
console.log(grouped);
