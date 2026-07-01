const fs = require('fs');

let payload = fs.readFileSync('src/pages/Reports.tsx', 'utf8');

const branchHeaderStr = `              <SortTH width="15%" label="Branches" sortKey="branches"
                activeKey={partySort?.key || ""}
                dir={partySort?.dir || "asc"}
                onClick={() =>
                  setPartySort(s => ({
                    key: "branches",
                    dir: s?.key === "branches" && s.dir === "asc" ? "desc" : "asc",
                  }))
                }
              />`;

if (!payload.includes('label="Branches"')) {
    // Find the end of Party SortTH block, then inject Branches SortTH
    let searchSegment = payload.substring(payload.indexOf('sortKey="party_name"'));
    let boundaryIdx = searchSegment.indexOf('/>');
    
    let insertionIdx = payload.indexOf('sortKey="party_name"') + boundaryIdx + 2;
    payload = payload.substring(0, insertionIdx) + "\n" + branchHeaderStr + payload.substring(insertionIdx);
    
    fs.writeFileSync('src/pages/Reports.tsx', payload);
    console.log("Branch header injected!");
} else {
    console.log("Already present!");
}
