import React from "react";
import { EditState, GRRow } from "@/types/collections";
import { StatusFilter } from "@/types/constants";


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
      <td className="px-1 py-1.5 border-b border-r border-gray-200 relative">
        <input
          type="number"
          min="0"
          step="0.01"
          disabled={!canEdit}
          className={`w-full rounded px-1 py-1 sm:text-xs text-right border ${
            rowErrors?.tds_amount ? "border-red-500 bg-red-50" : "border-gray-300"
          }`}
          placeholder="0"
          title={`Max TDS: ₹${Math.round((r.total_freight || 0) * 0.02).toLocaleString('en-IN')} (2%)`}
          value={
            e?.tds_amount ??
            (r.tds_amount ? String(r.tds_amount) : "")
          }
          onChange={(ev) =>
            handleChange(r.gr_no, "tds_amount", ev.target.value)
          }
        />
        {rowErrors?.tds_amount && (
          <div className="absolute top-full left-0 z-10 mt-0.5 w-36 rounded bg-red-600 px-1.5 py-1 text-[10px] text-white shadow-lg">
            Max 2% (₹{Math.round((r.total_freight || 0) * 0.02).toLocaleString('en-IN')})
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
