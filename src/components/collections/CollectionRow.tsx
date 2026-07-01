import React, { useState, useRef, useEffect } from "react";
import { EditState, GRRow } from "@/types/collections";
import { StatusFilter } from "@/types/constants";
import { ArrowRightLeft, Loader2, Search } from "lucide-react";
import type { TransferBranchOption } from "@/services/branchTransfers";

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
  handleRequestTransfer: (r: GRRow, toBranchCode: string) => Promise<void>;
  transferBranches: TransferBranchOption[];
  requestingTransfer: string | null;
  transferEnabled: boolean;
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
  handleRequestTransfer,
  transferBranches,
  requestingTransfer,
  transferEnabled,
  status,
  days,
  overdue,
  rowClass,
  rowErrors
}: CollectionRowProps) {
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [selectedTransferBranch, setSelectedTransferBranch] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);
  const transferKey = `${r.branch_code}__${r.gr_no}`;
  const availableBranches = transferBranches
    .filter((branch) => branch.branch_code !== r.branch_code)
    .filter((branch) => {
      const query = branchSearch.trim().toLowerCase();
      if (!query) return true;
      return (
        branch.branch_code.toLowerCase().includes(query) ||
        (branch.branch_name || "").toLowerCase().includes(query) ||
        (branch.area_manager || "").toLowerCase().includes(query)
      );
    })
    .slice(0, 50);

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setShowTransferPopup(false);
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
      <td className="px-1 py-1.5 border-b border-r border-gray-200 relative text-center">
        <button
          disabled={!canEdit || !transferEnabled || requestingTransfer === transferKey}
          onClick={() => canEdit && transferEnabled && setShowTransferPopup(true)}
          className="inline-flex items-center justify-center gap-0.5 rounded border border-indigo-200 bg-indigo-50 px-1 py-1 text-[10px] sm:text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap w-full overflow-hidden"
          title={transferEnabled ? "Request branch transfer" : "Branch transfers are disabled by admin"}
        >
          {requestingTransfer === transferKey ? <Loader2 size={10} className="animate-spin flex-shrink-0" /> : <ArrowRightLeft size={10} className="flex-shrink-0" />}
          <span className="truncate">Transfer</span>
        </button>

        {showTransferPopup && (
          <div ref={popupRef} className="absolute z-50 top-10 right-0 w-72 bg-white border border-gray-200 shadow-xl p-3 rounded-lg animate-in fade-in zoom-in-95 duration-200 text-left">
            <h4 className="text-sm font-semibold text-gray-800">Branch Transfer</h4>
            <div className="mt-1 text-xs text-gray-500">
              {r.gr_no} from <span className="font-semibold">{r.branch_code}</span>
            </div>

            <div className="relative mt-3">
              <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                className="w-full rounded-md border border-gray-300 py-2 pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Search branch..."
                value={branchSearch}
                onChange={(ev) => setBranchSearch(ev.target.value)}
              />
            </div>

            <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-gray-200">
              {availableBranches.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-500">No branch found</div>
              ) : (
                availableBranches.map((branch) => (
                  <button
                    key={branch.branch_code}
                    onClick={() => setSelectedTransferBranch(branch.branch_code)}
                    className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-xs last:border-b-0 ${
                      selectedTransferBranch === branch.branch_code
                        ? "bg-indigo-50 text-indigo-700"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-semibold">{branch.branch_code}</div>
                    <div className="text-gray-500">{branch.branch_name || branch.branch_code}</div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowTransferPopup(false)} className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors">
                Cancel
              </button>
              <button
                disabled={!selectedTransferBranch || requestingTransfer === transferKey}
                onClick={async () => {
                  await handleRequestTransfer(r, selectedTransferBranch);
                  setShowTransferPopup(false);
                  setBranchSearch("");
                  setSelectedTransferBranch("");
                }}
                className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                OK
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
