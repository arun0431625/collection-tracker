import re

with open('src/pages/Reports.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Fix Sorting logic for lr_pct and amt_pct in sortData
new_sort = '''    // 🔹 Virtual % columns support
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
    }'''
c = re.sub(r'    // 🔹 Virtual % columns support.*?if \(key === "balance"\) \{.*?\}', new_sort, c, flags=re.DOTALL)

# 2. Assign widths to columns without overwriting their specific sort parameters
def inject_class(match):
    tag = match.group(0)
    # Remove existing className="..." if any
    tag = re.sub(r'\s+className="[^"]+"', '', tag)
    
    label_match = re.search(r'label="([^"]+)"', tag)
    label = label_match.group(1) if label_match else ""
    
    width = "w-[10%]"
    if label in ["Branch", "Area Manager", "Party"]:
        width = "w-[40%]"
    elif label in ["LR %", "Amount %"]:
        width = "w-[8%]"
    elif label in ["Total Freight", "Balance"]:
        width = "w-[12%]"
    elif label in ["Total LRs", "Collected LRs"]:
        width = "w-[10%]"
    
    # insert className after <SortTH
    return tag.replace('<SortTH', f'<SortTH className="{width}"')

c = re.sub(r'<SortTH[^>]+/>', inject_class, c)

with open('src/pages/Reports.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Columns width and Area Manager sorting patched!")
