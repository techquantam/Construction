"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CornerDownLeft, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useApp } from "@/context/AppContext";

function SitesContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const action = searchParams.get("action") || "add";
  const { sites, isLoadingSites } = useApp();

  const [siteName, setSiteName] = useState("");
  const [searchVal, setSearchVal] = useState(""); // For search in delete mode
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter sites for delete listing based on search
  const filteredSites = sites.filter((site) => {
    if (!searchVal.trim()) return true;
    return site.name.toUpperCase().includes(searchVal.trim().toUpperCase());
  });

  // Auto focus input on mount depending on active mode
  useEffect(() => {
    if (action === "add" && inputRef.current) {
      inputRef.current.focus();
    } else if (action === "delete" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [action]);

  // Keep highlightedIndex synchronized and default to 0 on list load or filter change
  useEffect(() => {
    if (action === "delete") {
      setHighlightedIndex(filteredSites.length > 0 ? 0 : -1);
    }
  }, [searchVal, action, sites]);

  // Scroll active highlighted row into view automatically
  useEffect(() => {
    if (highlightedIndex >= 0 && action === "delete") {
      const el = document.getElementById(`delete-site-row-${highlightedIndex}`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, action]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/sites", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success(`SITE "${siteName.toUpperCase()}" REGISTERED SUCCESSFULLY!`);
      setSiteName("");
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create site");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Site and all its associated data deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete site");
    }
  });

  const handleSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = siteName.trim();
    if (!trimmed) {
      toast.error("PLEASE ENTER A VALID SITE/COMPANY NAME");
      return;
    }

    createMutation.mutate({
      name: trimmed.toUpperCase(),
      clientName: "DIRECT CLIENT",
      address: "",
      budget: "0",
      status: "RUNNING",
      startDate: new Date().toISOString().split("T")[0],
    });
  };

  const handleDelete = (id: string, name: string) => {
    const isConfirmed = window.confirm(
      `⚠️ WARNING: PERMANENT DATA LOSS!\n\nAre you sure you want to delete the site "${name.toUpperCase()}"?\n\nThis action will permanently delete:\n1. The Site record\n2. All DayBook transactions under this site\n3. All Material stock records under this site\n4. Any Ledger accounts specific to this site.\n\nTHIS ACTION CANNOT BE UNDONE. Click OK to proceed.`
    );
    if (isConfirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredSites.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= filteredSites.length ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredSites.length - 1 : next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredSites.length) {
        const targetSite = filteredSites[highlightedIndex];
        handleDelete(targetSite.id, targetSite.name);
      }
    }
  };

  if (action === "delete") {
    return (
      <div className="space-y-6 font-mono text-slate-800 max-w-4xl mx-auto pt-8">
        <div className="bg-white border-2 border-slate-950 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
          {/* Header */}
          <div className="bg-red-600 border-b-2 border-slate-950 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Building2 className="h-6 w-6 text-white" />
              <h2 className="text-xl font-black uppercase tracking-widest text-white">
                1.8. DELETE SITE
              </h2>
            </div>
            <span className="bg-white text-red-700 border-2 border-slate-950 font-black px-2.5 py-0.5 rounded text-[10px] tracking-wider select-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              DANGER ZONE
            </span>
          </div>

          {/* Search bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="SEARCH SITES TO DELETE (USE ARROWS & ENTER)..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-transparent font-mono text-xs font-black uppercase text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* Table list */}
          <div className="p-6">
            <div className="overflow-x-auto border-2 border-slate-950 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
              <table className="w-full border-collapse font-mono text-[13px] text-slate-900 bg-white">
                <thead>
                  <tr className="bg-[#2B547E] text-white font-extrabold uppercase text-[11px] border-b-2 border-slate-950">
                    <th className="py-2.5 px-3 text-left w-12 text-white font-black border border-slate-850">#</th>
                    <th className="py-2.5 px-3 text-left text-white font-black border border-slate-850">Site Name</th>
                    <th className="py-2.5 px-3 text-right w-44 text-white font-black border border-slate-850">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-slate-400 italic">
                        {isLoadingSites ? "LOADING SITES..." : "NO REGISTERED CONSTRUCTION SITES FOUND"}
                      </td>
                    </tr>
                  ) : (
                    filteredSites.map((site, index) => {
                      const isHighlighted = highlightedIndex === index;
                      return (
                        <tr
                          key={site.id}
                          id={`delete-site-row-${index}`}
                          onClick={() => setHighlightedIndex(index)}
                          className={`border-b border-slate-200 font-black text-xs uppercase transition-colors last:border-b-0 cursor-pointer select-none ${isHighlighted
                            ? "bg-red-50 text-slate-950 font-black border-y-2 border-slate-900"
                            : "hover:bg-red-50/20 text-slate-900"
                            }`}
                        >
                          <td className="py-3 px-3 text-slate-500 border border-slate-200">{index + 1}</td>
                          <td className="py-3 px-3 tracking-wider font-black border border-slate-200">{site.name}</td>
                          <td className="py-2 px-3 text-right border border-slate-200">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(site.id, site.name);
                              }}
                              disabled={deleteMutation.isPending}
                              className={`font-black text-[10px] px-3 py-1.5 rounded transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-none border border-slate-950 uppercase tracking-widest active:translate-y-0.5 flex items-center gap-1.5 ml-auto cursor-pointer ${isHighlighted
                                ? "bg-red-650 bg-red-700 text-white"
                                : "bg-red-600 text-white hover:bg-red-700"
                                }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>DELETE</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback to ADD NEW SITE (action === "add" or default)
  return (
    <div className="space-y-6 font-mono text-slate-800 max-w-2xl mx-auto pt-8">
      <div className="bg-white border-2 border-slate-950 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
        {/* Header */}
        <div className="bg-amber-400 border-b-2 border-slate-950 p-4 flex items-center gap-3">
          <Building2 className="h-6 w-6 text-slate-900" />
          <h2 className="text-xl font-black uppercase text-slate-900 tracking-widest">
            1.1. ADD NEW SITE OR COMPANY
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            TYPE THE NEW SITE/COMPANY NAME AND PRESS ENTER.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative border-2 border-slate-950 rounded bg-slate-50 p-4 focus-within:border-amber-500 transition-colors">
              <label htmlFor="site-name" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                SITE/COMPANY NAME
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  id="site-name"
                  type="text"
                  placeholder="ENTER NEW SITE OR COMPANY NAME..."
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  disabled={createMutation.isPending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit(e);
                    }
                  }}
                  className="w-full bg-transparent font-mono text-lg font-black uppercase tracking-widest text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  autoComplete="off"
                />
                <div className="flex items-center gap-1.5 bg-slate-200 border border-slate-400 rounded px-2 py-1 text-[10px] font-black uppercase text-slate-600 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.15)] shrink-0 select-none">
                  <span>ENTER</span>
                  <CornerDownLeft className="h-3 w-3" />
                </div>
              </div>
            </div>

            {createMutation.isPending && (
              <div className="text-center font-bold text-xs text-amber-600 uppercase animate-pulse">
                REGISTERING SITE ON SERVER...
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={<div className="font-mono text-xs text-slate-450 uppercase p-8 text-center animate-pulse">LOADING SITES INTERFACE...</div>}>
      <SitesContent />
    </Suspense>
  );
}
