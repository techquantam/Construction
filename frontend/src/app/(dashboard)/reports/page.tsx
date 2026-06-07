"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer, Building2, Wallet, ArrowDown } from "lucide-react";
import api from "@/lib/axios";
import { toast } from "sonner";

// Fuzzy search utility matching standard inputs across the app
function matchesFuzzy(name: string, query: string): boolean {
  if (!query) return true;
  const cleanStr = (s: string) => {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/ksh/g, "s")
      .replace(/ks/g, "s")
      .replace(/sh/g, "s")
      .replace(/x/g, "s")
      .replace(/ee/g, "i")
      .replace(/oo/g, "u")
      .replace(/ou/g, "u")
      .replace(/ow/g, "u")
      .replace(/v/g, "w")
      .replace(/y/g, "i")
      .replace(/dh/g, "d")
      .replace(/bh/g, "b")
      .replace(/kh/g, "k")
      .replace(/gh/g, "g")
      .replace(/ch/g, "c")
      .replace(/th/g, "t");
  };
  const normName = cleanStr(name);
  const normQuery = cleanStr(query);

  if (normName.includes(normQuery)) return true;

  // subsequence check
  let qIdx = 0;
  for (let i = 0; i < normName.length && qIdx < normQuery.length; i++) {
    if (normName[i] === normQuery[qIdx]) {
      qIdx++;
    }
  }
  return qIdx === normQuery.length;
}

function parsePaymentModeDetails(mode: string) {
  const clean = (mode || "").trim();
  if (clean.startsWith("{") && clean.endsWith("}")) {
    try {
      const parsed = JSON.parse(clean);
      return {
        qty: parsed.qty !== undefined ? String(parsed.qty) : "",
        unit: parsed.unit || "",
        rate: parsed.rate !== undefined ? String(parsed.rate) : "",
        isStructured: true,
        isCompany: true,
        material: parsed.material || "",
        address: parsed.address || "",
        mobile: parsed.mobile || "",
        crDr: parsed.crDr || "",
        raw: clean
      };
    } catch {
      // fallback
    }
  }
  
  const cleanUpper = clean.toUpperCase();
  if (cleanUpper.includes("@")) {
    const parts = cleanUpper.split("@");
    const beforeAt = parts[0].trim(); // e.g. "2000 SFT"
    const ratePart = parts[1].trim(); // e.g. "1500/="
    
    // Split beforeAt to find quantity and unit
    const subParts = beforeAt.split(/\s+/);
    if (subParts.length >= 2) {
      const qty = subParts[0];
      const unit = subParts.slice(1).join(" ");
      return { qty, unit, rate: ratePart, isStructured: true, isCompany: false, material: "", raw: cleanUpper };
    }
  }
  return { qty: "", unit: "", rate: "", isStructured: false, isCompany: false, material: "", raw: cleanUpper };
}

