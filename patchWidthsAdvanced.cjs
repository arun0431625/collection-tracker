const fs = require('fs');

let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

const new_sort = `    // 🔹 Virtual % columns support
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

c = c.replace(/    \/\/ 🔹 Virtual % columns support[\s\S]*?if \(key === "balance"\) \{[\s\S]*?\}/, new_sort);

// 2. Assign widths to columns without overwriting their specific sort parameters
c = c.replace(/<SortTH[^>]+/>/g, (tag) => {
    // Remove existing className="..."
    tag = tag.replace(/\s+className="[^"]+"/, '');
    
    let labelMatch = tag.match(/label="([^"]+)"/);
    let label = labelMatch ? labelMatch[1] : "";
    
    let width = "w-[10%]";
    if (["Branch", "Area Manager", "Party"].includes(label)) {
        width = "w-[40%]";
    } else if (["LR %", "Amount %"].includes(label)) {
        width = "w-[8%]";
    } else if (["Total Freight", "Balance"].includes(label)) {
        width = "w-[12%]";
    } else if (["Total LRs", "Collected LRs"].includes(label)) {
        width = "w-[11%]";
    }
    
    return tag.replace('<SortTH', \`<SortTH className="\${width}"\`);
});

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Columns width and Area Manager sorting patched!");
