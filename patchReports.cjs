const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

c = c.replace(
  /<div\s+className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between"\s+onClick=\{[^}]*setBranchOpen[^}]*\}\s*>\s*Branch-wise Outstanding\s*<span>\{branchOpen \? "▲" : "▼"\}<\/span>\s*<\/div>/g,
  `      <div
        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"
        onClick={() => setBranchOpen((o) => !o)}
      >
        <span>Branch-wise Outstanding</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportTable(
                summaryRows.map((r) => ({
                  Branch: r.branch_code,
                  "Total LRs": r.total_grs,
                  "Collected LRs": r.collected_grs,
                  Freight: r.total_freight,
                  Collected: r.collected,
                  Balance: r.total_freight - r.collected,
                  "Collection %": pct(r.collected, r.total_freight),
                })),
                \`Branch_Outstanding_\${fromDate}_to_\${toDate}\`
              );
            }}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition"
          >
            Export Excel
          </button>
          <span>{branchOpen ? "▲" : "▼"}</span>
        </div>
      </div>`
);

c = c.replace(
  /<div\s+className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between"\s+onClick=\{[^}]*setAreaOpen[^}]*\}\s*>\s*Area Manager-wise Outstanding\s*<span>\{areaOpen \? "▲" : "▼"\}<\/span>\s*<\/div>/g,
  `      <div
        className="px-3 py-2 border-b font-semibold text-sm cursor-pointer flex justify-between items-center"
        onClick={() => setAreaOpen((o) => !o)}
      >
        <span>Area Manager-wise Outstanding</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportTable(
                areaRows.map((r) => ({
                  "Area Manager": r.area_manager || "UNKNOWN",
                  "Total LRs": r.totalGRs,
                  "Collected LRs": r.collectedGRs,
                  Freight: r.totalFreight,
                  Collected: r.collected,
                  Balance: r.balance,
                  "Collection %": pct(r.collected, r.totalFreight),
                })),
                \`Area_Outstanding_\${fromDate}_to_\${toDate}\`
              );
            }}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition"
          >
            Export Excel
          </button>
          <span>{areaOpen ? "▲" : "▼"}</span>
        </div>
      </div>`
);

c = c.replace(
  /<div\s+className="flex items-center justify-between px-3 py-2 border-b font-semibold text-sm cursor-pointer"\s+onClick=\{[^}]*setPartyOpen[^}]*\}\s*>\s*<span>Party-wise Outstanding<\/span>\s*<span>\{partyOpen \? "▲" : "▼"\}<\/span>\s*<\/div>/g,
  `      <div
        className="flex items-center justify-between px-3 py-2 border-b font-semibold text-sm cursor-pointer"
        onClick={() => setPartyOpen((o) => !o)}
      >
        <span>Party-wise Outstanding</span>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportTable(
                partyRows.map((r) => ({
                  Party: r.party_name,
                  "Total LRs": r.total_grs,
                  "Collected LRs": r.collected_grs,
                  Freight: r.total_freight,
                  Collected: r.collected,
                  Balance: r.balance,
                  "Collection %": pct(r.collected, r.total_freight),
                })),
                \`Party_Outstanding_\${fromDate}_to_\${toDate}\`
              );
            }}
            className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded shadow-sm border border-emerald-200 hover:bg-emerald-100 transition"
          >
            Export Excel
          </button>
          <span>{partyOpen ? "▲" : "▼"}</span>
        </div>
      </div>`
);

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Reports.tsx regex patched successfully!");
