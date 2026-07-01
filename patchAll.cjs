const fs = require('fs');

let lines = fs.readFileSync('src/pages/Reports.tsx', 'utf8').split(/\r?\n/);

for (let i = 0; i < lines.length; i++) {
  // Sort Logic Fixes
  if (lines[i].includes('av = a.total_grs ? a.collected_grs / a.total_grs : 0;')) {
    lines[i] = '      const aT = a.total_grs ?? a.totalGRs ?? 0;\n      const aC = a.collected_grs ?? a.collectedGRs ?? 0;\n      av = aT ? aC / aT : 0;';
  }
  if (lines[i].includes('bv = b.total_grs ? b.collected_grs / b.total_grs : 0;')) {
    lines[i] = '      const bT = b.total_grs ?? b.totalGRs ?? 0;\n      const bC = b.collected_grs ?? b.collectedGRs ?? 0;\n      bv = bT ? bC / bT : 0;';
  }

  if (lines[i].includes('av = a.total_freight ? a.collected / a.total_freight : 0;')) {
    lines[i] = '      const aF = a.total_freight ?? a.totalFreight ?? 0;\n      av = aF ? (a.collected || 0) / aF : 0;';
  }
  if (lines[i].includes('bv = b.total_freight ? b.collected / b.total_freight : 0;')) {
    lines[i] = '      const bF = b.total_freight ?? b.totalFreight ?? 0;\n      bv = bF ? (b.collected || 0) / bF : 0;';
  }

  if (lines[i].includes('av = (a.total_freight || 0) - (a.collected || 0);')) {
    lines[i] = '      const aF2 = a.total_freight ?? a.totalFreight ?? 0;\n      av = aF2 - (a.collected || 0);';
  }
  if (lines[i].includes('bv = (b.total_freight || 0) - (b.collected || 0);')) {
    lines[i] = '      const bF2 = b.total_freight ?? b.totalFreight ?? 0;\n      bv = bF2 - (b.collected || 0);';
  }

  // Header Width Fixes
  if (lines[i].includes('<SortTH')) {
    // If it already has a className, remove it temporarily so we can standardize
    if (lines[i].includes('className=')) {
      lines[i] = lines[i].replace(/\s*className="[^"]+"/, '');
    }
  }
  
  if (lines[i].includes('label="Branch"') || lines[i].includes('label="Area Manager"') || lines[i].includes('label="Party"')) {
    lines[i] = lines[i].replace('<SortTH', '<SortTH className="w-[42%]"');
  }
  else if (lines[i].includes('label="LR %"') || lines[i].includes('label="Amount %"')) {
    lines[i] = lines[i].replace('<SortTH', '<SortTH className="w-[8%]"');
  }
  else if (lines[i].includes('label="Total Freight"') || lines[i].includes('label="Balance"')) {
    lines[i] = lines[i].replace('<SortTH', '<SortTH className="w-[11%]"');
  }
  else if (lines[i].includes('label="Total LRs"') || lines[i].includes('label="Collected LRs"')) {
    lines[i] = lines[i].replace('<SortTH', '<SortTH className="w-[10%]"');
  }
}

fs.writeFileSync('src/pages/Reports.tsx', lines.join('\n'));
console.log("Patched completely via line-by-line arrays");
