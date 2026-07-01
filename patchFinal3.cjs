const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// 1. Lighter Backgrounds: slate-800 -> slate-600, slate-700 -> slate-500
c = c.replace(/bg-slate-800/g, 'bg-slate-600');
c = c.replace(/hover:bg-slate-700/g, 'hover:bg-slate-500');

// 2. Add width logic to SortTH
if (!c.includes('width?: string')) {
    c = c.replace('className?: string;', 'className?: string;\n  width?: string;');
    c = c.replace('className = "",', 'className = "",\n  width,');
    c = c.replace(/<th\s+onClick=\{onClick\}\s+className=\{`(px-3 py-2 cursor-pointer align-middle text-center select-none border-b hover:bg-gray-100 \$\{className\})`\}/g, '<th style={{ width }} onClick={onClick} className={`$1`} >');
}

// 3. Migrate from className="w-[XX%]" to width="XX%" on all SortTH
c = c.replace(/className="w-\[50%\]"/g, 'width="50%"');
c = c.replace(/className="w-\[52%\]"/g, 'width="50%"'); // Default fallback for party before we split it
c = c.replace(/className="w-\[8%\]"/g, 'width="8%"');
c = c.replace(/className="w-\[6%\]"/g, 'width="6%"');
c = c.replace(/className="w-\[11%\]"/g, 'width="11%"');
c = c.replace(/className="w-\[14%\]"/g, 'width="14%"');

// 4. PartyRow updates
if (!c.includes('branches?: string;')) {
    c = c.replace('party_name: string;', 'party_name: string;\n  branches?: string;');
}

// Update Party Export table to include branches
c = c.replace(
    'Party: r.party_name,',
    'Party: r.party_name,\n                  Branches: r.branches || "-",'
);

// Update Party Headers: Replace <SortTH width="50%" label="Party" ... />
const partySortTHSearch = '<SortTH width="50%" label="Party" sortKey="party_name"';
const partySortTHTarget = '<SortTH width="34%" label="Party" sortKey="party_name"';
c = c.replace(partySortTHSearch, partySortTHTarget);

// Insert branch column right after Party header
const branchSortCode = `
              <SortTH width="16%" label="Branches" sortKey="branches"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "branches",
                    dir: s?.key === "branches" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />`;
              
if (!c.includes('label="Branches"')) {
    c = c.replace(
        /onClick=\{\(\) =>[\s\S]*? \}\s*\/>/,
        (match) => match + branchSortCode
    );
    // Wait, regex might match the FIRST SortTH in the file (Branch sort)! We ONLY want to inject it after Party SortTH.
    // Better way: find exactly where Party Sort ends.
}

// Clean and reliable Party Header insert:
// Since there's only one <SortTH width="34%" label="Party" (after replacement)
let lines = c.split('\\n');
let modified = false;
for (let i = 0; i < lines.length; i++) {
    // If it's a party header
    if (lines[i].includes('label="Party"')) {
        let endIndex = i;
        // find self closure
        for (let j = i; j < i + 15; j++) {
            if (lines[j] && lines[j].includes('/>')) {
                endIndex = j;
                break;
            }
        }
        
        // inject branch column
        if (!c.includes('label="Branches"')) {
            lines.splice(endIndex + 1, 0, branchSortCode.replace(/\\n/g, '\\n'));
        }
        modified = true;
        break;
    }
}
if (modified) {
    c = lines.join('\\n');
}

// Wait, the above logic uses explicit splitting which might fail if the token wasn't identical, I'll use an AST or a direct replace block!
// Wait! Let's just use string replace.
let partyHeaderBlock = `<SortTH width="34%" label="Party" sortKey="party_name"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "party_name",
                    dir: s?.key === "party_name" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />`;
              
// Note: We might be matching `dir: s?.key === "party_name" ...` which may have exact whitespace 
// Actually, I can just replace `party_name}</td>` with `party_name}</td>\\n                <td className="border px-2 py-1 text-center truncate">{r.branches || "-"}</td>`
c = c.replace('<td className="border px-2 py-1">{r.party_name}</td>', '<td className="border px-2 py-1">{r.party_name}</td>\\n                <td className="border px-2 text-xs py-1 text-center">{r.branches || "-"}</td>');

// Wait, did I inject SortTH for Branches yet? If the script logic is brittle, let me just do a manual replace!

fs.writeFileSync('src/pages/Reports.tsx.tmp', c);
console.log("Staged");
