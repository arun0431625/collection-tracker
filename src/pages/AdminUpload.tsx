import { useState, useMemo, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { useBranch } from "@/context/BranchContext";
import { toast } from "sonner";
import {
  fetchExistingCollectionRows,
  insertCollections,
  updateCollectionFields,
  upsertCollections,
  type CollectionFieldUpdateRow,
  type UploadRow,
} from "@/services/admin";

// ─── Session Storage Persistence ───────────────────────────────────────
const STORAGE_KEY = "admin_upload_state";

type PersistedState = {
  stage: "IDLE" | "VALIDATED" | "DUPLICATES_CHECKED" | "DONE";
  totalRows: number;
  validCount: number;
  invalidCount: number;
  newCount: number;
  duplicateCount: number;
  newInsertAmount: number;
  overwriteOldAmount: number;
  overwriteNewAmount: number;
  overwriteNetImpact: number;
  collectionUpdatedCount: number;
  collectionImpactAmount: number;
  // Cached parsed data (survives reload)
  rawRowsCache: any[];
  validRowsCache: UploadRow[];
  fileName: string;
};

function saveState(state: PersistedState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage might be full for very large files, silently ignore
  }
}

function loadState(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function clearState() {
  sessionStorage.removeItem(STORAGE_KEY);
}

// ─── Utility Functions ─────────────────────────────────────────────────
function excelDateToISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  if (typeof val === "string") {
    const p = val.split(/[-/]/);
    if (p.length === 3 && p[2].length === 4) {
      return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }
  }
  return null;
}

function parseFreight(val: any): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val.replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseUploadRow(r: any): UploadRow | null {
  const row: UploadRow = {
    area_manager: String(r["Area Manager"] || "").trim(),
    branch_code: String(r["Payment Collection Branch"] || "").trim().toUpperCase(),
    gr_no: String(r["GR No"] || "").trim(),
    gr_date: excelDateToISO(r["GR Date"]) || "",
    party_name: String(r["Consignor Name (Paid) / Consignee Name (Topay)"] || "").trim(),
    total_freight: parseFreight(r["Total Freight Rs"]) as number,
    pay_mode: String(r["Pay Mode"] || "").trim(),
  };

  if (row.area_manager && row.branch_code && row.gr_no && row.gr_date &&
      row.party_name && row.total_freight !== null && row.pay_mode) {
    return row;
  }
  return null;
}

function buildCollectionFieldUpdates(rawRows: any[]) {
  const updates: CollectionFieldUpdateRow[] = [];
  rawRows.forEach((row) => {
    let paymentMode = String(row["Payment Mode"] || "").trim().toUpperCase();
    
    if (paymentMode === "CASH") {
        paymentMode = "CASH";
    } else if (["BANK", "ONLINE", "CHEQUE", "NEFT", "RTGS", "UPI", "TRANSFER", "IMPS"].includes(paymentMode)) {
        paymentMode = "BANK";
    }

    const receivedAmount = parseFreight(row["Received"]);
    const paymentDate = excelDateToISO(row["Payment Date"]);
    const refNo = String(row["Ref No"] || "").trim();

    if (!paymentMode || receivedAmount === null || !paymentDate || !refNo) return;

    updates.push({
      branch_code: String(row["Payment Collection Branch"] || "").trim().toUpperCase(),
      gr_no: String(row["GR No"] || "").trim().toUpperCase(),
      payment_mode: paymentMode,
      received_amount: receivedAmount,
      payment_date: paymentDate,
      ref_no: refNo,
      remarks: row["Remarks"] ? String(row["Remarks"]).trim() : null,
    });
  });
  return updates;
}

function deduplicateRows(rows: UploadRow[]): UploadRow[] {
  const map = new Map<string, UploadRow>();
  rows.forEach((row) => {
    map.set(`${row.branch_code}__${row.gr_no}`, row);
  });
  return Array.from(map.values());
}

