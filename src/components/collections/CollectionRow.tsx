import React, { useState, useRef, useEffect } from "react";
import { EditState, GRRow } from "@/types/collections";
import { StatusFilter } from "@/types/constants";
import { Check, Loader2 } from "lucide-react";

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const days = d.getDate().toString().padStart(2, '0');
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[d.getMonth()];
  const y = d.getFullYear().toString().slice(-2);
  return `${days}-${m}-${y}`;
}

type CollectionRowProps = {
  r: GRRow;
  e: EditState;
  canEdit: boolean;
  savingRow: string | null;
  savedRow: string | null;
  handleChange: (grNo: string, field: keyof EditState, value: string) => void;
  handleSave: (r: GRRow) => void;
  status: StatusFilter;
  days: number;
  overdue: boolean;
  rowClass: string;
  rowErrors: Partial<Record<keyof EditState, boolean>>;
};

export const CollectionRow = React.memo(function CollectionRow({
  r,
  e,
  canEdit,
  savingRow,
  savedRow,
  handleChange,
  handleSave,
  status,
  days,
  overdue,
  rowClass,
  rowErrors
}: CollectionRowProps) {
  const [showRemarkPopup, setShowRemarkPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setShowRemarkPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <tr className={`${rowClass} transition-colors duration-150`}>
      <td className="px-2 py-1.5 border-b border-r border-gray-200 font-medium text-gray-900">{r.gr_no}</td>
      <td className="px-2 py-1.5 border-b border-r border-gray-200 text-gray-600 whitespace-nowrap">{formatDate(r.gr_date)}</td>
      <td className="px-2 py-1.5 border-b border-r border-gray-200 text-gray-800 whitespace-normal break-words">{r.party_name}</td>
      <td className="px-2 py-1.5 border-b border-r border-gray-200 text-right font-semibold text-gray-900">
        ₹ {r.total_freight?.toLocaleString("en-IN")}
      </td>
      <td className="px-1 py-1.5 border-b border-r border-gray-200 text-gray-600 whitespace-nowrap text-xs">{r.pay_mode}</td>
      <td className="px-1 py-1.5 border-b border-r border-gray-200">
        <select
          disabled={!canEdit}
          className={`w-full rounded px-1 py-1 text-xs border ${
            rowErrors?.payment_mode ? "border-red-500 bg-red-50" : "border-gray-300"
          }`}
          value={e?.payment_mode ?? r.payment_mode ?? ""}
          onChange={(ev) =>
            handleChange(r.gr_no, "payment_mode", ev.target.value)
          }
        >
          <option value="">—</option>
          <option value="CASH">CASH</option>
          <option value="BANK">BANK</option>
        </select>
      </td>
      <td className="px-1 py-1.5 border-b border-r border-gray-200">
        <input
          type="number"
          disabled={!canEdit}
          className={`w-full rounded px-1 py-1 sm:text-xs text-right border ${
            rowErrors?.received_amount ? "border-red-500 bg-red-50" : "border-gray-300"
          }`}
          value={
            e?.received_amount ??
            (r.received_amount !== null ? String(r.received_amount) : "")
          }
          onChange={(ev) =>
            handleChange(r.gr_no, "received_amount", ev.target.value)
          }
        />
      </td>
      <td className="px-1 py-1.5 border-b border-r border-gray-200">
        <input
          type="date"
          disabled={!canEdit}
          className={`w-full rounded border px-0 py-1 ${
            (e?.payment_date ?? r.payment_date) 
              ? "text-[13px] tracking-tight text-gray-900" 
              : "text-transparent focus:text-gray-900"
          } ${
            rowErrors?.payment_date ? "border-red-500 bg-red-50" : "border-gray-300"
          }`}
          value={e?.payment_date ?? r.payment_date ?? ""}
          onChange={(ev) =>
            handleChange(r.gr_no, "payment_date", ev.target.value)
          }
        />
      </td>
      <td className="px-1 py-1.5 border-b border-r border-gray-200">
        <input
          type="text"
          disabled={!canEdit}
          className={`w-full rounded px-1 py-1 text-xs border ${
            rowErrors?.ref_no ? "border-red-500 bg-red-50" : "border-gray-300"
          }`}
          value={e?.ref_no ?? r.ref_no ?? ""}
          onChange={(ev) =>
            handleChange(r.gr_no, "ref_no", ev.target.value)
          }
        />
      </td>
      <td className="px-2 py-1.5 border-b border-r border-gray-200 relative">
        <button
          onClick={() => canEdit && setShowRemarkPopup(true)}
          className="text-xs text-indigo-600 hover:text-indigo-800 truncate max-w-[80px] block text-left"
          title={e?.remarks ?? r.remarks ?? "Add remark"}
        >
          {e?.remarks ?? r.remarks ? (e?.remarks ?? r.remarks) : "+ Remark"}
        </button>

        {showRemarkPopup && (
          <div ref={popupRef} className="absolute z-50 top-10 right-0 w-56 bg-white border border-gray-200 shadow-xl p-3 rounded-lg animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Edit Remarks</h4>
            <textarea
              disabled={!canEdit}
              className="w-full text-sm border p-2 mb-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              rows={3}
              placeholder="Enter remarks..."
              value={e?.remarks ?? r.remarks ?? ""}
              onChange={(ev) => handleChange(r.gr_no, "remarks", ev.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRemarkPopup(false)} className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors">
                Cancel
              </button>
              <button
                disabled={!canEdit || savingRow === r.gr_no}
                onClick={() => {
                  setShowRemarkPopup(false);
                  handleSave(r);
                }}
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors shadow-sm flex items-center gap-1"
              >
                {savingRow === r.gr_no ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
            </div>
          </div>
        )}
      </td>
      <td className="px-1 py-1.5 border-b border-r border-gray-200 text-[11px] font-semibold text-center align-middle whitespace-normal break-words">
        {overdue ? (
          <span className="text-red-600">OVERDUE<br/>{days}d</span>
        ) : status === "COLLECTED" ? (
          <span className="text-emerald-600">Collected</span>
        ) : status === "PARTIAL" ? (
          <span className="text-amber-600">Partial<br/>{days}d</span>
        ) : (
          <span className="text-gray-600">Pending<br/>{days}d</span>
        )}
      </td>
      <td className="px-1 py-1.5 border-b border-gray-200 text-center">
        <button
          disabled={!canEdit || savingRow === r.gr_no || savedRow === r.gr_no}
          onClick={() => handleSave(r)}
          className={`rounded px-3 py-1 text-xs transition ${
            savedRow === r.gr_no
              ? "bg-green-600 text-white"
              : canEdit
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
          }`}
        >
          {savingRow === r.gr_no ? "Saving…" : savedRow === r.gr_no ? "Saved ✓" : "Save"}
        </button>
      </td>
    </tr>
  );
});
