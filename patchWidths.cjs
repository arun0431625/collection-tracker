const fs = require('fs');
let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

c = c.replace(/<SortTH\s+label="Branch"\s+sortKey="branch_code"/g, '<SortTH className="w-[40%]" label="Branch" sortKey="branch_code"');
c = c.replace(/<SortTH\s+label="Area Manager"\s+sortKey="area_manager"/g, '<SortTH className="w-[40%]" label="Area Manager" sortKey="area_manager"');
c = c.replace(/<SortTH\s+label="Party"\s+sortKey="party_name"/g, '<SortTH className="w-[45%]" label="Party" sortKey="party_name"');

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Table header width patched successfully!")
