"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Trash2, Search, ArrowDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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

export default function CompanyAccountsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  
  // AppContext context values
  const { selectedSiteId, setSelectedSiteId, sites } = useApp();

  // Dialog State (open by default when page loads)
  const [showPopup, setShowPopup] = useState(true);

  // Form inputs inside the popup modal
  const [popupSiteSearchVal, setPopupSiteSearchVal] = useState("");
  const [isPopupSiteSuggestionsOpen, setIsPopupSiteSuggestionsOpen] = useState(false);
  const [highlightedPopupSiteIndex, setHighlightedPopupSiteIndex] = useState(-1);
  const [popupSiteId, setPopupSiteId] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    mobile: "",
  });

  // Page level states
  const [pageSiteSearchVal, setPageSiteSearchVal] = useState("");
  const [isPageSiteSuggestionsOpen, setIsPageSiteSuggestionsOpen] = useState(false);
  const [highlightedPageSiteIndex, setHighlightedPageSiteIndex] = useState(-1);
  
  // Account search query on the page
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // Focused row for keyboard navigation in Table
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  // Refs for Tally-style keyboard navigation in popup
  const popupSiteInputRef = useRef<HTMLInputElement>(null);
  const popupNameInputRef = useRef<HTMLInputElement>(null);
  const popupAddressInputRef = useRef<HTMLInputElement>(null);
  const popupMobileInputRef = useRef<HTMLInputElement>(null);
  const popupSubmitBtnRef = useRef<HTMLButtonElement>(null);

  // Refs for page level controls
  const pageSiteInputRef = useRef<HTMLInputElement>(null);
  const pageSearchInputRef = useRef<HTMLInputElement>(null);

  // 1. Synchronize the popup site search value and page site search value with active selectedSiteId
  useEffect(() => {
    if (selectedSiteId && sites.length > 0) {
      const activeSiteObj = sites.find((s) => s.id === selectedSiteId);
      if (activeSiteObj) {
        setPageSiteSearchVal(activeSiteObj.name.toUpperCase());
        setPopupSiteSearchVal(activeSiteObj.name.toUpperCase());
        setPopupSiteId(activeSiteObj.id);
      }
    }
  }, [selectedSiteId, sites]);

  // 2. Fetch all ledgers for the selected site
  const { data: ledgers = [], isLoading } = useQuery({
    queryKey: ["ledgers", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId) return [];
      const response = await api.get(`/ledgers?siteId=${selectedSiteId}`);
      return response.data.data || [];
    },
    enabled: !!selectedSiteId,
  });

  // Filter ledgers by Company type and Search Query
  const companyAccounts = useMemo(() => {
    const list = ledgers.filter((l: any) => l.type === "Company");
    if (!accountSearchQuery.trim()) return list;
    const q = accountSearchQuery.trim().toUpperCase();
    return list.filter((l: any) => l.name.toUpperCase().includes(q));
  }, [ledgers, accountSearchQuery]);

  // Reset focus index when query or site changes
  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [accountSearchQuery, selectedSiteId]);

  // 3. Create Company Account Mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await api.post("/ledgers", payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["ledgers", selectedSiteId] });
      toast.success(`Created account: "${res.data.data.name}"`);
      // Reset popup form
      setFormData({ name: "", address: "", mobile: "" });
      setShowPopup(false);
      
      // Focus page level search query
      setTimeout(() => {
        pageSearchInputRef.current?.focus();
      }, 100);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create account");
    },
  });

  // 4. Delete Company Account Mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/ledgers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledgers", selectedSiteId] });
      toast.success("Account deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete account");
    },
  });

  // Autocomplete search suggestions for site name (Popup & Page)
  const filteredPopupSiteSuggestions = useMemo(() => {
    if (!popupSiteSearchVal.trim()) return sites;
    const q = popupSiteSearchVal.trim().toUpperCase();
    return sites.filter((site: any) => site.name.toUpperCase().includes(q));
  }, [sites, popupSiteSearchVal]);

  const filteredPageSiteSuggestions = useMemo(() => {
    if (!pageSiteSearchVal.trim()) return sites;
    const q = pageSiteSearchVal.trim().toUpperCase();
    return sites.filter((site: any) => site.name.toUpperCase().includes(q));
  }, [sites, pageSiteSearchVal]);

  // Initial focus on mount
  useEffect(() => {
    if (showPopup) {
      setTimeout(() => {
        popupSiteInputRef.current?.focus();
        popupSiteInputRef.current?.select();
      }, 200);
    } else {
      setTimeout(() => {
        pageSearchInputRef.current?.focus();
      }, 100);
    }
  }, [showPopup]);

  // Global keydown on page (e.g. F2 to open, Esc to exit to dashboard)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA"
      );

      if (e.key === "Escape" && !showPopup && !isInputFocused && focusedRowIndex === -1) {
        e.preventDefault();
        router.push("/dashboard");
      }

      if (e.key === "F2" && !showPopup) {
        e.preventDefault();
        setShowPopup(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [showPopup, router, focusedRowIndex]);

  // Table rows keydown navigation listener
  useEffect(() => {
    const handleTableKeyDown = (e: KeyboardEvent) => {
      if (showPopup) return;

      const activeEl = document.activeElement;
      const isPageInputFocused = activeEl && (
        activeEl === pageSiteInputRef.current ||
        (activeEl.tagName === "INPUT" && activeEl !== pageSearchInputRef.current)
      );

      if (isPageInputFocused) return;

      if (e.key === "Escape") {
        if (focusedRowIndex >= 0) {
          e.preventDefault();
          e.stopPropagation();
          setFocusedRowIndex(-1);
          pageSearchInputRef.current?.focus();
          return;
        }
      }

      // If search input is focused and we press ArrowDown, focus the first row
      if (activeEl === pageSearchInputRef.current) {
        if (e.key === "ArrowDown") {
          if (companyAccounts.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setFocusedRowIndex(0);
            setTimeout(() => {
              const el = document.getElementById(`account-row-0`);
              if (el) el.scrollIntoView({ block: "nearest" });
            }, 10);
          }
        }
        return;
      }

      // If a row is selected
      if (focusedRowIndex >= 0 && focusedRowIndex < companyAccounts.length) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          setFocusedRowIndex((prev) => {
            const next = prev + 1;
            const index = next >= companyAccounts.length ? companyAccounts.length - 1 : next;
            setTimeout(() => {
              const el = document.getElementById(`account-row-${index}`);
              if (el) el.scrollIntoView({ block: "nearest" });
            }, 10);
            return index;
          });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          setFocusedRowIndex((prev) => {
            const next = prev - 1;
            if (next < 0) {
              pageSearchInputRef.current?.focus();
              return -1;
            }
            setTimeout(() => {
              const el = document.getElementById(`account-row-${next}`);
              if (el) el.scrollIntoView({ block: "nearest" });
            }, 10);
            return next;
          });
        } else if (e.key === "Delete") {
          e.preventDefault();
          e.stopPropagation();
          const target = companyAccounts[focusedRowIndex];
          if (target) {
            handleDeleteCompany(target.id, target.name);
          }
        }
      }
    };

    window.addEventListener("keydown", handleTableKeyDown, true);
    return () => window.removeEventListener("keydown", handleTableKeyDown, true);
  }, [showPopup, focusedRowIndex, companyAccounts]);

  // Popup Keyboard navigation logic
  const handlePopupKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "site") {
        if (isPopupSiteSuggestionsOpen && highlightedPopupSiteIndex >= 0 && highlightedPopupSiteIndex < filteredPopupSiteSuggestions.length) {
          const selectedSite = filteredPopupSiteSuggestions[highlightedPopupSiteIndex];
          setPopupSiteId(selectedSite.id);
          setSelectedSiteId(selectedSite.id); // sync to global site
          setPopupSiteSearchVal(selectedSite.name.toUpperCase());
          setIsPopupSiteSuggestionsOpen(false);
          setHighlightedPopupSiteIndex(-1);
        }
        popupNameInputRef.current?.focus();
      } else if (field === "name") {
        popupAddressInputRef.current?.focus();
      } else if (field === "address") {
        popupMobileInputRef.current?.focus();
      } else if (field === "mobile") {
        // Submit directly on Enter on mobile input!
        handleRegisterCompany(e);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (field === "site" && isPopupSiteSuggestionsOpen) {
        setIsPopupSiteSuggestionsOpen(false);
        setHighlightedPopupSiteIndex(-1);
      } else {
        // Dismiss popup instantly on Escape key
        setShowPopup(false);
      }
    }
  };

  // Popup Site Suggestions keys navigation
  const handlePopupSiteSuggestionsKey = (e: React.KeyboardEvent) => {
    if (!isPopupSiteSuggestionsOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedPopupSiteIndex((prev) => {
        const next = prev + 1;
        return next >= filteredPopupSiteSuggestions.length ? filteredPopupSiteSuggestions.length - 1 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedPopupSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? 0 : next;
      });
    }
  };

  // Page Site Suggestions keys navigation
  const handlePageSiteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isPageSiteSuggestionsOpen && highlightedPageSiteIndex >= 0 && highlightedPageSiteIndex < filteredPageSiteSuggestions.length) {
        const selectedSite = filteredPageSiteSuggestions[highlightedPageSiteIndex];
        setSelectedSiteId(selectedSite.id);
        setPageSiteSearchVal(selectedSite.name.toUpperCase());
        setIsPageSiteSuggestionsOpen(false);
        setHighlightedPageSiteIndex(-1);
        pageSearchInputRef.current?.focus();
      } else {
        setIsPageSiteSuggestionsOpen(false);
        pageSearchInputRef.current?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (isPageSiteSuggestionsOpen) {
        setIsPageSiteSuggestionsOpen(false);
        setHighlightedPageSiteIndex(-1);
      } else {
        pageSiteInputRef.current?.blur();
      }
    } else if (e.key === "ArrowDown") {
      if (isPageSiteSuggestionsOpen) {
        e.preventDefault();
        setHighlightedPageSiteIndex((prev) => {
          const next = prev + 1;
          return next >= filteredPageSiteSuggestions.length ? filteredPageSiteSuggestions.length - 1 : next;
        });
      } else {
        setIsPageSiteSuggestionsOpen(true);
      }
    } else if (e.key === "ArrowUp") {
      if (isPageSiteSuggestionsOpen) {
        e.preventDefault();
        setHighlightedPageSiteIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? 0 : next;
        });
      }
    }
  };

  const handleRegisterCompany = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Find active popupSiteId if they didn't click/select it but typed and it matches exactly
    let activeSiteId = popupSiteId;
    if (!activeSiteId && popupSiteSearchVal.trim()) {
      const match = sites.find(s => s.name.toUpperCase() === popupSiteSearchVal.trim().toUpperCase());
      if (match) {
        activeSiteId = match.id;
      }
    }

    if (!activeSiteId) {
      toast.error("Please select a valid site");
      popupSiteInputRef.current?.focus();
      return;
    }
    if (!formData.name.trim()) {
      toast.error("Account Name is required");
      popupNameInputRef.current?.focus();
      return;
    }

    // Set globally selected site to the registered site
    setSelectedSiteId(activeSiteId);

    createCompanyMutation.mutate({
      type: "Company",
      name: formData.name.trim().toUpperCase(),
      contactPerson: JSON.stringify({
        address: formData.address.trim().toUpperCase() || "N/A",
        mobileNo: formData.mobile.trim() || "N/A",
        customerExtra: "CUSTOMER",
        measurementType: "OTHER",
        plotUnit: "CFT",
      }),
      phone: formData.mobile.trim() || "N/A",
      openingBalance: 0,
      siteId: activeSiteId,
    });
  };

  const handleDeleteCompany = (id: string, name: string) => {
    if (window.confirm(`ARE YOU SURE YOU WANT TO DELETE ACCOUNT: "${name.toUpperCase()}"?`)) {
      deleteCompanyMutation.mutate(id);
    }
  };

  // Safe parsing helper for addresses and mobile numbers from contactPerson JSON
  const getContactInfo = (contactPersonStr: string) => {
    let address = "N/A";
    let mobile = "N/A";
    if (contactPersonStr) {
      try {
        const parsed = JSON.parse(contactPersonStr);
        address = parsed.address || "N/A";
        mobile = parsed.mobileNo || parsed.phone || "N/A";
      } catch (e) {
        address = contactPersonStr;
      }
    }
    return { address, mobile };
  };

  return (
    <div className="font-mono text-slate-800 space-y-6 select-none animate-in fade-in duration-200">
      
      {/* 1. Page Header Block */}
      <div className="bg-[#2B547E] text-white p-4 border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded select-none flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-widest uppercase">ACCOUNT REGISTER / खाता रजिस्टर</h1>
          <p className="text-[10px] text-slate-200 mt-1 uppercase font-semibold">
            Manage ledger accounts and addresses associated with sites
          </p>
        </div>
        <User className="h-6 w-6 text-amber-400" />
      </div>

      {/* 2. Site Selection & Search Panel (Top Toolbar) */}
      <div className="bg-[#E5ECF4] border-2 border-slate-800 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
          {/* Site selection autocomplete */}
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Label className="text-xs font-black uppercase text-slate-700 shrink-0">Site Name:</Label>
            <div className="relative flex-1">
              <div className="relative flex items-center bg-[#FFE600] border-2 border-slate-900 overflow-hidden shadow-sm">
                <input
                  ref={pageSiteInputRef}
                  type="text"
                  spellCheck="false"
                  value={pageSiteSearchVal}
                  onChange={(e) => {
                    setPageSiteSearchVal(e.target.value);
                    setIsPageSiteSuggestionsOpen(true);
                  }}
                  onFocus={() => setIsPageSiteSuggestionsOpen(true)}
                  onKeyDown={handlePageSiteKeyDown}
                  placeholder="TYPE SITE NAME..."
                  className="w-full px-2 py-1 text-xs font-black bg-[#FFE600] text-slate-955 focus:outline-none placeholder:text-slate-700/60 uppercase font-mono tracking-wider h-8"
                />
                <button
                  type="button"
                  onClick={() => setIsPageSiteSuggestionsOpen((prev) => !prev)}
                  className="px-2 border-l border-slate-900 text-slate-955 hover:bg-[#E5C300] transition-colors focus:outline-none flex items-center justify-center h-full text-xs font-bold font-sans"
                >
                  ▼
                </button>
              </div>

              {/* Site suggestions list */}
              {isPageSiteSuggestionsOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFE600] border-2 border-slate-900 shadow-lg z-50 max-h-48 overflow-y-auto font-mono text-xs uppercase animate-in fade-in duration-100">
                  {filteredPageSiteSuggestions.length === 0 ? (
                    <div className="p-2 text-slate-800 italic text-[11px]">
                      NO MATCHING SITES
                    </div>
                  ) : (
                    filteredPageSiteSuggestions.map((site: any, idx: number) => {
                      const isActive = highlightedPageSiteIndex === idx;
                      return (
                        <button
                          key={site.id}
                          type="button"
                          onClick={() => {
                            setSelectedSiteId(site.id);
                            setPageSiteSearchVal(site.name.toUpperCase());
                            setIsPageSiteSuggestionsOpen(false);
                            setHighlightedPageSiteIndex(-1);
                            pageSearchInputRef.current?.focus();
                          }}
                          onMouseEnter={() => setHighlightedPageSiteIndex(idx)}
                          className={`w-full text-left px-3 py-2 border-b border-slate-900/10 last:border-b-0 transition-colors font-black text-xs uppercase ${
                            isActive
                              ? "bg-slate-950 text-[#FFE600]"
                              : "bg-[#FFE600] text-slate-955 hover:bg-[#E5C300]"
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

          {/* Account search box */}
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Label className="text-xs font-black uppercase text-slate-700 shrink-0">Search Account:</Label>
            <div className="relative flex-1">
              <div className="flex items-center bg-white border-2 border-slate-900 shadow-sm">
                <input
                  ref={pageSearchInputRef}
                  type="text"
                  spellCheck="false"
                  value={accountSearchQuery}
                  onChange={(e) => setAccountSearchQuery(e.target.value)}
                  placeholder="SEARCH BY NAME..."
                  className="w-full px-2 py-1 text-xs font-black bg-white text-slate-850 focus:outline-none placeholder:text-slate-400 uppercase font-mono tracking-wider h-8"
                />
                <div className="px-2 text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Account Button */}
        <button
          type="button"
          onClick={() => {
            // Setup site search value inside popup to match current site
            if (selectedSiteId) {
              const active = sites.find(s => s.id === selectedSiteId);
              if (active) {
                setPopupSiteSearchVal(active.name.toUpperCase());
                setPopupSiteId(active.id);
              }
            }
            setShowPopup(true);
          }}
          className="w-full sm:w-auto px-4 py-1.5 bg-[#FFE600] text-slate-955 border-2 border-slate-900 font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#E5C300] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>[F2] ADD ACCOUNT</span>
        </button>
      </div>

      {/* 3. Accounts Table View */}
      <div className="bg-white border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded overflow-hidden">
        {!selectedSiteId ? (
          <div className="p-20 text-center text-slate-400 italic font-black uppercase tracking-widest bg-slate-50">
            PLEASE SELECT A SITE NAME TO VIEW COMPANY ACCOUNTS / कंपनी खाते देखने के लिए कृपया साइट नाम चुनें
          </div>
        ) : isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : companyAccounts.length === 0 ? (
          <div className="p-16 text-center text-slate-400 italic font-black uppercase bg-slate-50">
            NO ACCOUNTS FOUND FOR THIS SITE / इस साइट के लिए कोई खाता नहीं मिला
          </div>
        ) : (
          <Table className="border-collapse w-full">
            <TableHeader className="bg-slate-100 border-b-2 border-slate-800">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-slate-950 font-black border-r border-slate-300 py-3 text-center uppercase">Sl No.</TableHead>
                <TableHead className="text-slate-950 font-black border-r border-slate-300 py-3 uppercase">Account Name / खाता का नाम</TableHead>
                <TableHead className="text-slate-950 font-black border-r border-slate-300 py-3 uppercase">Address / पता</TableHead>
                <TableHead className="w-48 text-slate-950 font-black border-r border-slate-300 py-3 uppercase">Mobile / मोबाइल</TableHead>
                <TableHead className="w-24 text-slate-950 font-black py-3 text-center uppercase">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companyAccounts.map((account: any, idx: number) => {
                const info = getContactInfo(account.contactPerson);
                const isFocused = idx === focusedRowIndex;
                return (
                  <TableRow
                    key={account.id}
                    id={`account-row-${idx}`}
                    onClick={() => setFocusedRowIndex(idx)}
                    className={`border-b border-slate-300 cursor-pointer font-bold uppercase transition-colors ${
                      isFocused
                        ? "bg-[#FFE600] text-black font-extrabold shadow-inner"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <TableCell className="text-center border-r border-slate-350 py-2.5">{idx + 1}</TableCell>
                    <TableCell className="border-r border-slate-350 py-2.5 font-extrabold">{account.name}</TableCell>
                    <TableCell className="border-r border-slate-350 py-2.5">{info.address}</TableCell>
                    <TableCell className="border-r border-slate-350 py-2.5">{info.mobile}</TableCell>
                    <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteCompany(account.id, account.name)}
                        className={`p-1 rounded transition-colors ${isFocused ? "text-slate-950 hover:bg-slate-950/10" : "text-red-650 hover:bg-red-50"}`}
                        title="Delete Account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 4. Keyboard-Friendly Create Company Popup Dialog */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent aria-describedby={undefined} className="max-w-md bg-white border-2 border-slate-990 font-mono text-slate-900 rounded p-0 shadow-2xl no-print">
          
          <DialogHeader className="sr-only">
            <DialogTitle>Register New Account</DialogTitle>
          </DialogHeader>

          {/* Dialog Header Title */}
          <div className="flex items-center justify-between bg-[#2B547E] text-white px-3 py-2 text-xs font-black shadow-inner select-none border-b-2 border-slate-950">
            <span className="uppercase tracking-wider">ADD ACCOUNT / नया खाता</span>
            <button
              onClick={() => setShowPopup(false)}
              className="w-5 h-5 bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs border border-slate-400 shadow-sm hover:bg-red-650 hover:text-white transition-colors focus:outline-none"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Dialog Form Fields */}
          <form onSubmit={handleRegisterCompany} className="p-6 space-y-4">
            
            {/* Field 1: Site Selector Autocomplete */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                Select Site / साइट चयन:
              </Label>
              <div className="relative">
                <div className="relative flex items-center bg-[#FFE600] border-2 border-slate-900 overflow-hidden shadow-sm">
                  <input
                    ref={popupSiteInputRef}
                    type="text"
                    spellCheck="false"
                    value={popupSiteSearchVal}
                    onChange={(e) => {
                      setPopupSiteSearchVal(e.target.value);
                      setIsPopupSiteSuggestionsOpen(true);
                      setPopupSiteId("");
                    }}
                    onFocus={() => setIsPopupSiteSuggestionsOpen(true)}
                    onKeyDown={(e) => {
                      handlePopupSiteSuggestionsKey(e);
                      handlePopupKeyDown(e, "site");
                    }}
                    placeholder="TYPE SITE NAME OR ARROW DOWN..."
                    className="w-full px-2.5 py-1.5 text-xs font-black bg-[#FFE600] text-slate-955 focus:outline-none placeholder:text-slate-700/60 uppercase font-mono tracking-wider h-8.5"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPopupSiteSuggestionsOpen((prev) => !prev)}
                    className="px-2 border-l border-slate-900 text-slate-955 hover:bg-[#E5C300] transition-colors focus:outline-none flex items-center justify-center h-full text-xs font-bold font-sans"
                  >
                    ▼
                  </button>
                </div>

                {/* Suggestions List in Modal */}
                {isPopupSiteSuggestionsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFE600] border-2 border-slate-900 shadow-lg z-[90] max-h-40 overflow-y-auto font-mono text-xs uppercase animate-in fade-in duration-100">
                    {filteredPopupSiteSuggestions.length === 0 ? (
                      <div className="p-2 text-slate-800 italic text-[11px]">
                        NO MATCHING SITES
                      </div>
                    ) : (
                      filteredPopupSiteSuggestions.map((site: any, idx: number) => {
                        const isActive = highlightedPopupSiteIndex === idx;
                        return (
                          <button
                            key={site.id}
                            type="button"
                            onClick={() => {
                              setPopupSiteId(site.id);
                              setSelectedSiteId(site.id); // sync to page
                              setPopupSiteSearchVal(site.name.toUpperCase());
                              setIsPopupSiteSuggestionsOpen(false);
                              setHighlightedPopupSiteIndex(-1);
                              popupNameInputRef.current?.focus();
                            }}
                            onMouseEnter={() => setHighlightedPopupSiteIndex(idx)}
                            className={`w-full text-left px-3 py-2 border-b border-slate-900/10 last:border-b-0 transition-colors font-black text-xs uppercase ${
                              isActive
                                ? "bg-slate-950 text-[#FFE600]"
                                : "bg-[#FFE600] text-slate-955 hover:bg-[#E5C300]"
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

            {/* Field 2: Account Name */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                Account Name / खाता का नाम:
              </Label>
              <Input
                ref={popupNameInputRef}
                type="text"
                spellCheck="false"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                onKeyDown={(e) => handlePopupKeyDown(e, "name")}
                className="bg-white border-2 border-slate-900 rounded font-bold text-xs uppercase focus:bg-[#FFE600] focus:text-black h-8.5 rounded-none"
              />
            </div>

            {/* Field 3: Address */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                Address / पता:
              </Label>
              <Input
                ref={popupAddressInputRef}
                type="text"
                spellCheck="false"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value.toUpperCase() })}
                onKeyDown={(e) => handlePopupKeyDown(e, "address")}
                className="bg-white border-2 border-slate-900 rounded font-bold text-xs uppercase focus:bg-[#FFE600] focus:text-black h-8.5 rounded-none"
              />
            </div>

            {/* Field 4: Mobile */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                Mobile Number / मोबाइल नंबर:
              </Label>
              <Input
                ref={popupMobileInputRef}
                type="text"
                spellCheck="false"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                onKeyDown={(e) => handlePopupKeyDown(e, "mobile")}
                className="bg-white border-2 border-slate-900 rounded font-bold text-xs uppercase focus:bg-[#FFE600] focus:text-black h-8.5 rounded-none"
              />
            </div>

            {/* Actions: Cancel & Register buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="px-4 py-2 bg-slate-100 border-2 border-slate-900 text-slate-900 font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-200 active:translate-y-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                ref={popupSubmitBtnRef}
                type="submit"
                onKeyDown={(e) => handlePopupKeyDown(e, "submit")}
                className="px-5 py-2 bg-[#FFE600] border-2 border-slate-900 text-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#E5C300] active:translate-y-0.5 active:shadow-none transition-all"
              >
                Register
              </button>
            </div>

          </form>

        </DialogContent>
      </Dialog>

    </div>
  );
}
