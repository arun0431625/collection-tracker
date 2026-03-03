import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
import { useBranch } from "../context/BranchContext";

/* ================= HELPERS ================= */

function excelDateToISO(val: any): string | null {
  if (!val) return null;

  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }

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
    return isNaN(n) ? null : n;
  }

  return null;
}

/* ================= TYPES ================= */

type UploadRow = {
  area_manager: string;
  branch_code: string;
  gr_no: string;
  gr_date: string;
  party_name: string;
  total_freight: number;
  pay_mode: string;
};

function parseAndValidateRow(r: any): UploadRow | null {
  const row: UploadRow = {
    area_manager: String(r["Area Manager"] || "").trim(),
    branch_code: String(r["Payment Collection Branch"] || "").trim().toUpperCase(),
    gr_no: String(r["GR No"] || "").trim(),
    gr_date: excelDateToISO(r["GR Date"]) || "",
    party_name: String(
      r["Consignor Name (Paid) / Consignee Name (Topay)"] || ""
    ).trim(),
    total_freight: parseFreight(r["Total Freight Rs"]),
    pay_mode: String(r["Pay Mode"] || "").trim(),
  };

  if (
    row.area_manager &&
    row.branch_code &&
    row.gr_no &&
    row.gr_date &&
    row.party_name &&
    row.total_freight !== null &&
    row.pay_mode
  ) {
    return row;
  }

  return null;
}

/* ================= COMPONENT ================= */

