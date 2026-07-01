const fs = require('fs');

let content = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// 1. Move Ageing Block
// Notice: Ageing block is bounded by '    {/* Ageing */}' up to '    {/* Filters */}' or end of the return statement.
// Wait! Let's find exactly the blocks.
let arr = content.split('    {/* Ageing */}');
if (arr.length === 2 && content.includes('{/* Branch-wise */}')) {
    let ageingBlockAndBelow = arr[1];
    // Find where the block ends. It ends at the last '      </div>' before the next chunk or whatever.
    // Actually, Ageing is the LAST section in the return! It finishes at '    </div>\n  );\n}'
    let ageingEndIndex = ageingBlockAndBelow.lastIndexOf('    </div>\n  );\n}');
    if (ageingEndIndex !== -1) {
        let ageingCode = ageingBlockAndBelow.substring(0, ageingEndIndex);
        let remainder = ageingBlockAndBelow.substring(ageingEndIndex);
        
        let beforeAgeing = arr[0];
        
        // Remove '    {/* Ageing */}' from its current location, and put it right BEFORE '    {/* Branch-wise */}'
        let chunks2 = beforeAgeing.split('    {/* Branch-wise */}');
        if (chunks2.length === 2) {
            content = chunks2[0] + 
                      '    {/* Ageing */}' + ageingCode + '\n' +
                      '    {/* Branch-wise */}' + chunks2[1] + remainder;
            console.log("Ageing moved successfully.");
        }
    }
}

// 2. Add Background Colors to all 4 Summary Headers
// Branch-wise wrapper
content = content.replace(
    '        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"',
    '        className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between items-center bg-slate-800 text-white rounded-t hover:bg-slate-700 transition"'
);
content = content.replace(
    '        <div className="flex items-center gap-3">',
    '        <div className="flex items-center gap-4 text-slate-100">'
);

// Area Manager
content = content.replace(
    '        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"',
    '        className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between items-center bg-slate-800 text-white rounded-t hover:bg-slate-700 transition"'
);

// Party-wise
content = content.replace(
    '        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"',
    '        className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between items-center bg-slate-800 text-white rounded-t hover:bg-slate-700 transition"'
);

// Ageing
content = content.replace(
    '        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between"',
    '        className="px-4 py-3 border-b font-bold text-sm cursor-pointer flex justify-between bg-slate-800 text-white rounded-t hover:bg-slate-700 transition"'
);

// Replace ALL Export Excel buttons to contrast beautifully against the dark header
content = content.replace(/bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition/g, 'bg-emerald-500 text-white px-3 py-1 rounded shadow border border-emerald-600 hover:bg-emerald-600 transition');

