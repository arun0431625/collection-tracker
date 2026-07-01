const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// 1. Rewrite SortTH Component to default to center/middle
const oldSortTH = /function SortTH\(\{[\s\S]*?\}\s*<\/(th|span)>\s*<\/th>\s*\);\s*\}/g;

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

c = c.replace(oldSortTH, newSortTH);


// 2. Rewrite the TR for all three tables manually to ensure absolute perfection!

const branchHeader = `            <tr className="text-left">
              <SortTH className="w-[42%]" label="Branch" sortKey="branch_code"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "branch_code",
                    dir: s?.key === "branch_code" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />
              <SortTH className="w-[10%]"
                label="Total LRs"
                sortKey="total_grs"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "total_grs",
                    dir: s?.key === "total_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH className="w-[10%]"
                label="Collected LRs"
                sortKey="collected_grs"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "collected_grs",
                    dir: s?.key === "collected_grs" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH className="w-[8%]"
                label="LR %"
                sortKey="lr_pct"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "lr_pct",
                    dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH className="w-[11%]"
                label="Total Freight"
                sortKey="total_freight"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "total_freight",
                    dir: s?.key === "total_freight" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH className="w-[8%]"
                label="Amount %"
                sortKey="amt_pct"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "amt_pct",
                    dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
              <SortTH className="w-[11%]"
                label="Balance"
                sortKey="balance"
                activeKey={branchSort?.key || ""}
                dir={branchSort?.dir || "asc"}
                onClick={() =>
                  setBranchSort(s => ({
                    key: "balance",
                    dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
                align="right"
              />
            </tr>`;

const branchHeaderNew = `            <tr className="text-center align-middle">
              <SortTH className="w-[44%]" label="Branch" sortKey="branch_code" activeKey={branchSort?.key || ""} dir={branchSort?.dir || "asc"} onClick={() => setBranchSort(s => ({ key: "branch_code", dir: s?.key === "branch_code" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[8%]" label="Total LRs" sortKey="total_grs" activeKey={branchSort?.key || ""} dir={branchSort?.dir || "asc"} onClick={() => setBranchSort(s => ({ key: "total_grs", dir: s?.key === "total_grs" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[8%]" label="Collected LRs" sortKey="collected_grs" activeKey={branchSort?.key || ""} dir={branchSort?.dir || "asc"} onClick={() => setBranchSort(s => ({ key: "collected_grs", dir: s?.key === "collected_grs" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[6%]" label="LR %" sortKey="lr_pct" activeKey={branchSort?.key || ""} dir={branchSort?.dir || "asc"} onClick={() => setBranchSort(s => ({ key: "lr_pct", dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[14%]" label="Total Freight" sortKey="total_freight" activeKey={branchSort?.key || ""} dir={branchSort?.dir || "asc"} onClick={() => setBranchSort(s => ({ key: "total_freight", dir: s?.key === "total_freight" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[6%]" label="Amount %" sortKey="amt_pct" activeKey={branchSort?.key || ""} dir={branchSort?.dir || "asc"} onClick={() => setBranchSort(s => ({ key: "amt_pct", dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[14%]" label="Balance" sortKey="balance" activeKey={branchSort?.key || ""} dir={branchSort?.dir || "asc"} onClick={() => setBranchSort(s => ({ key: "balance", dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc" }))} />
            </tr>`;

c = c.replace(branchHeader, branchHeaderNew);


const areaHeader = /<tr className="text-left">[\s\S]*?<SortTH className="w-\[42%\]" label="Area Manager"[\s\S]*?<SortTH\s+label="Balance"[\s\S]*?align="right"\s*\/>\s*<\/tr>/g;

const areaHeaderNew = `            <tr className="text-center align-middle">
              <SortTH className="w-[44%]" label="Area Manager" sortKey="area_manager" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "area_manager", dir: s?.key === "area_manager" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[8%]" label="Total LRs" sortKey="totalGRs" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "totalGRs", dir: s?.key === "totalGRs" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[8%]" label="Collected LRs" sortKey="collectedGRs" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "collectedGRs", dir: s?.key === "collectedGRs" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[6%]" label="LR %" sortKey="lr_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "lr_pct", dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[14%]" label="Total Freight" sortKey="totalFreight" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "totalFreight", dir: s?.key === "totalFreight" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[6%]" label="Amount %" sortKey="amt_pct" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "amt_pct", dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[14%]" label="Balance" sortKey="balance" activeKey={areaSort?.key || ""} dir={areaSort?.dir || "asc"} onClick={() => setAreaSort(s => ({ key: "balance", dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc" }))} />
            </tr>`;

c = c.replace(areaHeader, areaHeaderNew);

const partyHeader = /<tr className="text-left">[\s\S]*?<SortTH className="w-\[42%\]" label="Party"[\s\S]*?<SortTH\s+label="Balance"[\s\S]*?align="right"\s*\/>\s*<\/tr>/g;

const partyHeaderNew = `            <tr className="text-center align-middle">
              <SortTH className="w-[44%]" label="Party" sortKey="party_name" activeKey={partySort?.key || ""} dir={partySort?.dir || "asc"} onClick={() => setPartySort(s => ({ key: "party_name", dir: s?.key === "party_name" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[8%]" label="Total LRs" sortKey="total_grs" activeKey={partySort?.key || ""} dir={partySort?.dir || "asc"} onClick={() => setPartySort(s => ({ key: "total_grs", dir: s?.key === "total_grs" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[8%]" label="Collected LRs" sortKey="collected_grs" activeKey={partySort?.key || ""} dir={partySort?.dir || "asc"} onClick={() => setPartySort(s => ({ key: "collected_grs", dir: s?.key === "collected_grs" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[6%]" label="LR %" sortKey="lr_pct" activeKey={partySort?.key || ""} dir={partySort?.dir || "asc"} onClick={() => setPartySort(s => ({ key: "lr_pct", dir: s?.key === "lr_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[14%]" label="Total Freight" sortKey="total_freight" activeKey={partySort?.key || ""} dir={partySort?.dir || "asc"} onClick={() => setPartySort(s => ({ key: "total_freight", dir: s?.key === "total_freight" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[6%]" label="Amount %" sortKey="amt_pct" activeKey={partySort?.key || ""} dir={partySort?.dir || "asc"} onClick={() => setPartySort(s => ({ key: "amt_pct", dir: s?.key === "amt_pct" && s.dir === "asc" ? "desc" : "asc" }))} />
              <SortTH className="w-[14%]" label="Balance" sortKey="balance" activeKey={partySort?.key || ""} dir={partySort?.dir || "asc"} onClick={() => setPartySort(s => ({ key: "balance", dir: s?.key === "balance" && s.dir === "asc" ? "desc" : "asc" }))} />
            </tr>`;

c = c.replace(partyHeader, partyHeaderNew);

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Headers replaced thoroughly with absolute exact specs and middle alignment");
