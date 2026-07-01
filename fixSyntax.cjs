const fs = require('fs');
let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

c = c.replace('party_name: string;\\n  branches?: string;', 'party_name: string;\n  branches?: string;');
c = c.replace('Party: r.party_name,\\n                  Branches: r.branches || "-",\\n', 'Party: r.party_name,\n                  Branches: r.branches || "-",');
c = c.replace('<td className="border px-2 py-1 break-words">{r.party_name}</td>\\n                <td className="border px-2 text-xs py-1 text-center truncate">{r.branches || "-"}</td>', '<td className="border px-2 py-1 break-words">{r.party_name}</td>\n                <td className="border px-2 text-xs py-1 text-center truncate">{r.branches || "-"}</td>');

fs.writeFileSync('src/pages/Reports.tsx', c);
console.log("Syntax fixed!");
