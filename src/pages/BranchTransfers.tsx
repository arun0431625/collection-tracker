import React, { useState, useEffect } from "react";
import { Search, Loader2, ArrowRight, Trash2, ArrowLeft, Clipboard, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { 
  searchGRForAdmin, 
  searchGRsBulkForAdmin, 
  updateGRsBranchBulk, 
  deleteGRsForAdmin 
} from "@/services/admin";
import { fetchAllBranchesLookup } from "@/services/collections.api";

type GRSearchResult = {
  gr_no: string;
  branch_code: string;
  party_name: string;
  total_freight: number;
};

type Mode = "CHOOSE" | "TRANSFER" | "DELETE";

export default function BranchTransfers() {
  const [mode, setMode] = useState<Mode>("CHOOSE");
  const [isBulkInput, setIsBulkInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkQuery, setBulkQuery] = useState("");
  
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GRSearchResult[]>([]);
  
  const [branches, setBranches] = useState<{branch_code: string, branch_name: string}[]>([]);
  const [updating, setUpdating] = useState(false);
  
  // Checkbox selections: Record of GR string key => boolean
  // key format: `${gr_no}_${branch_code}`
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [targetBranch, setTargetBranch] = useState("");

  useEffect(() => {
    fetchAllBranchesLookup()
      .then(lookup => {
        const branchList = Array.from(lookup.entries()).map(([code, data]) => ({
          branch_code: code,
          branch_name: data.branch_name
        }));
        branchList.sort((a, b) => a.branch_code.localeCompare(b.branch_code));
        setBranches(branchList);
      })
      .catch(err => console.error("Failed to fetch branches", err));
  }, []);

  // Clean selections and results on mode change
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSearchResults([]);
    setSelectedRows({});
    setSearchQuery("");
    setBulkQuery("");
    setTargetBranch("");
  };

  // Add individual search result
  async function handleSingleSearch(e: React.FormEvent) {
    e.preventDefault();
    const cleanGr = searchQuery.trim().toUpperCase();
    if (!cleanGr) return;

    // Avoid duplicates in current working list
    if (searchResults.some(r => r.gr_no === cleanGr)) {
      toast.info(`GR ${cleanGr} is already in the list.`);
      setSearchQuery("");
      return;
    }
    
    setSearching(true);
    try {
      const results = await searchGRForAdmin(cleanGr);
      if (results.length === 0) {
        toast.error(`No GR found matching "${cleanGr}"`);
      } else {
        const mapped = results.map((r: any) => ({
          gr_no: r.gr_no,
          branch_code: r.branch_code,
          party_name: r.party_name || "",
          total_freight: Number(r.total_freight) || 0
        }));
        
        setSearchResults(prev => [...mapped, ...prev]);
        // Auto-select newly added GR
        mapped.forEach(item => {
          setSelectedRows(prev => ({ ...prev, [`${item.gr_no}_${item.branch_code}`]: true }));
        });
        toast.success(`Fetched GR ${cleanGr}`);
        setSearchQuery("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to search GR");
    } finally {
      setSearching(false);
    }
  }

  // Add bulk Excel paste results
  async function handleBulkSearch(e: React.FormEvent) {
    e.preventDefault();
    // Parse GR numbers: extract alphanumeric codes separated by spaces, commas, tabs, or newlines
    const grs = bulkQuery
      .split(/[\s,\t\n]+/)
      .map(x => x.trim().toUpperCase())
      .filter(x => x.length > 0);

    if (grs.length === 0) {
      toast.error("Please paste or enter some valid GR numbers.");
      return;
    }

    setSearching(true);
    try {
      // Fetch details in bulk
      const results = await searchGRsBulkForAdmin(grs);
      
      if (results.length === 0) {
        toast.error("No matching GRs found in the database.");
      } else {
        const mapped = results.map((r: any) => ({
          gr_no: r.gr_no,
          branch_code: r.branch_code,
          party_name: r.party_name || "",
          total_freight: Number(r.total_freight) || 0
        }));

        // Filter out existing duplicates in the searchResults list
        const filteredMapped = mapped.filter(
          item => !searchResults.some(existing => existing.gr_no === item.gr_no && existing.branch_code === item.branch_code)
        );

        if (filteredMapped.length === 0) {
          toast.info("All fetched GRs are already in the list.");
        } else {
          setSearchResults(prev => [...filteredMapped, ...prev]);
          // Auto-select newly added bulk GRs
          const newSelections = { ...selectedRows };
          filteredMapped.forEach(item => {
            newSelections[`${item.gr_no}_${item.branch_code}`] = true;
          });
          setSelectedRows(newSelections);
          toast.success(`Successfully imported ${filteredMapped.length} GRs.`);
          setBulkQuery("");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch bulk GRs");
    } finally {
      setSearching(false);
    }
  }

  // Handle select all checkbox state
  const isAllSelected = searchResults.length > 0 && searchResults.every(r => selectedRows[`${r.gr_no}_${r.branch_code}`]);
  
  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      // Clear selections
      const newSelects = { ...selectedRows };
      searchResults.forEach(r => {
        delete newSelects[`${r.gr_no}_${r.branch_code}`];
      });
      setSelectedRows(newSelects);
    } else {
      // Select all working rows
      const newSelects = { ...selectedRows };
      searchResults.forEach(r => {
        newSelects[`${r.gr_no}_${r.branch_code}`] = true;
      });
      setSelectedRows(newSelects);
    }
  };

  const handleRowSelectToggle = (grNo: string, branchCode: string) => {
    const key = `${grNo}_${branchCode}`;
    setSelectedRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getSelectedItems = () => {
    return searchResults.filter(r => selectedRows[`${r.gr_no}_${r.branch_code}`]);
  };

  const selectedCount = getSelectedItems().length;

  // Perform bulk branch updates
  async function handleBulkTransfer() {
    if (!targetBranch) {
      toast.error("Please select a target branch.");
      return;
    }
    const itemsToTransfer = getSelectedItems();
    if (itemsToTransfer.length === 0) {
      toast.error("Please select at least one GR row to transfer.");
      return;
    }

    setUpdating(true);
    try {
      const payload = itemsToTransfer.map(r => ({
        gr_no: r.gr_no,
        old_branch_code: r.branch_code
      }));
      await updateGRsBranchBulk(payload, targetBranch);
      
      toast.success(`Successfully transferred ${itemsToTransfer.length} GRs to ${targetBranch}`);
      
      // Remove from list
      const grKeysToTransfer = new Set(itemsToTransfer.map(r => `${r.gr_no}_${r.branch_code}`));
      setSearchResults(prev => prev.filter(r => !grKeysToTransfer.has(`${r.gr_no}_${r.branch_code}`)));
      
      // Clear selections for those rows
      const newSelects = { ...selectedRows };
      grKeysToTransfer.forEach(key => delete newSelects[key]);
      setSelectedRows(newSelects);
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer branches");
    } finally {
      setUpdating(false);
    }
  }

  // Perform bulk deletions
  async function handleBulkDelete() {
    const itemsToDelete = getSelectedItems();
    if (itemsToDelete.length === 0) {
      toast.error("Please select at least one GR row to delete.");
      return;
    }

    const confirmMsg = `Are you absolutely sure you want to permanently delete ${itemsToDelete.length} selected GR(s)?\n\nThis will also permanently delete their entire payment/TDS history! This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setUpdating(true);
    try {
      const payload = itemsToDelete.map(r => ({
        gr_no: r.gr_no,
        branch_code: r.branch_code
      }));
      await deleteGRsForAdmin(payload);
      
      toast.success(`Permanently deleted ${itemsToDelete.length} GRs successfully.`);
      
      // Remove from working list
      const grKeysToDelete = new Set(itemsToDelete.map(r => `${r.gr_no}_${r.branch_code}`));
      setSearchResults(prev => prev.filter(r => !grKeysToDelete.has(`${r.gr_no}_${r.branch_code}`)));
      
      // Clear selections
      const newSelects = { ...selectedRows };
      grKeysToDelete.forEach(key => delete newSelects[key]);
      setSelectedRows(newSelects);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete entries");
    } finally {
      setUpdating(false);
    }
  }

  // --- Step 1: Mode Selection Render ---
  if (mode === "CHOOSE") {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-8 text-center mt-12 animate-fade-in">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Transfer / Delete GR Management</h1>
          <p className="text-slate-500 mt-2 max-w-xl mx-auto">
            Choose whether you want to transfer controlling branches in bulk or permanently delete GR entries.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto mt-6">
          <button
            onClick={() => handleModeChange("TRANSFER")}
            className="group flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-400 hover:ring-2 hover:ring-blue-100 transition-all text-left"
          >
            <div className="p-4 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
              <ArrowRight className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mt-4 group-hover:text-blue-600 transition-colors">Transfer GRs</h3>
            <p className="text-xs text-slate-400 mt-1.5 text-center leading-normal">
              Change the controlling branch of multiple GR numbers simultaneously.
            </p>
          </button>

          <button
            onClick={() => handleModeChange("DELETE")}
            className="group flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-red-400 hover:ring-2 hover:ring-rose-100 transition-all text-left"
          >
            <div className="p-4 rounded-full bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors duration-200">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mt-4 group-hover:text-rose-600 transition-colors">Delete GRs</h3>
            <p className="text-xs text-slate-400 mt-1.5 text-center leading-normal">
              Permanently remove GR records and payment history from the system.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // --- Step 2: Management Panel Render ---
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleModeChange("CHOOSE")}
            className="p-1.5 rounded-lg border hover:bg-slate-50 transition text-slate-600"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {mode === "TRANSFER" ? (
                <>
                  <span className="text-blue-600">Transfer</span> GRs
                </>
              ) : (
                <>
                  <span className="text-rose-600">Delete</span> GRs
                </>
              )}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === "TRANSFER" 
                ? "Move selected GRs to another controlling branch." 
                : "Permanently delete selected GRs and their logs."}
            </p>
          </div>
        </div>

        {/* Input Toggle Switch */}
        <button
          onClick={() => {
            setIsBulkInput(!isBulkInput);
            setSearchQuery("");
            setBulkQuery("");
          }}
          className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 transition text-slate-700 bg-white"
        >
          {isBulkInput ? (
            <>
              <ToggleRight className="w-5 h-5 text-blue-600" />
              <span>Bulk Paste Mode (Active)</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-5 h-5 text-gray-400" />
              <span>Switch to Bulk Excel Paste</span>
            </>
          )}
        </button>
      </div>

      {/* Input panel (Single Search OR Bulk Excel Area) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        {!isBulkInput ? (
          <form onSubmit={handleSingleSearch} className="flex gap-4 items-end max-w-xl">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Manual GR Search
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 focus:bg-white transition-all"
                  placeholder="Enter GR No. (e.g. S605816) & Press Enter"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm rounded-lg font-semibold disabled:opacity-50 transition flex items-center gap-1.5 h-[38px]"
            >
              {searching ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
              Fetch
            </button>
          </form>
        ) : (
          <form onSubmit={handleBulkSearch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clipboard className="w-4 h-4 text-gray-400" />
                Excel Columns Copy Paste (Bulk)
              </label>
              <textarea
                rows={5}
                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 focus:bg-white font-mono text-xs transition"
                placeholder="Paste GR list here directly from Excel columns (One GR per line, or comma-separated)"
                value={bulkQuery}
                onChange={e => setBulkQuery(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={searching || !bulkQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-sm rounded-lg font-semibold disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {searching ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                Fetch All GRs ({bulkQuery.split(/[\s,\t\n]+/).filter(x => x.trim().length > 0).length} items detected)
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Grid Working Area */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="w-12 px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={isAllSelected}
                      onChange={handleSelectAllToggle}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">GR No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Current Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider">Party Details</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider">Freight</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searchResults.map((row) => {
                  const rowKey = `${row.gr_no}_${row.branch_code}`;
                  const isChecked = !!selectedRows[rowKey];
                  
                  return (
                    <tr 
                      key={rowKey} 
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${isChecked ? "bg-blue-50/50" : ""}`}
                      onClick={() => handleRowSelectToggle(row.gr_no, row.branch_code)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={isChecked}
                          onChange={() => handleRowSelectToggle(row.gr_no, row.branch_code)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{row.gr_no}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border">
                          {row.branch_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-600">{row.party_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
                        ₹ {row.total_freight?.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Footer controls */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl">
            <div className="text-sm font-semibold text-slate-700">
              Selected: <span className="text-blue-600 font-bold">{selectedCount}</span> / {searchResults.length} GRs
            </div>

            {mode === "TRANSFER" ? (
              <div className="flex items-center gap-3">
                <select
                  className="block w-64 pl-3 pr-10 py-1.5 text-sm border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  disabled={updating}
                >
                  <option value="">Select target branch...</option>
                  {branches.map(b => (
                    <option key={b.branch_code} value={b.branch_code}>
                      {b.branch_code} {b.branch_name ? `- ${b.branch_name}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkTransfer}
                  disabled={updating || selectedCount === 0 || !targetBranch}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Transfer Selected
                </button>
              </div>
            ) : (
              <button
                onClick={handleBulkDelete}
                disabled={updating || selectedCount === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