// ─── Components ────────────────────────────────────────────────────────
function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  const toneClass =
    tone === "green" ? "text-green-600"
    : tone === "red" ? "text-red-600"
    : tone === "blue" ? "text-blue-600"
    : tone === "amber" ? "text-amber-600"
    : tone === "purple" ? "text-purple-600"
    : "text-gray-800";

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm text-center">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
export default function AdminUpload() {
  const { role } = useBranch();

  // Restore saved state on mount (survives Vite HMR reloads & tab switches)
  const saved = loadState();

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(saved?.fileName || "");
  const [rawRowsCache, setRawRowsCache] = useState<any[]>(saved?.rawRowsCache || []);
  const [validRowsCache, setValidRowsCache] = useState<UploadRow[]>(saved?.validRowsCache || []);

  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);

  const [insertProgress, setInsertProgress] = useState(0);
  const [insertTotal, setInsertTotal] = useState(0);
  const [checkingProgress, setCheckingProgress] = useState(0);
  const [checkingTotal, setCheckingTotal] = useState(0);

  const [stage, setStage] = useState<"IDLE" | "VALIDATED" | "DUPLICATES_CHECKED" | "DONE">(saved?.stage || "IDLE");

  const [totalRows, setTotalRows] = useState(saved?.totalRows || 0);
  const [validCount, setValidCount] = useState(saved?.validCount || 0);
  const [invalidCount, setInvalidCount] = useState(saved?.invalidCount || 0);
  const [newCount, setNewCount] = useState(saved?.newCount || 0);
  const [duplicateCount, setDuplicateCount] = useState(saved?.duplicateCount || 0);

  const [collectionUpdatedCount, setCollectionUpdatedCount] = useState(saved?.collectionUpdatedCount || 0);
  const [collectionImpactAmount, setCollectionImpactAmount] = useState(saved?.collectionImpactAmount || 0);

  const [newInsertAmount, setNewInsertAmount] = useState(saved?.newInsertAmount || 0);
  const [overwriteOldAmount, setOverwriteOldAmount] = useState(saved?.overwriteOldAmount || 0);
  const [overwriteNewAmount, setOverwriteNewAmount] = useState(saved?.overwriteNewAmount || 0);
  const [overwriteNetImpact, setOverwriteNetImpact] = useState(saved?.overwriteNetImpact || 0);

  // Persist state to sessionStorage whenever key values change
  const persistState = useCallback(() => {
    saveState({
      stage, totalRows, validCount, invalidCount, newCount, duplicateCount,
      newInsertAmount, overwriteOldAmount, overwriteNewAmount, overwriteNetImpact,
      collectionUpdatedCount, collectionImpactAmount,
      rawRowsCache, validRowsCache, fileName,
    });
  }, [stage, totalRows, validCount, invalidCount, newCount, duplicateCount,
      newInsertAmount, overwriteOldAmount, overwriteNewAmount, overwriteNetImpact,
      collectionUpdatedCount, collectionImpactAmount, rawRowsCache, validRowsCache, fileName]);

  useEffect(() => {
    if (stage !== "IDLE") {
      persistState();
    }
  }, [stage, persistState]);

  // Collection Field Preview
  const collectionFieldPreview = useMemo(() => {
    if (!rawRowsCache.length) return null;
    const updates = buildCollectionFieldUpdates(rawRowsCache);
    if (!updates.length) return null;

    const totalAmount = updates.reduce((sum, r) => sum + r.received_amount, 0);
    const uniqueBranches = new Set(updates.map((r) => r.branch_code)).size;
    const paymentModes = new Map<string, number>();
    updates.forEach((r) => {
      paymentModes.set(r.payment_mode, (paymentModes.get(r.payment_mode) || 0) + 1);
    });

    return { count: updates.length, totalAmount, uniqueBranches, paymentModes };
  }, [rawRowsCache]);

  // Branch Summary: unique branches in upload with GR counts + area managers
  const branchSummary = useMemo(() => {
    if (!validRowsCache.length) return null;
    const map = new Map<string, { areaManager: string; grCount: number; totalFreight: number }>();
    validRowsCache.forEach((row) => {
      const existing = map.get(row.branch_code);
      if (existing) {
        existing.grCount += 1;
        existing.totalFreight += row.total_freight || 0;
      } else {
        map.set(row.branch_code, {
          areaManager: row.area_manager,
          grCount: 1,
          totalFreight: row.total_freight || 0,
        });
      }
    });
    // Sort by branch code
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return {
      totalBranches: entries.length,
      branches: entries.map(([code, data]) => ({ code, ...data })),
    };
  }, [validRowsCache]);

  if (role !== "ADMIN") {
    return <div className="p-6 text-red-600">Access denied</div>;
  }

  // Flag: do we have cached data from a previous session (even if file input is empty)?
  const hasRestoredData = !file && rawRowsCache.length > 0 && stage !== "IDLE";

  async function handleValidate() {
    if (!file) return;

    setLoading(true);
    setTimeout(async () => {
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

        if (raw.length > 200000) {
          toast.error("Maximum 2,00,000 rows allowed per upload.");
          setLoading(false);
          return;
        }

        const validRows = raw.map((row) => parseUploadRow(row)).filter(Boolean) as UploadRow[];

        setRawRowsCache(raw);
        setValidRowsCache(validRows);
        setFileName(file.name);
        setTotalRows(raw.length);
        setValidCount(validRows.length);
        setInvalidCount(raw.length - validRows.length);
        setCollectionUpdatedCount(0);
        setCollectionImpactAmount(0);
        setStage("VALIDATED");
        toast.success("File validation complete!");
      } catch (err) {
        toast.error("Failed to parse the Excel file.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 50);
  }

  async function handleCheckDuplicates() {
    if (!validRowsCache.length) return;

    setLoading(true);
    setIsChecking(true);

    const validRows = validRowsCache;
    let newCounter = 0, duplicateCounter = 0;
    let newInsertTotal = 0, oldAmountTotal = 0, newAmountTotal = 0;

    const existingMap = new Map<string, number>();
    const rowsForLookup = validRows.map((row) => ({ branch_code: row.branch_code, gr_no: row.gr_no }));

    setCheckingTotal(rowsForLookup.length);
    setCheckingProgress(0);

    try {
      for (let i = 0; i < rowsForLookup.length; i += 250) {
        const chunk = rowsForLookup.slice(i, i + 250);
        const data = await fetchExistingCollectionRows(chunk);
        data.forEach((row) => {
          existingMap.set(`${row.branch_code}__${row.gr_no}`, Number(row.total_freight || 0));
        });
        setCheckingProgress((prev) => prev + chunk.length);
      }
    } catch (err) {
      setLoading(false);
      setIsChecking(false);
      toast.error(err instanceof Error ? err.message : "Duplicate check failed");
      return;
    }

    validRows.forEach((row) => {
      const key = `${row.branch_code}__${row.gr_no}`;
      const existingAmount = existingMap.get(key);
      if (existingAmount !== undefined) {
        duplicateCounter += 1;
        oldAmountTotal += existingAmount;
        newAmountTotal += row.total_freight || 0;
      } else {
        newCounter += 1;
        newInsertTotal += row.total_freight || 0;
      }
    });

    setNewCount(newCounter);
    setDuplicateCount(duplicateCounter);
    setNewInsertAmount(newInsertTotal);
    setOverwriteOldAmount(oldAmountTotal);
    setOverwriteNewAmount(newAmountTotal);
    setOverwriteNetImpact(newAmountTotal - oldAmountTotal);
    setStage("DUPLICATES_CHECKED");
    setLoading(false);
    setIsChecking(false);
    toast.success("Duplicate check complete!");
  }

  async function handleInsertOnlyNew() {
    if (!validRowsCache.length) return;
    try {
      setIsInserting(true);
      setInsertError(null);
      const validRows = deduplicateRows(validRowsCache);
      setInsertTotal(validRows.length);
      setInsertProgress(0);

      for (let i = 0; i < validRows.length; i += 1000) {
        const chunk = validRows.slice(i, i + 1000);
        await insertCollections(chunk);
        setInsertProgress((prev) => prev + chunk.length);
      }

      setStage("DONE");
      clearState();
      toast.success(`Insert completed! ${validRows.length} unique rows processed.`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Insert failed";
      toast.error(errMsg);
      setInsertError(errMsg);
    } finally {
      setIsInserting(false);
    }
  }

  async function handleInsertAndOverwrite() {
    if (!validRowsCache.length) return;
    try {
      setIsInserting(true);
      setInsertError(null);
      const validRows = deduplicateRows(validRowsCache);
      setInsertTotal(validRows.length);
      setInsertProgress(0);

      for (let i = 0; i < validRows.length; i += 1000) {
        const chunk = validRows.slice(i, i + 1000);
        await upsertCollections(chunk);
        setInsertProgress((prev) => prev + chunk.length);
      }

      setStage("DONE");
      clearState();
      toast.success(`Insert + Overwrite completed! ${validRows.length} unique rows processed.`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Overwrite failed";
      toast.error(errMsg);
      setInsertError(errMsg);
    } finally {
      setIsInserting(false);
    }
  }

  async function handleUpdateCollectionFields() {
    if (!rawRowsCache.length) return;
    try {
      setIsInserting(true);
      const updates = buildCollectionFieldUpdates(rawRowsCache);

      if (!updates.length) {
        toast.error("No valid collection field rows found. Ensure Payment Mode, Received, Payment Date, and Ref No columns are filled.");
        setIsInserting(false);
        return;
      }

      const validModes = ["CASH", "BANK"];
      const invalidRows = updates.filter(u => !validModes.includes(u.payment_mode));
      if (invalidRows.length > 0) {
          toast.error(`Found invalid payment mode value in Excel: "${invalidRows[0].payment_mode}" at GR No: ${invalidRows[0].gr_no}. Allowed mapping types: Cash, Online, Cheque, NEFT, RTGS, UPI...`);
          setIsInserting(false);
          return;
      }

      setInsertTotal(updates.length);
      setInsertProgress(0);

      let totalImpact = 0;
      let processedCount = 0;

      for (let i = 0; i < updates.length; i += 500) {
        const chunk = updates.slice(i, i + 500);
        try {
          await updateCollectionFields(chunk);
          processedCount += chunk.length;
          totalImpact += chunk.reduce((sum, row) => sum + row.received_amount, 0);
        } catch (chunkErr) {
          const errMsg = chunkErr instanceof Error ? chunkErr.message : "Unknown error";
          if (errMsg.includes("payment_mode_check")) {
            toast.error(`Payment Mode constraint error! The database only accepts CASH or BANK. Check row ${i + 1}.`);
          } else {
            toast.error(`Batch error at rows ${i + 1}-${i + chunk.length}: ${errMsg}`);
          }
          if (processedCount > 0) {
            setCollectionUpdatedCount(processedCount);
            setCollectionImpactAmount(totalImpact);
            toast.warning(`Partially updated ${processedCount} rows before the error.`);
          }
          setIsInserting(false);
          return;
        }
        setInsertProgress((prev) => prev + chunk.length);
      }

      setCollectionUpdatedCount(processedCount);
      setCollectionImpactAmount(totalImpact);
      toast.success(`Collection update complete! Updated: ${processedCount} rows, Total: Rs ${totalImpact.toLocaleString()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Collection update failed");
    } finally {
      setIsInserting(false);
    }
  }

  function downloadTemplate() {
    const sample = [{
      "Area Manager": "RAJ", "Payment Collection Branch": "SURAT",
      "GR No": "S123456", "GR Date": "01-01-2026",
      "Consignor Name (Paid) / Consignee Name (Topay)": "ABC TEXTILES",
      "Total Freight Rs": 5000, "Pay Mode": "Paid",
      "Payment Mode": "Cash", Received: 5000,
      "Payment Date": "01-01-2026", "Ref No": "UTR12345", Remarks: "Collected",
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "collections_template.xlsx");
  }

  function handleReset() {
    setFile(null);
    setFileName("");
    setRawRowsCache([]);
    setValidRowsCache([]);
    setStage("IDLE");
    setTotalRows(0);
    setValidCount(0);
    setInvalidCount(0);
    setNewCount(0);
    setDuplicateCount(0);
    setCollectionUpdatedCount(0);
    setCollectionImpactAmount(0);
    setNewInsertAmount(0);
    setOverwriteOldAmount(0);
    setOverwriteNewAmount(0);
    setOverwriteNetImpact(0);
    setInsertError(null);
    clearState();
    toast.info("Upload data cleared.");
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Admin Bulk Upload</h1>

      {/* Restored data banner */}
      {hasRestoredData && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            📦 Previous upload data restored: <strong>{fileName}</strong> ({totalRows.toLocaleString()} rows).
            You can continue from where you left off or click Reset to start fresh.
          </span>
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Reset
          </button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              if (f) {
                // New file selected, reset all state
                setRawRowsCache([]);
                setValidRowsCache([]);
                setCollectionUpdatedCount(0);
                setCollectionImpactAmount(0);
                setStage("IDLE");
                clearState();
              }
            }}
            className="text-sm"
          />

          <button
            disabled={!file || loading}
            onClick={handleValidate}
            className="rounded-lg bg-blue-600 px-5 py-2 text-white shadow-sm hover:bg-blue-700 transition-all duration-150 disabled:opacity-50"
          >
            {loading ? "Validating..." : "Validate"}
          </button>

          {stage === "VALIDATED" && (
            <div className="space-y-2">
              <button
                onClick={handleCheckDuplicates}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-white shadow-sm hover:bg-indigo-700 transition-all duration-150 disabled:opacity-50"
              >
                {loading ? "Checking..." : "Check Duplicates"}
              </button>

              {isChecking && (
                <>
                  <div className="w-full bg-gray-200 rounded h-3">
                    <div className="bg-indigo-600 h-3 rounded transition-all duration-300"
                      style={{ width: `${(checkingProgress / Math.max(checkingTotal, 1)) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500">{checkingProgress} / {checkingTotal} checked</div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {stage !== "IDLE" && (
            <button onClick={handleReset} className="px-4 py-2 rounded-md border bg-red-50 text-red-600 hover:bg-red-100 transition text-sm">
              Reset
            </button>
          )}
          <button onClick={downloadTemplate} className="px-4 py-2 rounded-md border bg-white hover:bg-gray-100 transition">
            Download Template
          </button>
        </div>
      </div>

      {/* Validation summary (shows after validate, even without duplicate check) */}
      {(stage === "VALIDATED" || stage === "DUPLICATES_CHECKED") && (
        <div className="grid grid-cols-5 gap-4 mt-4">
          <SummaryCard label="Total Rows" value={totalRows} />
          <SummaryCard label="Valid Rows" value={validCount} tone="green" />
          <SummaryCard label="Invalid Rows" value={invalidCount} tone="red" />
          <SummaryCard label="Unique Branches" value={branchSummary?.totalBranches || 0} tone="blue" />
          {stage === "DUPLICATES_CHECKED" && (
            <>
              <SummaryCard label="New GRs" value={newCount} tone="blue" />
              <SummaryCard label="Duplicate GRs" value={duplicateCount} tone="amber" />
            </>
          )}
        </div>
      )}

      {/* Branch Summary - shows after validation */}
      {(stage === "VALIDATED" || stage === "DUPLICATES_CHECKED") && branchSummary && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl shadow-md p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-teal-700">📍 Branch Summary ({branchSummary.totalBranches} branches)</h3>
            <span className="text-xs text-teal-600 bg-teal-100 px-3 py-1 rounded-full">
              New branches will be auto-created during upload
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-teal-100">
            <table className="min-w-full text-sm">
              <thead className="bg-teal-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-teal-800">#</th>
                  <th className="text-left px-3 py-2 font-medium text-teal-800">Branch Code</th>
                  <th className="text-left px-3 py-2 font-medium text-teal-800">Area Manager</th>
                  <th className="text-right px-3 py-2 font-medium text-teal-800">GRs</th>
                  <th className="text-right px-3 py-2 font-medium text-teal-800">Total Freight</th>
                </tr>
              </thead>
              <tbody>
                {branchSummary.branches.map((b, i) => (
                  <tr key={b.code} className={i % 2 === 0 ? "bg-white" : "bg-teal-50/50"}>
                    <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{b.code}</td>
                    <td className="px-3 py-1.5">{b.areaManager || <span className="text-red-500">Missing!</span>}</td>
                    <td className="px-3 py-1.5 text-right">{b.grCount.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right">₹ {b.totalFreight.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stage === "DUPLICATES_CHECKED" && (
        <div className="mt-4 space-y-8">
          <div className="flex gap-4 flex-wrap">
            <button onClick={handleInsertOnlyNew} disabled={isInserting}
              className="px-6 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50 shadow-md">
              {isInserting ? "Processing..." : "Insert New Only"}
            </button>
            <button onClick={handleInsertAndOverwrite} disabled={isInserting}
              className="px-6 py-2 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition disabled:opacity-50 shadow-md">
              {isInserting ? "Processing..." : "Insert + Overwrite"}
            </button>
            <button onClick={handleUpdateCollectionFields} disabled={isInserting || !collectionFieldPreview}
              className="px-6 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition disabled:opacity-50 shadow-md">
              {isInserting ? "Processing..." : "Update Collection Fields Only"}
            </button>
          </div>

          {isInserting && (
            <div className="bg-gray-100 rounded-xl p-4">
              <div className="text-sm text-gray-600 mb-2">Processing {insertProgress} / {insertTotal} rows...</div>
              <div className="w-full bg-gray-300 rounded h-3">
                <div className="bg-green-600 h-3 rounded transition-all duration-300"
                  style={{ width: `${(insertProgress / Math.max(insertTotal, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {insertError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="text-red-500 text-2xl mt-1">⚠️</div>
                <div className="w-full">
                  <h3 className="font-semibold text-red-700 text-lg">Insertion Failed: Detailed Error Report</h3>
                  <div className="bg-white text-red-900 mt-2 font-mono text-sm whitespace-pre-wrap p-4 rounded-lg border border-red-100 w-full overflow-x-auto">
                    {insertError}
                  </div>
                  <div className="text-sm text-red-600 mt-3 pt-3 border-t border-red-200">
                    <p><strong>Diagnosis:</strong> If this error mentions <code>collections_lrs_pkey</code>, it usually means your primary key setup and incoming data are out of sync.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {duplicateCount > 0 && (
            <div className="bg-white border rounded-2xl shadow-md p-6">
              <h3 className="text-red-600 font-semibold mb-4">Duplicate GR Financial Summary</h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase">Old Amount (Existing)</div>
                  <div className="text-lg font-semibold mt-1">Rs {overwriteOldAmount.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase">New Amount (File)</div>
                  <div className="text-lg font-semibold mt-1">Rs {overwriteNewAmount.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-500 uppercase">Net Impact</div>
                  <div className={`text-lg font-semibold mt-1 ${overwriteNetImpact >= 0 ? "text-green-600" : "text-red-600"}`}>
                    Rs {overwriteNetImpact.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collection Field Update Preview */}
          <div className="bg-purple-50 border border-purple-200 rounded-2xl shadow-md p-6">
            <h3 className="font-semibold text-purple-700 mb-4">Collection Field Update Preview</h3>
            {collectionFieldPreview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <SummaryCard label="GRs With Collection Data" value={collectionFieldPreview.count} tone="purple" />
                  <SummaryCard label="Total Collection Amount" value={`Rs ${collectionFieldPreview.totalAmount.toLocaleString()}`} tone="green" />
                  <SummaryCard label="Unique Branches" value={collectionFieldPreview.uniqueBranches} tone="blue" />
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <div className="text-xs text-gray-500 uppercase mb-2">Payment Modes Breakdown</div>
                  <div className="flex flex-wrap gap-3">
                    {Array.from(collectionFieldPreview.paymentModes.entries()).map(([mode, count]) => (
                      <span key={mode} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
                        {mode}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No collection field data found. Ensure "Payment Mode", "Received", "Payment Date", and "Ref No" columns are filled.</p>
            )}
            {collectionUpdatedCount > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-green-700 font-semibold mb-2">✅ Collection Update Result</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Rows Updated: <span className="font-bold text-green-700">{collectionUpdatedCount}</span></div>
                  <div>Total Amount: <span className="font-bold text-green-700">Rs {collectionImpactAmount.toLocaleString()}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Net Impact Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-md">
            <h3 className="font-semibold text-blue-700 mb-4">Net Impact Preview</h3>
            <div className="text-sm space-y-3">
              <div>New GR Count: <span className="ml-1 font-semibold text-green-600">{newCount}</span></div>
              <div>New Insert Amount: <span className="ml-1 font-semibold text-green-600">Rs {newInsertAmount.toLocaleString()}</span></div>
              <div>Overwrite GR Count: <span className="ml-1 font-semibold text-orange-600">{duplicateCount}</span></div>
              <div>Overwrite Net Impact:
                <span className={`ml-1 font-semibold ${overwriteNetImpact >= 0 ? "text-green-600" : "text-red-600"}`}>
                  Rs {overwriteNetImpact.toLocaleString()}
                </span>
              </div>
              <div className="border-t pt-2 mt-2">
                Total Net Impact: <span className="ml-1 font-bold text-blue-700">Rs {(newInsertAmount + overwriteNetImpact).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "DONE" && (
        <div className="text-green-700 font-semibold mt-4">
          Upload completed successfully! You can upload a new file if needed.
        </div>
      )}
    </div>
  );
}
