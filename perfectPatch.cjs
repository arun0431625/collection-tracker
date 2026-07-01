const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// 1. Move Ageing Block
const ageingStartToken = '    {/* Ageing */}';
const partyStartToken = '    {/* Party-wise */}';

let ageingStartIdx = c.indexOf(ageingStartToken);
let partyStartIdx = c.indexOf(partyStartToken);

if (ageingStartIdx !== -1 && partyStartIdx !== -1) {
    let ageingBlock = c.substring(ageingStartIdx, partyStartIdx);
    
    // Remove ageingBlock from original string
    c = c.substring(0, ageingStartIdx) + c.substring(partyStartIdx);
    
    // Insert ageingBlock before '{/* Branch-wise */}'
    const branchStartToken = '    {/* Branch-wise */}';
    let branchStartIdx = c.indexOf(branchStartToken);
    
    if (branchStartIdx !== -1) {
        c = c.substring(0, branchStartIdx) + ageingBlock + c.substring(branchStartIdx);
        console.log("Moved Ageing block successfully!");
    } else {
        console.log("Could not find Branch-wise token");
    }
} else {
    console.log("Could not find Ageing or Party-wise token");
}

// 2. Fix SortTH definitions (Center & Middle alignment)
const oldSortTH = `function SortTH({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={onClick}
      className={\`px-3 py-2 cursor-pointer select-none border-b hover:bg-gray-100 \${
        align === "right" ? "text-right" : "text-left"
      }\`}
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

const oldSortTH2 = `function SortTH({
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
      className={\`px-3 py-2 cursor-pointer align-middle text-center select-none border-b hover:bg-gray-100 \${className}\`}
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

c = c.replace(oldSortTH, newSortTH);
c = c.replace(oldSortTH2, newSortTH);
// Just in case there are minor whitespace differences, we regex it if it's not replaced:
if (!c.includes('align-middle text-center select-none')) {
    c = c.replace(/function SortTH[\s\S]*?<\/\s*th\s*>\s*;\s*\}/m, newSortTH);
}

// 3. Add Background Colors to all 4 Summary Headers
c = c.replace(
    /className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"/g,
    'className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between items-center bg-slate-800 text-white rounded-t hover:bg-slate-700 transition"'
);
c = c.replace(
    /className="flex items-center justify-between px-3 py-2 border-b font-semibold text-sm cursor-pointer"/g,
    'className="flex items-center justify-between px-4 py-3 border-b font-bold text-sm cursor-pointer bg-slate-800 text-white rounded-t hover:bg-slate-700 transition"'
);
c = c.replace(
    /className="px-3 py-2 border-b font-semibold text-sm"/g,
    'className="px-4 py-3 border-b font-bold text-sm bg-slate-800 text-white rounded-t"'
);

// Green Excel Buttons:
c = c.replace(/bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition/g, 'bg-emerald-500 text-white px-3 py-1 rounded shadow border border-emerald-600 hover:bg-emerald-600 transition');

// 4. Transform Area Manager percent static <th> into SortTH
const areaLROld = '<th className="px-3 py-2 text-right">LR %</th>';
const areaLRNew = \`<SortTH className="w-[6%]" label="LR %" sortKey="lr_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "lr_pct", dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc" }))} />\`;
c = c.replace(areaLROld, areaLRNew);

const areaAmtOld = '<th className="px-3 py-2 text-right">Amount %</th>';
const areaAmtNew = \`<SortTH className="w-[6%]" label="Amount %" sortKey="amt_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "amt_pct", dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc" }))} />\`;
c = c.replace(areaAmtOld, areaAmtNew);

// 5. Transform all explicit widths and align properties
c = c.replace(/align="right"/g, '');

c = c.replace(/className="w-\[42%\]" label="Branch"/g, 'className="w-[50%]" label="Branch"');
c = c.replace(/className="w-\[42%\]" label="Area Manager"/g, 'className="w-[50%]" label="Area Manager"');
c = c.replace(/className="w-\[42%\]" label="Party"/g, 'className="w-[52%]" label="Party"');

const headerLabels = [
    { search: '<SortTH\\s+label="Total LRs"', replace: '<SortTH className="w-[8%]" label="Total LRs"' },
    { search: '<SortTH\\s+label="Collected LRs"', replace: '<SortTH className="w-[8%]" label="Collected LRs"' },
    { search: '<SortTH\\s+label="LR %"', replace: '<SortTH className="w-[6%]" label="LR %"' },
    { search: '<SortTH\\s+label="Total Freight"', replace: '<SortTH className="w-[11%]" label="Total Freight"' },
    { search: '<SortTH\\s+label="Amount %"', replace: '<SortTH className="w-[6%]" label="Amount %"' },
    { search: '<SortTH\\s+label="Balance"', replace: '<SortTH className="w-[11%]" label="Balance"' }
];

headerLabels.forEach(({ search, replace }) => {
    const regex = new RegExp(search, 'g');
    c = c.replace(regex, replace);
});

// 6. Fix sortData logic for area manager
c = c.replace(/av = a\.total_grs \? a\.collected_grs \/ a\.total_grs : 0;/g, 'const aT = a.total_grs ?? a.totalGRs ?? 0; const aC = a.collected_grs ?? a.collectedGRs ?? 0; av = aT ? aC / aT : 0;');
c = c.replace(/bv = b\.total_grs \? b\.collected_grs \/ b\.total_grs : 0;/g, 'const bT = b.total_grs ?? b.totalGRs ?? 0; const bC = b.collected_grs ?? b.collectedGRs ?? 0; bv = bT ? bC / bT : 0;');
c = c.replace(/av = a\.total_freight \? a\.collected \/ a\.total_freight : 0;/g, 'const aF = a.total_freight ?? a.totalFreight ?? 0; av = aF ? (a.collected || 0) / aF : 0;');
c = c.replace(/bv = b\.total_freight \? b\.collected \/ b\.total_freight : 0;/g, 'const bF = b.total_freight ?? b.totalFreight ?? 0; bv = bF ? (b.collected || 0) / bF : 0;');
c = c.replace(/av = \(a\.total_freight \|\| 0\) - \(a\.collected \|\| 0\);/g, 'const aF2 = a.total_freight ?? a.totalFreight ?? 0; av = aF2 - (a.collected || 0);');
c = c.replace(/bv = \(b\.total_freight \|\| 0\) - \(b\.collected \|\| 0\);/g, 'const bF2 = b.total_freight ?? b.totalFreight ?? 0; bv = bF2 - (b.collected || 0);');

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Successfully rebuilt Reports component beautifully.");
