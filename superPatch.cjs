const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// ==== 1. Fix SortTH definitions (Center & Middle alignment) ====
const oldSortTH = `function SortTH({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={onClick}
      className={\`px-3 py-2 cursor-pointer select-none border-b hover:bg-gray-100 \${
        align === "right" ? "text-right" : "text-left"
      } \${className}\`}
    >
      <span className={\`inline-flex items-center gap-1 \${align === "right" ? "justify-end w-full" : ""}\`}>
        {label}
        {isActive && (
          <span className="text-xs text-gray-500">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}`;

const newSortTH = `function SortTH({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align = "center",
  className = "",
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={onClick}
      className={\`px-3 py-2 align-middle text-center cursor-pointer select-none border-b hover:bg-gray-100 \${className}\`}
    >
      <span className="inline-flex items-center justify-center w-full gap-1">
        {label}
        {isActive && (
          <span className="text-xs text-gray-500">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}`;

if(c.includes('function SortTH')) {
    // Basic replacement for SortTH to ensure safety, or just standard regex
    c = c.replace(/function SortTH\(\{[\s\S]*?\}\s*<\/(th|span)>\s*<\/th>\s*\);\s*\}/, newSortTH);
}

// ==== 2. Headers background color (Professional Styling) ====
// We replace the header divs that have: className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors"
// Or whatever it is right now in HEAD~1
c = c.replace(/className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between/g, 'className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between bg-slate-800 text-white rounded-t hover:bg-slate-700 transition');
c = c.replace(/className="flex items-center justify-between px-3 py-2 border-b font-semibold text-sm cursor-pointer bg-slate-50/g, 'className="flex items-center justify-between px-4 py-3 border-b font-bold text-sm cursor-pointer bg-slate-800 text-white rounded-t');
// Specifically Ageing (which didn't have export buttons)
c = c.replace(/className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between"/g, 'className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between bg-slate-800 text-white rounded-t hover:bg-slate-700 transition"');


// ==== 3. Area Manager missing % sorts ====
const oldAreaLRPCT = '<th className="px-3 py-2 text-right">LR %</th>';
const newAreaLRPCT = `<SortTH className="w-[6%]" label="LR %" sortKey="lr_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "lr_pct", dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc" }))} />`;
c = c.replace(oldAreaLRPCT, newAreaLRPCT);

const oldAreaAmtPCT = '<th className="px-3 py-2 text-right">Amount %</th>';
const newAreaAmtPCT = `<SortTH className="w-[6%]" label="Amount %" sortKey="amt_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "amt_pct", dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc" }))} />`;
c = c.replace(oldAreaAmtPCT, newAreaAmtPCT);


// ==== 4. Exact Width tuning ====
// Name -> w-[50%]
// Total / Col LRs -> w-[8%]
// LR% / Amt% -> w-[6%]
// Freight / Balance -> w-[11%]

// Name
c = c.replace(/className="w-\[40%\]" label="Branch"/g, 'className="w-[50%]" label="Branch"');
c = c.replace(/className="w-\[40%\]" label="Area Manager"/g, 'className="w-[50%]" label="Area Manager"');
c = c.replace(/className="w-\[45%\]" label="Party"/g, 'className="w-[52%]" label="Party"');

// We add classNames to others by finding the strings
c = c.replace(/label="Total LRs"/g, 'className="w-[8%]" label="Total LRs"');
c = c.replace(/label="Collected LRs"/g, 'className="w-[8%]" label="Collected LRs"');
c = c.replace(/label="LR %"/g, 'className="w-[6%]" label="LR %"');
c = c.replace(/label="Total Freight"/g, 'className="w-[11%]" label="Total Freight"');
c = c.replace(/label="Amount %"/g, 'className="w-[6%]" label="Amount %"');
c = c.replace(/label="Balance"/g, 'className="w-[11%]" label="Balance"');
// Clean up any duplicates if they existed (e.g. className="w-[8%]" className="w-[x]")
c = c.replace(/className="w-\[\d+%\]" className="w-\[\d+%\]"/g, (match) => {
    return match.split(' ')[0]; // Keep first one
});

// Remove align="right" from SortTH calls so center takes over
c = c.replace(/align="right"/g, '');


// ==== 5. Move Ageing to Top ====
// We need to extract the entire '{/* Ageing */}' block and place it after '{/* KPI */}' block.
// Let's find index of '    {/* KPI */}' and the end of that div (which is \n    </div>\n)
// Then extract '{/* Ageing */}' to '    {/* Branch-wise */}'
// This requires some careful array/split logic.

let lines = c.split(/\\r?\\n/);
let kpiEnd = -1;
let ageingStart = -1;
let ageingEnd = -1;
let branchStart = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* Branch-wise */}')) branchStart = i;
    if (lines[i].includes('{/* Ageing*/}')) ageingStart = i; // "Ageing" wrapper is usually {/* Ageing */}
    if (lines[i].includes('{/* Ageing */}')) ageingStart = i;
}

// Find kpiEnd: Next empty line after KPI block
for (let i = 0; i < branchStart; i++) {
    if (lines[i].includes('{/* KPI */}')) {
        for (let j = i+1; j < branchStart; j++) {
            if (lines[j].includes('</div>')) {
               kpiEnd = j + 1;
            }
        }
    }
}
// Ageing might be below Area Manager. Let's find where Party ends or file ends to find Ageing end.
// We will just substring between "{/* Ageing */}" and "{/* Party-wise */}" (Assuming it's before party) or EOF.
// Wait, a much safer AST-like block extract:
let str = c;
let ageingMatch = str.match(/\\s*\\{\\/\\* Ageing \\*\\/\\}[\\s\\S]*?<div className="rounded border bg-white">[\\s\\S]*?([^<]*<\\/table>\\s*<\\/div>\\s*<\\/div>\\s*<\\/div>|[^<]*<\\/div>\\s*<\\/div>)/); // Fuzzy
// Let's not use regex for moving blocks. 
// I'll leave the block move to a separate step or just do it reliably:
// In Reports.tsx, { /* Ageing */ } is just below { /* KPIs */ } NO wait, previously Ageing was below Area? Let's check where it is.
fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Stage 1 done");
