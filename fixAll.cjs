const fs = require('fs');
let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// ===== 1. Replace SortTH function entirely =====
const sortThStart = c.indexOf('function SortTH(');
const sortThEnd = c.indexOf('\n}\n', sortThStart);
if (sortThStart === -1 || sortThEnd === -1) {
  // try \r\n
  const sortThEnd2 = c.indexOf('\r\n}\r\n', sortThStart);
  if (sortThEnd2 !== -1) {
    c = c.substring(0, sortThStart) + `function SortTH({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  width,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onClick: () => void;
  width?: string;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={onClick}
      style={width ? { width } : undefined}
      className="px-2 py-2 cursor-pointer select-none border-b hover:bg-gray-100 text-center align-middle whitespace-nowrap"
    >
      <span className="inline-flex items-center justify-center w-full gap-1">
        {label}
        {isActive && (
          <span className="text-xs text-gray-500">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}` + c.substring(sortThEnd2 + 4);
    console.log("SortTH replaced (CRLF)!");
  } else {
    console.log("ERROR: Could not find SortTH end");
  }
} else {
  c = c.substring(0, sortThStart) + `function SortTH({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
  width,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
  onClick: () => void;
  width?: string;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th
      onClick={onClick}
      style={width ? { width } : undefined}
      className="px-2 py-2 cursor-pointer select-none border-b hover:bg-gray-100 text-center align-middle whitespace-nowrap"
    >
      <span className="inline-flex items-center justify-center w-full gap-1">
        {label}
        {isActive && (
          <span className="text-xs text-gray-500">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}` + c.substring(sortThEnd + 2);
  console.log("SortTH replaced (LF)!");
}

// ===== 2. Fix widths =====
// Branch table: name=40%, LR=7%, Coll LR=7%, LR%=5%, Freight=14%, Amt%=5%, Balance=14% (subtotal 92 + 8% slack)
// Area table: same
// Party table: name=25%, branch=15%, rest same

// All width replacements
c = c.replace(/width="50%" label="Branch"/g, 'width="40%" label="Branch"');
c = c.replace(/width="50%" label="Area Manager"/g, 'width="40%" label="Area Manager"');

// Total LRs => 7%, shorten label 
c = c.replace(/width="8%" label="Total LRs"/g, 'width="7%" label="Total LRs"');
// Collected LRs => 7%, shorten label
c = c.replace(/width="8%" label="Collected LRs"/g, 'width="7%" label="Coll. LRs"');
// LR% => 5%
c = c.replace(/width="6%" label="LR %"/g, 'width="5%" label="LR %"');
// Total Freight => 14%
c = c.replace(/width="11%" label="Total Freight"/g, 'width="14%" label="Total Freight"');
// Amount % => 5%
c = c.replace(/width="6%" label="Amount %"/g, 'width="5%" label="Amt %"');
c = c.replace(/width="6%" label="Amt %"/g, 'width="5%" label="Amt %"');
// Balance => 14%
c = c.replace(/width="11%" label="Balance"/g, 'width="14%" label="Balance"');

// Party name column
c = c.replace(/width="30%" label="Party"/g, 'width="25%" label="Party"');
// Branches label shortening
c = c.replace(/label="Branches"/g, 'label="Branch"');

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("All widths + SortTH fixed!");
