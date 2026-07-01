const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

const oldSort = `    // 🔹 Virtual % columns support
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

const newSort = `    // 🔹 Virtual % columns support
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

c = c.replace(oldSort, newSort);

// Add table-fixed to all 3 tables
c = c.replace(/<table className="min-w-full border-collapse text-sm">/g, '<table className="w-full table-fixed border-collapse text-sm">'); 
c = c.replace(/<table className="min-w-full border-collapse text-sm">/g, '<table className="w-full table-fixed border-collapse text-sm">'); 
c = c.replace(/<table className="min-w-full border-collapse text-sm">/g, '<table className="w-full table-fixed border-collapse text-sm">'); 

// Modify SortTH to accept className
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
      <span className={\`inline-flex items-center gap-1 \${align === "right" ? "justify-end w-full" : ""}\`}>`;

const newSortTH = `function SortTH({
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
      <span className={\`inline-flex items-center gap-1 \${align === "right" ? "justify-end w-full" : ""}\`}>`;

c = c.replace(oldSortTH, newSortTH);

// Set first SortTH in each block to w-1/3 or w-4/12
// They are exactly these:
c = c.replace(
  `              <SortTH
                label="Branch"
                sortKey="branch_code"`,
  `              <SortTH
                className="w-1/3 truncate"
                label="Branch"
                sortKey="branch_code"`
);

c = c.replace(
  `              <SortTH
                label="Area Manager"
                sortKey="area_manager"`,
  `              <SortTH
                className="w-1/3 truncate"
                label="Area Manager"
                sortKey="area_manager"`
);

c = c.replace(
  `              <SortTH
                label="Party"
                sortKey="party_name"`,
  `              <SortTH
                className="w-96 truncate"
                label="Party"
                sortKey="party_name"`
);


// Also on the td itself we need truncate so the long names don't expand the height necessarily, wait if heights expand it's fine, the user explicitly said "row ki height content k according flexible rahe but width fix rahni chahiye".
// With \`table-fixed\` and a fixed width on \`<th>\`, width will absolutely remain fixed and text will natively wrap extending row height!
// But just to make sure the large text wraps correctly and doesn't break out, word-break is good. But we don't strictly need it. 

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Reports.tsx sorting logic and table-fixed patched successfully!");
