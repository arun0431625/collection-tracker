import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveBranchTransferRequest,
  fetchBranchTransferRequests,
  rejectBranchTransferRequest,
  type BranchTransferRequest,
} from "@/services/branchTransfers";

const STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED"] as const;

export default function BranchTransfers() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("PENDING");
  const [requests, setRequests] = useState<BranchTransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadRequests(nextStatus = status) {
    try {
      setLoading(true);
      const data = await fetchBranchTransferRequests(nextStatus);
      setRequests(data);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load transfer requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests(status);
  }, [status]);

  async function handleApprove(id: string) {
    try {
      setProcessingId(id);
      await approveBranchTransferRequest(id);
      toast.success("Transfer approved.");
      await loadRequests();
    } catch (error: any) {
      toast.error(error?.message || "Failed to approve transfer.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt("Reject reason (optional)") || "";
    try {
      setProcessingId(id);
      await rejectBranchTransferRequest(id, reason);
      toast.success("Transfer rejected.");
      await loadRequests();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject transfer.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Branch Transfer Requests</h1>
          <div className="text-xs text-gray-500 mt-0.5">
            Approve or reject branch change requests raised from Collections.
          </div>
        </div>
        <button
          onClick={() => void loadRequests()}
          className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {STATUS_OPTIONS.map((item) => (
          <button
            key={item}
            onClick={() => setStatus(item)}
            className={`rounded px-3 py-1.5 text-xs font-medium border ${
              status === item
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-800 text-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">GR No</th>
              <th className="px-3 py-2 text-left">Party</th>
              <th className="px-3 py-2 text-left">From Branch</th>
              <th className="px-3 py-2 text-left">To Branch</th>
              <th className="px-3 py-2 text-right">Freight</th>
              <th className="px-3 py-2 text-left">Requested By</th>
              <th className="px-3 py-2 text-left">Requested At</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-gray-500">
                  <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
                  Loading requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-gray-500">
                  No {status.toLowerCase()} transfer requests.
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold">{request.gr_no}</td>
                  <td className="px-3 py-2">{request.party_name || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{request.from_branch_code}</div>
                    <div className="text-xs text-gray-500">{request.from_branch_name || request.from_branch_code}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{request.to_branch_code}</div>
                    <div className="text-xs text-gray-500">{request.to_branch_name || request.to_branch_code}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    Rs {Number(request.total_freight || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2 text-xs">{request.requested_by_email || "-"}</td>
                  <td className="px-3 py-2 text-xs">
                    {new Date(request.requested_at).toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      request.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : request.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {request.status === "PENDING" ? (
                      <div className="flex justify-center gap-2">
                        <button
                          disabled={processingId === request.id}
                          onClick={() => void handleApprove(request.id)}
                          className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {processingId === request.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Approve
                        </button>
                        <button
                          disabled={processingId === request.id}
                          onClick={() => void handleReject(request.id)}
                          className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <X size={13} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">
                        {request.reject_reason || "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