// 3. Fix SortTH functionality to enable Center & Middle Alignment
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
      className={\`px-3 py-2 cursor-pointer align-middle select-none border-b hover:bg-gray-100 \${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } \${className}\`}
    >
      <span className={\`inline-flex items-center gap-1 \${
        align === "right" ? "justify-end w-full" : align === "center" ? "justify-center w-full" : ""
      }\`}>
        {label}
        {isActive && (
          <span className="text-xs text-gray-500">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}`;

content = content.replace(oldSortTH, newSortTH);

// 4. Transform Area Manager percent static <th> into SortTH
const areaLROld = '<th className="px-3 py-2 text-right">LR %</th>';
const areaAmtOld = '<th className="px-3 py-2 text-right">Amount %</th>';
const areaLRNew = `<SortTH className="w-[6%]" label="LR %" sortKey="lr_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "lr_pct", dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc" }))} />`;
const areaAmtNew = `<SortTH className="w-[6%]" label="Amount %" sortKey="amt_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "amt_pct", dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc" }))} />`;

content = content.replace(areaLROld, areaLRNew);
content = content.replace(areaAmtOld, areaAmtNew);


// 5. Transform all explicit widths and align properties
// We strip all align="right"
content = content.replace(/align="right"/g, '');

// Re-map widths using precise replacing to avoid overlapping regex
content = content.replace(/className="w-\[40%\]"/g, 'className="w-[50%]"');
content = content.replace(/className="w-\[45%\]"/g, 'className="w-[50%]"');

// Add specific classes to headers
const headerLabels = [
    { search: '<SortTH\\s+label="Total LRs"', replace: '<SortTH className="w-[8%]" label="Total LRs"' },
    { search: '<SortTH\\s+label="Collected LRs"', replace: '<SortTH className="w-[8%]" label="Collected LRs"' },
    { search: '<SortTH\\s+label="LR %"', replace: '<SortTH className="w-[6%]" label="LR %"' },
    { search: '<SortTH\\s+label="Total Freight"', replace: '<SortTH className="w-[11%]" label="Total Freight"' },
    { search: '<SortTH\\s+label="Amount %"', replace: '<SortTH className="w-[6%]" label="Amount %"' },
    { search: '<SortTH\\s+label="Balance"', replace: '<SortTH className="w-[11%]" label="Balance"' }
];

headerLabels.forEach(({ search, replace }) => {
    // using global regex correctly formatted
    const regex = new RegExp(search, 'g');
    content = content.replace(regex, replace);
});

// 6. Fix sortData for area manager sorting (fallback to totalGRs)
const oldSortLogic = `// 🔹 Virtual % columns support
    if (key === "lr_pct") {
      av = a.total_grs ? a.collected_grs / a.total_grs : 0;
      bv = b.total_grs ? b.collected_grs / b.total_grs : 0;
    }

    if (key === "amt_pct") {
      av = a.total_freight ? a.collected / a.total_freight : 0;
      bv = b.total_freight ? b.collected / b.total_freight : 0;
    }

    // 🔹 Balance virtual column
    if (key === "balance") {
      av = (a.total_freight || 0) - (a.collected || 0);
      bv = (b.total_freight || 0) - (b.collected || 0);
    }`;

const newSortLogic = `// 🔹 Virtual % columns support
    if (key === "lr_pct") {
      const aT = a.total_grs ?? a.totalGRs ?? 0;
      const aC = a.collected_grs ?? a.collectedGRs ?? 0;
      const bT = b.total_grs ?? b.totalGRs ?? 0;
      const bC = b.collected_grs ?? b.collectedGRs ?? 0;
      av = aT ? aC / aT : 0;
      bv = bT ? bC / bT : 0;
    }

    if (key === "amt_pct") {
      const aF = a.total_freight ?? a.totalFreight ?? 0;
      const bF = b.total_freight ?? b.totalFreight ?? 0;
      av = aF ? (a.collected || 0) / aF : 0;
      bv = bF ? (b.collected || 0) / bF : 0;
    }

    // 🔹 Balance virtual column
    if (key === "balance") {
      const aF = a.total_freight ?? a.totalFreight ?? 0;
      const bF = b.total_freight ?? b.totalFreight ?? 0;
      av = aF - (a.collected || 0);
      bv = bF - (b.collected || 0);
    }`;

let fixedSort = content.replace(oldSortLogic, newSortLogic);
if(content !== fixedSort) {
    content = fixedSort;
} else {
    // try line by line fix
    content = content.replace(/av = a\.total_grs \? a\.collected_grs \/ a\.total_grs : 0;/g, 'const aT = a.total_grs ?? a.totalGRs ?? 0; const aC = a.collected_grs ?? a.collectedGRs ?? 0; av = aT ? aC / aT : 0;');
    content = content.replace(/bv = b\.total_grs \? b\.collected_grs \/ b\.total_grs : 0;/g, 'const bT = b.total_grs ?? b.totalGRs ?? 0; const bC = b.collected_grs ?? b.collectedGRs ?? 0; bv = bT ? bC / bT : 0;');
    content = content.replace(/av = a\.total_freight \? a\.collected \/ a\.total_freight : 0;/g, 'const aF = a.total_freight ?? a.totalFreight ?? 0; av = aF ? (a.collected || 0) / aF : 0;');
    content = content.replace(/bv = b\.total_freight \? b\.collected \/ b\.total_freight : 0;/g, 'const bF = b.total_freight ?? b.totalFreight ?? 0; bv = bF ? (b.collected || 0) / bF : 0;');
    content = content.replace(/av = \(a\.total_freight \|\| 0\) - \(a\.collected \|\| 0\);/g, 'const aF2 = a.total_freight ?? a.totalFreight ?? 0; av = aF2 - (a.collected || 0);');
    content = content.replace(/bv = \(b\.total_freight \|\| 0\) - \(b\.collected \|\| 0\);/g, 'const bF2 = b.total_freight ?? b.totalFreight ?? 0; bv = bF2 - (b.collected || 0);');
}


// Just checking if we overassigned width
content = content.replace(/className="w-\[6%\]" className="w-\[6%\]"/g, 'className="w-[6%]"');

fs.writeFileSync('src/pages/Reports.tsx', content);
console.log("Safe patch executed seamlessly");
