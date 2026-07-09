import { useState, useEffect } from "react";
import { Search, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { searchGRForAdmin, updateGRBranch } from "@/services/admin";
import { fetchAllBranchesLookup } from "@/services/collections.api";

type GRSearchResult = {
  gr_no: string;
  branch_code: string;
  party_name: string;
  total_freight: number;
};

export default function BranchTransfers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GRSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [branches, setBranches] = useState<{branch_code: string, branch_name: string}[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Track selected branch code for each row. Key: `${gr_no}_${branch_code}`
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>({});

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setHasSearched(true);
    try {
      const results = await searchGRForAdmin(searchQuery.trim().toUpperCase());
      setSearchResults(results as any[]);
      
      // Initialize dropdowns
      const newSelections: Record<string, string> = {};
      results.forEach((r: any) => {
        newSelections[`${r.gr_no}_${r.branch_code}`] = r.branch_code;
      });
      setSelectedBranches(newSelections);
    } catch (err: any) {
      toast.error(err.message || "Failed to search GR");
    } finally {
      setSearching(false);
    }
  }

  async function handleUpdate(grNo: string, oldBranch: string) {
    const newBranch = selectedBranches[`${grNo}_${oldBranch}`];
    if (!newBranch || newBranch === oldBranch) {
      toast.error("Please select a different branch.");
      return;
    }
    
    const rowKey = `${grNo}_${oldBranch}`;
    setUpdating(rowKey);
    try {
      await updateGRBranch(grNo, oldBranch, newBranch);
      toast.success(`GR ${grNo} moved to ${newBranch} successfully.`);
      
      // Remove from list or refresh
      setSearchResults(prev => prev.filter(r => !(r.gr_no === grNo && r.branch_code === oldBranch)));
    } catch (err: any) {
      toast.error(err.message || "Failed to update branch");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GR Branch Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search for a GR number and update its controlling branch directly.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GR Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter GR No. (e.g. 123456)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2 h-[42px]"
          >
            {searching && <Loader2 className="animate-spin w-4 h-4" />}
            Search
          </button>
        </form>
      </div>

      {hasSearched && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GR Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Branch</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {searching ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <Loader2 className="animate-spin w-6 h-6 mx-auto mb-2 text-blue-600" />
                    Searching...
                  </td>
                </tr>
              ) : searchResults.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No GR found matching "{searchQuery}"
                  </td>
                </tr>
              ) : (
                searchResults.map((row) => {
                  const rowKey = `${row.gr_no}_${row.branch_code}`;
                  const isUpdating = updating === rowKey;
                  const currentSelected = selectedBranches[rowKey] || row.branch_code;
                  
                  return (
                    <tr key={rowKey} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{row.gr_no}</div>
                        <div className="text-sm text-gray-500">{row.party_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        ₹ {row.total_freight?.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {row.branch_code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                          value={currentSelected}
                          onChange={(e) => setSelectedBranches(prev => ({ ...prev, [rowKey]: e.target.value }))}
                          disabled={isUpdating}
                        >
                          {branches.map(b => (
                            <option key={b.branch_code} value={b.branch_code}>
                              {b.branch_code} {b.branch_name ? `- ${b.branch_name}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button
                          onClick={() => handleUpdate(row.gr_no, row.branch_code)}
                          disabled={isUpdating || currentSelected === row.branch_code}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