function parsePartyDetails(contactPerson: string | null) {
  if (!contactPerson) return null;
  const trimmed = contactPerson.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function formatRenderDate(dateISO: string) {
  try {
    const d = new Date(dateISO);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}`;
  } catch {
    return dateISO;
  }
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const reportType = searchParams.get("type") || "summary";

  // Site query
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const response = await api.get("/sites");
      return response.data.data;
    },
  });

  // Ledgers query
  const { data: ledgers } = useQuery({
    queryKey: ["ledgers"],
    queryFn: async () => {
      const response = await api.get("/ledgers");
      return response.data.data;
    },
  });

  // DAYBOOK STATES
  const [dbSiteSearchVal, setDbSiteSearchVal] = useState("");
  const [dbSelectedSiteId, setDbSelectedSiteId] = useState<string | null>(null);
  const [isDbSiteSuggestionsOpen, setIsDbSiteSuggestionsOpen] = useState(false);
  const [highlightedDbSiteIndex, setHighlightedDbSiteIndex] = useState<number>(-1);
  const dbSiteSelectorRef = useRef<HTMLDivElement>(null);

  // LEDGER STATES
  const [lgSiteSearchVal, setLgSiteSearchVal] = useState("");
  const [lgSelectedSiteId, setLgSelectedSiteId] = useState<string | null>(null);
  const [isLgSiteSuggestionsOpen, setIsLgSiteSuggestionsOpen] = useState(false);
  const [highlightedLgSiteIndex, setHighlightedLgSiteIndex] = useState<number>(-1);
  const lgSiteSelectorRef = useRef<HTMLDivElement>(null);

  const [lgLedgerSearchVal, setLgLedgerSearchVal] = useState("");
  const [lgSelectedLedgerId, setLgSelectedLedgerId] = useState<string | null>(null);
  const [isLgLedgerSuggestionsOpen, setIsLgLedgerSuggestionsOpen] = useState(false);
  const [highlightedLgLedgerIndex, setHighlightedLgLedgerIndex] = useState<number>(-1);
  const lgLedgerSelectorRef = useRef<HTMLDivElement>(null);
  const [lgFilterDate, setLgFilterDate] = useState("");
  const [lgSelectedRowIndex, setLgSelectedRowIndex] = useState<number>(-1);
  const [dbSelectedRowIndex, setDbSelectedRowIndex] = useState<number>(-1);

  // SUMMARY STATES
  const [smSiteSearchVal, setSmSiteSearchVal] = useState("");
  const [smSelectedSiteId, setSmSelectedSiteId] = useState<string | null>(null);
  const [isSmSiteSuggestionsOpen, setIsSmSiteSuggestionsOpen] = useState(false);
  const [highlightedSmSiteIndex, setHighlightedSmSiteIndex] = useState<number>(-1);
  const smSiteSelectorRef = useRef<HTMLDivElement>(null);

  const [smLedgerSearchVal, setSmLedgerSearchVal] = useState("");
  const [smSelectedLedgerId, setSmSelectedLedgerId] = useState<string | null>(null);
  const [isSmLedgerSuggestionsOpen, setIsSmLedgerSuggestionsOpen] = useState(false);
  const [highlightedSmLedgerIndex, setHighlightedSmLedgerIndex] = useState<number>(-1);
  const smLedgerSelectorRef = useRef<HTMLDivElement>(null);

  // Focus tracking states for premium yellow style transitions
  const [isLgSiteFocused, setIsLgSiteFocused] = useState(false);
  const [isLgLedgerFocused, setIsLgLedgerFocused] = useState(false);
  const [isSmSiteFocused, setIsSmSiteFocused] = useState(false);
  const [isSmLedgerFocused, setIsSmLedgerFocused] = useState(false);

  // Autofocus input refs
  const lgSiteInputRef = useRef<HTMLInputElement>(null);
  const dbSiteInputRef = useRef<HTMLInputElement>(null);
  const lgLedgerInputRef = useRef<HTMLInputElement>(null);
  const smSiteInputRef = useRef<HTMLInputElement>(null);
  const smLedgerInputRef = useRef<HTMLInputElement>(null);

  // Daybook data query
  const { data: daybookData } = useQuery({
    queryKey: ["daybookReport", dbSelectedSiteId],
    queryFn: async () => {
      if (!dbSelectedSiteId) return [];
      const res = await api.get(`/daybooks?siteId=${dbSelectedSiteId}`);
      return res.data.data;
    },
    enabled: !!dbSelectedSiteId,
  });

  // Ledger transactions statements query
  const { data: ledgerDaybookData } = useQuery({
    queryKey: ["ledgerReportDaybooks", lgSelectedSiteId],
    queryFn: async () => {
      if (!lgSelectedSiteId) return [];
      const res = await api.get(`/daybooks?siteId=${lgSelectedSiteId}`);
      return res.data.data;
    },
    enabled: !!lgSelectedSiteId,
  });

  // Summary transactions statements query
  const { data: summaryDaybookData } = useQuery({
    queryKey: ["summaryReportDaybooks", smSelectedSiteId],
    queryFn: async () => {
      if (!smSelectedSiteId) return [];
      const res = await api.get(`/daybooks?siteId=${smSelectedSiteId}`);
      return res.data.data;
    },
    enabled: !!smSelectedSiteId,
  });

  // Sync state values on site changes or inputs click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dbSiteSelectorRef.current && !dbSiteSelectorRef.current.contains(event.target as Node)) {
        setIsDbSiteSuggestionsOpen(false);
      }
      if (lgSiteSelectorRef.current && !lgSiteSelectorRef.current.contains(event.target as Node)) {
        setIsLgSiteSuggestionsOpen(false);
      }
      if (lgLedgerSelectorRef.current && !lgLedgerSelectorRef.current.contains(event.target as Node)) {
        setIsLgLedgerSuggestionsOpen(false);
      }
      if (smSiteSelectorRef.current && !smSiteSelectorRef.current.contains(event.target as Node)) {
        setIsSmSiteSuggestionsOpen(false);
      }
      if (smLedgerSelectorRef.current && !smLedgerSelectorRef.current.contains(event.target as Node)) {
        setIsSmLedgerSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Autofocus search box when reportType changes
  useEffect(() => {
    if (reportType === "ledger") {
      setTimeout(() => {
        lgSiteInputRef.current?.focus();
      }, 100);
    } else if (reportType === "daybook") {
      setTimeout(() => {
        dbSiteInputRef.current?.focus();
      }, 100);
    } else if (reportType === "summary") {
      setTimeout(() => {
        smSiteInputRef.current?.focus();
      }, 100);
    }
  }, [reportType]);

  // Reset selected site and ledger state on page mount to prevent preloaded data
  useEffect(() => {
    setLgSelectedSiteId(null);
    setLgSiteSearchVal("");
    setLgSelectedLedgerId(null);
    setLgLedgerSearchVal("");
    setLgFilterDate("");
    setDbSelectedSiteId(null);
    setDbSiteSearchVal("");
    // Also reset summary states
    setSmSelectedSiteId(null);
    setSmSiteSearchVal("");
    setSmSelectedLedgerId(null);
    setSmLedgerSearchVal("");
  }, []);

  // Filter site list for Daybook Autocomplete
  const filteredDbSites = (() => {
    if (!sites) return [];
    const activeSite = sites.find((s: any) => s.id === dbSelectedSiteId);
    const isSearching = dbSiteSearchVal.trim() !== "" && dbSiteSearchVal.toUpperCase() !== activeSite?.name?.toUpperCase();
    if (!isSearching) return sites;
    return sites.filter((site: any) => matchesFuzzy(site.name, dbSiteSearchVal));
  })();

  // Filter site list for Ledger Autocomplete
  const filteredLgSites = (() => {
    if (!sites) return [];
    const activeSite = sites.find((s: any) => s.id === lgSelectedSiteId);
    const isSearching = lgSiteSearchVal.trim() !== "" && lgSiteSearchVal.toUpperCase() !== activeSite?.name?.toUpperCase();
    if (!isSearching) return sites;
    return sites.filter((site: any) => matchesFuzzy(site.name, lgSiteSearchVal));
  })();

  // Filter site list for Summary Autocomplete
  const filteredSmSites = (() => {
    if (!sites) return [];
    const activeSite = sites.find((s: any) => s.id === smSelectedSiteId);
    const isSearching = smSiteSearchVal.trim() !== "" && smSiteSearchVal.toUpperCase() !== activeSite?.name?.toUpperCase();
    if (!isSearching) return sites;
    return sites.filter((site: any) => matchesFuzzy(site.name, smSiteSearchVal));
  })();

  // List of active accounts used in that site's transactions
  const activeSiteLedgers = (() => {
    if (!lgSelectedSiteId || !ledgerDaybookData) return [];
    const names = new Set<string>();
    ledgerDaybookData.forEach((item: any) => {
      const text = item.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
      else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
      if (name) names.add(name);
    });

    const list: any[] = [];
    names.forEach((name) => {
      const dbLedger = ledgers ? ledgers.find((l: any) => l.name.toUpperCase() === name) : null;
      list.push({
        id: dbLedger ? dbLedger.id : name,
        name: name,
        phone: dbLedger ? dbLedger.phone || "" : "",
        contactPerson: dbLedger ? dbLedger.contactPerson || "" : "",
        isVirtual: !dbLedger
      });
    });
    // Sort alphabetically by name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // List of active accounts used in that site's transactions for Summary
  const summaryActiveSiteLedgers = (() => {
    if (!smSelectedSiteId || !summaryDaybookData) return [];
    const names = new Set<string>();
    summaryDaybookData.forEach((item: any) => {
      const text = item.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
      else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
      if (name) names.add(name);
    });

    const list: any[] = [];
    names.forEach((name) => {
      const dbLedger = ledgers ? ledgers.find((l: any) => l.name.toUpperCase() === name) : null;
      list.push({
        id: dbLedger ? dbLedger.id : name,
        name: name,
        phone: dbLedger ? dbLedger.phone || "" : "",
        contactPerson: dbLedger ? dbLedger.contactPerson || "" : "",
        isVirtual: !dbLedger
      });
    });
    // Sort alphabetically by name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Filter accounts suggestions list to display active site accounts only
  const filteredLgLedgers = (() => {
    if (!activeSiteLedgers || activeSiteLedgers.length === 0) return [];
    const activeLedger = activeSiteLedgers.find((l) => String(l.id) === String(lgSelectedLedgerId));
    const isSearching = lgLedgerSearchVal.trim() !== "" && lgLedgerSearchVal.toUpperCase() !== activeLedger?.name?.toUpperCase();
    
    if (!isSearching) {
      return activeSiteLedgers;
    }
    
    return activeSiteLedgers.filter((ledger) => {
      const details = parsePartyDetails(ledger.contactPerson);
      const address = details ? details.address : (ledger.contactPerson || "");
      const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");
      return (
        matchesFuzzy(ledger.name, lgLedgerSearchVal) ||
        (address && matchesFuzzy(address, lgLedgerSearchVal)) ||
        (phone && matchesFuzzy(phone, lgLedgerSearchVal))
      );
    });
  })();

  // Filter accounts suggestions list to display active site accounts only for Summary
  const filteredSmLedgers = (() => {
    const isAll = smSelectedLedgerId === "all";
    const activeLedger = isAll ? { name: "ALL ACCOUNTS" } : summaryActiveSiteLedgers.find((l) => String(l.id) === String(smSelectedLedgerId));
    const isSearching = smLedgerSearchVal.trim() !== "" && smLedgerSearchVal.toUpperCase() !== activeLedger?.name?.toUpperCase();
    
    if (!isSearching) {
      return [{ id: "all", name: "ALL ACCOUNTS" }, ...summaryActiveSiteLedgers];
    }
    
    const matches = summaryActiveSiteLedgers.filter((ledger) => {
      const details = parsePartyDetails(ledger.contactPerson);
      const address = details ? details.address : (ledger.contactPerson || "");
      const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");
      return (
        matchesFuzzy(ledger.name, smLedgerSearchVal) ||
        (address && matchesFuzzy(address, smLedgerSearchVal)) ||
        (phone && matchesFuzzy(phone, smLedgerSearchVal))
      );
    });

    if (matchesFuzzy("ALL ACCOUNTS", smLedgerSearchVal)) {
      return [{ id: "all", name: "ALL ACCOUNTS" }, ...matches];
    }
    return matches;
  })();

  // Summary list of balances calculation
  const summaryLedgersList = (() => {
    if (!smSelectedSiteId || !summaryDaybookData) return [];

    return summaryActiveSiteLedgers.map((ledger) => {
      const details = parsePartyDetails(ledger.contactPerson);
      const address = details ? details.address : (ledger.contactPerson || "");
      const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");

      let totalDebit = 0;
      let totalCredit = 0;

      summaryDaybookData.forEach((item: any) => {
        const text = item.expenseType || "";
        let name = "";
        if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
        else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
        
        if (name === ledger.name.toUpperCase()) {
          let isDebit = text.toUpperCase().startsWith("TO ");
          const compDetails = item.paymentMode && item.paymentMode.trim().startsWith("{") && item.paymentMode.trim().endsWith("}")
            ? (() => {
                try { return JSON.parse(item.paymentMode); } catch { return null; }
              })()
            : null;

          if (compDetails && compDetails.crDr) {
            isDebit = compDetails.crDr === "DR";
          }

          if (isDebit) {
            totalDebit += item.amount;
          } else {
            totalCredit += item.amount;
          }
        }
      });

      const balance = totalDebit - totalCredit;
      const status = balance > 0 ? "DR" : balance < 0 ? "CR" : "NIL";

      return {
        ...ledger,
        address,
        phone,
        totalDebit,
        totalCredit,
        balance: Math.abs(balance),
        status
      };
    });
  })();

  // Keyboard controls for site dropdown in PRINT DAYBOOK
  const handleDbSiteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDbSiteSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsDbSiteSuggestionsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedDbSiteIndex((prev) => {
        const next = prev + 1;
        return next >= filteredDbSites.length ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedDbSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredDbSites.length - 1 : next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let idx = highlightedDbSiteIndex;
      if (idx === -1 && filteredDbSites.length > 0) idx = 0;
      if (idx >= 0 && idx < filteredDbSites.length) {
        const site = filteredDbSites[idx];
        setDbSelectedSiteId(site.id);
        setDbSiteSearchVal(site.name.toUpperCase());
        setIsDbSiteSuggestionsOpen(false);
        setHighlightedDbSiteIndex(-1);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsDbSiteSuggestionsOpen(false);
      setHighlightedDbSiteIndex(-1);
    }
  };

  // Keyboard controls for site dropdown in PRINT LEDGER
  const handleLgSiteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isLgSiteSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsLgSiteSuggestionsOpen(true);
        e.preventDefault();
      } else if (e.key === "Enter") {
        e.preventDefault();
        lgLedgerInputRef.current?.focus();
        lgLedgerInputRef.current?.select();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedLgSiteIndex((prev) => {
        const next = prev + 1;
        return next >= filteredLgSites.length ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedLgSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredLgSites.length - 1 : next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let idx = highlightedLgSiteIndex;
      if (idx === -1 && filteredLgSites.length > 0) idx = 0;
      if (idx >= 0 && idx < filteredLgSites.length) {
        const site = filteredLgSites[idx];
        setLgSelectedSiteId(site.id);
        setLgSiteSearchVal(site.name.toUpperCase());
        setIsLgSiteSuggestionsOpen(false);
        setHighlightedLgSiteIndex(-1);
        
        // reset ledger selection when site changes
        setLgSelectedLedgerId(null);
        setLgLedgerSearchVal("");

        setTimeout(() => {
          lgLedgerInputRef.current?.focus();
          lgLedgerInputRef.current?.select();
        }, 100);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsLgSiteSuggestionsOpen(false);
      setHighlightedLgSiteIndex(-1);
    }
  };

  // Keyboard controls for account dropdown in PRINT LEDGER
  const handleLgLedgerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isLgLedgerSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsLgLedgerSuggestionsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedLgLedgerIndex((prev) => {
        const next = prev + 1;
        const index = next >= filteredLgLedgers.length ? 0 : next;
        const ledger = filteredLgLedgers[index];
        if (ledger) {
          setLgSelectedLedgerId(ledger.id);
          setLgLedgerSearchVal(ledger.name.toUpperCase());
        }
        return index;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedLgLedgerIndex((prev) => {
        const next = prev - 1;
        const index = next < 0 ? filteredLgLedgers.length - 1 : next;
        const ledger = filteredLgLedgers[index];
        if (ledger) {
          setLgSelectedLedgerId(ledger.id);
          setLgLedgerSearchVal(ledger.name.toUpperCase());
        }
        return index;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      setIsLgLedgerSuggestionsOpen(false);
      setHighlightedLgLedgerIndex(-1);
      lgLedgerInputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsLgLedgerSuggestionsOpen(false);
      setHighlightedLgLedgerIndex(-1);
    }
  };

  // Keyboard controls for site dropdown in PRINT SUMMARY
  const handleSmSiteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSmSiteSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsSmSiteSuggestionsOpen(true);
        e.preventDefault();
      } else if (e.key === "Enter") {
        e.preventDefault();
        smLedgerInputRef.current?.focus();
        smLedgerInputRef.current?.select();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSmSiteIndex((prev) => {
        const next = prev + 1;
        return next >= filteredSmSites.length ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSmSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredSmSites.length - 1 : next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let idx = highlightedSmSiteIndex;
      if (idx === -1 && filteredSmSites.length > 0) idx = 0;
      if (idx >= 0 && idx < filteredSmSites.length) {
        const site = filteredSmSites[idx];
        setSmSelectedSiteId(site.id);
        setSmSiteSearchVal(site.name.toUpperCase());
        setIsSmSiteSuggestionsOpen(false);
        setHighlightedSmSiteIndex(-1);
        
        // reset ledger selection when site changes
        setSmSelectedLedgerId(null);
        setSmLedgerSearchVal("");

        setTimeout(() => {
          smLedgerInputRef.current?.focus();
          smLedgerInputRef.current?.select();
        }, 100);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsSmSiteSuggestionsOpen(false);
      setHighlightedSmSiteIndex(-1);
    }
  };

  // Keyboard controls for account dropdown in PRINT SUMMARY
  const handleSmLedgerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSmLedgerSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsSmLedgerSuggestionsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSmLedgerIndex((prev) => {
        const next = prev + 1;
        const index = next >= filteredSmLedgers.length ? 0 : next;
        const ledger = filteredSmLedgers[index];
        if (ledger) {
          setSmSelectedLedgerId(ledger.id);
          setSmLedgerSearchVal(ledger.name.toUpperCase());
        }
        return index;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSmLedgerIndex((prev) => {
        const next = prev - 1;
        const index = next < 0 ? filteredSmLedgers.length - 1 : next;
        const ledger = filteredSmLedgers[index];
        if (ledger) {
          setSmSelectedLedgerId(ledger.id);
          setSmLedgerSearchVal(ledger.name.toUpperCase());
        }
        return index;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      setIsSmLedgerSuggestionsOpen(false);
      setHighlightedSmLedgerIndex(-1);
      smLedgerInputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsSmLedgerSuggestionsOpen(false);
      setHighlightedSmLedgerIndex(-1);
    }
  };

  // Chronological computation for PRINT DAYBOOK
  const processedDbData = (() => {
    if (!daybookData) return { items: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };

    const sorted = [...daybookData].sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let cumulativeBalance = 0.0;
    let totalDebit = 0.0;
    let totalCredit = 0.0;

    const items = sorted.map((item: any) => {
      const text = item.expenseType || "";
      let type: "TO" | "BY" = "TO";
      let particular = text;
      
      if (text.startsWith("To ") || text.startsWith("TO ")) {
        type = "TO";
        particular = text.substring(3);
      } else if (text.startsWith("By ") || text.startsWith("BY ")) {
        type = "BY";
        particular = text.substring(3);
      }

      const compDetails = item.paymentMode && item.paymentMode.trim().startsWith("{") && item.paymentMode.trim().endsWith("}")
        ? (() => {
            try { return JSON.parse(item.paymentMode); } catch { return null; }
          })()
        : null;

      let isDebit = type === "TO";
      if (compDetails && compDetails.crDr) {
        isDebit = compDetails.crDr === "DR";
      }

      const typeText = isDebit ? "TO" : "BY";
      const debitVal = isDebit ? item.amount : 0.0;
      const creditVal = !isDebit ? item.amount : 0.0;

      cumulativeBalance = cumulativeBalance + debitVal - creditVal;
      totalDebit += debitVal;
      totalCredit += creditVal;

      const parsed = parsePaymentModeDetails(item.paymentMode || "CASH");
      let displayParticular = "";
      if (parsed.isCompany) {
        displayParticular = `${particular.toUpperCase()} (${parsed.material || "COMPANY TRANSACTION"})`;
      } else {
        displayParticular = `${particular.toUpperCase()} (${item.paymentMode || "CASH"})`;
      }

      return {
        ...item,
        parsedType: typeText,
        parsedParticular: particular,
        displayParticular,
        debit: debitVal,
        credit: creditVal,
        runningBalance: cumulativeBalance,
      };
    });

    return { items, totalDebit, totalCredit, finalBalance: cumulativeBalance };
  })();

  // Chronological statement computation for PRINT LEDGER
  const processedLgData = (() => {
    if (!lgSelectedSiteId || !ledgerDaybookData) {
      return { items: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };
    }

    const isAll = lgSelectedLedgerId === "all";
    if (!isAll && !lgSelectedLedgerId) {
      return { items: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };
    }

    const searchVal = lgLedgerSearchVal.trim().toUpperCase();
    
    // Find active ledger in activeSiteLedgers or database ledgers list
    const activeLedger = isAll 
      ? null 
      : (activeSiteLedgers.find(
          (l: any) => String(l.id) === String(lgSelectedLedgerId) || l.name.toUpperCase() === searchVal
        ) || (ledgers ? ledgers.find((l: any) => String(l.id) === String(lgSelectedLedgerId) || l.name.toUpperCase() === searchVal) : null));

    const filtered = ledgerDaybookData.filter((item: any) => {
      if (isAll) return true;
      const text = item.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
      else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
      
      if (activeLedger) {
        return name === activeLedger.name.toUpperCase();
      }
      
      // Fallback: If they typed something that doesn't exactly map to an activeLedger object, fuzzy/partial match on name
      return name.includes(searchVal) || searchVal.includes(name);
    });

    const sorted = [...filtered].sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let cumulativeBalance = 0.0;
    let totalDebit = 0.0;
    let totalCredit = 0.0;

    const items = sorted.map((item: any) => {
      const text = item.expenseType || "";
      let isDebit = text.toUpperCase().startsWith("TO ");
      
      const compDetails = item.paymentMode && item.paymentMode.trim().startsWith("{") && item.paymentMode.trim().endsWith("}")
        ? (() => {
            try { return JSON.parse(item.paymentMode); } catch { return null; }
          })()
        : null;

      if (compDetails && compDetails.crDr) {
        isDebit = compDetails.crDr === "DR";
      }

      const typeText = isDebit ? "TO" : "BY";
      
      let cleanParticular = text;
      if (text.toUpperCase().startsWith("TO ")) {
        cleanParticular = text.substring(3);
      } else if (text.toUpperCase().startsWith("BY ")) {
        cleanParticular = text.substring(3);
      }

      const debitVal = isDebit ? item.amount : 0.0;
      const creditVal = !isDebit ? item.amount : 0.0;

      cumulativeBalance = cumulativeBalance + debitVal - creditVal;
      totalDebit += debitVal;
      totalCredit += creditVal;

      const parsed = parsePaymentModeDetails(item.paymentMode || "CASH");
      
      const isAll = lgSelectedLedgerId === "all";
      let displayParticular = "";
      if (parsed.isCompany) {
        displayParticular = isAll
          ? `${cleanParticular.toUpperCase()} (${parsed.material || "COMPANY TRANSACTION"})`
          : (parsed.material || "COMPANY TRANSACTION");
      } else {
        displayParticular = isAll
          ? `${cleanParticular.toUpperCase()} (${item.paymentMode || "CASH"})`
          : (parsed.isStructured ? "PLOT PURCHASE" : (item.paymentMode || "CASH"));
      }

      return {
        ...item,
        parsedType: typeText,
        particulars: cleanParticular.toUpperCase(),
        displayParticular,
        qty: parsed.qty,
        unit: parsed.unit,
        rate: parsed.rate,
        isStructured: parsed.isStructured,
        paymentMethod: item.paymentMode || "CASH",
        debit: debitVal,
        credit: creditVal,
        runningBalance: cumulativeBalance,
      };
    });

    const filteredItems = lgFilterDate
      ? items.filter((item: any) => {
          try {
            const d = new Date(item.date);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const itemDateStr = `${yyyy}-${mm}-${dd}`;
            return itemDateStr === lgFilterDate;
          } catch {
            return false;
          }
        })
      : items;

    let filteredTotalDebit = 0.0;
    let filteredTotalCredit = 0.0;
    filteredItems.forEach((item: any) => {
      filteredTotalDebit += item.debit;
      filteredTotalCredit += item.credit;
    });

    return { 
      items: filteredItems, 
      totalDebit: filteredTotalDebit, 
      totalCredit: filteredTotalCredit, 
      finalBalance: filteredTotalDebit - filteredTotalCredit 
    };
  })();

  // EXPORT EXCEL & PDF HANDLERS
  const handlePrintPDF = () => {
    window.print();
  };

  const handleExportDbExcel = () => {
    if (!processedDbData.items.length) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Particulars", "Debit", "Credit", "Dr/Cr", "Amount"];
    const rows = processedDbData.items.map((item: any) => {
      const rowDrCr = (item.debit > 0 || item.parsedType === "TO") ? "DR" : "CR";
      const runningBalSign = item.runningBalance < 0 ? "CR " : item.runningBalance > 0 ? "DR " : "";
      return [
        item.displayParticular,
        item.debit > 0 ? item.debit : 0,
        item.credit > 0 ? item.credit : 0,
        rowDrCr,
        item.runningBalance === 0 ? "NILL" : `${runningBalSign}${Math.abs(item.runningBalance)}`
      ];
    });
    
    rows.push([
      "TOTAL",
      processedDbData.totalDebit,
      processedDbData.totalCredit,
      processedDbData.finalBalance === 0 ? "NIL" : (processedDbData.finalBalance < 0 ? "CR" : "DR"),
      processedDbData.finalBalance === 0 ? "NILL" : `${processedDbData.finalBalance < 0 ? "CR " : "DR "}${Math.abs(processedDbData.finalBalance)}`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daybook_report_${dbSelectedSiteId || "site"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel CSV file downloaded successfully");
  };

  const handleExportLgExcel = () => {
    if (!processedLgData.items.length) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Particulars", "Qty", "Unit", "Rate", "Debit", "Credit", "Dr/Cr", "Amount"];
    const rows = processedLgData.items.map((item: any) => {
      const rowDrCr = (item.debit > 0 || item.parsedType === "TO") ? "DR" : "CR";
      const runningBalSign = item.runningBalance < 0 ? "CR " : item.runningBalance > 0 ? "DR " : "";
      return [
        item.displayParticular,
        item.isStructured ? item.qty : "-",
        item.isStructured ? item.unit : "-",
        item.isStructured ? item.rate : "-",
        item.debit > 0 ? item.debit : 0,
        item.credit > 0 ? item.credit : 0,
        rowDrCr,
        item.runningBalance === 0 ? "NILL" : `${runningBalSign}${Math.abs(item.runningBalance)}`
      ];
    });
    
    rows.push([
      "TOTAL",
      "",
      "",
      "",
      processedLgData.totalDebit,
      processedLgData.totalCredit,
      processedLgData.finalBalance === 0 ? "NIL" : (processedLgData.finalBalance < 0 ? "CR" : "DR"),
      processedLgData.finalBalance === 0 ? "NILL" : `${processedLgData.finalBalance < 0 ? "CR " : "DR "}${Math.abs(processedLgData.finalBalance)}`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ledger_report_${lgSelectedSiteId || "site"}_${lgSelectedLedgerId || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel CSV file downloaded successfully");
  };

  const handleExportSmExcel = () => {
    const dataToExport = smSelectedLedgerId && smSelectedLedgerId !== "all"
      ? summaryLedgersList.filter(l => String(l.id) === String(smSelectedLedgerId))
      : summaryLedgersList;

    if (!dataToExport.length) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Account Name", "Address", "Mobile No.", "Debit", "Credit", "Dr/Cr", "Balance"];
    const rows = dataToExport.map((item: any) => {
      return [
        item.name.toUpperCase(),
        item.address ? item.address.toUpperCase() : "-",
        item.phone || "-",
        item.totalDebit,
        item.totalCredit,
        item.status,
        item.balance
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `summary_report_${smSelectedSiteId || "site"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel CSV file downloaded successfully");
  };

  // Keyboard shortcut listeners (F2 for PDF, F3 for Excel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        window.print();
      } else if (e.key === "F3") {
        e.preventDefault();
        if (reportType === "daybook") {
          handleExportDbExcel();
        } else if (reportType === "ledger") {
          handleExportLgExcel();
        } else if (reportType === "summary") {
          handleExportSmExcel();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reportType, processedDbData, processedLgData, dbSelectedSiteId, lgSelectedSiteId, lgSelectedLedgerId, smSelectedSiteId, smSelectedLedgerId, summaryLedgersList]);

  // Auto-select first account in Print Ledger when site changes and activeSiteLedgers is populated
  useEffect(() => {
    if (lgSelectedSiteId && activeSiteLedgers.length > 0 && !lgSelectedLedgerId) {
      const first = activeSiteLedgers[0];
      setLgSelectedLedgerId(first.id);
      setLgLedgerSearchVal(first.name.toUpperCase());
    }
  }, [lgSelectedSiteId, activeSiteLedgers, lgSelectedLedgerId]);

  // Auto-select first row (index 0) in Print Ledger table when ledger data changes
  useEffect(() => {
    if (reportType === "ledger" && processedLgData.items.length > 0) {
      setLgSelectedRowIndex(0);
    } else {
      setLgSelectedRowIndex(-1);
    }
  }, [lgSelectedLedgerId, processedLgData.items.length, reportType]);

  // Auto-select first row (index 0) in Print Daybook table when daybook data changes
  useEffect(() => {
    if (reportType === "daybook" && processedDbData.items.length > 0) {
      setDbSelectedRowIndex(0);
    } else {
      setDbSelectedRowIndex(-1);
    }
  }, [dbSelectedSiteId, processedDbData.items.length, reportType]);

  // Global keydown handler for navigating ledger rows
  useEffect(() => {
    const handleLgTableKeyDown = (e: KeyboardEvent) => {
      if (reportType !== "ledger") return;
      if (
        isLgSiteSuggestionsOpen || 
        isLgLedgerSuggestionsOpen || 
        isDbSiteSuggestionsOpen || 
        isSmSiteSuggestionsOpen || 
        isSmLedgerSuggestionsOpen
      ) {
        return;
      }
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      const itemsCount = processedLgData.items.length;
      if (itemsCount === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setLgSelectedRowIndex((prev) => {
          const next = prev + 1;
          const target = next >= itemsCount ? itemsCount - 1 : next;
          const el = document.getElementById(`lg-row-${target}`);
          if (el) el.scrollIntoView({ block: "nearest" });
          return target;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setLgSelectedRowIndex((prev) => {
          const next = prev - 1;
          const target = next < 0 ? 0 : next;
          const el = document.getElementById(`lg-row-${target}`);
          if (el) el.scrollIntoView({ block: "nearest" });
          return target;
        });
      }
    };

    window.addEventListener("keydown", handleLgTableKeyDown);
    return () => window.removeEventListener("keydown", handleLgTableKeyDown);
  }, [
    reportType, 
    processedLgData.items.length, 
    isLgSiteSuggestionsOpen, 
    isLgLedgerSuggestionsOpen,
    isDbSiteSuggestionsOpen,
    isSmSiteSuggestionsOpen,
    isSmLedgerSuggestionsOpen
  ]);

  // Global keydown handler for navigating daybook rows
  useEffect(() => {
    const handleDbTableKeyDown = (e: KeyboardEvent) => {
      if (reportType !== "daybook") return;
      if (
        isDbSiteSuggestionsOpen || 
        isLgSiteSuggestionsOpen || 
        isLgLedgerSuggestionsOpen || 
        isSmSiteSuggestionsOpen || 
        isSmLedgerSuggestionsOpen
      ) {
        return;
      }
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      const itemsCount = processedDbData.items.length;
      if (itemsCount === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDbSelectedRowIndex((prev) => {
          const next = prev + 1;
          const target = next >= itemsCount ? itemsCount - 1 : next;
          const el = document.getElementById(`db-row-${target}`);
          if (el) el.scrollIntoView({ block: "nearest" });
          return target;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setDbSelectedRowIndex((prev) => {
          const next = prev - 1;
          const target = next < 0 ? 0 : next;
          const el = document.getElementById(`db-row-${target}`);
          if (el) el.scrollIntoView({ block: "nearest" });
          return target;
        });
      }
    };

    window.addEventListener("keydown", handleDbTableKeyDown);
    return () => window.removeEventListener("keydown", handleDbTableKeyDown);
  }, [
    reportType, 
    processedDbData.items.length, 
    isDbSiteSuggestionsOpen,
    isLgSiteSuggestionsOpen, 
    isLgLedgerSuggestionsOpen,
    isSmSiteSuggestionsOpen,
    isSmLedgerSuggestionsOpen
  ]);


  // VIEW RENDERS
  if (reportType === "summary") {
    const selectedLedgerObj = smSelectedLedgerId === "all" || !smSelectedLedgerId
      ? null
      : summaryLedgersList.find((l: any) => String(l.id) === String(smSelectedLedgerId));

    const selectedLedgerName = selectedLedgerObj ? selectedLedgerObj.name : "";
    const selectedLedgerPhone = selectedLedgerObj ? selectedLedgerObj.phone : "";
    const selectedLedgerAddress = selectedLedgerObj ? selectedLedgerObj.address : "";

    const smFillerCount = Math.max(0, 10 - summaryLedgersList.length);
    const smFillers = Array.from({ length: smFillerCount });

    // Net balance details if single account is selected
    const singleAccountBalance = selectedLedgerObj ? selectedLedgerObj.balance : 0;
    const singleAccountStatus = selectedLedgerObj ? selectedLedgerObj.status : "NIL";
    const singleAccountDebit = selectedLedgerObj ? selectedLedgerObj.totalDebit : 0;
    const singleAccountCredit = selectedLedgerObj ? selectedLedgerObj.totalCredit : 0;

    return (
      <div className="font-mono text-slate-800 max-w-[96%] sm:max-w-[98%] mx-auto space-y-4">
        
        {/* PRINT SUMMARY PANEL */}
        <div className="bg-white border-2 border-slate-800 rounded shadow-lg overflow-hidden">

          {/* Windows retro window frame title bar */}
          <div className="flex items-center justify-between bg-[#2B547E] text-white px-3 py-1.5 font-mono text-xs font-black shadow-inner select-none no-print">
            <div className="flex items-center gap-2">
              <Printer className="h-3.5 w-3.5" />
              <span>Print_Summary</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-slate-800 text-[8px] flex items-center justify-center font-bold font-sans shadow-sm select-none">_</span>
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-slate-800 text-[8px] flex items-center justify-center font-bold font-sans shadow-sm select-none">&#9633;</span>
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-red-650 text-[9px] flex items-center justify-center font-black font-sans shadow-sm select-none">X</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 font-mono">
            
            {/* LEFT SIDEBAR (Col span 1) */}
            <div className="lg:col-span-1 bg-[#E5ECF4] border-r border-slate-300 p-4 space-y-4 no-print flex flex-col h-full min-h-[550px]">
              
              {/* Top Label */}
              <div className="bg-[#2B547E] text-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-t-sm shadow-sm">
                Account Summary : (ALL RECORD)
              </div>
 
              {/* SITE SELECTOR */}
              <div className="space-y-1.5" ref={smSiteSelectorRef}>
                <span className="font-bold text-[10px] uppercase text-slate-700 tracking-wider block">Select Site / Company :</span>
                <div className="relative">
                  <div className="relative flex items-center bg-white border border-slate-400 rounded overflow-hidden">
                    <input 
                      ref={smSiteInputRef}
                      type="text"
                      value={smSiteSearchVal}
                      placeholder="TYPE TO SEARCH SITE..."
                      onChange={(e) => {
                        setSmSiteSearchVal(e.target.value);
                        setIsSmSiteSuggestionsOpen(true);
                        setHighlightedSmSiteIndex(-1);
                      }}
                      onFocus={() => {
                        setIsSmSiteSuggestionsOpen(true);
                        setHighlightedSmSiteIndex(-1);
                        setIsSmSiteFocused(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsSmSiteFocused(false), 200);
                      }}
                      onKeyDown={handleSmSiteKeyDown}
                      className={`w-full px-2.5 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-400 uppercase font-mono tracking-wide transition-colors ${
                        isSmSiteFocused ? "bg-[#FFE600] text-black" : "bg-white text-slate-800"
                      }`}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setIsSmSiteSuggestionsOpen((prev) => !prev);
                        setHighlightedSmSiteIndex(-1);
                      }}
                      className="px-2 border-l border-slate-300 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
 
                  {isSmSiteSuggestionsOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 max-h-40 overflow-y-auto font-mono text-[11px] uppercase">
                      {filteredSmSites.length === 0 ? (
                        <div className="p-2.5 text-slate-400 italic">No matching sites found</div>
                      ) : (
                        filteredSmSites.map((site: any, index: number) => {
                          const isActive = highlightedSmSiteIndex === index;
                          return (
                            <button
                              key={site.id}
                              type="button"
                              onClick={() => {
                                setSmSelectedSiteId(site.id);
                                setSmSiteSearchVal(site.name.toUpperCase());
                                setIsSmSiteSuggestionsOpen(false);
                                setHighlightedSmSiteIndex(-1);
                                setSmSelectedLedgerId(null);
                                setSmLedgerSearchVal("");
                                setTimeout(() => {
                                  smLedgerInputRef.current?.focus();
                                  smLedgerInputRef.current?.select();
                                }, 80);
                              }}
                              onMouseEnter={() => setHighlightedSmSiteIndex(index)}
                              className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                isActive ? "bg-[#2B547E] text-white" : "bg-white hover:bg-slate-200 text-slate-900"
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
 
              {/* ACCOUNT SELECTOR */}
              <div className="space-y-1.5 animate-in fade-in duration-200" ref={smLedgerSelectorRef}>
                <span className="font-bold text-[10px] uppercase text-slate-700 tracking-wider block">Select Account :</span>
                <div className="relative">
                  <div className="relative flex items-center bg-white border border-slate-400 rounded overflow-hidden">
                    <input 
                      ref={smLedgerInputRef}
                      type="text"
                      value={smLedgerSearchVal}
                      placeholder="ALL ACCOUNTS"
                      onChange={(e) => {
                        const val = e.target.value;
                        setSmLedgerSearchVal(val);
                        setIsSmLedgerSuggestionsOpen(true);
                        setHighlightedSmLedgerIndex(-1);
                        
                        const norm = val.trim().toUpperCase();
                        if (norm === "ALL ACCOUNTS" || !norm) {
                          setSmSelectedLedgerId("all");
                        } else {
                          const exact = summaryActiveSiteLedgers.find((l: any) => l.name.toUpperCase() === norm);
                          if (exact) {
                            setSmSelectedLedgerId(exact.id);
                          } else {
                            setSmSelectedLedgerId(null);
                          }
                        }
                      }}
                      onFocus={() => {
                        setIsSmLedgerSuggestionsOpen(true);
                        setHighlightedSmLedgerIndex(-1);
                        setIsSmLedgerFocused(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsSmLedgerFocused(false), 200);
                      }}
                      onKeyDown={handleSmLedgerKeyDown}
                      className={`w-full px-2.5 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-450 uppercase font-mono tracking-wide transition-colors ${
                        isSmLedgerFocused ? "bg-[#FFE600] text-black" : "bg-white text-slate-800"
                      }`}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setIsSmLedgerSuggestionsOpen((prev) => !prev);
                        setHighlightedSmLedgerIndex(-1);
                      }}
                      className="px-2 border-l border-slate-300 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
 
                  {isSmLedgerSuggestionsOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 max-h-40 overflow-y-auto font-mono text-[11px] uppercase">
                      {filteredSmLedgers.length === 0 ? (
                        <div className="p-2.5 text-slate-400 italic">No matching accounts found</div>
                      ) : (
                        filteredSmLedgers.map((ledger: any, index: number) => {
                          const isActive = highlightedSmLedgerIndex === index;
                          const details = parsePartyDetails(ledger.contactPerson);
                          const address = details ? details.address : (ledger.contactPerson || "");
                          const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");
 
                          return (
                            <button
                              key={ledger.id}
                              type="button"
                              onClick={() => {
                                setSmSelectedLedgerId(ledger.id);
                                setSmLedgerSearchVal(ledger.name.toUpperCase());
                                setIsSmLedgerSuggestionsOpen(false);
                                setHighlightedSmLedgerIndex(-1);
                              }}
                              onMouseEnter={() => setHighlightedSmLedgerIndex(index)}
                              className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                isActive ? "bg-[#2B547E] text-white" : "bg-white hover:bg-slate-200 text-slate-900"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="truncate">{ledger.name.toUpperCase()}</span>
                                {(!ledger.isVirtual && ledger.id !== "all" && (phone || address)) && (
                                  <div className={`text-[9px] mt-0.5 font-normal normal-case flex flex-wrap gap-x-2 gap-y-0.5 ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                                    {phone && <span>📞 {phone}</span>}
                                    {address && <span className="truncate max-w-[250px]">📍 {address}</span>}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
 
            </div>
 
            {/* RIGHT STATEMENT AREA (Col span 3) */}
            <div className="lg:col-span-3 bg-white p-1 flex flex-col justify-between print-full-width">
              
              <div className="space-y-1">
                {!smSelectedSiteId ? (
                  <div className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                    Please select a Site location to view summary records.
                  </div>
                ) : (
                  <>
                    {smSelectedLedgerId && smSelectedLedgerId !== "all" && selectedLedgerObj ? (
                      // 1. SINGLE ACCOUNT SUMMARY VIEW
                      <div className="p-4 bg-white font-mono text-slate-900 space-y-6">
                        <div className="border-b-2 border-slate-800 pb-4">
                          <h4 className="text-sm font-black text-[#2B547E] uppercase tracking-wider mb-3">ACCOUNT DETAILS</h4>
                          <div className="space-y-2 text-xs font-bold">
                            <div className="flex">
                              <span className="w-24 text-slate-500 uppercase">Name :</span>
                              <span className="font-black uppercase text-slate-900">
                                {selectedLedgerName.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex">
                              <span className="w-24 text-slate-500 uppercase">Address :</span>
                              <span className="font-black uppercase text-slate-900">
                                {selectedLedgerAddress ? selectedLedgerAddress.toUpperCase() : "NOT SPECIFIED"}
                              </span>
                            </div>
                            <div className="flex">
                              <span className="w-24 text-slate-500 uppercase">Mobile No :</span>
                              <span className="font-black text-slate-900">
                                {selectedLedgerPhone || "NOT SPECIFIED"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Balance Details Box */}
                        <div className="bg-slate-50 border border-slate-350 p-4 rounded space-y-4">
                          <h5 className="font-black text-xs uppercase tracking-wider text-slate-700">Financial Summary</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            
                            <div className="bg-white border border-slate-200 p-3 rounded shadow-sm">
                              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Debit</div>
                              <div className="text-base font-black text-blue-750">
                                {singleAccountDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            </div>

                            <div className="bg-white border border-slate-200 p-3 rounded shadow-sm">
                              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Credit</div>
                              <div className="text-base font-black text-amber-700">
                                {singleAccountCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                            </div>

                            <div className={`border p-3 rounded shadow-sm ${
                              singleAccountStatus === "DR" 
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                                : singleAccountStatus === "CR" 
                                  ? "bg-rose-50 border-rose-200 text-rose-800" 
                                  : "bg-slate-100 border-slate-200 text-slate-800"
                            }`}>
                              <div className="text-[10px] uppercase font-bold mb-1">Net Balance</div>
                              <div className="text-base font-black flex items-center justify-center gap-1">
                                <span>{singleAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-xs px-1.5 py-0.5 bg-black/10 rounded font-black">{singleAccountStatus}</span>
                              </div>
                            </div>

                          </div>
                        </div>

                        <div className="bg-[#FFE600]/10 border border-[#FFE600] p-4 rounded text-[11px] font-black uppercase tracking-wider text-slate-800 flex justify-between items-center">
                          <span>Balance Status:</span>
                          <span className={`px-2.5 py-1 text-xs rounded-sm text-white font-black ${
                            singleAccountStatus === "DR" ? "bg-emerald-600" : singleAccountStatus === "CR" ? "bg-rose-600" : "bg-slate-500"
                          }`}>
                            {singleAccountStatus === "DR" ? "IN DEBIT (DR)" : singleAccountStatus === "CR" ? "IN CREDIT (CR)" : "NIL / BALANCED"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      // 2. ALL ACCOUNTS SUMMARY LIST (TABLE VIEW)
                      <table className="w-full border-collapse border-2 border-slate-800 font-mono text-[13px] sm:text-sm text-slate-900">
                        <thead>
                          <tr className="bg-slate-100 text-black border-b-2 border-slate-800 font-black uppercase text-[12px]">
                            <th className="border border-slate-800 py-3 px-2 text-center w-12 text-black font-black">S.N.</th>
                            <th className="border border-slate-800 py-3 px-3 text-left text-black font-black">Account Name</th>
                            <th className="border border-slate-800 py-3 px-3 text-left text-black font-black">Address</th>
                            <th className="border border-slate-800 py-3 px-3 text-center w-28 text-black font-black">Mobile No.</th>
                            <th className="border border-slate-800 py-3 px-3 text-right w-28 text-black font-black">Debit</th>
                            <th className="border border-slate-800 py-3 px-3 text-right w-28 text-black font-black">Credit</th>
                            <th className="border border-slate-800 py-3 px-3 text-center w-16 text-black font-black">Dr/Cr</th>
                            <th className="border border-slate-800 py-3 px-3 text-right w-36 text-black font-black">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryLedgersList.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                                No accounts or transactions found for this site.
                              </td>
                            </tr>
                          ) : (
                            <>
                              {summaryLedgersList.map((item: any, idx: number) => {
                                return (
                                  <tr key={item.id || item.name} className="border-b border-slate-400 font-black uppercase hover:bg-slate-100/60 text-slate-955 animate-in fade-in duration-100">
                                    <td className="border-r border-slate-400 px-2 py-2 text-center font-bold text-slate-500">
                                      {idx + 1}
                                    </td>
                                    <td className="border-r border-slate-400 px-3 py-2 font-black">
                                      {item.name.toUpperCase()}
                                    </td>
                                    <td className="border-r border-slate-400 px-3 py-2 font-bold text-slate-700 text-xs">
                                      {item.address ? item.address.toUpperCase() : "-"}
                                    </td>
                                    <td className="border-r border-slate-400 px-3 py-2 text-center font-bold text-slate-700 text-xs">
                                      {item.phone || "-"}
                                    </td>
                                    <td className="border-r border-slate-400 px-3 py-2 text-right text-slate-900 font-black">
                                      {item.totalDebit > 0 ? item.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                                    </td>
                                    <td className="border-r border-slate-400 px-3 py-2 text-right text-slate-900 font-black">
                                      {item.totalCredit > 0 ? item.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                                    </td>
                                    <td className={`border-r border-slate-400 px-3 py-2 text-center font-black ${
                                      item.status === "DR" ? "text-emerald-700" : item.status === "CR" ? "text-rose-700" : "text-slate-650"
                                    }`}>
                                      {item.status}
                                    </td>
                                    <td className="px-3 py-2 text-right font-black text-slate-955">
                                      {item.balance === 0 ? "NILL" : item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                              
                              {/* Fillers to maintain layout height */}
                              {smFillers.map((_, i) => (
                                <tr key={`filler-${i}`} className="h-8 border-b border-slate-350 select-none bg-white/40">
                                  <td className="border-r border-slate-350 px-2 py-2"></td>
                                  <td className="border-r border-slate-350 px-3 py-2"></td>
                                  <td className="border-r border-slate-350 px-3 py-2"></td>
                                  <td className="border-r border-slate-350 px-3 py-2"></td>
                                  <td className="border-r border-slate-350 px-3 py-2"></td>
                                  <td className="border-r border-slate-350 px-3 py-2"></td>
                                  <td className="border-r border-slate-350 px-3 py-2"></td>
                                  <td className="px-3 py-2"></td>
                                </tr>
                              ))}
 
                              {/* Table Totals Row */}
                              <tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[12px] text-slate-955">
                                <td colSpan={4} className="border-r border-slate-400 px-3 py-2.5 text-right font-black">TOTALS:</td>
                                <td className="border-r border-slate-400 px-3 py-2.5 text-right text-slate-955 font-black">
                                  {summaryLedgersList.reduce((acc, curr) => acc + curr.totalDebit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="border-r border-slate-400 px-3 py-2.5 text-right text-slate-955 font-black">
                                  {summaryLedgersList.reduce((acc, curr) => acc + curr.totalCredit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="border-r border-slate-400 px-3 py-2.5 text-center text-slate-955 font-black">
                                  -
                                </td>
                                <td className="px-3 py-2.5 text-right text-slate-955 font-black">
                                  {/* Net sum of balances */}
                                  {(() => {
                                    const drSum = summaryLedgersList.reduce((acc, curr) => acc + (curr.status === "DR" ? curr.balance : 0), 0);
                                    const crSum = summaryLedgersList.reduce((acc, curr) => acc + (curr.status === "CR" ? curr.balance : 0), 0);
                                    const diff = drSum - crSum;
                                    const status = diff > 0 ? "DR" : diff < 0 ? "CR" : "NIL";
                                    return diff === 0 ? "NILL" : `${status} ${Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                                  })()}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>
 
              {/* RETRO ACTION BUTTONS BAR */}
              {smSelectedSiteId && (
                <div className="p-3 bg-[#E5ECF4] border-t border-slate-300 flex items-center justify-end gap-3 print-toolbar no-print mt-4">
                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
                  >
                    <span>[F2] PRINT PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSmExcel}
                    className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
                  >
                    <span>[F3] PRINT EXCEL</span>
                  </button>
                </div>
              )}
 
            </div>
 
          </div>
 
        </div>
 
        <style>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            aside, nav, header, .no-print, .print-filter-panel, .print-toolbar {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
            }
            /* Neutralize layout flex and screen height wrappers in print */
            .flex.h-screen, .flex-1.flex.flex-col.min-w-0.h-full.overflow-hidden {
              height: auto !important;
              min-height: 0 !important;
              display: block !important;
              overflow: visible !important;
              position: static !important;
              width: 100% !important;
            }
            /* Neutralize absolute modal backdrop and flex centering */
            .absolute.inset-0.bg-slate-900\\/40 {
              position: static !important;
              display: block !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              height: auto !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            /* Strip modal borders, shadows, backgrounds, and viewports in print */
            .w-\\[98vw\\], .flex-1.overflow-y-auto.p-6.bg-slate-100 {
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
            /* Hide the yellow modal header bar completely */
            .bg-amber-400 {
              display: none !important;
            }
            /* Hide the left sidebar/selectors completely */
            .lg\\:col-span-1 {
              display: none !important;
            }
            .max-w-\\[96\\%\\], .max-w-7xl, .print-full-width, .bg-white.border-2.border-slate-800 {
              max-width: 100% !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
            }
            .bg-\\[\\#E5ECF4\\] {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
            }
            .bg-\\[\\#2B547E\\] {
              background: #000000 !important;
              color: #ffffff !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              table-layout: auto !important;
            }
            th, td {
              border: 1.5px solid #000 !important;
              padding: 7px 6px !important;
              font-size: 13px !important;
              width: auto !important;
              max-width: none !important;
            }
            th {
              font-weight: 900 !important;
              background-color: #f1f5f9 !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
            }
            .print-full-width {
              width: 100% !important;
              max-width: 100% !important;
              display: block !important;
            }
            .grid, .grid-cols-1, .lg\\:grid-cols-4 {
              display: block !important;
            }
            .lg\\:col-span-3 {
              width: 100% !important;
              display: block !important;
            }
          }
        `}</style>
      </div>
    );
  }

  if (reportType === "ledger") {
    const lgFillerCount = Math.max(0, 10 - processedLgData.items.length);
    const lgFillers = Array.from({ length: lgFillerCount });

    // Get selected account metadata
    const selectedLedgerObj = lgSelectedLedgerId === "all"
      ? null
      : (activeSiteLedgers.find((l: any) => String(l.id) === String(lgSelectedLedgerId)) || 
         (ledgers ? ledgers.find((l: any) => String(l.id) === String(lgSelectedLedgerId)) : null));

    const selectedLedgerName = selectedLedgerObj ? selectedLedgerObj.name : "";
    const selectedLedgerPhone = selectedLedgerObj ? selectedLedgerObj.phone : "";
    const selectedLedgerAddress = selectedLedgerObj 
      ? (() => {
          const details = parsePartyDetails(selectedLedgerObj.contactPerson);
          return details ? details.address : selectedLedgerObj.contactPerson;
        })()
      : "";

    return (
      <div className="font-mono text-slate-800 max-w-[96%] sm:max-w-[98%] mx-auto space-y-4">
        
        {/* PRINT LEDGER PANEL */}
        <div className="bg-white border-2 border-slate-800 rounded shadow-lg overflow-hidden">

          {/* Windows retro window frame title bar */}
          <div className="flex items-center justify-between bg-[#2B547E] text-white px-3 py-1.5 font-mono text-xs font-black shadow-inner select-none no-print">
            <div className="flex items-center gap-2">
              <Printer className="h-3.5 w-3.5" />
              <span>Print_Ledger</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-slate-800 text-[8px] flex items-center justify-center font-bold font-sans shadow-sm select-none">_</span>
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-slate-800 text-[8px] flex items-center justify-center font-bold font-sans shadow-sm select-none">&#9633;</span>
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-red-650 text-[9px] flex items-center justify-center font-black font-sans shadow-sm select-none">X</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 font-mono">
            
            {/* LEFT SIDEBAR (Col span 1) */}
            <div className="lg:col-span-1 bg-[#E5ECF4] border-r border-slate-300 p-4 space-y-4 no-print flex flex-col h-full min-h-[550px]">
              
              {/* Top Label */}
              <div className="bg-[#2B547E] text-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-t-sm shadow-sm">
                Account Ledger : (ALL RECORD)
              </div>
 
              {/* SITE SELECTOR */}
              <div className="space-y-1.5" ref={lgSiteSelectorRef}>
                <span className="font-bold text-[10px] uppercase text-slate-700 tracking-wider block">Select Site :</span>
                <div className="relative">
                  <div className="relative flex items-center bg-white border border-slate-400 rounded overflow-hidden">
                    <input 
                      ref={lgSiteInputRef}
                      type="text"
                      value={lgSiteSearchVal}
                      placeholder="TYPE TO SEARCH SITE..."
                      onChange={(e) => {
                        setLgSiteSearchVal(e.target.value);
                        setIsLgSiteSuggestionsOpen(true);
                        setHighlightedLgSiteIndex(-1);
                      }}
                      onFocus={() => {
                        setIsLgSiteSuggestionsOpen(true);
                        setHighlightedLgSiteIndex(-1);
                        setIsLgSiteFocused(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsLgSiteFocused(false), 200);
                      }}
                      onKeyDown={handleLgSiteKeyDown}
                      className={`w-full px-2.5 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-400 uppercase font-mono tracking-wide transition-colors ${
                        isLgSiteFocused ? "bg-[#FFE600] text-black" : "bg-white text-slate-800"
                      }`}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setIsLgSiteSuggestionsOpen((prev) => !prev);
                        setHighlightedLgSiteIndex(-1);
                      }}
                      className="px-2 border-l border-slate-300 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
 
                  {isLgSiteSuggestionsOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 max-h-40 overflow-y-auto font-mono text-[11px] uppercase">
                      {filteredLgSites.length === 0 ? (
                        <div className="p-2.5 text-slate-400 italic">No matching sites found</div>
                      ) : (
                        filteredLgSites.map((site: any, index: number) => {
                          const isActive = highlightedLgSiteIndex === index;
                          return (
                            <button
                              key={site.id}
                              type="button"
                              onClick={() => {
                                setLgSelectedSiteId(site.id);
                                setLgSiteSearchVal(site.name.toUpperCase());
                                setIsLgSiteSuggestionsOpen(false);
                                setHighlightedLgSiteIndex(-1);
                                setLgSelectedLedgerId(null);
                                setLgLedgerSearchVal("");
                                setLgFilterDate("");
                                setTimeout(() => {
                                  lgLedgerInputRef.current?.focus();
                                  lgLedgerInputRef.current?.select();
                                }, 80);
                              }}
                              onMouseEnter={() => setHighlightedLgSiteIndex(index)}
                              className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                isActive ? "bg-[#2B547E] text-white" : "bg-white hover:bg-slate-200 text-slate-900"
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
 
              {/* ACCOUNT SELECTOR */}
              <div className="space-y-1.5 animate-in fade-in duration-200" ref={lgLedgerSelectorRef}>
                <span className="font-bold text-[10px] uppercase text-slate-700 tracking-wider block">Select Account :</span>
                <div className="relative">
                  <div className="relative flex items-center bg-white border border-slate-400 rounded overflow-hidden">
                    <input 
                      ref={lgLedgerInputRef}
                      type="text"
                      value={lgLedgerSearchVal}
                      placeholder="SELECT ACCOUNT"
                      onChange={(e) => {
                        const val = e.target.value;
                        setLgLedgerSearchVal(val);
                        setIsLgLedgerSuggestionsOpen(true);
                        setHighlightedLgLedgerIndex(-1);
                        
                        const norm = val.trim().toUpperCase();
                        if (!norm) {
                          setLgSelectedLedgerId(null);
                        } else {
                          const exact = activeSiteLedgers.find((l: any) => l.name.toUpperCase() === norm);
                          if (exact) {
                            setLgSelectedLedgerId(exact.id);
                          } else {
                            setLgSelectedLedgerId(null);
                          }
                        }
                      }}
                      onFocus={() => {
                        setIsLgLedgerSuggestionsOpen(true);
                        setHighlightedLgLedgerIndex(-1);
                        setIsLgLedgerFocused(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsLgLedgerFocused(false), 200);
                      }}
                      onKeyDown={handleLgLedgerKeyDown}
                      className={`w-full px-2.5 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-450 uppercase font-mono tracking-wide transition-colors ${
                        isLgLedgerFocused ? "bg-[#FFE600] text-black" : "bg-white text-slate-800"
                      }`}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setIsLgLedgerSuggestionsOpen((prev) => !prev);
                        setHighlightedLgLedgerIndex(-1);
                      }}
                      className="px-2 border-l border-slate-300 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
 
                  {isLgLedgerSuggestionsOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 max-h-40 overflow-y-auto font-mono text-[11px] uppercase">
                      {filteredLgLedgers.length === 0 ? (
                        <div className="p-2.5 text-slate-400 italic">No matching accounts found</div>
                      ) : (
                        filteredLgLedgers.map((ledger: any, index: number) => {
                          const isActive = highlightedLgLedgerIndex === index;
                          const details = parsePartyDetails(ledger.contactPerson);
                          const address = details ? details.address : (ledger.contactPerson || "");
                          const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");

                          return (
                            <button
                              key={ledger.id}
                              type="button"
                              onClick={() => {
                                setLgSelectedLedgerId(ledger.id);
                                setLgLedgerSearchVal(ledger.name.toUpperCase());
                                setIsLgLedgerSuggestionsOpen(false);
                                setHighlightedLgLedgerIndex(-1);
                              }}
                              onMouseEnter={() => setHighlightedLgLedgerIndex(index)}
                              className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                isActive ? "bg-[#2B547E] text-white" : "bg-white hover:bg-slate-200 text-slate-900"
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="truncate">{ledger.name.toUpperCase()}</span>
                                {(!ledger.isVirtual && ledger.id !== "all" && (phone || address)) && (
                                  <div className={`text-[9px] mt-0.5 font-normal normal-case flex flex-wrap gap-x-2 gap-y-0.5 ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                                    {phone && <span>📞 {phone}</span>}
                                    {address && <span className="truncate max-w-[250px]">📍 {address}</span>}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* DATE SELECTOR (CALENDAR) */}
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <span className="font-bold text-[10px] uppercase text-slate-700 tracking-wider block">Filter Date :</span>
                <div className="relative flex items-center bg-white border border-slate-400 rounded overflow-hidden h-8.5">
                  <input 
                    type="date"
                    value={lgFilterDate}
                    onChange={(e) => setLgFilterDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-black focus:outline-none bg-white text-slate-800 font-mono tracking-wide cursor-pointer"
                  />
                  {lgFilterDate && (
                    <button
                      type="button"
                      onClick={() => setLgFilterDate("")}
                      className="absolute right-8 text-slate-400 hover:text-slate-750 transition-colors font-black text-sm select-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
 
            {/* RIGHT STATEMENT AREA (Col span 3) */}
            <div className="lg:col-span-3 bg-white p-1 flex flex-col justify-between print-full-width">
              
              <div className="space-y-1">
                {/* Account Details Header block exactly like the screenshot */}
                {lgSelectedSiteId && (
                  <div className="p-4 bg-white text-xs font-bold font-mono text-slate-900 space-y-1 select-none">
                    <div className="flex">
                      <span className="w-24 text-slate-500">Name :</span>
                      <span className="font-black uppercase text-slate-900">
                        {lgSelectedLedgerId === "all" ? "ALL ACCOUNTS" : selectedLedgerName.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-slate-500">Address :</span>
                      <span className="font-black uppercase text-slate-900">
                        {lgSelectedLedgerId === "all" ? "" : (selectedLedgerAddress ? selectedLedgerAddress.toUpperCase() : "")}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-slate-500">Phone No. :</span>
                      <span className="font-black text-slate-900">
                        {lgSelectedLedgerId === "all" ? "" : (selectedLedgerPhone || "")}
                      </span>
                    </div>
                  </div>
                )}
                     <table className="w-full border-collapse border-2 border-slate-800 font-mono text-[13px] sm:text-sm text-slate-900">
                  <thead>
                    <tr className="bg-slate-100 text-black border-b-2 border-slate-800 font-black uppercase text-[12px]">
                      <th className="border border-slate-800 py-3 px-4 text-center w-28 text-black font-black">Date</th>
                      <th className="border border-slate-800 py-3 px-4 text-left text-black font-black">Particulars</th>
                      <th className="border border-slate-800 py-3 px-4 text-right w-20 text-black font-black">Qty</th>
                      <th className="border border-slate-800 py-3 px-4 text-center w-20 text-black font-black">Unit</th>
                      <th className="border border-slate-800 py-3 px-4 text-right w-24 text-black font-black">Rate</th>
                      <th className="border border-slate-800 py-3 px-4 text-right w-36 text-black font-black">Debit</th>
                      <th className="border border-slate-800 py-3 px-4 text-right w-36 text-black font-black">Credit</th>
                      <th className="border border-slate-800 py-3 px-4 text-center w-20 text-black font-black">Dr/Cr</th>
                      <th className="border border-slate-800 py-3 px-4 text-right w-44 text-black font-black">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!lgSelectedSiteId ? (
                      <tr>
                        <td colSpan={9} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                          Please select a Site location to view account ledgers.
                        </td>
                      </tr>
                    ) : !lgSelectedLedgerId ? (
                      <tr>
                        <td colSpan={9} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                          Please select a specific Account Ledger to view transactions.
                        </td>
                      </tr>
                    ) : processedLgData.items.length === 0 ? (
                      <>
                        <tr key="no-records">
                          <td colSpan={9} className="text-center py-12 bg-slate-50 text-slate-400 italic">
                            No transactions recorded for this account.
                          </td>
                        </tr>
                        {lgFillers.map((_, i) => (
                          <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                            <td className="px-4 py-2.5 text-right w-44"></td>
                          </tr>
                        ))}
                      </>
                    ) : (
                      <>
                        {processedLgData.items.map((item: any, idx: number) => {
                          const rowDrCr = (item.debit > 0 || item.parsedType === "TO") ? "DR" : "CR";
                          const runningBalSign = item.runningBalance < 0 ? "CR " : item.runningBalance > 0 ? "DR " : "";
  
                          return (
                            <tr 
                              key={item.id} 
                              id={`lg-row-${idx}`}
                              onClick={() => setLgSelectedRowIndex(idx)}
                              className={`border-b border-slate-400 font-black uppercase text-slate-955 animate-in fade-in duration-100 ${
                                lgSelectedRowIndex === idx 
                                  ? "bg-[#FFE600] text-black font-extrabold" 
                                  : "hover:bg-slate-100/60"
                              }`}
                            >
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-center font-bold">
                                {formatRenderDate(item.date)}
                              </td>
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 font-black">
                                {item.displayParticular}
                              </td>
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-right font-black text-slate-700 w-20">
                                {item.isStructured ? item.qty : "-"}
                              </td>
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-center font-black text-slate-700 w-20">
                                {item.isStructured ? item.unit : "-"}
                              </td>
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-right font-black text-slate-700 w-24">
                                {item.isStructured ? item.rate : "-"}
                              </td>
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-right text-slate-900 w-36 font-black">
                                {item.debit > 0 ? item.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                              </td>
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-right text-slate-900 w-36 font-black">
                                {item.credit > 0 ? item.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                              </td>
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-center w-20 font-black text-slate-650">
                                {rowDrCr}
                              </td>
                              <td className="px-4 py-2.5 text-right font-black text-slate-950 w-44">
                                {item.runningBalance === 0 ? "NILL" : `${runningBalSign}${Math.abs(item.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                              </td>
                            </tr>
                          );
                        })}
                        {lgFillers.map((_, i) => (
                          <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                            <td className="px-4 py-2.5 text-right w-44"></td>
                          </tr>
                        ))}
                        <tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[12px] text-slate-955">
                          <td colSpan={5} className="border-r border-slate-400 px-4 py-3 text-right font-black">TOTAL:</td>
                          <td className="border-r border-slate-400 px-4 py-3 text-right text-slate-955 font-black">
                            {processedLgData.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="border-r border-slate-400 px-4 py-3 text-right text-slate-955 font-black">
                            {processedLgData.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="border-r border-slate-400 px-4 py-3 text-center text-slate-955 font-black">
                            {processedLgData.finalBalance === 0 ? "NIL" : (processedLgData.finalBalance < 0 ? "CR" : "DR")}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-955 font-black">
                            {processedLgData.finalBalance === 0 ? "NILL" : `${processedLgData.finalBalance < 0 ? "CR " : "DR "}${Math.abs(processedLgData.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* RETRO ACTION BUTTONS BAR */}
              <div className="p-3 bg-[#E5ECF4] border-t border-slate-300 flex items-center justify-end gap-3 print-toolbar no-print mt-4">
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
                >
                  <span>[F2] PRINT PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportLgExcel}
                  className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
                >
                  <span>[F3] PRINT EXCEL</span>
                </button>
              </div>

            </div>

          </div>

        </div>

        <style>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            aside, nav, header, .no-print, .print-filter-panel, .print-toolbar {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
            }
            /* Neutralize layout flex and screen height wrappers in print */
            .flex.h-screen, .flex-1.flex.flex-col.min-w-0.h-full.overflow-hidden {
              height: auto !important;
              min-height: 0 !important;
              display: block !important;
              overflow: visible !important;
              position: static !important;
            }
            /* Neutralize absolute modal backdrop and flex centering */
            .absolute.inset-0.bg-slate-900\\/40 {
              position: static !important;
              display: block !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              height: auto !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            /* Strip modal borders, shadows, backgrounds, and viewports in print */
            .w-\\[98vw\\], .flex-1.overflow-y-auto.p-6.bg-slate-100 {
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
            /* Hide the yellow modal header bar completely */
            .bg-amber-400 {
              display: none !important;
            }
            /* Hide the left sidebar/selectors completely */
            .lg\\:col-span-1 {
              display: none !important;
            }
            .max-w-\\[96\\%\\], .max-w-7xl, .print-full-width, .bg-white.border-2.border-slate-800 {
              max-width: 100% !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
            }
            .bg-\\[\\#E5ECF4\\] {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
            }
            .bg-\\[\\#2B547E\\] {
              background: #000000 !important;
              color: #ffffff !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              table-layout: auto !important;
            }
            th, td {
              border: 1.5px solid #000 !important;
              padding: 7px 6px !important;
              font-size: 13px !important;
              width: auto !important;
              max-width: none !important;
            }
            th {
              font-weight: 900 !important;
              background-color: #f1f5f9 !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
            }
            .print-full-width {
              width: 100% !important;
              max-width: 100% !important;
              display: block !important;
            }
            .grid, .grid-cols-1, .lg\\:grid-cols-4 {
              display: block !important;
            }
            .lg\\:col-span-3 {
              width: 100% !important;
              display: block !important;
            }
          }
        `}</style>
      </div>
    );
  }

  if (reportType === "daybook") {
    const fillerCount = Math.max(0, 10 - processedDbData.items.length);
    const fillers = Array.from({ length: fillerCount });

    return (
      <div className="font-mono text-slate-800 max-w-[96%] sm:max-w-[98%] mx-auto space-y-4">
        
        {/* PRINT DAYBOOK PANEL */}
        <div className="bg-white border-2 border-slate-800 rounded shadow-lg overflow-hidden">

          {/* SITE SELECT PANEL WITH AUTO-SUGGEST (YELLOW STYLED BOX) */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-300 bg-[#E5ECF4] print-filter-panel" ref={dbSiteSelectorRef}>
            <span className="font-bold text-xs uppercase text-slate-700 tracking-wider">Site name :</span>
            
            <div className="relative w-[340px]">
              <div className="relative flex items-center bg-[#FFE600] border-2 border-slate-900 overflow-hidden shadow-sm">
                <input 
                  ref={dbSiteInputRef}
                  type="text"
                  value={dbSiteSearchVal}
                  placeholder="TYPE SITE NAME..."
                  onChange={(e) => {
                    setDbSiteSearchVal(e.target.value);
                    setIsDbSiteSuggestionsOpen(true);
                    setHighlightedDbSiteIndex(-1);
                  }}
                  onFocus={() => {
                    setIsDbSiteSuggestionsOpen(true);
                    setHighlightedDbSiteIndex(-1);
                  }}
                  onKeyDown={handleDbSiteKeyDown}
                  className="w-full px-3 py-1.5 text-xs font-black bg-[#FFE600] text-slate-955 focus:outline-none placeholder:text-slate-700/60 uppercase font-mono tracking-wider h-8.5"
                />
                <button 
                  type="button"
                  onClick={() => {
                    setIsDbSiteSuggestionsOpen((prev) => !prev);
                    setHighlightedDbSiteIndex(-1);
                  }}
                  className="px-2 border-l border-slate-900 text-slate-950 hover:bg-[#E5C300] transition-colors focus:outline-none flex items-center justify-center h-full text-xs font-bold font-sans"
                >
                  v
                </button>
              </div>

              {/* ABSOLUTE FLOATING SUGGESTIONS PANEL (YELLOW STYLED OPTIONS LIST) */}
              {isDbSiteSuggestionsOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#FFE600] border-2 border-slate-900 shadow-lg z-50 max-h-48 overflow-y-auto font-mono text-xs uppercase animate-in fade-in duration-100">
                  {filteredDbSites.length === 0 ? (
                    <div className="p-3 text-slate-800 italic text-[11px]">
                      NO MATCHING LOCATIONS
                    </div>
                  ) : (
                    filteredDbSites.map((site: any, index: number) => {
                      const isActive = highlightedDbSiteIndex === index;
                      return (
                        <button
                          key={site.id}
                          id={`site-opt-${index}`}
                          type="button"
                          onClick={() => {
                            setDbSelectedSiteId(site.id);
                            setDbSiteSearchVal(site.name.toUpperCase());
                            setIsDbSiteSuggestionsOpen(false);
                            setHighlightedDbSiteIndex(-1);
                          }}
                          onMouseEnter={() => setHighlightedDbSiteIndex(index)}
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

          {/* DAYBOOK SPREADSHEET (WITH DATE COLUMN) */}
          <div className="bg-white p-1">
            <table className="w-full border-collapse border-2 border-slate-800 font-mono text-[13px] sm:text-sm text-slate-900">
              
              {/* TABLE HEADERS */}
              <thead>
                <tr className="bg-slate-100 text-black border-b-2 border-slate-800 font-black uppercase text-[12px]">
                  <th className="border border-slate-800 py-3 px-4 text-center w-28 text-black font-black">Date</th>
                  <th className="border border-slate-800 py-3 px-4 text-center w-16 text-black font-black">Type</th>
                  <th className="border border-slate-800 py-3 px-4 text-left text-black font-black">Particulars</th>
                  <th className="border border-slate-800 py-3 px-4 text-right w-36 text-black font-black">Debit</th>
                  <th className="border border-slate-800 py-3 px-4 text-right w-36 text-black font-black">Credit</th>
                  <th className="border border-slate-800 py-3 px-4 text-center w-20 text-black font-black">Dr/Cr</th>
                  <th className="border border-slate-800 py-3 px-4 text-right w-44 text-black font-black">Amount</th>
                </tr>
              </thead>
 
              <tbody>{!dbSelectedSiteId ? (
                    <tr key="no-site">
                      <td colSpan={7} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                        Please select a Site name to view daybook transaction tables.
                      </td>
                    </tr>
                  ) : processedDbData.items.length === 0 ? (
                    <><tr key="no-records">
                      <td colSpan={7} className="text-center py-12 bg-slate-50 text-slate-400 italic">
                        No transactions registered for this site.
                      </td>
                    </tr>{fillers.map((_, i) => (
                      <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                        <td className="border-r border-slate-350 px-4 py-2.5"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                        <td className="px-4 py-2.5 text-right"></td>
                      </tr>
                    ))}</>
                  ) : (
                    <>{processedDbData.items.map((item: any, idx: number) => {
                      const rowDrCr = (item.debit > 0 || item.parsedType === "TO") ? "DR" : "CR";
                      const runningBalSign = item.runningBalance < 0 ? "CR " : item.runningBalance > 0 ? "DR " : "";
  
                      return (
                        <tr 
                          key={item.id} 
                          id={`db-row-${idx}`}
                          onClick={() => setDbSelectedRowIndex(idx)}
                          className={`border-b border-slate-400 font-black uppercase text-slate-955 animate-in fade-in duration-100 ${
                            dbSelectedRowIndex === idx 
                              ? "bg-[#FFE600] text-black font-extrabold" 
                              : "hover:bg-slate-100/60"
                          }`}
                        >
                          
                          {/* Date Column */}
                          <td className="border-r border-slate-400 px-4 py-2.5 text-center font-bold w-28">
                            {formatRenderDate(item.date)}
                          </td>

                          {/* Type Column (TO/BY) */}
                          <td className="border-r border-slate-400 px-4 py-2.5 text-center font-black text-slate-700 w-16">
                            {item.parsedType}
                          </td>
 
                          {/* Particular Description (Expense / Payment Mode) */}
                          <td className="border-r border-slate-400 px-4 py-2.5 text-slate-955 font-black">
                            {item.displayParticular}
                          </td>
 
                          {/* Debit Value */}
                          <td className="border-r border-slate-400 px-4 py-2.5 text-right text-slate-900 w-36 font-black">
                            {item.debit > 0 ? item.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                          </td>
 
                          {/* Credit Value */}
                          <td className="border-r border-slate-400 px-4 py-2.5 text-right text-slate-900 w-36 font-black">
                            {item.credit > 0 ? item.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                          </td>
 
                          {/* Dr / Cr indicator */}
                          <td className="border-r border-slate-400 px-4 py-2.5 text-center w-20 font-black text-slate-650">
                            {rowDrCr}
                          </td>
 
                          {/* Running Balance Amount */}
                          <td className="px-4 py-2.5 text-right font-black text-slate-955 w-44">
                            {item.runningBalance === 0 ? "NILL" : `${runningBalSign}${Math.abs(item.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                          </td>
                        </tr>
                      );
                    })}{fillers.map((_, i) => (
                      <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                        <td className="border-r border-slate-350 px-4 py-2.5"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                        <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                        <td className="px-4 py-2.5 text-right"></td>
                      </tr>
                    ))}<tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[12px] text-slate-955">
                      <td colSpan={3} className="border-r border-slate-400 px-4 py-3 text-right font-black">TOTAL:</td>
                      <td className="border-r border-slate-400 px-4 py-3 text-right text-slate-955 font-black">
                        {processedDbData.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="border-r border-slate-400 px-4 py-3 text-right text-slate-955 font-black">
                        {processedDbData.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="border-r border-slate-400 px-4 py-3 text-center text-slate-955 font-black">
                        {processedDbData.finalBalance === 0 ? "NIL" : (processedDbData.finalBalance < 0 ? "CR" : "DR")}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-955 font-black">
                        {processedDbData.finalBalance === 0 ? "NILL" : `${processedDbData.finalBalance < 0 ? "CR " : "DR "}${Math.abs(processedDbData.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                  </>
                )}
                  </tbody>
            </table>
          </div>

          {/* RETRO ACTION BUTTONS BAR */}
          <div className="p-3 bg-[#E5ECF4] border-t border-slate-300 flex items-center justify-end gap-3 print-toolbar no-print">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
            >
              <span>[F2] PRINT PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportDbExcel}
              className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
            >
              <span>[F3] PRINT EXCEL</span>
            </button>
          </div>

        </div>

        <style>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            aside, nav, header, .no-print, .print-filter-panel, .print-toolbar {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
            }
            /* Neutralize layout flex and screen height wrappers in print */
            .flex.h-screen, .flex-1.flex.flex-col.min-w-0.h-full.overflow-hidden {
              height: auto !important;
              min-height: 0 !important;
              display: block !important;
              overflow: visible !important;
              position: static !important;
            }
            /* Neutralize absolute modal backdrop and flex centering */
            .absolute.inset-0.bg-slate-900\\/40 {
              position: static !important;
              display: block !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              height: auto !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            /* Strip modal borders, shadows, backgrounds, and viewports in print */
            .w-\\[98vw\\], .flex-1.overflow-y-auto.p-6.bg-slate-100 {
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
            /* Hide the yellow modal header bar completely */
            .bg-amber-400 {
              display: none !important;
            }
            .max-w-\\[96\\%\\], .max-w-7xl, .bg-white.border-2.border-slate-800 {
              max-width: 100% !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
            }
            .bg-\\[\\#E5ECF4\\] {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
            }
            .bg-\\[\\#2B547E\\] {
              background: #000000 !important;
              color: #ffffff !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              table-layout: auto !important;
            }
            th, td {
              border: 1.5px solid #000 !important;
              padding: 7px 6px !important;
              font-size: 13px !important;
              width: auto !important;
              max-width: none !important;
            }
            th {
              font-weight: 900 !important;
              background-color: #f1f5f9 !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return null;
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="font-mono p-6 space-y-4">
        <div className="h-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-96 bg-slate-200 rounded animate-pulse" />
      </div>
    }>
      <ReportsContent />
    </Suspense>
  );
}
