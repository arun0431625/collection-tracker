import { useEffect, useState } from "react";
import { X, Calendar, DollarSign, Tag, FileText, Landmark } from "lucide-react";
import { fetchCollectionPaymentHistory, addCollectionPayment, type PaymentHistoryRecord } from "@/services/collections.api";
import { GRRow } from "@/types/collections";
import { toast } from "sonner";

type Props = {
  gr: GRRow;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export default function PaymentHistoryModal({ gr, canEdit, onClose, onUpdated }: Props) {
  const [history, setHistory] = useState<PaymentHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form fields
  const [receivedAmount, setReceivedAmount] = useState("");
  const [tdsAmount, setTdsAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("BANK");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refNo, setRefNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadHistory();
  }, [gr.gr_no, gr.branch_code]);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const data = await fetchCollectionPaymentHistory(gr.gr_no, gr.branch_code);
      setHistory(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load payment history");
    } finally {
      setLoadingHistory(false);
    }
  }

  // Calculate totals
  const totalFreight = Number(gr.total_freight) || 0;
  const collectedReceived = history.reduce((sum, item) => sum + Number(item.received_amount), 0);
  const collectedTds = history.reduce((sum, item) => sum + Number(item.tds_amount), 0);
  const totalCollected = collectedReceived + collectedTds;
  const balance = totalFreight - totalCollected;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amt = Number(receivedAmount) || 0;
    const tds = Number(tdsAmount) || 0;

    if (amt <= 0 && tds <= 0) {
      toast.error("Please enter a valid received or TDS amount");
      return;
    }

    if (amt + tds > balance) {
      toast.error(`Amount exceeds pending balance of ₹${balance.toLocaleString("en-IN")}`);
      return;
    }

    // Max 2% TDS validation (only if TDS is entered)
    if (tds > 0) {
      const maxTds = Math.round(totalFreight * 0.02 * 100) / 100;
      const currentTotalTds = collectedTds + tds;
      if (currentTotalTds > maxTds) {
        toast.error(`Total TDS exceeds 2% limit (Max ₹${maxTds.toLocaleString("en-IN")})`);
        return;
      }
    }

    setSaving(true);
    try {
      await addCollectionPayment(gr.gr_no, gr.branch_code, {
        payment_mode: paymentMode,
        received_amount: amt,
        tds_amount: tds,
        payment_date: paymentDate,
        ref_no: refNo.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      toast.success("Payment installment added successfully!");
      // Reset form
      setReceivedAmount("");
      setTdsAmount("");
      setRefNo("");
      setRemarks("");
      
      // Reload history & update main collections page list
      await loadHistory();
      onUpdated();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to add payment");
    } finally {
      setSaving(false);
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = d.getDate().toString().padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days}-${months[d.getMonth()]}-${d.getFullYear().toString().slice(-2)}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-800 text-white">
          <div>
            <h2 className="text-lg font-semibold">Payment Installments - GR: {gr.gr_no}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Party: {gr.party_name} | Branch: {gr.branch_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition rounded-lg p-1.5 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side: Summary & Installments History */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="border rounded-xl p-3 bg-slate-50">
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Total Freight</span>
                <div className="text-base font-bold text-gray-900 mt-1">₹ {totalFreight.toLocaleString("en-IN")}</div>
              </div>
              <div className="border rounded-xl p-3 bg-emerald-50">
                <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">Collected Recd</span>
                <div className="text-base font-bold text-emerald-800 mt-1">₹ {collectedReceived.toLocaleString("en-IN")}</div>
              </div>
              <div className="border rounded-xl p-3 bg-blue-50">
                <span className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider">Collected TDS</span>
                <div className="text-base font-bold text-blue-800 mt-1">₹ {collectedTds.toLocaleString("en-IN")}</div>
              </div>
              <div className="border rounded-xl p-3 bg-rose-50">
                <span className="text-[10px] text-rose-700 font-semibold uppercase tracking-wider">Pending Balance</span>
                <div className="text-base font-bold text-rose-800 mt-1">₹ {balance.toLocaleString("en-IN")}</div>
              </div>
            </div>

            {/* History Table */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Installment History</h3>
              {loadingHistory ? (
                <div className="text-center py-8 text-sm text-gray-500">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="border rounded-xl p-6 text-center text-sm text-gray-400 bg-slate-50">No payments added yet.</div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs font-semibold text-gray-600 border-b">
                      <tr>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Mode</th>
                        <th className="px-4 py-2 text-right">Received</th>
                        <th className="px-4 py-2 text-right">TDS</th>
                        <th className="px-4 py-2">Ref No</th>
                        <th className="px-4 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatDate(item.payment_date)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              item.payment_mode === "CASH" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                            }`}>
                              {item.payment_mode}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">₹ {item.received_amount?.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">₹ {item.tds_amount?.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{item.ref_no || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{item.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Add Installment Form */}
          {canEdit && balance > 0 && (
            <form onSubmit={handleSubmit} className="w-80 border-l border-slate-100 p-6 flex flex-col gap-4 bg-slate-50 overflow-y-auto">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Add Installment</h3>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Received Amount</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">TDS Amount</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input
                    type="number"
                    value={tdsAmount}
                    onChange={(e) => setTdsAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BANK">BANK</option>
                  <option value="CASH">CASH</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ref No</label>
                <input
                  type="text"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  placeholder="Txn ID, Cheque No, etc."
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Installment notes..."
                  rows={2}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {saving ? "Saving Installment..." : "Save Installment"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