export default function AdminUpload() {
  const { role, branch } = useBranch();

  if (role !== "ADMIN") {
    return <div className="p-6 text-red-600">Access denied</div>;
  }

  function SummaryCard({ label, value, green, red, blue, amber }: any) {
    const color =
      green ? "text-green-700"
      : red ? "text-red-700"
      : blue ? "text-blue-700"
      : amber ? "text-amber-700"
      : "text-gray-800";

    return (
      <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className={`mt-2 text-2xl font-bold ${color}`}>
          {value}
        </div>
      </div>
    );
  }

  const [file, setFile] = useState<File | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicatePreview, setDuplicatePreview] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [insertProgress, setInsertProgress] = useState(0);
  const [insertTotal, setInsertTotal] = useState(0);
  const [collectionUpdatedCount, setCollectionUpdatedCount] = useState(0);
  const [collectionImpactAmount, setCollectionImpactAmount] = useState(0);
  const [stage, setStage] = useState<
    "IDLE" | "VALIDATED" | "DUPLICATES_CHECKED" | "DONE"
  >("IDLE");
  const [checkingProgress, setCheckingProgress] = useState(0);
  const [checkingTotal, setCheckingTotal] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [newInsertAmount, setNewInsertAmount] = useState(0);
  const [overwriteOldAmount, setOverwriteOldAmount] = useState(0);
  const [overwriteNewAmount, setOverwriteNewAmount] = useState(0);
  const [overwriteNetImpact, setOverwriteNetImpact] = useState(0);


  /* ================= VALIDATE ================= */

  async function handleValidate() {
    if (!file) return;
    setLoading(true);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (raw.length > 60000) {
      alert("Maximum 60,000 rows allowed per upload for performance stability.");
      setLoading(false);
      return;
    }

    const validRows = raw
      .map((r) => parseAndValidateRow(r))
      .filter(Boolean);

    setTotalRows(raw.length);
    setValidCount(validRows.length);
    setInvalidCount(raw.length - validRows.length);
    setStage("VALIDATED");
    setLoading(false);
  }

  /* ================= DUPLICATE CHECK ================= */

    async function handleCheckDuplicates() {
      if (!file) return;

      setLoading(true);
      setIsChecking(true);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const validRows = raw
        .map((r) => parseAndValidateRow(r))
        .filter(Boolean) as UploadRow[];

      let newCounter = 0;
      let duplicateCounter = 0;
      let preview: UploadRow[] = [];

      let newInsertTotal = 0;
      let oldAmountTotal = 0;
      let newAmountTotal = 0;
     
      const CHUNK = 100;
      let existingSet = new Set<string>();

      const grNos = validRows.map((r) => r.gr_no);

      setCheckingTotal(grNos.length);
      setCheckingProgress(0);

      for (let i = 0; i < grNos.length; i += CHUNK) {
        const chunk = grNos.slice(i, i + CHUNK);

        const { data, error } = await supabase
          .from("collections_lrs")
          .select("gr_no, branch_code, total_freight")
          .in("gr_no", chunk);

        if (error) {
          console.error(error);
          break;
        }

      data?.forEach((d: any) => {
        existingSet.add(`${d.branch_code}__${d.gr_no}`);
        oldAmountTotal += Number(d.total_freight || 0);
      });

        setCheckingProgress((prev) => prev + chunk.length);
      }

validRows.forEach((row) => {
  const key = `${row.branch_code}__${row.gr_no}`;

  if (existingSet.has(key)) {
    duplicateCounter++;
    newAmountTotal += row.total_freight || 0;

    if (preview.length < 20) preview.push(row);
  } else {
    newCounter++;
    newInsertTotal += row.total_freight || 0;
  }
});

      setNewCount(newCounter);
      setDuplicateCount(duplicateCounter);
      setDuplicatePreview(preview);
      setNewInsertAmount(newInsertTotal);
      setOverwriteOldAmount(oldAmountTotal);
      setOverwriteNewAmount(newAmountTotal);
      setOverwriteNetImpact(newAmountTotal - oldAmountTotal);


      setStage("DUPLICATES_CHECKED");
      setLoading(false);
      setIsChecking(false);
    }

  /* ================= INSERT NEW ================= */

    async function handleInsertOnlyNew() {
      if (!file) return;

      setIsInserting(true);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const validRows = raw
        .map((r) => parseAndValidateRow(r))
        .filter(Boolean) as UploadRow[];

      const CHUNK = 1000;
      setInsertTotal(validRows.length);
      setInsertProgress(0);

      for (let i = 0; i < validRows.length; i += CHUNK) {
      const chunk = validRows.slice(i, i + CHUNK);

        const { error } = await supabase
          .from("collections_lrs")
          .insert(chunk);

        if (error) {
          console.error("Insert error:", error);
          alert("Insert failed: " + error.message);
          return;
        }

        setInsertProgress((prev) => prev + chunk.length);
      }

      setIsInserting(false);
      setStage("DONE");
      alert("✅ Insert completed");
    }

  /* ================= INSERT + OVERWRITE ================= */

    async function handleInsertAndOverwrite() {
      if (!file) return;

      setIsInserting(true);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const validRows = raw
        .map((r) => parseAndValidateRow(r))
        .filter(Boolean) as UploadRow[];

      const CHUNK = 1000;
      setInsertTotal(validRows.length);
      setInsertProgress(0);

      for (let i = 0; i < validRows.length; i += CHUNK) {
        const chunk = validRows.slice(i, i + CHUNK);

        await supabase
          .from("collections_lrs")
          .upsert(chunk, { onConflict: "branch_code,gr_no" });

        setInsertProgress((prev) => prev + chunk.length);
      }


      setIsInserting(false);
      setStage("DONE");
      alert("✅ Insert + Overwrite completed");
    }

    async function handleUpdateCollectionFields() {
      if (!file) return;

      setIsInserting(true);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      let updatedCount = 0;
      let totalCollectionImpact = 0;

      setInsertTotal(raw.length);
      setInsertProgress(0);

      for (const r of raw) {
      const paymentMode = String(r["Payment Mode"] || "").trim();
      const receivedAmount = parseFreight(r["Received"]);
      const paymentDate = excelDateToISO(r["Payment Date"]);
      const refNo = String(r["Ref No"] || "").trim();

        const branchCode = String(r["Payment Collection Branch"] || "").trim().toUpperCase();
        const grNo = String(r["GR No"] || "").trim().toUpperCase();

        // STRICT COLLECTION VALIDATION
        if (!paymentMode || receivedAmount === null || !paymentDate || !refNo) {
          console.log("Invalid collection row skipped:", grNo);
          setInsertProgress((prev) => prev + 1);
          continue;
        }

        console.log("Updating:", branchCode, grNo);

        const { data, error } = await supabase
          .from("collections_lrs")
          .select("branch_code, gr_no")
          .eq("branch_code", branchCode)
          .eq("gr_no", grNo);

        if (error) {
          console.log("Select error:", error);
          continue;
        }

        if (data && data.length > 0) {
          const { error: updateError } = await supabase
            .from("collections_lrs")
            .update({
              payment_mode: paymentMode,
              received_amount: receivedAmount,
              payment_date: paymentDate,
              ref_no: refNo,
              remarks: r["Remarks"] ? String(r["Remarks"]).trim() : null,
            })
            .eq("branch_code", branchCode)
              .eq("gr_no", grNo);

          if (updateError) {
            console.log("Update error:", updateError);
          } else {
            updatedCount++;
            totalCollectionImpact += receivedAmount;
          }
        }

        setInsertProgress((prev) => prev + 1);
      }
      setCollectionUpdatedCount(updatedCount);
      setCollectionImpactAmount(totalCollectionImpact);

      setIsInserting(false);

      alert(
        `✅ Collection Update Complete\n
        Matched & Updated: ${updatedCount}\n
        Total Collection Amount: ₹ ${totalCollectionImpact.toLocaleString()}`
      );
    }

    /* ================= LOG ================= */

    async function writeLog(overwrite: boolean) {
    await supabase.from("upload_logs").insert({
      filename: file?.name || "unknown",
      uploaded_by: branch || "ADMIN",
      total_rows: totalRows,
      valid_rows: validCount,
      new_gr_count: newCount,
      overwrite_gr_count: overwrite ? duplicateCount : 0,

    });
  }

  /* ================= UI ================= */
    function downloadTemplate() {
    const sample = [
      {
        "Area Manager": "RAJ",
        "Payment Collection Branch": "SURAT",
        "GR No": "S123456",
        "GR Date": "01-01-2026",
        "Consignor Name (Paid) / Consignee Name (Topay)": "ABC TEXTILES",
        "Total Freight Rs": 5000,
        "Pay Mode": "Paid",

        // NEW COLLECTION COLUMNS
        "Payment Mode": "Online",
        "Received": 5000,
        "Payment Date": "01-01-2026",
        "Ref No": "UTR12345",
        "Remarks": "Collected"
      }
    ];


      const ws = XLSX.utils.json_to_sheet(sample);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");

      XLSX.writeFile(wb, "collections_template.xlsx");
    }

  return (
        <div className="p-6 space-y-4">
          <h1 className="text-xl font-semibold">📤 Admin Bulk Upload</h1>

          <div className="flex items-center justify-between flex-wrap gap-4">

      {/* LEFT SIDE */}
      <div className="flex items-center gap-3">

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />

      <button
        disabled={!file || loading}
        onClick={handleValidate}
        className="rounded-lg bg-blue-600 px-5 py-2 text-white shadow-sm 
                  hover:bg-blue-700 active:scale-95 transition-all duration-150"
      >
        {loading ? "Validating..." : "Validate"}
      </button>

      {stage === "VALIDATED" && (
        <div className="space-y-2">

      <button
        onClick={handleCheckDuplicates}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-white shadow-sm 
                  hover:bg-indigo-700 active:scale-95 transition-all duration-150"
      >
        {loading ? "Checking..." : "Check Duplicates"}
      </button>

          {isChecking && (
            <div className="w-full bg-gray-200 rounded h-3">
              <div
                className="bg-indigo-600 h-3 rounded transition-all duration-300"
                style={{
                  width: `${(checkingProgress / checkingTotal) * 100}%`,
                }}
              />
            </div>
          )}

          {isChecking && (
            <div className="text-xs text-gray-500">
              {checkingProgress} / {checkingTotal} checked
            </div>
          )}
        </div>
      )}
      </div>

      {/* RIGHT SIDE */}
      <button
        onClick={downloadTemplate}
        className="px-4 py-2 rounded-md border bg-white hover:bg-gray-100 transition"
      >
        ⬇ Download Template
      </button>

    </div>

{stage === "DUPLICATES_CHECKED" && (
  <div className="mt-8 space-y-8">

    {/* ACTION BUTTONS */}

    <div className="flex gap-4 mt-4">
    <button
      onClick={handleInsertOnlyNew}
      disabled={isInserting}
      className="px-6 py-2 rounded-xl bg-green-600 text-white font-medium 
                hover:bg-green-700 transition disabled:opacity-50 shadow-md"
    >
      {isInserting ? "Processing..." : "Insert New Only"}
    </button>

    <button
      onClick={handleInsertAndOverwrite}
      disabled={isInserting}
      className="px-6 py-2 rounded-xl bg-orange-500 text-white font-medium 
                hover:bg-orange-600 transition disabled:opacity-50 shadow-md"
    >
      {isInserting ? "Processing..." : "Insert + Overwrite"}
    </button>

    <button
      onClick={handleUpdateCollectionFields}
      disabled={isInserting}
      className="px-6 py-2 rounded-xl bg-blue-600 text-white font-medium 
                hover:bg-blue-700 transition disabled:opacity-50 shadow-md"
    >
      {isInserting ? "Processing..." : "Update Collection Fields"}
    </button>

      {isInserting && (
        <div className="bg-gray-100 rounded-xl p-4 mt-4">
          <div className="text-sm text-gray-600 mb-2">
            Processing {insertProgress} / {insertTotal} rows...
          </div>

          <div className="w-full bg-gray-300 rounded h-3">
            <div
              className="bg-green-600 h-3 rounded transition-all duration-300"
              style={{
                width: `${(insertProgress / insertTotal) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

    </div>

    {/* SUMMARY CARDS */}
    <div className="grid grid-cols-5 gap-4">
      <SummaryCard
        label="Total Rows"
        value={totalRows}
      />
      <SummaryCard
        label="Valid Rows"
        value={validCount}
        green
      />
      <SummaryCard
        label="Invalid Rows"
        value={invalidCount}
        red
      />
      <SummaryCard
        label="New GRs"
        value={newCount}
        blue
      />
      <SummaryCard
        label="Duplicate GRs"
        value={duplicateCount}
        amber
      />
    </div>

    {/* MAIN GRID SECTION */}
    <div className="col-span-12">

    {/* DUPLICATE FINANCIAL SUMMARY */}
    {duplicateCount > 0 && (
      <div className="bg-white border rounded-2xl shadow-md p-6">
        <h3 className="text-red-600 font-semibold mb-4">
          💰 Duplicate GR Financial Summary
        </h3>

        <div className="grid grid-cols-3 gap-6">

          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 uppercase">
              Old Amount (Existing)
            </div>
            <div className="text-lg font-semibold mt-1">
              ₹ {overwriteOldAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 uppercase">
              New Amount (File)
            </div>
            <div className="text-lg font-semibold mt-1">
              ₹ {overwriteNewAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500 uppercase">
              Net Impact
            </div>
            <div className={`text-lg font-semibold mt-1 ${
              overwriteNetImpact >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              ₹ {overwriteNetImpact.toLocaleString()}
            </div>
          </div>

        </div>
      </div>
    )}

      {/* RIGHT SIDE - NET IMPACT */}
      <div className="col-span-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-md mt-4">
          <h3 className="font-semibold text-blue-700 mb-4">
            📊 Net Impact Preview
          </h3>

          <div className="text-sm space-y-3">

            <div>
              New GR Count:
              <span className="ml-1 font-semibold text-green-600">
                {newCount}
              </span>
            </div>

            <div>
              New Insert Amount:
              <span className="ml-1 font-semibold text-green-600">
                ₹ {newInsertAmount.toLocaleString()}
              </span>
            </div>

            <div>
              Overwrite GR Count:
              <span className="ml-1 font-semibold text-orange-600">
                {duplicateCount}
              </span>
            </div>

            <div>
              Overwrite Net Impact:
              <span className={`ml-1 font-semibold ${
                overwriteNetImpact >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                ₹ {overwriteNetImpact.toLocaleString()}
              </span>
            </div>

            <div className="border-t pt-2 mt-2">
              Total Net Impact:
              <span className="ml-1 font-bold text-blue-700">
                ₹ {(newInsertAmount + overwriteNetImpact).toLocaleString()}
              </span>
            </div>

        {collectionUpdatedCount > 0 && (
          <>
            <div className="border-t pt-3 mt-3" />

            <div>
              Collection Rows Updated:
              <span className="ml-1 font-semibold text-blue-600">
                {collectionUpdatedCount}
              </span>
            </div>

            <div>
              Collection Update Amount:
              <span className="ml-1 font-semibold text-blue-600">
                ₹ {collectionImpactAmount.toLocaleString()}
              </span>
            </div>
          </>
        )}


          </div>

        </div>
      </div>

    </div>

  </div>
)}


      {stage === "DONE" && (
        <div className="text-green-700 font-semibold">
          ✅ Upload completed successfully
        </div>
      )}
    </div>
  );
}
function SummaryCard({ label, value, green, red, blue, amber }: any) {
  const color =
    green ? "text-green-600"
    : red ? "text-red-600"
    : blue ? "text-blue-600"
    : amber ? "text-amber-600"
    : "text-gray-800";

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm text-center">
      <div className="text-xs text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}
