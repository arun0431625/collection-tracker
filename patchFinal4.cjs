const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// 1. Lighter Backgrounds: slate-800 -> slate-600, slate-700 -> slate-500
c = c.replace(/bg-slate-800/g, 'bg-slate-600');
c = c.replace(/hover:bg-slate-700/g, 'hover:bg-slate-500');

// 2. Add width logic to SortTH
if (!c.includes('width?: string')) {
    c = c.replace('className?: string;', 'className?: string;\\n  width?: string;');
    c = c.replace('className = "",', 'className = "",\\n  width,');
    c = c.replace(/className=\{\`(px-3 py-2 cursor-pointer align-middle text-center select-none border-b hover:bg-gray-100 \$\{className\})\`\}/g, 'style={{ width }} className={`$1`}');
}

// 3. Migrate from className="w-[XX%]" to width="XX%" on all SortTH
c = c.replace(/className="w-\[50%\]"/g, 'width="50%"');
c = c.replace(/className="w-\[52%\]"/g, 'width="50%"');
c = c.replace(/className="w-\[8%\]"/g, 'width="8%"');
c = c.replace(/className="w-\[6%\]"/g, 'width="6%"');
c = c.replace(/className="w-\[11%\]"/g, 'width="11%"');
c = c.replace(/className="w-\[14%\]"/g, 'width="14%"');

// 4. PartyRow updates
if (!c.includes('branches?: string;')) {
    c = c.replace('party_name: string;', 'party_name: string;\\n  branches?: string;');
}

// Update Party Export table to include branches
c = c.replace(
    'Party: r.party_name,',
    'Party: r.party_name,\\n                  Branches: r.branches || "-",\\n'
);

// We need to inject Branches into Party Summary:
const partySortTHSearch = '<SortTH width="50%" label="Party" sortKey="party_name"';
const partySortTHTarget = '<SortTH width="30%" label="Party" sortKey="party_name"';
if (c.includes(partySortTHSearch)) {
    c = c.replace(partySortTHSearch, partySortTHTarget);
} else {
    // In case it's 52% or something else
    c = c.replace(/<SortTH width="5[02]%" label="Party" sortKey="party_name"/, partySortTHTarget);
}

// Inject branch into SortTH Headers for Party (only inject once)
const branchSortCode = `              <SortTH width="20%" label="Branches" sortKey="branches"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "branches",
                    dir: s?.key === "branches" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
`;

if (!c.includes('label="Branches"')) {
    // We inject right before <SortTH width="8%" label="Total LRs" BUT ONLY in Party-wise table context!
    // Easiest way is to find exactly this string in the Party table section
    const partyTotalLrsSearch = `<SortTH width="8%" label="Total LRs"
                sortKey="total_grs"
                activeKey={partySort?.key || ""}`;
                
    if (c.includes(partyTotalLrsSearch)) {
        c = c.replace(partyTotalLrsSearch, branchSortCode + partyTotalLrsSearch);
    }
}

// Update table body for branches
if (!c.includes('{r.branches || "-"}')) {
    c = c.replace(
        '<td className="border px-2 py-1">{r.party_name}</td>', 
        '<td className="border px-2 py-1 break-words">{r.party_name}</td>\\n                <td className="border px-2 text-xs py-1 text-center truncate">{r.branches || "-"}</td>'
    );
}

// Additional minor style fixes: use w-[8%] where needed just to be fully certain
fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Successfully rebuilt Reports component beautifully.");
