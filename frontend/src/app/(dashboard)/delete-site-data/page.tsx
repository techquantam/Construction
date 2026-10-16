"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, AlertTriangle, ShieldCheck, Database, RefreshCw, Building2, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeleteSiteDataPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { selectedSiteId, setSelectedSiteId, sites } = useApp();

  // Site search state
  const [siteSearchVal, setSiteSearchVal] = useState("");
  const [isSiteSuggestionsOpen, setIsSiteSuggestionsOpen] = useState(false);
  const [highlightedSiteIndex, setHighlightedSiteIndex] = useState(-1);
  const siteInputRef = useRef<HTMLInputElement>(null);

  // Sync search input with globally active site
  useEffect(() => {
    if (selectedSiteId && sites.length > 0) {
      const active = sites.find((s) => s.id === selectedSiteId);
      if (active) {
        setSiteSearchVal(active.name.toUpperCase());
      }
    }
  }, [selectedSiteId, sites]);

  // Initial focus on mount
  useEffect(() => {
    setTimeout(() => {
      siteInputRef.current?.focus();
      siteInputRef.current?.select();
    }, 150);
  }, []);

  // Filter site suggestions
  const filteredSiteSuggestions = useMemo(() => {
    if (!siteSearchVal.trim()) return sites;
    const q = siteSearchVal.trim().toUpperCase();
    return sites.filter((site: any) => site.name.toUpperCase().includes(q));
  }, [sites, siteSearchVal]);

  // Fetch accounts/ledgers for selected site
  const { data: ledgers = [], isLoading: isLoadingLedgers } = useQuery({
    queryKey: ["ledgers", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId || selectedSiteId === "all") return [];
      const res = await api.get(`/ledgers?siteId=${selectedSiteId}`);
      return res.data.data || [];
    },
    enabled: !!selectedSiteId && selectedSiteId !== "all",
  });

  // Fetch daybooks (transactions) for selected site
  const { data: daybooks = [], isLoading: isLoadingDaybooks, refetch: refetchDaybooks } = useQuery({
    queryKey: ["daybooks", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId || selectedSiteId === "all") return [];
      const res = await api.get(`/daybooks?siteId=${selectedSiteId}`);
      return res.data.data || [];
    },
    enabled: !!selectedSiteId && selectedSiteId !== "all",
  });

  // Map transaction entries count per ledger
  const accountsWithStats = useMemo(() => {
    const sorted = [...ledgers].sort((a: any, b: any) =>
      (a.name || "").trim().localeCompare((b.name || "").trim(), undefined, { sensitivity: "base" })
    );

    return sorted.map((ledger: any) => {
      const nameUpper = (ledger.name || "").trim().toUpperCase();
      let entriesCount = 0;
      if (daybooks && daybooks.length > 0) {
        daybooks.forEach((item: any) => {
          const typeText = (item.expenseType || "").trim().toUpperCase();
          if (typeText.startsWith(`TO ${nameUpper}`) || typeText.startsWith(`BY ${nameUpper}`)) {
            entriesCount++;
          }
        });
      }

      let address = "N/A";
      let mobile = ledger.phone || "N/A";
      if (ledger.contactPerson) {
        try {
          const parsed = JSON.parse(ledger.contactPerson);
          address = parsed.address || "N/A";
          mobile = parsed.mobileNo || parsed.phone || mobile;
        } catch {
          address = ledger.contactPerson;
        }
      }

      return {
        ...ledger,
        address,
        mobile,
        entriesCount,
      };
    });
  }, [ledgers, daybooks]);

  // Mutation: Clear all accounts data for the selected site
  const clearDataMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const res = await api.post(`/sites/${siteId}/clear-accounts-data`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success(data.message || "All account data deleted successfully. Heads remain intact!");
      refetchDaybooks();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete account data");
    },
  });

  const handleClearAllData = () => {
    if (!selectedSiteId || selectedSiteId === "all") {
      toast.error("PLEASE SELECT A SITE FIRST / कृपया पहले साइट चुनें");
      siteInputRef.current?.focus();
      return;
    }

    const activeSite = sites.find((s) => s.id === selectedSiteId);
    const siteName = activeSite ? activeSite.name.toUpperCase() : "THIS SITE";
    const totalEntries = daybooks.length;
    const totalHeads = ledgers.length;

    if (totalEntries === 0) {
      toast.info(`Site "${siteName}" has 0 transaction entries to delete.`);
      return;
    }

    const confirmMessage =
      `⚠️ WARNING: TRANSACTION DATA DELETION!\n\n` +
      `Are you sure you want to delete ALL ${totalEntries} transaction entries for site "${siteName}" in one click?\n\n` +
      `✔ ALL ${totalHeads} ACCOUNT HEADS WILL REMAIN SAFE (NOT DELETED)\n` +
      `✖ ALL TRANSACTIONS / DAYBOOK RECORDS WILL BE PERMANENTLY CLEARED\n\n` +
      `Click OK to proceed with deletion.`;

    if (window.confirm(confirmMessage)) {
      clearDataMutation.mutate(selectedSiteId);
    }
  };

  const handleSiteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsSiteSuggestionsOpen(true);
      setHighlightedSiteIndex((prev) =>
        prev < filteredSiteSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsSiteSuggestionsOpen(true);
      setHighlightedSiteIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSiteSuggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        isSiteSuggestionsOpen &&
        highlightedSiteIndex >= 0 &&
        highlightedSiteIndex < filteredSiteSuggestions.length
      ) {
        const sel = filteredSiteSuggestions[highlightedSiteIndex];
        setSelectedSiteId(sel.id);
        setSiteSearchVal(sel.name.toUpperCase());
        setIsSiteSuggestionsOpen(false);
        setHighlightedSiteIndex(-1);
      } else if (filteredSiteSuggestions.length > 0) {
        const sel = filteredSiteSuggestions[0];
        setSelectedSiteId(sel.id);
        setSiteSearchVal(sel.name.toUpperCase());
        setIsSiteSuggestionsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsSiteSuggestionsOpen(false);
      setHighlightedSiteIndex(-1);
    }
  };

  const activeSiteObj = sites.find((s) => s.id === selectedSiteId);

  return (
    <div className="font-mono text-slate-800 space-y-6 select-none animate-in fade-in duration-200">

      {/* 1. Header Banner */}
      <div className="bg-[#B91C1C] text-white p-4 border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-amber-300" />
            <h1 className="text-lg font-black tracking-widest uppercase">
              7. DELETE SITE DATA / साइट खाता डेटा हटाएं
            </h1>
          </div>
          <p className="text-[11px] text-red-100 mt-1 uppercase font-semibold">
            DELETE ALL ACCOUNTS TRANSACTION DATA IN ONE CLICK • ACCOUNT HEADS REMAIN 100% SAFE
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-red-950/40 px-3 py-1.5 border border-red-400/30 rounded text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="font-bold text-white">HEADS PROTECTED</span>
        </div>
      </div>

      {/* 2. Site Selection Panel & Delete Action */}
      <div className="bg-[#E5ECF4] border-2 border-slate-800 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
          {/* Site selection autocomplete */}
          <div className="flex items-center gap-2 w-full sm:w-96">
            <Label className="text-xs font-black uppercase text-slate-700 shrink-0">Site Name / साइट:</Label>
            <div className="relative flex-1">
              <div className="relative flex items-center bg-[#FFE600] border-2 border-slate-900 overflow-hidden shadow-sm">
                <input
                  ref={siteInputRef}
                  type="text"
                  spellCheck="false"
                  value={siteSearchVal}
                  onChange={(e) => {
                    setSiteSearchVal(e.target.value);
                    setIsSiteSuggestionsOpen(true);
                  }}
                  onFocus={() => setIsSiteSuggestionsOpen(true)}
                  onKeyDown={handleSiteKeyDown}
                  placeholder="TYPE SITE NAME..."
                  className="w-full px-2 py-1 text-xs font-black bg-[#FFE600] text-slate-950 focus:outline-none placeholder:text-slate-700/60 uppercase font-mono tracking-wider h-9"
                />
                <button
                  type="button"
                  onClick={() => setIsSiteSuggestionsOpen((prev) => !prev)}
                  className="px-2 border-l border-slate-900 text-slate-950 hover:bg-[#E5C300] transition-colors focus:outline-none flex items-center justify-center h-full text-xs font-bold font-sans"
                >
                  ▼
                </button>
              </div>

              {/* Site suggestions list */}
              {isSiteSuggestionsOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFE600] border-2 border-slate-900 shadow-lg z-50 max-h-48 overflow-y-auto font-mono text-xs uppercase animate-in fade-in duration-100">
                  {filteredSiteSuggestions.length === 0 ? (
                    <div className="p-2 text-slate-800 italic text-[11px]">
                      NO MATCHING SITES
                    </div>
                  ) : (
                    filteredSiteSuggestions.map((site: any, idx: number) => {
                      const isActive = highlightedSiteIndex === idx;
                      return (
                        <button
                          key={site.id}
                          type="button"
                          onClick={() => {
                            setSelectedSiteId(site.id);
                            setSiteSearchVal(site.name.toUpperCase());
                            setIsSiteSuggestionsOpen(false);
                            setHighlightedSiteIndex(-1);
                          }}
                          onMouseEnter={() => setHighlightedSiteIndex(idx)}
                          className={`w-full text-left px-3 py-2 border-b border-slate-900/10 last:border-b-0 transition-colors font-black text-xs uppercase ${
                            isActive
                              ? "bg-slate-950 text-[#FFE600]"
                              : "bg-[#FFE600] text-slate-950 hover:bg-[#E5C300]"
                          }`}
                        >
                          {site.name.toUpperCase()}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clear Data Trigger Button */}
        <button
          type="button"
          onClick={handleClearAllData}
          disabled={!selectedSiteId || clearDataMutation.isPending || daybooks.length === 0}
          className={`w-full sm:w-auto px-5 py-2 border-2 border-slate-950 font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 ${
            !selectedSiteId || daybooks.length === 0
              ? "bg-slate-300 text-slate-500 cursor-not-allowed border-slate-400 shadow-none"
              : "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 cursor-pointer"
          }`}
        >
          {clearDataMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>DELETING DATA...</span>
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              <span>DELETE ALL ACCOUNT DATA ({daybooks.length} ENTRIES)</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Selected Site */}
        <div className="bg-white border-2 border-slate-900 p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] rounded">
          <div className="text-[11px] font-black uppercase text-slate-500">SELECTED SITE / चुनी गई साइट</div>
          <div className="text-base font-black text-slate-900 mt-1 uppercase truncate">
            {activeSiteObj ? activeSiteObj.name : "PLEASE SELECT A SITE"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">STATUS: {activeSiteObj?.status || "N/A"}</div>
        </div>

        {/* Card 2: Account Heads (Safe) */}
        <div className="bg-emerald-50 border-2 border-emerald-900 p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] rounded">
          <div className="text-[11px] font-black uppercase text-emerald-800 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <span>ACCOUNT HEADS (सुरक्षित रहेंगे)</span>
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {isLoadingLedgers ? "..." : ledgers.length}{" "}
            <span className="text-xs font-bold text-emerald-700">ACCOUNTS</span>
          </div>
          <div className="text-[10px] text-emerald-700 mt-1 uppercase font-semibold">
            ALL HEADS WILL REMAIN IN SYSTEM
          </div>
        </div>

        {/* Card 3: Total Transaction Entries (To Be Deleted) */}
        <div className="bg-red-50 border-2 border-red-900 p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] rounded">
          <div className="text-[11px] font-black uppercase text-red-800 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-700" />
            <span>TRANSACTIONS (डिलीट होंगे)</span>
          </div>
          <div className="text-2xl font-black text-red-900 mt-1">
            {isLoadingDaybooks ? "..." : daybooks.length}{" "}
            <span className="text-xs font-bold text-red-700">ENTRIES</span>
          </div>
          <div className="text-[10px] text-red-700 mt-1 uppercase font-semibold">
            {daybooks.length === 0 ? "NO DATA ENTRIES TO DELETE" : "WILL BE CLEARED ON BUTTON CLICK"}
          </div>
        </div>
      </div>

      {/* 4. Warning & Clarification Alert Box */}
      <div className="bg-amber-100 border-2 border-amber-900 p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] rounded flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 font-bold leading-relaxed space-y-1">
          <div>
            <span className="font-black uppercase">महत्वपूर्ण सूचना (IMPORTANT NOTE):</span> इस विकल्प से चुनी गई साइट के <span className="underline font-black">सभी खातों (Accounts) का लेन-देन / डेटा एक साथ डिलीट</span> हो जाएगा।
          </div>
          <div className="text-emerald-900 font-extrabold flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 inline" />
            <span>खाता (Account Head) डिलीट नहीं होगा — पार्टी/कंपनी का नाम, पता, फोन नंबर सुरक्षित रहेगा और शेष राशि ₹0.00 हो जाएगी।</span>
          </div>
        </div>
      </div>

      {/* 5. Accounts Table View */}
      <div className="bg-white border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded overflow-hidden">
        <div className="p-3 bg-slate-100 border-b-2 border-slate-800 flex justify-between items-center">
          <span className="font-black text-xs uppercase tracking-wider text-slate-800">
            SITE ACCOUNTS PREVIEW / इस साइट के खातों की सूची ({accountsWithStats.length} HEADS)
          </span>
          <span className="text-[10px] text-slate-500 font-bold uppercase">
            SORTED A TO Z
          </span>
        </div>

        {!selectedSiteId ? (
          <div className="p-16 text-center text-slate-400 italic font-black uppercase tracking-widest bg-slate-50">
            PLEASE SELECT A SITE NAME ABOVE TO VIEW ACCOUNTS / कृपया साइट नाम चुनें
          </div>
        ) : isLoadingLedgers ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : accountsWithStats.length === 0 ? (
          <div className="p-16 text-center text-slate-400 italic font-black uppercase bg-slate-50">
            NO REGISTERED ACCOUNTS FOUND FOR THIS SITE / इस साइट के लिए कोई खाता नहीं मिला
          </div>
        ) : (
          <Table className="border-collapse w-full">
            <TableHeader className="bg-slate-200 border-b-2 border-slate-800">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-slate-950 font-black border-r border-slate-350 py-3 text-center uppercase">Sl No.</TableHead>
                <TableHead className="text-slate-950 font-black border-r border-slate-350 py-3 uppercase">Account Name / खाता</TableHead>
                <TableHead className="w-32 text-slate-950 font-black border-r border-slate-350 py-3 uppercase">Type</TableHead>
                <TableHead className="text-slate-950 font-black border-r border-slate-350 py-3 uppercase">Address / पता</TableHead>
                <TableHead className="w-40 text-slate-950 font-black border-r border-slate-350 py-3 uppercase">Mobile</TableHead>
                <TableHead className="w-36 text-center text-slate-950 font-black border-r border-slate-350 py-3 uppercase">Current Entries</TableHead>
                <TableHead className="w-36 text-center text-slate-950 font-black py-3 uppercase">Head Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountsWithStats.map((account: any, idx: number) => (
                <TableRow
                  key={account.id}
                  className="border-b border-slate-300 font-bold uppercase hover:bg-slate-50"
                >
                  <TableCell className="text-center border-r border-slate-350 py-2.5">{idx + 1}</TableCell>
                  <TableCell className="border-r border-slate-350 py-2.5 font-extrabold text-slate-950">{account.name}</TableCell>
                  <TableCell className="border-r border-slate-350 py-2.5 text-xs text-slate-600">{account.type || "Party"}</TableCell>
                  <TableCell className="border-r border-slate-350 py-2.5 text-xs text-slate-600">{account.address}</TableCell>
                  <TableCell className="border-r border-slate-350 py-2.5 text-xs text-slate-600">{account.mobile}</TableCell>
                  <TableCell className="border-r border-slate-350 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-black ${
                      account.entriesCount > 0 ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-500"
                    }`}>
                      {account.entriesCount} Entries
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      SAFE / सुरक्षित
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

    </div>
  );
}
