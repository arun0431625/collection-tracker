const fs = require('fs');
let c = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

// Find the party export onClick handler and replace it
const oldOnClick = `onClick={(e) => {
              e.stopPropagation();
              exportTable(
                partyRows.map((r) => ({
                  Party: r.party_name,`;

const newExportCode = `onClick={async (e) => {
              e.stopPropagation();
              // Fetch ALL party rows (bypass Supabase 1000-row default limit)
              let allParty: any[] = [];
              let from = 0;
              const chunk = 1000;
              while (true) {
                const { data } = await supabase.rpc("get_party_outstanding", {
                  p_branch_code: role === "ADMIN" ? null : branch,
                  p_from_date: fromDate,
                  p_to_date: toDate,
                  p_search: null,
                }).range(from, from + chunk - 1);
                if (!data || data.length === 0) break;
                allParty = allParty.concat(data);
                if (data.length < chunk) break;
                from += chunk;
              }
              exportTable(
                allParty.map((r: any) => ({
                  Party: r.party_name,`;

// Normalize line endings for matching
const cNorm = c.replace(/\r\n/g, '\n');
const oldNorm = oldOnClick.replace(/\r\n/g, '\n');

if (cNorm.includes(oldNorm)) {
  c = cNorm.replace(oldNorm, newExportCode);
  fs.writeFileSync('src/pages/Reports.tsx', c);
  console.log("Party export updated to fetch all rows!");
} else {
  console.log("ERROR: Could not find party export onClick pattern");
  // Debug: show what's around "partyRows.map"
  const idx = cNorm.indexOf('partyRows.map');
  if (idx !== -1) {
    console.log("Context around partyRows.map:");
    console.log(cNorm.substring(idx - 200, idx + 100));
  }
}
