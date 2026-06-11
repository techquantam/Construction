"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, History, ArrowDown, ArrowUpRight, ArrowDownLeft, Edit, Trash2, User, Phone, Settings, X, Eraser } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useApp } from "@/context/AppContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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

  // Also check character-by-character subsequence match for typing assists
  let qIdx = 0;
  for (let i = 0; i < normName.length && qIdx < normQuery.length; i++) {
    if (normName[i] === normQuery[qIdx]) {
      qIdx++;
    }
  }
  return qIdx === normQuery.length;
}

const parsePartyDetails = (contactPerson: string | null) => {
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
};

const parseCompanyTransactionPaymentMode = (paymentMode: string | null) => {
  if (!paymentMode) return null;
  const trimmed = paymentMode.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
};

const getNextChallanNoForDate = (dateStr: string, daybooks: any[]): string => {
  if (!daybooks || daybooks.length === 0) {
    return `${dateStr}/1`;
  }
  
  let maxN = 0;
  daybooks.forEach((item: any) => {
    const ref = item.referenceNumber;
    if (ref && typeof ref === "string" && ref.startsWith(dateStr + "/")) {
      const parts = ref.split("/");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxN) {
          maxN = num;
        }
      }
    }
  });
  
  return `${dateStr}/${maxN + 1}`;
};

const getLastChallanNoForLedger = (ledgerName: string, daybooks: any[]): string | null => {
  if (!daybooks || daybooks.length === 0) return null;
  const ledgerUpper = ledgerName.toUpperCase();
  
  let latestTx: any = null;
  daybooks.forEach((item: any) => {
    const text = item.expenseType || "";
    let name = "";
    if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
    else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
    
    if (name === ledgerUpper && item.referenceNumber && item.referenceNumber !== "AUTO_DEBIT") {
      if (!latestTx || new Date(item.createdAt).getTime() > new Date(latestTx.createdAt).getTime()) {
        latestTx = item;
      }
    }
  });
  
  return latestTx ? latestTx.referenceNumber : null;
};

function LedgerContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedSiteId, setSelectedSiteId, sites, modifyQuery } = useApp();
  
  const action = searchParams.get("action") || "entry";

  const [ledgerTypeTab, setLedgerTypeTab] = useState<"PLOT" | "COMPANY" | null>(null);

  // States for Autocomplete Dropdowns
  const [siteSearchVal, setSiteSearchVal] = useState("");
  const [isSiteSuggestionsOpen, setIsSiteSuggestionsOpen] = useState(false);
  const [highlightedSiteIndex, setHighlightedSiteIndex] = useState<number>(-1);
  const siteSelectorRef = useRef<HTMLDivElement>(null);

  const [accountSearchVal, setAccountSearchVal] = useState("");
  const [isAccountSuggestionsOpen, setIsAccountSuggestionsOpen] = useState(false);
  const [highlightedAccountIndex, setHighlightedAccountIndex] = useState<number>(-1);
  const accountSelectorRef = useRef<HTMLDivElement>(null);

  // Selected Ledger ID state
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isParticularLedgerOpen = !!selectedLedgerId && selectedLedgerId !== "all";

  // Auto-close sidebar when both site and account are selected
  useEffect(() => {
    if (selectedSiteId && selectedSiteId !== "all" && selectedLedgerId) {
      setIsSidebarOpen(false);
    }
  }, [selectedSiteId, selectedLedgerId]);

  // Inline entry account selector states for ALL ACCOUNTS view
  const [entryAccountSearchVal, setEntryAccountSearchVal] = useState("");
  const [isEntryAccountSuggestionsOpen, setIsEntryAccountSuggestionsOpen] = useState(false);
  const [highlightedEntryAccountIndex, setHighlightedEntryAccountIndex] = useState<number>(-1);
  const entryAccountSelectorRef = useRef<HTMLDivElement>(null);
  const [selectedEntryLedgerId, setSelectedEntryLedgerId] = useState<string | null>(null);

  const siteInputRef = useRef<HTMLInputElement>(null);
  const accountInputRef = useRef<HTMLInputElement>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedSiteId("");
    setSelectedLedgerId(null);
  }, []);

  useEffect(() => {
    // Focus the Select Site input when the action or component mounts or active tab changes
    setTimeout(() => {
      if ((ledgerTypeTab || action !== "entry") && siteInputRef.current) {
        siteInputRef.current.focus();
        siteInputRef.current.select();
      }
    }, 150);
  }, [action, ledgerTypeTab]);

  useEffect(() => {
    if (action !== "entry" || ledgerTypeTab !== null) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === "1") {
        e.preventDefault();
        setLedgerTypeTab("PLOT");
      } else if (key === "2") {
        e.preventDefault();
        setLedgerTypeTab("COMPANY");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [action, ledgerTypeTab]);


  
  // Transaction inline edit states for Ledger Correction
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState<"TO" | "BY">("BY");
  const [editParticularText, setEditParticularText] = useState("");
  const [editNarrationText, setEditNarrationText] = useState("");
  const [editAmountText, setEditAmountText] = useState("");
  const [editMaterial, setEditMaterial] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("CFT");
  const [editRate, setEditRate] = useState("");
  const [editChallanNo, setEditChallanNo] = useState("");
  const [highlightedEditMaterialIndex, setHighlightedEditMaterialIndex] = useState<number>(-1);
  const editingTransactionRowRef = useRef<HTMLTableRowElement>(null);

  // Suggestions for edit particular
  const [isEditParticularSuggestionsOpen, setIsEditParticularSuggestionsOpen] = useState(false);
  const [highlightedEditParticularIndex, setHighlightedEditParticularIndex] = useState<number>(-1);
  const editParticularSelectorRef = useRef<HTMLDivElement>(null);

  // States and refs for direct ledger entry
  const [entryDate, setEntryDate] = useState<string>("");
  const [entryType, setEntryType] = useState<"TO" | "BY">("BY");
  const [particularText, setParticularText] = useState("");
  const [debitAmount, setDebitAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  const dateInputRef = useRef<HTMLInputElement>(null);
  const entryTypeRef = useRef<HTMLSelectElement>(null);
  const particularInputRef = useRef<HTMLInputElement>(null);
  const debitAmountRef = useRef<HTMLInputElement>(null);
  const creditAmountRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);
  const [focusDateTrigger, setFocusDateTrigger] = useState(0);

  // Standard React post-render focus trigger
  useEffect(() => {
    if (focusDateTrigger > 0) {
      const input = ledgerTypeTab === "COMPANY" ? compDateInputRef.current : dateInputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(0, 2);
      }
    }
  }, [focusDateTrigger, ledgerTypeTab]);

  // Company Ledger direct entry refs
  const compDateInputRef = useRef<HTMLInputElement>(null);
  const compTypeSelectRef = useRef<HTMLSelectElement>(null);
  const compNameInputRef = useRef<HTMLInputElement>(null);
  const compAddressInputRef = useRef<HTMLTextAreaElement>(null);
  const compMobileInputRef = useRef<HTMLInputElement>(null);
  const compMaterialInputRef = useRef<HTMLInputElement>(null);
  const compQtyInputRef = useRef<HTMLInputElement>(null);
  const compUnitInputRef = useRef<HTMLInputElement>(null);
  const compCrDrSelectRef = useRef<HTMLSelectElement>(null);
  const compAmountInputRef = useRef<HTMLInputElement>(null);
  const compRateInputRef = useRef<HTMLInputElement>(null);
  const compDebitInputRef = useRef<HTMLInputElement>(null);
  const compCreditInputRef = useRef<HTMLInputElement>(null);

  // Company Ledger direct entry states
  const [compDate, setCompDate] = useState("");
  const [compType, setCompType] = useState<"BY" | "TO">("BY");
  const [compName, setCompName] = useState("");
  const [compAddress, setCompAddress] = useState("");
  const [compMobile, setCompMobile] = useState("");
  const [compMaterial, setCompMaterial] = useState("");
  const [compQty, setCompQty] = useState("");
  const [compUnit, setCompUnit] = useState("CFT");
  const [compCrDr, setCompCrDr] = useState<"DR" | "CR">("DR");
  const [compAmount, setCompAmount] = useState("");
  const [compRate, setCompRate] = useState("");
  const [challanNo, setChallanNo] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("current_challan_no");
      if (stored) return stored;
    }
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}/1`;
  });

  const updateChallanNo = (val: string) => {
    setChallanNo(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("current_challan_no", val);
    }
  };

  const getTargetDateStr = () => {
    if (compDate && compDate.includes(".") && compDate.split(".").length === 3) {
      return compDate;
    }
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}`;
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem("current_challan_no");
      if (stored && stored !== challanNo) {
        setChallanNo(stored);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleStorageChange);
    };
  }, [challanNo]);

  // Prompt modal states
  const [showNewEstimatePrompt, setShowNewEstimatePrompt] = useState(false);
  const [pendingEstimateCallback, setPendingEstimateCallback] = useState<(() => void) | null>(null);

  const startNewButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showNewEstimatePrompt) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setTimeout(() => {
        startNewButtonRef.current?.focus();
      }, 50);
    }
  }, [showNewEstimatePrompt]);



  const [hoveredOrFocusedTx, setHoveredOrFocusedTx] = useState<any>(null);
  const [filterDateVal, setFilterDateVal] = useState("");
  const [appliedFilterDate, setAppliedFilterDate] = useState("");

  // Search & create material state
  const [isCompMaterialDropdownOpen, setIsCompMaterialDropdownOpen] = useState(false);
  const [isCreatingNewCompMaterial, setIsCreatingNewCompMaterial] = useState(false);
  const [newCompMaterialName, setNewCompMaterialName] = useState("");
  const [newCompMaterialUnit, setNewCompMaterialUnit] = useState("CFT");

  // Custom unit states
  const [availableUnits, setAvailableUnits] = useState<string[]>(["CFT", "SFT", "BAG", "TON", "NOS", "KG"]);
  const [isCreatingCustomUnit, setIsCreatingCustomUnit] = useState(false);
  const [customUnitName, setCustomUnitName] = useState("");

  // Highlighted suggestions state variables
  const [highlightedCompNameIndex, setHighlightedCompNameIndex] = useState<number>(-1);
  const [highlightedCompMaterialIndex, setHighlightedCompMaterialIndex] = useState<number>(-1);

  // Step-by-step active step / popup control
  const [compActiveStep, setCompActiveStep] = useState<"DATE" | "TYPE" | "NAME" | "ADDRESS_MOBILE" | "MATERIAL" | "QTY" | "UNIT" | "RATE" | "CRDR" | "AMOUNT" | "DEBIT" | "CREDIT">("DATE");

  // Ledger Metadata Edit States
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editMetaName, setEditMetaName] = useState("");
  const [editMetaPhone, setEditMetaPhone] = useState("");
  const [editMetaAddress, setEditMetaAddress] = useState("");
  const [editMetaDetails, setEditMetaDetails] = useState<any>({
    customerExtra: "CUSTOMER",
    phoneNo: "",
    mobileNo: "",
    reference: "Self",
    commission: "",
    dueDate: "",
    plotLength: "",
    plotWidth: "",
    plotMeasurement: "",
    plotUnit: "SFT",
    rate: "",
    amount: "",
    totalCommission: "",
    cashFinance: "CASH",
    financeAmount: "",
    measurementType: "PLOT",
    materialName: "",
    plotHeight: "",
    address: ""
  });

  const handleMetaDetailsChange = (field: string, value: string) => {
    setEditMetaDetails((prev: any) => {
      const updated = { ...prev, [field]: value };
      
      // If switching measurementType, adjust default unit
      if (field === "measurementType") {
        if (value === "OTHER") {
          updated.plotUnit = "CFT";
        } else {
          updated.plotUnit = "SFT";
        }
      }

      // Calculate measurement automatically
      if (updated.measurementType === "PLOT") {
        if (field === "plotLength" || field === "plotWidth" || field === "measurementType") {
          const len = parseFloat(updated.plotLength) || 0;
          const wid = parseFloat(updated.plotWidth) || 0;
          const calculatedSft = len * wid;
          updated.plotMeasurement = calculatedSft > 0 ? calculatedSft.toString() : "";
        }
      } else {
        if (field === "plotLength" || field === "plotWidth" || field === "plotHeight" || field === "measurementType") {
          const h = parseFloat(updated.plotHeight) || 0;
          const w = parseFloat(updated.plotWidth) || 0;
          const l = parseFloat(updated.plotLength) || 0;
          const calculatedCft = h * w * l;
          updated.plotMeasurement = calculatedCft > 0 ? calculatedCft.toFixed(2) : "";
        }
      }

      const plot = parseFloat(updated.plotMeasurement) || 0;

      // Auto-calculate AMOUNT = PLOT MEASUREMENT * RATE
      const rateVal = parseFloat(updated.rate) || 0;
      updated.amount = plot > 0 && rateVal > 0 ? (plot * rateVal).toFixed(2) : "";
      
      // Auto-calculate TOTAL COMMISSION = COMMISSION * PLOT MEASUREMENT
      const comm = parseFloat(updated.commission) || 0;
      updated.totalCommission = comm > 0 && plot > 0 ? (comm * plot).toFixed(2) : "";
      
      return updated;
    });
  };

  const startEditingMetadata = (focusField?: string) => {
    if (!selectedLedger) return;
    setEditMetaName(selectedLedger.name || "");
    setEditMetaPhone(selectedLedger.phone || "");
    
    const details = parsePartyDetails(selectedLedger.contactPerson);
    if (details) {
      setEditMetaAddress("");
      setEditMetaDetails({
        customerExtra: details.customerExtra || "CUSTOMER",
        phoneNo: details.phoneNo || "",
        mobileNo: details.mobileNo || "",
        reference: details.reference || "Self",
        commission: details.commission || "",
        dueDate: details.dueDate || "",
        plotLength: details.plotLength || "",
        plotWidth: details.plotWidth || "",
        plotMeasurement: details.plotMeasurement || "",
        plotUnit: details.plotUnit || "SFT",
        rate: details.rate || "",
        amount: details.amount || "",
        totalCommission: details.totalCommission || "",
        cashFinance: details.cashFinance || "CASH",
        financeAmount: details.financeAmount || "",
        measurementType: details.plotHeight ? "CFT" : (details.measurementType || "PLOT"),
        materialName: details.materialName || "",
        plotHeight: details.plotHeight || "",
        address: details.address || ""
      });
    } else {
      setEditMetaAddress(selectedLedger.contactPerson || "");
      setEditMetaDetails({
        customerExtra: "CUSTOMER",
        phoneNo: "",
        mobileNo: "",
        reference: "Self",
        commission: "",
        dueDate: "",
        plotLength: "",
        plotWidth: "",
        plotMeasurement: "",
        plotUnit: "SFT",
        rate: "",
        amount: "",
        totalCommission: "",
        cashFinance: "CASH",
        financeAmount: "",
        measurementType: "PLOT",
        materialName: "",
        plotHeight: "",
        address: ""
      });
    }
    setIsEditingMetadata(true);

    if (focusField) {
      setTimeout(() => {
        let elementId = `edit-meta-${focusField}`;
        // Support custom mapping
        if (focusField === "plotlength-plot") {
          elementId = "edit-meta-plotlength-plot";
        } else if (focusField === "plotwidth-plot") {
          elementId = "edit-meta-plotwidth-plot";
        }
        const element = document.getElementById(elementId);
        if (element) {
          (element as HTMLElement).focus();
          if (element instanceof HTMLInputElement) {
            element.select();
          }
        }
      }, 80);
    }
  };

  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialUnit, setNewMaterialUnit] = useState("CFT");
  const [isCreatingNewMaterial, setIsCreatingNewMaterial] = useState(false);

  // Query: Fetch materials for selector
  const { data: materialsData } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const response = await api.get("/materials");
      return response.data.data;
    },
  });
  const existingMaterials: any[] = materialsData || [];

  // Mutate: Register new material directly to database inline
  const createMaterialMutation = useMutation({
    mutationFn: async (materialData: { name: string; unit: string }) => {
      return await api.post("/materials", materialData);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material registered successfully!");
      
      const newMat = res.data.data;
      setEditMetaDetails((prev: any) => ({
        ...prev,
        materialName: newMat.name.toUpperCase(),
        plotUnit: newMat.unit.toUpperCase(),
      }));
      
      setNewMaterialName("");
      setNewMaterialUnit("CFT");
      setIsCreatingNewMaterial(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create material");
    }
  });

  // Mutate: Delete material from database
  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete material");
    }
  });

  const updateLedgerMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; phone: string; contactPerson: string }) => {
      return await api.put(`/ledgers/${payload.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Ledger metadata updated successfully!");
      setIsEditingMetadata(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update ledger");
    }
  });

  const handleSaveMetadataSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedger) return;
    if (!editMetaName.trim()) {
      toast.error("Account name is required");
      return;
    }

    const originalDetails = parsePartyDetails(selectedLedger.contactPerson);
    let contactPersonValue = "";
    if (originalDetails || editMetaDetails.plotMeasurement || editMetaDetails.materialName) {
      contactPersonValue = JSON.stringify(editMetaDetails);
    } else {
      contactPersonValue = editMetaAddress;
    }

    updateLedgerMutation.mutate({
      id: selectedLedger.id,
      name: editMetaName.trim().toUpperCase(),
      phone: editMetaPhone.trim(),
      contactPerson: contactPersonValue
    });
  };

  // Query: Fetch all ledgers
  const { data: ledgers, isLoading: isLoadingLedgers } = useQuery({
    queryKey: ["ledgers", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId || selectedSiteId === "all") return [];
      const response = await api.get(`/ledgers?siteId=${selectedSiteId}`);
      return response.data.data;
    },
    enabled: !!selectedSiteId && selectedSiteId !== "all",
  });
  const existingLedgers: any[] = ledgers || [];

  // Query: Fetch all daybook entries for the active site
  const { data: dayBooks, isLoading: isLoadingDayBooks } = useQuery({
    queryKey: ["daybooks", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId || selectedSiteId === "all") return [];
      const response = await api.get(`/daybooks?siteId=${selectedSiteId}`);
      return response.data.data;
    },
    enabled: !!selectedSiteId && selectedSiteId !== "all",
  });
  const siteDaybooks: any[] = dayBooks || [];

  // Derive list of ledger accounts (all registered accounts of active tab + virtual accounts)
  const filteredLedgers = (() => {
    if (!selectedSiteId || selectedSiteId === "all") return [];
    
    // Find all unique account names from the site's daybook
    const usedNames = new Set<string>();
    if (siteDaybooks && siteDaybooks.length > 0) {
      siteDaybooks.forEach((item: any) => {
        const typeText = item.expenseType || "";
        let name = "";
        if (typeText.toUpperCase().startsWith("TO ")) {
          name = typeText.substring(3).trim().toUpperCase();
        } else if (typeText.toUpperCase().startsWith("BY ")) {
          name = typeText.substring(3).trim().toUpperCase();
        }
        if (name) {
          usedNames.add(name);
        }
      });
    }

    const list: any[] = [];
    const activeNames = new Set(usedNames); // Keep a copy of usedNames for filtering active accounts
    
    // 1. Add all existing database registered ledgers
    const allDbLedgers = ledgers || [];
    allDbLedgers.forEach((dbLedger: any) => {
      const ledgerNameUpper = dbLedger.name.toUpperCase();
      const isCorrectType = ledgerTypeTab === null || (
        ledgerTypeTab === "COMPANY" ? dbLedger.type === "Company" : (dbLedger.type === "Party" || !dbLedger.type)
      );
      
      const shouldInclude = isCorrectType;
      
      if (shouldInclude) {
        list.push({
          id: dbLedger.id,
          name: ledgerNameUpper,
          contactPerson: dbLedger.contactPerson || "",
          phone: dbLedger.phone || "N/A",
          type: dbLedger.type,
          isVirtual: false
        });
      }
      // Remove from usedNames so we don't duplicate virtual accounts
      usedNames.delete(ledgerNameUpper);
    });

    // 2. Add remaining virtual accounts that only exist in the daybook transactions
    usedNames.forEach((name) => {
      list.push({
        id: name,
        name: name,
        contactPerson: "DIRECT DAYBOOK ACCOUNT",
        phone: "N/A",
        type: "Daybook Account",
        isVirtual: true
      });
    });

    return list;
  })();

  // Sync site autocomplete text with globally active site
  useEffect(() => {
    if (selectedSiteId && selectedSiteId !== "all" && sites.length > 0) {
      const activeSite = sites.find((s) => s.id === selectedSiteId);
      if (activeSite) {
        setSiteSearchVal(activeSite.name.toUpperCase());
      }
    } else {
      setSiteSearchVal("");
    }
  }, [selectedSiteId, sites]);

  // Sync account autocomplete text with currently active ledger
  useEffect(() => {
    if (selectedLedgerId === "all") {
      const typedName = accountSearchVal.trim();
      const hasTypedVal = typedName && 
                          typedName.toUpperCase() !== "+ CREATE NEW ACCOUNT" && 
                          typedName.toUpperCase() !== "ALL ACCOUNTS";
                          
      setAccountSearchVal(ledgerTypeTab === "COMPANY" ? "+ CREATE NEW ACCOUNT" : "ALL ACCOUNTS");
      
      if (ledgerTypeTab === "COMPANY") {
        if (hasTypedVal) {
          setCompName(typedName.toUpperCase());
        } else {
          setCompName("");
        }
        setCompAddress("");
        setCompMobile("");
      } else {
        if (hasTypedVal) {
          setEntryAccountSearchVal(typedName.toUpperCase());
        } else {
          setEntryAccountSearchVal("");
        }
      }
    } else if (selectedLedgerId) {
      const activeLedger = filteredLedgers.find((l: any) => l.id === selectedLedgerId) || existingLedgers.find((l: any) => l.id === selectedLedgerId);
      if (activeLedger) {
        setAccountSearchVal(activeLedger.name.toUpperCase());
        setCompName(activeLedger.name.toUpperCase());
        const parsed = parsePartyDetails(activeLedger.contactPerson);
        if (parsed) {
          setCompAddress(parsed.address || "");
          setCompMobile(parsed.mobileNo || "");
        } else {
          setCompAddress(activeLedger.contactPerson || "");
          setCompMobile(activeLedger.phone || "");
        }
        
        // Dynamically switch ledgerTypeTab based on selected ledger type
        if (activeLedger.type === "Company") {
          setLedgerTypeTab("COMPANY");
        } else {
          setLedgerTypeTab("PLOT");
        }
      }
    } else {
      if (action !== "entry") {
        setLedgerTypeTab(null);
      }
      // Only clear if the input is not currently focused (meaning the user isn't typing)
      if (document.activeElement !== accountInputRef.current) {
        setAccountSearchVal("");
        setCompName("");
        setCompAddress("");
        setCompMobile("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLedgerId, ledgerTypeTab]);

  // Global Escape interceptor inside Ledger to cancel metadata editing before the layout's global handler can close the page
  useEffect(() => {
    const handleLocalEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNewEstimatePrompt) {
          // Handled by the prompt modal's local listener
          return;
        }
        if (isEditingMetadata) {
          e.preventDefault();
          e.stopPropagation();
          setIsEditingMetadata(false);
          toast.info("Ledger editing cancelled.");
        } else if (!isSidebarOpen) {
          const activeEl = document.activeElement;
          const isSelectorFocused = activeEl === accountInputRef.current || activeEl === siteInputRef.current;
          
          if (!isSelectorFocused && (activeEl?.tagName === "INPUT" || activeEl?.tagName === "SELECT" || activeEl?.tagName === "TEXTAREA")) {
            // Do not intercept - let the local element keydown handler handle it!
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          setIsSidebarOpen(true);
          setTimeout(() => {
            accountInputRef.current?.focus();
            accountInputRef.current?.select();
          }, 50);
        }
      }
    };
    window.addEventListener("keydown", handleLocalEsc, true); // capture phase
    return () => {
      window.removeEventListener("keydown", handleLocalEsc, true);
    };
  }, [isEditingMetadata, isSidebarOpen, showNewEstimatePrompt]);

  // Click outside listeners for custom autocomplete boxes
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (siteSelectorRef.current && !siteSelectorRef.current.contains(event.target as Node)) {
        setIsSiteSuggestionsOpen(false);
      }
      if (accountSelectorRef.current && !accountSelectorRef.current.contains(event.target as Node)) {
        setIsAccountSuggestionsOpen(false);
      }
      if (entryAccountSelectorRef.current && !entryAccountSelectorRef.current.contains(event.target as Node)) {
        setIsEntryAccountSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Keep track of the previous open state of account suggestions
  const wasAccountSuggestionsOpenRef = useRef(false);

  // Auto-scroll and highlight selected account when dropdown is opened
  useEffect(() => {
    const isOpened = isAccountSuggestionsOpen && !wasAccountSuggestionsOpenRef.current;
    wasAccountSuggestionsOpenRef.current = isAccountSuggestionsOpen;

    if (isOpened && selectedLedgerId) {
      const selectedIndex = filteredAccountSuggestions.findIndex(
        (l: any) => l.id === selectedLedgerId
      );
      if (selectedIndex >= 0) {
        setHighlightedAccountIndex(selectedIndex);
        setTimeout(() => {
          const el = document.getElementById(`acct-opt-${selectedIndex}`);
          if (el) {
            el.scrollIntoView({ block: "nearest" });
          }
        }, 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAccountSuggestionsOpen, selectedLedgerId]);

  // Click outside listener for the active inline editing transaction row
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editingTransactionId && editingTransactionRowRef.current && !editingTransactionRowRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest(".z-\\[999\\]") && !target.closest(".z-\\[9999\\]")) {
          setEditingTransactionId(null);
          setIsEditParticularSuggestionsOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingTransactionId]);

  // Click outside listener for edit particular suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editParticularSelectorRef.current && !editParticularSelectorRef.current.contains(event.target as Node)) {
        setIsEditParticularSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset selected ledger when the construction site changes
  useEffect(() => {
    setSelectedLedgerId(null);
    setAccountSearchVal("");
  }, [selectedSiteId]);

  // Filter site suggestions
  const filteredSiteSuggestions = (() => {
    const activeSite = sites.find((s) => s.id === selectedSiteId);
    const isSearching = siteSearchVal.trim() !== "" && siteSearchVal.toUpperCase() !== activeSite?.name?.toUpperCase();
    if (!isSearching) return sites;
    return sites.filter((site) => matchesFuzzy(site.name, siteSearchVal));
  })();

  // Filter account suggestions from the site's used accounts, prepending "ALL ACCOUNTS" or "+ CREATE NEW ACCOUNT"
  const filteredAccountSuggestions = (() => {
    const isAll = selectedLedgerId === "all";
    const firstOptionName = ledgerTypeTab === "COMPANY" ? "+ CREATE NEW ACCOUNT" : "ALL ACCOUNTS";
    const selectedLedger = isAll ? { name: firstOptionName } : (filteredLedgers.find((l: any) => l.id === selectedLedgerId) || existingLedgers.find((l: any) => l.id === selectedLedgerId));
    const activeLedger = selectedLedger && !isAll ? (
      existingLedgers.find((l: any) => l.name.toUpperCase() === selectedLedger.name.toUpperCase()) || selectedLedger
    ) : selectedLedger;
    
    const isSearching = accountSearchVal.trim() !== "" && accountSearchVal.toUpperCase() !== activeLedger?.name?.toUpperCase();
    
    if (!isSearching) {
      // Find unique account names used in recent transactions from the daybook
      const recentNames: string[] = [];
      if (siteDaybooks && siteDaybooks.length > 0) {
        for (let i = siteDaybooks.length - 1; i >= 0; i--) {
          const item = siteDaybooks[i];
          const typeText = item.expenseType || "";
          let name = "";
          if (typeText.toUpperCase().startsWith("TO ")) {
            name = typeText.substring(3).trim().toUpperCase();
          } else if (typeText.toUpperCase().startsWith("BY ")) {
            name = typeText.substring(3).trim().toUpperCase();
          }
          if (name && !recentNames.includes(name)) {
            recentNames.push(name);
            if (recentNames.length >= 3) break;
          }
        }
      }
      const activeSource = (action === "entry")
        ? filteredLedgers.filter((l) => {
            if (l.isVirtual) return false;
            return siteDaybooks.some((item: any) => {
              const typeText = item.expenseType || "";
              let name = "";
              if (typeText.toUpperCase().startsWith("TO ")) name = typeText.substring(3).trim().toUpperCase();
              else if (typeText.toUpperCase().startsWith("BY ")) name = typeText.substring(3).trim().toUpperCase();
              return name === l.name.toUpperCase();
            });
          })
        : filteredLedgers;

      let initialLedgers = activeSource;
      if (recentNames.length > 0 && action === "entry") {
        // Filter and keep the recent ones in order of their recency
        initialLedgers = recentNames
          .map((name) => activeSource.find((l) => l.name.toUpperCase() === name))
          .filter(Boolean) as any[];
      } else {
        initialLedgers = activeSource;
      }

      return [{ id: "all", name: firstOptionName }, ...initialLedgers];
    }
    
    // In entry mode, if the user is searching, we allow selecting globally from existingLedgers
    // In delete/correction mode, we only allow selecting from filteredLedgers (accounts with transactions)
    const searchSource = (action === "entry")
      ? existingLedgers.filter((dbLedger: any) => {
          return ledgerTypeTab === null || (
            ledgerTypeTab === "COMPANY" ? dbLedger.type === "Company" : (dbLedger.type === "Party" || !dbLedger.type)
          );
        })
      : filteredLedgers;
    
    const matches = searchSource.filter((ledger: any) => {
      const details = parsePartyDetails(ledger.contactPerson);
      const address = details ? details.address : (ledger.contactPerson || "");
      const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");
      return (
        matchesFuzzy(ledger.name, accountSearchVal) ||
        (address && matchesFuzzy(address, accountSearchVal)) ||
        (phone && matchesFuzzy(phone, accountSearchVal))
      );
    });
    
    // Prepend special option if action is not entry and it matches query
    if (action !== "entry" && matchesFuzzy(firstOptionName, accountSearchVal)) {
      return [{ id: "all", name: firstOptionName }, ...matches];
    }
    return matches;
  })();

  // Filter account suggestions for direct entry inline selector when selectedLedgerId === "all"
  const filteredEntryAccountSuggestions = (() => {
    const q = entryAccountSearchVal.trim().toUpperCase();
    const source = existingLedgers.filter((l: any) => 
      ledgerTypeTab === "COMPANY" ? l.type === "Company" : (l.type === "Party" || !l.type)
    );
    if (!q) return source;
    return source.filter((ledger: any) => matchesFuzzy(ledger.name, q));
  })();

  // Filter account suggestions for company direct entry name
  const filteredCompNameSuggestions = (() => {
    const q = compName.trim().toUpperCase();
    const companies = existingLedgers.filter((l: any) => l.type === "Company");
    if (!q) return companies;
    return companies.filter((ledger: any) => matchesFuzzy(ledger.name, q));
  })();

  // Filter material suggestions for company direct entry material
  const filteredCompMaterialSuggestions = (() => {
    const q = compMaterial.trim().toUpperCase();
    if (!q) return existingMaterials;
    return existingMaterials.filter((m: any) => matchesFuzzy(m.name, q));
  })();

  const filteredEditMaterialSuggestions = (() => {
    const q = editMaterial.trim().toUpperCase();
    if (!q) return existingMaterials;
    return existingMaterials.filter((m: any) => matchesFuzzy(m.name, q));
  })();


  // Mutations


  // Helper parser for stored expenseType
  const parseEntry = (expenseType: string) => {
    const text = expenseType || "";
    let type: "TO" | "BY" = "TO";
    let particular = text;
    
    if (text.startsWith("To ") || text.startsWith("TO ")) {
      type = "TO";
      particular = text.substring(3);
    } else if (text.startsWith("By ") || text.startsWith("BY ")) {
      type = "BY";
      particular = text.substring(3);
    } else {
      type = "TO";
      particular = text;
    }
    
    return { type, particular };
  };

  // Convert date picker format or typed DD.MM.YY to standard Date
  const parseInputDate = (dateStr: string) => {
    if (dateStr.includes(".")) {
      const parts = dateStr.split(".");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(`20${parts[2]}`, 10);
        return new Date(year, month, day);
      }
    }
    return new Date(dateStr);
  };

  // Format database ISO date back to DD.MM.YY for rendering
  const formatRenderDate = (dateISO: string) => {
    try {
      const d = new Date(dateISO);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).substring(2);
      return `${day}.${month}.${year}`;
    } catch {
      return dateISO;
    }
  };

  // Mutation for Daybook transaction correction
  const updateTransactionMutation = useMutation({
    mutationFn: async (data: { id: string; payload: any }) => {
      return await api.put(`/daybooks/${data.id}`, data.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Transaction corrected successfully");
      cancelTransactionInlineEdit();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update transaction");
    },
  });

  // Mutation for Daybook transaction deletion
  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/daybooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Transaction deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete transaction");
    },
  });

  const deleteLedgerMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/ledgers/${id}`);
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Ledger account deleted successfully");
      if (selectedLedgerId === id) {
        setSelectedLedgerId("all");
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete ledger");
    },
  });

  const handleDeleteWholeLedger = () => {
    if (!selectedLedgerId || selectedLedgerId === "all") return;
    const ledgerName = selectedLedger ? selectedLedger.name : "this ledger";
    const isConfirmed = window.confirm(
      `⚠️ WARNING: PERMANENT DATA LOSS!\n\nAre you sure you want to delete the WHOLE LEDGER account "${ledgerName.toUpperCase()}" and all its transaction entries?\n\nThis action cannot be undone. Click OK to proceed.`
    );
    if (isConfirmed) {
      deleteLedgerMutation.mutate(selectedLedgerId);
    }
  };

  const deleteLedgerDataMutation = useMutation({
    mutationFn: async ({ id, siteId }: { id: string; siteId?: string }) => {
      const url = siteId ? `/ledgers/${id}/data?siteId=${siteId}` : `/ledgers/${id}/data`;
      return await api.delete(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Ledger data entries deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete ledger data");
    },
  });

  const handleDeleteLedgerData = () => {
    if (!selectedLedgerId || selectedLedgerId === "all") return;
    const ledgerName = selectedLedger ? selectedLedger.name : "this ledger";
    const isConfirmed = window.confirm(
      `⚠️ WARNING: TRANSACTION DATA LOSS!\n\nAre you sure you want to delete ALL daybook entries of "${ledgerName.toUpperCase()}" for the selected site?\n\nThe ledger account (head) itself will NOT be deleted.\n\nThis action cannot be undone. Click OK to proceed.`
    );
    if (isConfirmed) {
      deleteLedgerDataMutation.mutate({ 
        id: selectedLedgerId, 
        siteId: selectedSiteId && selectedSiteId !== "all" ? selectedSiteId : undefined 
      });
    }
  };

  // Mutate: Create Daybook Entry (Ledger Direct Entry)
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      isSubmittingRef.current = true;
      return await api.post("/daybooks", data);
    },
    onSuccess: () => {
      isSubmittingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Entry added successfully");
      
      // Reset inputs but keep Date for fast entry flow
      setParticularText("");
      setDebitAmount("");
      setCreditAmount("");
      setEntryAccountSearchVal("");
      setSelectedEntryLedgerId(null);
      
      // Trigger robust state-based refocusing
      setFocusDateTrigger((prev) => prev + 1);
    },
    onError: (error: any) => {
      isSubmittingRef.current = false;
      toast.error(error.response?.data?.message || "Failed to add entry");
    },
  });

  // Handle Add Entry action (Ledger Direct Entry)
  const handleAddEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 1000) {
      return;
    }
    if (isSubmittingRef.current || createMutation.isPending) {
      return;
    }
    lastSubmitTimeRef.current = now;
    if (!selectedSiteId || selectedSiteId === "all") {
      toast.error("Please select a specific Site from the dropdown suggestions first");
      return;
    }
    
    // Determine the target ledger
    const targetLedger = selectedLedgerId === "all"
      ? existingLedgers.find((l: any) => l.id === selectedEntryLedgerId || l.name.toUpperCase() === entryAccountSearchVal.trim().toUpperCase())
      : selectedLedger;

    if (!targetLedger) {
      toast.error("Please select a specific Account Ledger to post transactions");
      return;
    }
    if (!particularText.trim()) {
      toast.error("Particular/Narration detail is required");
      return;
    }

    // Safely parse user date input
    let parsedDate = new Date();
    try {
      parsedDate = parseInputDate(entryDate);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
      }
    } catch {
      parsedDate = new Date();
    }

    // Determine final amount
    let amount = 0.0;
    if (entryType === "TO") {
      amount = parseFloat(debitAmount) || 0;
    } else {
      amount = parseFloat(creditAmount) || 0;
    }

    // Validate amount
    if (amount <= 0) {
      toast.error(entryType === "TO" ? "Debit amount must be greater than zero" : "Credit amount must be greater than zero");
      return;
    }

    const prefix = entryType === "TO" ? "To " : "By ";
    const combinedExpenseType = `${prefix}${targetLedger.name.trim().toUpperCase()}`;

    const payload = {
      siteId: selectedSiteId,
      date: parsedDate.toISOString(),
      expenseType: combinedExpenseType, // e.g. "To 001 RAM SINGH"
      amount,
      paymentMode: particularText.trim().toUpperCase() || "CASH", // Narration
      description: "LEDGER DIRECT ENTRY",
      referenceNumber: null,
    };

    isSubmittingRef.current = true;
    createMutation.mutate(payload);
  };

  const handleCompanyVoucherSubmit = async () => {
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 1000) {
      return;
    }
    if (isSubmittingRef.current || createMutation.isPending) return;

    if (!compDate.trim()) {
      toast.error("Date is required");
      return;
    }

    const activeLedgerDetails = (() => {
      if (isParticularLedgerOpen && selectedLedger) {
        const parsed = parsePartyDetails(selectedLedger.contactPerson);
        return {
          name: selectedLedger.name,
          address: parsed ? (parsed.address || "") : (selectedLedger.contactPerson || ""),
          mobile: parsed ? (parsed.mobileNo || "") : (selectedLedger.phone || "")
        };
      }
      return {
        name: compName,
        address: compAddress,
        mobile: compMobile
      };
    })();

    if (!activeLedgerDetails.name || !activeLedgerDetails.name.trim()) {
      toast.error("Account name is required");
      return;
    }
    
    const qtyVal = parseFloat(compQty) || 0;
    const rateVal = parseFloat(compRate) || 0;
    let calculatedAmount = qtyVal * rateVal;

    if (calculatedAmount <= 0) {
      calculatedAmount = parseFloat(compAmount) || 0;
    }

    if (calculatedAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    let parsedDate = new Date();
    try {
      parsedDate = parseInputDate(compDate);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
      }
    } catch {
      toast.error("Invalid Date format. Use DD.MM.YY");
      return;
    }

    // Immediately guard against double submissions
    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;

    try {
      // 1. Check if ledger account exists
      let ledgerId = isParticularLedgerOpen ? (selectedLedger?.id || "") : "";
      const existing = ledgerId 
        ? selectedLedger 
        : (ledgers || []).find((l: any) => l.name.toUpperCase() === activeLedgerDetails.name.trim().toUpperCase() && l.type === "Company");
      
      if (!existing && !isParticularLedgerOpen) {
        // Create the company ledger
         const ledgerRes = await api.post("/ledgers", {
          type: "Company",
          name: activeLedgerDetails.name.trim().toUpperCase(),
          contactPerson: JSON.stringify({
            address: activeLedgerDetails.address,
            mobileNo: activeLedgerDetails.mobile,
            customerExtra: "CUSTOMER",
            measurementType: "OTHER",
            plotUnit: compUnit
          }),
          phone: activeLedgerDetails.mobile,
          openingBalance: 0,
          siteId: selectedSiteId
        });
        
        if (ledgerRes.data && ledgerRes.data.data) {
          ledgerId = ledgerRes.data.data.id;
          toast.success(`Created new Company Ledger Account "${activeLedgerDetails.name.toUpperCase()}"`);
        }
      } else {
        ledgerId = existing.id;
      }

      // 2. Submit the Daybook entry
      const prefix = compType === "TO" ? "To " : "By ";
      const combinedExpenseType = `${prefix}${activeLedgerDetails.name.trim().toUpperCase()}`;

      const serializedPaymentMode = JSON.stringify({
        type: "CompanyTransaction",
        address: activeLedgerDetails.address,
        mobile: activeLedgerDetails.mobile,
        material: compMaterial.trim().toUpperCase(),
        qty: qtyVal,
        unit: compUnit,
        crDr: compCrDr,
        rate: rateVal
      });

      const payload = {
        siteId: selectedSiteId,
        date: parsedDate.toISOString(),
        expenseType: combinedExpenseType,
        amount: calculatedAmount,
        paymentMode: serializedPaymentMode,
        description: "COMPANY_LEDGER_ENTRY",
        referenceNumber: challanNo.trim().toUpperCase() || "1001",
      };

      createMutation.mutate(payload, {
        onSuccess: () => {
          isSubmittingRef.current = false;
          queryClient.invalidateQueries({ queryKey: ["ledgers"] });
          queryClient.invalidateQueries({ queryKey: ["daybooks"] });
          queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
          toast.success("Company Voucher saved successfully");
          // Reset states but preserve Date for fast data entry
          setCompName("");
          setCompAddress("");
          setCompMobile("");
          setCompMaterial("");
          setCompQty("");
          setCompRate("");
          setCompAmount("");
          setCompActiveStep("DATE");
          
          if (ledgerId) {
            setSelectedLedgerId(ledgerId);
          }
          
          // Trigger robust state-based refocusing
          setFocusDateTrigger((prev) => prev + 1);
        },
        onError: (err: any) => {
          isSubmittingRef.current = false;
          toast.error(err.response?.data?.message || "Failed to submit Company Voucher");
        }
      });

    } catch (err: any) {
      isSubmittingRef.current = false;
      toast.error(err.response?.data?.message || "Failed to submit Company Voucher");
    }
  };

  const submitTransactionInlineEdit = () => {
    if (!editingTransactionId) return;
    const item = siteDaybooks.find((d) => d.id === editingTransactionId);
    if (!item) return;

    if (!editParticularText.trim()) {
      toast.error("Account name is required");
      return;
    }

    const qtyVal = parseFloat(editQty) || 0;
    const rateVal = parseFloat(editRate) || 0;
    let calculatedAmount = qtyVal * rateVal;

    if (calculatedAmount <= 0) {
      calculatedAmount = parseFloat(editAmountText) || 0;
    }

    if (calculatedAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    const prefix = editType === "TO" ? "To " : "By ";
    const combinedExpenseType = `${prefix}${editParticularText.trim().toUpperCase()}`;

    let parsedDate = new Date();
    try {
      parsedDate = parseInputDate(editDate);
    } catch {
      toast.error("Invalid Date format. Use DD.MM.YY");
      return;
    }

    const serializedPaymentMode = ledgerTypeTab === "COMPANY" ? JSON.stringify({
      type: "CompanyTransaction",
      address: compAddress,
      mobile: compMobile,
      material: editMaterial.trim().toUpperCase(),
      qty: qtyVal,
      unit: editUnit,
      crDr: editType === "TO" ? "DR" : "CR",
      rate: rateVal
    }) : editNarrationText.trim().toUpperCase() || "CASH";

    const payload = {
      siteId: selectedSiteId,
      date: parsedDate.toISOString(),
      expenseType: combinedExpenseType,
      amount: calculatedAmount,
      paymentMode: serializedPaymentMode,
      description: item.description || "COMPANY_LEDGER_ENTRY",
      referenceNumber: ledgerTypeTab === "COMPANY" ? (editChallanNo.trim().toUpperCase() || "1001") : null,
    };

    updateTransactionMutation.mutate({ id: editingTransactionId, payload });
  };

  const cancelTransactionInlineEdit = () => {
    setEditingTransactionId(null);
    setIsEditParticularSuggestionsOpen(false);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitTransactionInlineEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelTransactionInlineEdit();
    }
  };

  const handleParticularInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isEditParticularSuggestionsOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedEditParticularIndex((prev) => {
          const next = prev + 1;
          return next >= filteredEditLedgerSuggestions.length ? 0 : next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedEditParticularIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? filteredEditLedgerSuggestions.length - 1 : next;
        });
      } else if (e.key === "Enter") {
        if (highlightedEditParticularIndex >= 0 && highlightedEditParticularIndex < filteredEditLedgerSuggestions.length) {
          e.preventDefault();
          const ledger = filteredEditLedgerSuggestions[highlightedEditParticularIndex];
          setEditParticularText(ledger.name.toUpperCase());
          setIsEditParticularSuggestionsOpen(false);
          setHighlightedEditParticularIndex(-1);
          setTimeout(() => {
            document.getElementById("edit-inline-narration")?.focus();
          }, 50);
        } else {
          e.preventDefault();
          setIsEditParticularSuggestionsOpen(false);
          document.getElementById("edit-inline-narration")?.focus();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setIsEditParticularSuggestionsOpen(false);
        setHighlightedEditParticularIndex(-1);
      }
    } else {
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        document.getElementById("edit-inline-narration")?.focus();
      } else if (e.key === "Escape" || e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById("edit-inline-type")?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsEditParticularSuggestionsOpen(true);
        e.preventDefault();
      }
    }
  };

  const handleEditClick = (tx: any) => {
    const item = siteDaybooks.find((d) => d.id === tx.id);
    if (!item) return;

    const { type, particular } = parseEntry(item.expenseType);
    setEditingTransactionId(item.id);
    setEditDate(formatRenderDate(item.date));
    setEditType(type);
    setEditParticularText(particular);
    setEditNarrationText(item.paymentMode || "");
    setEditAmountText(item.amount.toString());
    setEditChallanNo(item.referenceNumber || "");

    if (ledgerTypeTab === "COMPANY") {
      const compDetails = parseCompanyTransactionPaymentMode(item.paymentMode);
      setEditMaterial(compDetails?.material || "");
      setEditQty(compDetails?.qty ? compDetails.qty.toString() : "");
      setEditUnit(compDetails?.unit || "CFT");
      setEditRate(compDetails?.rate ? compDetails.rate.toString() : "");
    }
  };

  // Parse and calculate transactions statement for selected ledger in active site
  const statementData = (() => {
    if (!selectedSiteId || selectedSiteId === "all") {
      return { transactions: [], finalBalance: 0, balanceSign: "Nil" };
    }

    const isAll = selectedLedgerId === "all";
    const selectedLedger = isAll ? null : (filteredLedgers.find((l) => l.id === selectedLedgerId) || existingLedgers.find((l: any) => l.id === selectedLedgerId));
    const activeLedger = selectedLedger && !isAll ? (
      existingLedgers.find((l: any) => l.name.toUpperCase() === selectedLedger.name.toUpperCase()) || selectedLedger
    ) : selectedLedger;
    
    if (!isAll && !activeLedger) {
      return { transactions: [], finalBalance: 0, balanceSign: "Nil" };
    }

    // 1. Filter daybook entries belonging to selected site (and this ledger name if not ALL)
    const matchingDaybooks = siteDaybooks.filter((item: any) => {
      if (isAll) return true;

      const typeText = item.expenseType || "";
      let name = "";
      if (typeText.toUpperCase().startsWith("TO ")) {
        name = typeText.substring(3).trim().toUpperCase();
      } else if (typeText.toUpperCase().startsWith("BY ")) {
        name = typeText.substring(3).trim().toUpperCase();
      }
      return name === activeLedger.name.toUpperCase();
    });

    // 2. Sort chronologically (oldest first)
    const sorted = [...matchingDaybooks].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // 3. Compute step-by-step running balance
    let currentBalance = 0;
    
    const calculatedTx = sorted.map((item: any) => {
      const typeText = item.expenseType || "";
      let isDebit = typeText.toUpperCase().startsWith("TO ");
      
      const compDetails = parseCompanyTransactionPaymentMode(item.paymentMode);
      if (compDetails && compDetails.crDr) {
        isDebit = compDetails.crDr === "DR";
      }

      const debitVal = isDebit ? item.amount : 0.0;
      const creditVal = !isDebit ? item.amount : 0.0;

      // Running Balance = Opening Balance + Debit - Credit
      currentBalance = currentBalance + debitVal - creditVal;

      const balanceSign = currentBalance < 0 ? "Cr" : currentBalance > 0 ? "Dr" : "Nil";

      // Render date formatting
      let renderDate = item.date;
      try {
        const d = new Date(item.date);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = String(d.getFullYear()).substring(2);
        renderDate = `${day}.${month}.${year}`;
      } catch {}

      // If viewing all accounts, render a daybook-style Particular description showing account name
      const particularsVal = isAll 
        ? `${typeText.toUpperCase()} (${item.paymentMode || "CASH"})`
        : (item.paymentMode || "CASH");

      let name = "";
      if (typeText.toUpperCase().startsWith("TO ")) {
        name = typeText.substring(3).trim().toUpperCase();
      } else if (typeText.toUpperCase().startsWith("BY ")) {
        name = typeText.substring(3).trim().toUpperCase();
      }

      const rowLedger = isAll 
        ? existingLedgers.find((l: any) => l.name.toUpperCase() === name)
        : activeLedger;
      const rowDetails = rowLedger ? parsePartyDetails(rowLedger.contactPerson) : null;

      const isAutoDebit = item.referenceNumber === "AUTO_DEBIT";
      const qtyValForPlot = (isDebit && isAutoDebit && rowDetails) ? parseFloat(rowDetails.plotMeasurement) || null : null;
      const unitValForPlot = (isDebit && isAutoDebit && rowDetails) ? rowDetails.plotUnit || null : null;
      const rateValForPlot = (isDebit && isAutoDebit && rowDetails) ? parseFloat(rowDetails.rate) || null : null;

      return {
        id: item.id,
        date: renderDate,
        particulars: particularsVal,
        debit: debitVal,
        credit: creditVal,
        runningBalance: currentBalance,
        balanceSign,
        paymentMode: item.paymentMode,
        expenseType: item.expenseType,
        isDebit,
        qty: qtyValForPlot,
        unit: unitValForPlot,
        rate: rateValForPlot,
        referenceNumber: item.referenceNumber,
      };
    });

    const finalSign = currentBalance < 0 ? "Cr" : currentBalance > 0 ? "Dr" : "Nil";

    const filteredTx = calculatedTx.filter((tx: any) => {
      if (!appliedFilterDate.trim()) return true;
      return tx.date.includes(appliedFilterDate.trim());
    });

    return {
      transactions: filteredTx,
      finalBalance: currentBalance,
      balanceSign: finalSign,
    };
  })();

  // Auto scroll table container to bottom when transactions load or change
  useEffect(() => {
    if (tableContainerRef.current) {
      setTimeout(() => {
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [statementData?.transactions?.length, selectedLedgerId, ledgerTypeTab, selectedSiteId]);

  const getTodayFormatted = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}`;
  };

  // On page load, leave the date filter empty so all transactions are shown
  useEffect(() => {
    setFilterDateVal("");
    setAppliedFilterDate("");
  }, []);

  // Auto scroll material suggestion into view when arrow keys highlight it
  useEffect(() => {
    if (highlightedCompMaterialIndex >= 0) {
      const el = document.getElementById(`material-suggestion-${highlightedCompMaterialIndex}`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedCompMaterialIndex]);

  // Pre-fill direct entry date automatically
  useEffect(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      const dateToSet = getTodayFormatted();
      setCompDate(dateToSet);
      if (selectedLedgerId) {
        setEntryDate(dateToSet);
      } else {
        setEntryDate("");
      }
    } else {
      setEntryDate("");
      setCompDate("");
    }
  }, [selectedLedgerId, selectedSiteId]);

  // Track last initialized site to prevent overriding active user session on daybook mutation
  const lastInitializedSiteRef = useRef("");

  // Auto-initialize next challan number when site daybooks load/change (only once per site)
  useEffect(() => {
    if (selectedSiteId && selectedSiteId !== "all" && siteDaybooks) {
      if (selectedSiteId !== lastInitializedSiteRef.current) {
        lastInitializedSiteRef.current = selectedSiteId;
        const targetDate = getTargetDateStr();
        const nextNo = getNextChallanNoForDate(targetDate, siteDaybooks);
        updateChallanNo(nextNo);
      }
    }
  }, [selectedSiteId, siteDaybooks]);

  // Track last seen compDate to only auto-update on active date changes
  const lastCompDateRef = useRef("");

  // Auto-update challan number prefix when the direct entry date input changes
  useEffect(() => {
    if (selectedSiteId && selectedSiteId !== "all" && siteDaybooks && compDate) {
      if (compDate.includes(".") && compDate.split(".").length === 3) {
        if (compDate !== lastCompDateRef.current) {
          lastCompDateRef.current = compDate;
          const nextNo = getNextChallanNoForDate(compDate, siteDaybooks);
          updateChallanNo(nextNo);
        }
      }
    }
  }, [compDate, selectedSiteId, siteDaybooks]);

  const focusFirstTransactionRow = () => {
    if (statementData && statementData.transactions && statementData.transactions.length > 0) {
      setFocusedRowIndex(0);
      setTimeout(() => {
        const firstId = statementData.transactions[0].id;
        const row = document.getElementById(`tx-row-${firstId}`);
        row?.focus();
      }, 50);
    } else {
      setTimeout(() => {
        if (ledgerTypeTab === "COMPANY") {
          if (compDateInputRef.current) {
            compDateInputRef.current.focus();
            compDateInputRef.current.setSelectionRange(0, 2);
          }
        } else {
          if (dateInputRef.current) {
            dateInputRef.current.focus();
            dateInputRef.current.setSelectionRange(0, 2);
          }
        }
      }, 50);
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, tx: any, index: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (statementData && index < statementData.transactions.length - 1) {
        const nextIdx = index + 1;
        setFocusedRowIndex(nextIdx);
        const nextId = statementData.transactions[nextIdx].id;
        document.getElementById(`tx-row-${nextId}`)?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0 && statementData) {
        const prevIdx = index - 1;
        setFocusedRowIndex(prevIdx);
        const prevId = statementData.transactions[prevIdx].id;
        document.getElementById(`tx-row-${prevId}`)?.focus();
      } else {
        setFocusedRowIndex(-1);
        accountInputRef.current?.focus();
        accountInputRef.current?.select();
      }
    } else if (e.key === "ArrowLeft" || e.key === "Escape") {
      e.preventDefault();
      setFocusedRowIndex(-1);
      accountInputRef.current?.focus();
      accountInputRef.current?.select();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (action === "correction") {
        handleEditClick(tx);
        setTimeout(() => {
          document.getElementById("edit-inline-date")?.focus();
        }, 100);
      } else if (action === "delete") {
        if (window.confirm("Are you sure you want to delete this entry?")) {
          deleteTransactionMutation.mutate(tx.id);
        }
      }
    }
  };

  const handleInlineFieldKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "date") {
        document.getElementById("edit-inline-type")?.focus();
      } else if (field === "type") {
        document.getElementById("edit-inline-particular")?.focus();
      } else if (field === "particular") {
        if (!isEditParticularSuggestionsOpen) {
          document.getElementById("edit-inline-narration")?.focus();
        }
      } else if (field === "narration") {
        if (editType === "TO") {
          const deb = document.getElementById("edit-inline-debit");
          if (deb) {
            deb.focus();
          } else {
            submitTransactionInlineEdit();
          }
        } else {
          const cred = document.getElementById("edit-inline-credit");
          if (cred) {
            cred.focus();
          } else {
            submitTransactionInlineEdit();
          }
        }
      } else if (field === "debit" || field === "credit") {
        submitTransactionInlineEdit();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (field === "date") {
        cancelTransactionInlineEdit();
        setTimeout(() => {
          const row = document.getElementById(`tx-row-${editingTransactionId}`);
          row?.focus();
        }, 50);
      } else if (field === "type") {
        document.getElementById("edit-inline-date")?.focus();
      } else if (field === "particular") {
        if (isEditParticularSuggestionsOpen) {
          setIsEditParticularSuggestionsOpen(false);
        } else {
          document.getElementById("edit-inline-type")?.focus();
        }
      } else if (field === "narration") {
        document.getElementById("edit-inline-particular")?.focus();
      } else if (field === "debit" || field === "credit") {
        document.getElementById("edit-inline-narration")?.focus();
      }
    }
  };

  const handleMetaFieldKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "name") {
        document.getElementById("edit-meta-category")?.focus();
      } else if (field === "category") {
        document.getElementById("edit-meta-reference")?.focus();
      } else if (field === "reference") {
        document.getElementById("edit-meta-duedate")?.focus();
      } else if (field === "duedate") {
        document.getElementById("edit-meta-address")?.focus();
      } else if (field === "address") {
        document.getElementById("edit-meta-phone")?.focus();
      } else if (field === "phone") {
        document.getElementById("edit-meta-altmobile")?.focus();
      } else if (field === "altmobile") {
        handleSaveMetadataSubmit(e as any);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (field === "name") {
        setIsEditingMetadata(false);
      } else if (field === "category") {
        document.getElementById("edit-meta-name")?.focus();
      } else if (field === "reference") {
        document.getElementById("edit-meta-category")?.focus();
      } else if (field === "duedate") {
        document.getElementById("edit-meta-reference")?.focus();
      } else if (field === "address") {
        document.getElementById("edit-meta-duedate")?.focus();
      } else if (field === "phone") {
        document.getElementById("edit-meta-address")?.focus();
      } else if (field === "altmobile") {
        document.getElementById("edit-meta-phone")?.focus();
      }
    }
  };

  // Filter database registered accounts list for correction/deletion tables using local account search value
  const filteredDirectoryAccounts = existingLedgers.filter((ledger: any) => {
    const q = accountSearchVal.trim();
    if (!q || q.toUpperCase() === "ALL ACCOUNTS" || q.toUpperCase() === "+ CREATE NEW ACCOUNT") return true;
    return (
      matchesFuzzy(ledger.name, q) ||
      (ledger.type && matchesFuzzy(ledger.type, q)) ||
      (ledger.contactPerson && matchesFuzzy(ledger.contactPerson, q)) ||
      (ledger.phone && ledger.phone.includes(q))
    );
  });

  // Filter edit particular suggestions
  const filteredEditLedgerSuggestions = (() => {
    const activeText = editParticularText.trim();
    if (!activeText) return existingLedgers;
    return existingLedgers.filter((ledger: any) => matchesFuzzy(ledger.name, activeText));
  })();



  const selectedLedger = selectedLedgerId === "all"
    ? (ledgerTypeTab === "COMPANY"
        ? { name: "+ CREATE NEW ACCOUNT", contactPerson: "", phone: "" }
        : { name: "ALL ACCOUNTS STATEMENT", contactPerson: "CONSOLIDATED SITE VIEW", phone: "N/A" }
      )
    : (filteredLedgers.find((l: any) => l.id === selectedLedgerId) || existingLedgers.find((l: any) => l.id === selectedLedgerId));

  const triggerNewEstimatePrompt = (callback: () => void) => {
    if (ledgerTypeTab !== "COMPANY" || !selectedSiteId || selectedSiteId === "all") {
      callback();
      return;
    }

    setPendingEstimateCallback(() => callback);
    setShowNewEstimatePrompt(true);
  };

  const handleConfirmNewEstimate = () => {
    const targetDate = getTargetDateStr();
    const nextNo = getNextChallanNoForDate(targetDate, siteDaybooks);
    updateChallanNo(nextNo);
    setShowNewEstimatePrompt(false);
  };

  const handleCancelNewEstimate = () => {
    const name = selectedLedger?.name || compName;
    if (name) {
      const lastCh = getLastChallanNoForLedger(name, siteDaybooks);
      if (lastCh) {
        updateChallanNo(lastCh);
      }
    }
    setShowNewEstimatePrompt(false);
  };

  useEffect(() => {
    if (showNewEstimatePrompt === false && pendingEstimateCallback) {
      pendingEstimateCallback();
      setPendingEstimateCallback(null);
    }
  }, [showNewEstimatePrompt, pendingEstimateCallback]);

  // Keypress listener for New Estimate Prompt Modal
  useEffect(() => {
    if (!showNewEstimatePrompt) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (document.activeElement === continueButtonRef.current) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleConfirmNewEstimate();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCancelNewEstimate();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNewEstimatePrompt, challanNo, selectedLedger, compName, compDate, siteDaybooks]);

  // Find name, address, phone for active display (live details)
  const activeDisplayDetails = (() => {
    if (hoveredOrFocusedTx && ledgerTypeTab === "COMPANY") {
      const compDetails = parseCompanyTransactionPaymentMode(hoveredOrFocusedTx.paymentMode);
      const { particular: parsedName } = parseEntry(hoveredOrFocusedTx.expenseType);
      return {
        name: parsedName.toUpperCase(),
        address: compDetails?.address?.toUpperCase() || "N/A",
        phone: compDetails?.mobile || "N/A"
      };
    }
    
    // Fallback to selected ledger
    if (selectedLedgerId === "all") {
      if (ledgerTypeTab === "COMPANY") {
        return {
          name: compName ? compName.toUpperCase() : "+ CREATE NEW ACCOUNT",
          address: compAddress ? compAddress.toUpperCase() : "N/A",
          phone: compMobile ? compMobile : "N/A"
        };
      } else {
        return {
          name: entryAccountSearchVal ? entryAccountSearchVal.toUpperCase() : "ALL ACCOUNTS STATEMENT",
          address: "CONSOLIDATED SITE VIEW",
          phone: "N/A"
        };
      }
    }

    const details = parsePartyDetails(selectedLedger?.contactPerson);
    const addr = details ? (details.address || "N/A") : (selectedLedger?.contactPerson || "N/A");
    const mob = details ? (details.mobileNo || "N/A") : (selectedLedger?.phone || "N/A");
    return {
      name: selectedLedger?.name || "SELECT ACCOUNT",
      address: addr,
      phone: mob
    };
  })();

  return (
    <div className="font-mono text-slate-800 space-y-4 max-w-[98%] mx-auto">
      
      {/* Title & Register Account Header Removed as per user request */}

      {action === "entry" && ledgerTypeTab === null ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-200">
          <div className="w-[600px] bg-[#D3DFEE] border-2 border-slate-950 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden flex flex-col">
            
            {/* Title Bar */}
            <div className="bg-[#2B547E] border-b-2 border-slate-950 px-4 py-2.5 flex items-center justify-between text-white shrink-0">
              <span className="text-xs font-black uppercase tracking-wider font-mono">
                Select Ledger Module ({action === "entry" ? "Entry" : action === "delete" ? "Delete" : "Correction"} Mode)
              </span>
              <span className="text-[10px] bg-[#ECC30B] text-slate-950 font-black px-1.5 py-0.5 rounded-xs animate-pulse">ACTION REQUIRED</span>
            </div>

            {/* Content */}
            <div className="p-6 bg-[#E5ECF4] space-y-6 text-slate-950">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Choose Ledger Account Type</h3>
                <p className="text-[11px] text-slate-600 font-bold uppercase">Please select the type of ledger you wish to open</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Option 1: Plot Ledger */}
                <button
                  type="button"
                  onClick={() => setLedgerTypeTab("PLOT")}
                  className="bg-white hover:bg-slate-50 border-2 border-slate-950 rounded p-5 flex flex-col items-center text-center space-y-3.5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer group"
                >
                  <div className="text-4xl group-hover:scale-110 transition-transform">🏡</div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase text-[#2B547E] group-hover:underline">[1] PLOT LEDGER</h4>
                    <p className="text-[10px] text-slate-500 font-bold leading-normal uppercase">
                      Manage plot areas, rates, commissions, and customer details.
                    </p>
                  </div>
                </button>

                {/* Option 2: Company Ledger */}
                <button
                  type="button"
                  onClick={() => setLedgerTypeTab("COMPANY")}
                  className="bg-white hover:bg-slate-50 border-2 border-slate-950 rounded p-5 flex flex-col items-center text-center space-y-3.5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer group"
                >
                  <div className="text-4xl group-hover:scale-110 transition-transform">🏢</div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase text-[#2B547E] group-hover:underline">[2] COMPANY LEDGER</h4>
                    <p className="text-[10px] text-slate-500 font-bold leading-normal uppercase">
                      Manage corporate accounts, corporate expenses, and suppliers.
                    </p>
                  </div>
                </button>
              </div>

              <div className="bg-[#ECC30B]/35 border border-slate-400 p-2.5 rounded text-center text-[10px] text-slate-900 font-bold uppercase tracking-wider">
                💡 Pro-Tip: Press <span className="font-mono bg-white border border-slate-950 px-1 py-0.5 text-xs font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">1</span> for Plot or <span className="font-mono bg-white border border-slate-950 px-1 py-0.5 text-xs font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">2</span> for Company ledger!
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Small top utility bar to switch back if selected */}
          {ledgerTypeTab !== null && (
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-350 animate-in fade-in duration-200">
              <div className="text-xs font-black uppercase text-[#2B547E] tracking-wider flex items-center gap-1.5">
                <span>Active Mode:</span>
                <span className="bg-[#2B547E] text-white px-2 py-0.5 border border-slate-950 rounded-xs text-[10px]">{ledgerTypeTab === "PLOT" ? "PLOT LEDGER" : "COMPANY LEDGER"}</span>
              </div>
              
              {/* Date Filter & Mode Switcher Button Container */}
              <div className="flex items-center gap-4">
                {/* DATE SELECTOR/FILTER FOR LEDGER */}
                <div className="flex items-center gap-2 bg-[#E5ECF4] border border-slate-400 rounded px-2 py-1 h-7.5">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider select-none font-mono">Filter Date:</span>
                  <input
                    type="text"
                    placeholder="DD.MM.YY"
                    value={filterDateVal}
                    onChange={(e) => setFilterDateVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        setAppliedFilterDate(filterDateVal);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        accountInputRef.current?.focus();
                        accountInputRef.current?.select();
                      }
                    }}
                    className="w-20 bg-white border border-slate-355 rounded px-1.5 py-0.5 text-xs font-black font-mono placeholder:text-slate-400 text-slate-900 focus:outline-none uppercase h-6 text-center"
                  />
                  {filterDateVal && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterDateVal("");
                        setAppliedFilterDate("");
                      }}
                      className="text-slate-400 hover:text-slate-955 transition-colors font-bold text-xs mr-1"
                    >
                      ×
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAppliedFilterDate(filterDateVal)}
                    className="px-2 py-0.5 bg-[#2B547E] hover:bg-[#1E3E64] text-white text-[9px] font-black font-mono rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all cursor-pointer h-5 uppercase flex items-center justify-center shrink-0"
                  >
                    OK
                  </button>
                </div>

                {action === "entry" && (
                  <button
                    type="button"
                    onClick={() => setLedgerTypeTab(null)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border border-slate-955 bg-white hover:bg-slate-100 rounded transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-none active:translate-y-0.5 cursor-pointer flex items-center gap-1"
                  >
                    <span>← Change Ledger Type</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Render Action View 1: ENTRY, CORRECTION & DELETE MODES (Classic Tally Print_Ledger UI) */}
          {(action === "entry" || action === "correction" || action === "delete") && (
            <div className={isSidebarOpen ? "grid grid-cols-1 lg:grid-cols-4 gap-4 items-start" : "block"}>
          
          {/* LEFT SIDEBAR PANEL (Width ~25%) */}
          {isSidebarOpen && (
            <div className="lg:col-span-1 bg-[#E5ECF4] border border-slate-300 rounded shadow p-3 space-y-4">
            
            {/* Top Label */}
            <div className="bg-[#2B547E] text-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-t-sm">
              Account Ledger : (ALL RECORD)
            </div>

            {/* SITE SELECTOR DROP-DOWN */}
            <div className="space-y-1.5" ref={siteSelectorRef}>
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Select Site :</label>
              <div className="relative">
                <div className="flex items-center bg-white border border-slate-400 rounded overflow-hidden h-7.5">
                  <input 
                    ref={siteInputRef}
                    type="text"
                    value={siteSearchVal}
                    placeholder="TYPE TO SEARCH SITE..."
                    onChange={(e) => {
                      setSiteSearchVal(e.target.value);
                      setIsSiteSuggestionsOpen(true);
                      setHighlightedSiteIndex(-1);
                    }}
                    onFocus={() => {
                      setIsSiteSuggestionsOpen(true);
                      setHighlightedSiteIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      if (!isSiteSuggestionsOpen) {
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                          setIsSiteSuggestionsOpen(true);
                          e.preventDefault();
                        }
                        if (e.key === "ArrowRight") {
                          e.preventDefault();
                          focusFirstTransactionRow();
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          accountInputRef.current?.focus();
                          accountInputRef.current?.select();
                          setIsAccountSuggestionsOpen(true);
                        }
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedSiteIndex((prev) => {
                          const next = prev + 1;
                          return next >= filteredSiteSuggestions.length ? 0 : next;
                        });
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedSiteIndex((prev) => {
                          const next = prev - 1;
                          return next < 0 ? filteredSiteSuggestions.length - 1 : next;
                        });
                      } else if (e.key === "Enter") {
                        let targetIndex = highlightedSiteIndex;
                        if (targetIndex === -1 && filteredSiteSuggestions.length > 0) {
                          targetIndex = 0;
                        }
                        if (targetIndex >= 0 && targetIndex < filteredSiteSuggestions.length) {
                          e.preventDefault();
                          const site = filteredSiteSuggestions[targetIndex];
                          setSelectedSiteId(site.id);
                          setSiteSearchVal(site.name.toUpperCase());
                          setIsSiteSuggestionsOpen(false);
                          setHighlightedSiteIndex(-1);
                          setTimeout(() => {
                            accountInputRef.current?.focus();
                            accountInputRef.current?.select();
                            setIsAccountSuggestionsOpen(true);
                          }, 50);
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsSiteSuggestionsOpen(false);
                        setHighlightedSiteIndex(-1);
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        focusFirstTransactionRow();
                      }
                    }}
                    className="w-full px-2 py-1 text-xs font-black focus:outline-none placeholder:text-slate-400 uppercase font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setIsSiteSuggestionsOpen((prev) => !prev);
                      setHighlightedSiteIndex(-1);
                    }}
                    className="px-1.5 border-l border-slate-350 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center h-full"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Autocomplete floating panel */}
                {isSiteSuggestionsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[60] max-h-40 overflow-y-auto font-mono text-[11px] uppercase">
                    {filteredSiteSuggestions.length === 0 ? (
                      <div className="p-2 text-slate-400 italic">No matching sites</div>
                    ) : (
                      filteredSiteSuggestions.map((site, index) => {
                        const isActive = highlightedSiteIndex === index;
                        return (
                          <button
                            key={site.id}
                            id={`site-opt-${index}`}
                            type="button"
                            onClick={() => {
                              setSelectedSiteId(site.id);
                              setSiteSearchVal(site.name.toUpperCase());
                              setIsSiteSuggestionsOpen(false);
                              setHighlightedSiteIndex(-1);
                              setTimeout(() => {
                                accountInputRef.current?.focus();
                                accountInputRef.current?.select();
                                setIsAccountSuggestionsOpen(true);
                              }, 50);
                            }}
                            onMouseEnter={() => setHighlightedSiteIndex(index)}
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

            {/* ACCOUNT SELECTOR DROP-DOWN */}
            <div className="space-y-1.5" ref={accountSelectorRef}>
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Select Account :</label>
              <div className="relative">
                <div className="flex items-center bg-white border border-slate-400 rounded overflow-hidden h-7.5">
                  <input 
                    ref={accountInputRef}
                    type="text"
                    value={accountSearchVal}
                    placeholder="TYPE TO SEARCH ACCOUNT..."
                    onChange={(e) => {
                      setAccountSearchVal(e.target.value);
                      setIsAccountSuggestionsOpen(true);
                      setHighlightedAccountIndex(-1);
                      if (e.target.value === "") {
                        setSelectedLedgerId(null);
                      }
                    }}
                    onFocus={(e) => {
                      setIsAccountSuggestionsOpen(true);
                      setHighlightedAccountIndex(-1);
                      e.target.select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsAccountSuggestionsOpen(false);
                        focusFirstTransactionRow();
                        return;
                      }
                      if (!isAccountSuggestionsOpen) {
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                          setIsAccountSuggestionsOpen(true);
                          e.preventDefault();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          siteInputRef.current?.focus();
                          siteInputRef.current?.select();
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          focusFirstTransactionRow();
                        }
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedAccountIndex((prev) => {
                          const next = prev + 1;
                          const index = next >= filteredAccountSuggestions.length ? 0 : next;
                          setTimeout(() => {
                            const el = document.getElementById(`acct-opt-${index}`);
                            if (el) el.scrollIntoView({ block: "nearest" });
                          }, 10);
                          return index;
                        });
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedAccountIndex((prev) => {
                          const next = prev - 1;
                          const index = next < 0 ? filteredAccountSuggestions.length - 1 : next;
                          setTimeout(() => {
                            const el = document.getElementById(`acct-opt-${index}`);
                            if (el) el.scrollIntoView({ block: "nearest" });
                          }, 10);
                          return index;
                        });
                      } else if (e.key === "Enter") {
                        let targetIndex = highlightedAccountIndex;
                        if (targetIndex === -1 && filteredAccountSuggestions.length > 0) {
                          targetIndex = 0;
                        }
                        if (targetIndex >= 0 && targetIndex < filteredAccountSuggestions.length) {
                          e.preventDefault();
                          const ledger = filteredAccountSuggestions[targetIndex];
                          setSelectedLedgerId(ledger.id);
                          if (ledger.id !== "all") {
                            setAccountSearchVal(ledger.name.toUpperCase());
                          }
                          setIsAccountSuggestionsOpen(false);
                          setHighlightedAccountIndex(-1);
                          
                           if (action === "entry") {
                            if (ledger.id === "all") {
                              setTimeout(() => {
                                compNameInputRef.current?.focus();
                              }, 50);
                            } else {
                              triggerNewEstimatePrompt(() => {
                                setTimeout(() => {
                                  const dateInput = ledgerTypeTab === "COMPANY" ? compDateInputRef.current : dateInputRef.current;
                                  if (dateInput) {
                                    dateInput.focus();
                                    dateInput.setSelectionRange(0, 2);
                                  }
                                }, 50);
                              });
                            }
                          } else {
                            setTimeout(() => {
                              focusFirstTransactionRow();
                            }, 50);
                          }
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsAccountSuggestionsOpen(false);
                        setHighlightedAccountIndex(-1);
                        siteInputRef.current?.focus();
                        siteInputRef.current?.select();
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        const dateInput = ledgerTypeTab === "COMPANY" ? compDateInputRef.current : dateInputRef.current;
                        if (action === "entry" && dateInput) {
                          dateInput.focus();
                          dateInput.setSelectionRange(0, 2);
                        } else {
                          focusFirstTransactionRow();
                        }
                      }
                    }}
                    className="w-full px-2 py-1 text-xs font-black focus:outline-none placeholder:text-slate-400 uppercase font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAccountSuggestionsOpen((prev) => !prev);
                      setHighlightedAccountIndex(-1);
                    }}
                    className="px-1.5 border-l border-slate-350 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center h-full"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
 
                {/* Autocomplete floating panel */}
                {isAccountSuggestionsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[60] max-h-[350px] overflow-y-auto font-mono text-[11px] uppercase">
                    {filteredAccountSuggestions.length === 0 ? (
                      <div className="p-2 text-slate-400 italic">No matching accounts</div>
                    ) : (
                      filteredAccountSuggestions.map((ledger: any, index: number) => {
                        const isActive = highlightedAccountIndex === index;
                        const isSelected = selectedLedgerId === ledger.id;
                        return (
                          <button
                            key={ledger.id}
                            id={`acct-opt-${index}`}
                            type="button"
                            onClick={() => {
                              setSelectedLedgerId(ledger.id);
                              if (ledger.id !== "all") {
                                setAccountSearchVal(ledger.name.toUpperCase());
                              }
                              setIsAccountSuggestionsOpen(false);
                              setHighlightedAccountIndex(-1);
                              
                               if (action === "entry") {
                                if (ledger.id === "all") {
                                  setTimeout(() => {
                                    compNameInputRef.current?.focus();
                                  }, 50);
                                } else {
                                  triggerNewEstimatePrompt(() => {
                                    setTimeout(() => {
                                      const dateInput = ledgerTypeTab === "COMPANY" ? compDateInputRef.current : dateInputRef.current;
                                      if (dateInput) {
                                        dateInput.focus();
                                        dateInput.setSelectionRange(0, 2);
                                      }
                                    }, 50);
                                  });
                                }
                              } else {
                                setTimeout(() => {
                                  focusFirstTransactionRow();
                                }, 50);
                              }
                            }}
                            onMouseEnter={() => setHighlightedAccountIndex(index)}
                            className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                              isActive 
                                ? "bg-[#2B547E] text-white" 
                                : isSelected 
                                  ? "bg-[#E5ECF4] text-[#2B547E] font-black" 
                                  : "bg-white hover:bg-slate-200 text-slate-900"
                            }`}
                          >
                            <span className="truncate block py-0.5">{ledger.name.toUpperCase()}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CHALLAN SELECTOR */}
            {selectedSiteId && selectedSiteId !== "all" && action === "entry" && ledgerTypeTab === "COMPANY" && (
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Challan No :</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={challanNo}
                    onChange={(e) => updateChallanNo(e.target.value)}
                    placeholder="Challan No"
                    className="w-full bg-white border border-slate-400 rounded px-2.5 py-1 text-xs font-bold font-mono focus:outline-none focus:border-slate-800 uppercase text-center h-7.5"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (challanNo.includes("/")) {
                        const parts = challanNo.split("/");
                        if (parts.length === 2) {
                          const n = parseInt(parts[1], 10);
                          if (!isNaN(n)) {
                            updateChallanNo(`${parts[0]}/${n + 1}`);
                            return;
                          }
                        }
                      }
                      const num = parseInt(challanNo, 10);
                      if (!isNaN(num)) {
                        updateChallanNo(String(num + 1));
                      } else {
                        const targetDate = getTargetDateStr();
                        updateChallanNo(`${targetDate}/1`);
                      }
                    }}
                    className="bg-[#2B547E] hover:bg-[#1E3E64] text-white text-xs font-black px-2.5 py-1.5 rounded transition-all shadow active:translate-y-0.5 h-7.5 shrink-0"
                  >
                    + Next
                  </button>
                </div>
              </div>
            )}




          </div>
          )}

          {/* RIGHT PRINT LEDGER PANEL STATEMENT (Width ~75%) */}
          <div className={isSidebarOpen ? "lg:col-span-3 bg-white border-2 border-slate-800 rounded shadow-lg overflow-hidden flex flex-col font-mono relative" : "max-w-[1300px] mx-auto w-full bg-white border-2 border-slate-800 rounded shadow-lg overflow-hidden flex flex-col font-mono relative"}>
            
            {/* Selected Ledger Metadata Info Banner */}
            <div 
              className={`p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-800 relative ${
                !isEditingMetadata && selectedLedger && selectedLedgerId !== "all" && action !== "delete" 
                  ? "cursor-pointer hover:bg-slate-100/60 transition-all group" 
                  : ""
              }`}
              onClick={() => {
                if (!isEditingMetadata && selectedLedger && selectedLedgerId !== "all" && action !== "delete") {
                  startEditingMetadata();
                }
              }}
            >
              {!isEditingMetadata && selectedLedger && selectedLedgerId !== "all" && action !== "delete" && (
                <span className="hidden group-hover:inline-block absolute right-4 top-3 bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest animate-pulse select-none z-10">
                  ✏️ Click to Edit Details
                </span>
              )}
              {!isEditingMetadata && selectedSiteId && selectedSiteId !== "all" && selectedLedgerId && selectedLedgerId !== "all" && action === "delete" && (
                <div 
                  className="absolute right-4 top-3 flex items-center gap-2.5 z-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleDeleteWholeLedger}
                    className="bg-red-600 hover:bg-red-700 text-white border border-slate-950 font-black text-[11px] py-1.5 px-3 rounded shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-none transition-all active:translate-y-0.5 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    <span>DELETE HEAD</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLedgerData}
                    className="bg-[#D97706] hover:bg-[#B45309] text-white border border-slate-950 font-black text-[11px] py-1.5 px-3 rounded shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-none transition-all active:translate-y-0.5 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Eraser className="h-3.5 w-3.5 shrink-0" />
                    <span>DELETE DATA</span>
                  </button>
                </div>
              )}
              {isEditingMetadata ? (
                <form onSubmit={handleSaveMetadataSubmit} onClick={(e) => e.stopPropagation()} className="space-y-4">
                  <div className="grid grid-cols-1 max-w-xl gap-4">
                    {/* Left Column: Basic Info */}
                    <div className="bg-[#E5ECF4] border border-slate-300 rounded p-3 space-y-2 text-[11px] font-bold text-slate-800">
                      <div className="bg-[#2B547E] text-white px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded-t-sm mb-1">
                        📁 Basic Account Information
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="w-20 text-slate-650 uppercase">Name:</span>
                        <input
                          id="edit-meta-name"
                          type="text"
                          value={editMetaName}
                          onChange={(e) => setEditMetaName(e.target.value.toUpperCase())}
                          onKeyDown={(e) => handleMetaFieldKeyDown(e, "name")}
                          required
                          className="flex-1 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 font-mono text-xs text-slate-900 h-6.5"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-20 text-slate-650 uppercase">Category:</span>
                        <select
                          id="edit-meta-category"
                          value={editMetaDetails.customerExtra || "CUSTOMER"}
                          onChange={(e) => handleMetaDetailsChange("customerExtra", e.target.value)}
                          onKeyDown={(e) => handleMetaFieldKeyDown(e, "category")}
                          className="flex-1 bg-white border border-slate-400 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-800 cursor-pointer font-black text-xs text-slate-900 h-6.5"
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="SUPPLIER">SUPPLIER</option>
                          <option value="CONTRACTOR">CONTRACTOR</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-20 text-slate-650 uppercase">Reference:</span>
                        <input
                          id="edit-meta-reference"
                          type="text"
                          value={editMetaDetails.reference || ""}
                          onChange={(e) => handleMetaDetailsChange("reference", e.target.value)}
                          onKeyDown={(e) => handleMetaFieldKeyDown(e, "reference")}
                          className="flex-1 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 font-mono text-xs text-slate-900 h-6.5"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-20 text-slate-650 uppercase">Due Date:</span>
                        <input
                          id="edit-meta-duedate"
                          type="text"
                          value={editMetaDetails.dueDate || ""}
                          onChange={(e) => handleMetaDetailsChange("dueDate", e.target.value)}
                          onKeyDown={(e) => handleMetaFieldKeyDown(e, "duedate")}
                          placeholder="e.g. 15 DAYS"
                          className="flex-1 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 font-mono text-xs text-slate-900 h-6.5"
                        />
                      </div>

                      {/* Render Address for structured details */}
                      {parsePartyDetails(selectedLedger?.contactPerson) !== null && (
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-slate-650 uppercase">Address:</span>
                          <textarea
                            id="edit-meta-address"
                            rows={2}
                            value={editMetaDetails.address || ""}
                            onChange={(e) => handleMetaDetailsChange("address", e.target.value)}
                            onKeyDown={(e) => handleMetaFieldKeyDown(e, "address")}
                            className="flex-1 bg-white border border-slate-400 rounded px-2 py-1 focus:outline-none focus:border-slate-800 font-mono text-xs text-slate-900 resize-none h-12"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="w-20 text-slate-650 uppercase">Phone No:</span>
                        <input
                          id="edit-meta-phone"
                          type="text"
                          value={editMetaPhone}
                          onChange={(e) => {
                            setEditMetaPhone(e.target.value);
                            handleMetaDetailsChange("phoneNo", e.target.value);
                          }}
                          onKeyDown={(e) => handleMetaFieldKeyDown(e, "phone")}
                          className="flex-1 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 font-mono text-xs text-slate-900 h-6.5"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-20 text-slate-650 uppercase">Alt Mobile:</span>
                        <input
                          id="edit-meta-altmobile"
                          type="text"
                          value={editMetaDetails.mobileNo || ""}
                          onChange={(e) => handleMetaDetailsChange("mobileNo", e.target.value)}
                          onKeyDown={(e) => handleMetaFieldKeyDown(e, "altmobile")}
                          className="flex-1 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 font-mono text-xs text-slate-900 h-6.5"
                        />
                      </div>

                      {/* If simple address, allow editing it directly */}
                      {parsePartyDetails(selectedLedger?.contactPerson) === null && (
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-slate-650 uppercase">Address:</span>
                          <textarea
                            id="edit-meta-address"
                            rows={2}
                            value={editMetaAddress}
                            onChange={(e) => setEditMetaAddress(e.target.value)}
                            onKeyDown={(e) => handleMetaFieldKeyDown(e, "address")}
                            className="flex-1 bg-white border border-slate-400 rounded px-2 py-1 focus:outline-none focus:border-slate-800 font-mono text-xs text-slate-900 resize-none h-12"
                          />
                        </div>
                      )}

                      {/* Form Actions Footer moved here from Specifications Form because yellow block is hidden */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-300 mt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingMetadata(false)}
                          className="px-3 py-1 border border-slate-950 bg-[#C0C0C0] text-slate-900 font-black hover:bg-slate-300 rounded shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 transition-all cursor-pointer focus:outline-none text-[10px] uppercase"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updateLedgerMutation.isPending}
                          className="px-3 py-1 border border-slate-950 bg-[#2B547E] hover:bg-[#1E3E64] disabled:opacity-50 text-white font-black rounded shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 transition-all cursor-pointer uppercase focus:outline-none text-[10px]"
                        >
                          {updateLedgerMutation.isPending ? "Saving..." : "Save Corrected Info"}
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Specifications Form (HIDDEN BY USER REQUEST) */}
                    <div className="hidden bg-[#ECC30B] border-2 border-slate-950 rounded p-3 text-[11px] space-y-2 shadow-md text-slate-900 font-mono">
                      <div className="text-xs font-black uppercase text-slate-950 border-b border-slate-950/20 pb-1 flex justify-between items-center">
                        <span>📐 Specifications & Calculations</span>
                        
                        {/* Measurement Type selector */}
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMetaDetailsChange("measurementType", "PLOT")}
                            className={`px-2 py-0.5 border border-slate-950 font-black rounded text-[9px] uppercase ${
                              editMetaDetails.measurementType !== "OTHER" 
                                ? "bg-slate-950 text-white" 
                                : "bg-white text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            PLOT
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMetaDetailsChange("measurementType", "OTHER")}
                            className={`px-2 py-0.5 border border-slate-950 font-black rounded text-[9px] uppercase ${
                              editMetaDetails.measurementType === "OTHER" 
                                ? "bg-slate-950 text-white" 
                                : "bg-white text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            OTHER
                          </button>
                        </div>
                      </div>

                      {editMetaDetails.measurementType === "OTHER" ? (
                        <>
                          {/* OTHER Material SPECIFICATIONS */}
                          <div className="space-y-1.5 border-b border-slate-950/15 pb-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-800 font-extrabold uppercase w-28">Material Type:</span>
                              <div className="flex-1 flex gap-1.5 items-center">
                                <select
                                  id="edit-meta-materialname"
                                  value={editMetaDetails.materialName || ""}
                                  onChange={(e) => {
                                    if (e.target.value === "__NEW__") {
                                      setIsCreatingNewMaterial(true);
                                    } else {
                                      setIsCreatingNewMaterial(false);
                                      const selectedMat = existingMaterials.find(m => m.name.toUpperCase() === e.target.value.toUpperCase());
                                      handleMetaDetailsChange("materialName", e.target.value.toUpperCase());
                                      if (selectedMat) {
                                        handleMetaDetailsChange("plotUnit", selectedMat.unit.toUpperCase());
                                      }
                                    }
                                  }}
                                  className="flex-1 bg-white border border-slate-950 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-800 cursor-pointer font-black h-6.5 text-slate-900"
                                >
                                  <option value="">-- SELECT MATERIAL --</option>
                                  {existingMaterials.map((mat: any) => (
                                    <option key={mat.id} value={mat.name.toUpperCase()}>
                                      {mat.name.toUpperCase()} ({mat.unit.toUpperCase()})
                                    </option>
                                  ))}
                                  <option value="__NEW__" className="text-blue-700 font-bold">+ REGISTER NEW MATERIAL</option>
                                </select>
                              </div>
                            </div>

                            {/* Inline create new material panel */}
                            {(isCreatingNewMaterial || editMetaDetails.materialName === "__NEW__") && (
                              <div className="bg-amber-50/90 border border-slate-950 rounded p-2 space-y-1.5">
                                <div className="text-[9px] font-black uppercase text-slate-700">Register New Material:</div>
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase w-12">NAME:</span>
                                    <input
                                      type="text"
                                      value={newMaterialName}
                                      onChange={(e) => setNewMaterialName(e.target.value.toUpperCase())}
                                      placeholder="e.g. MORANG"
                                      className="flex-1 bg-white border border-slate-950 rounded px-1.5 py-0.5 focus:outline-none font-mono text-[10px] h-6 text-slate-900"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase w-12">UNIT:</span>
                                    <select
                                      value={newMaterialUnit}
                                      onChange={(e) => setNewMaterialUnit(e.target.value.toUpperCase())}
                                      className="bg-white border border-slate-950 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer font-black text-[10px] h-6 text-slate-900"
                                    >
                                      <option value="CFT">CFT</option>
                                      <option value="SFT">SFT</option>
                                      <option value="BAG">BAG</option>
                                      <option value="KG">KG</option>
                                      <option value="TON">TON</option>
                                      <option value="NOS">NOS</option>
                                    </select>
                                    
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!newMaterialName.trim()) {
                                          toast.error("Please enter a material name.");
                                          return;
                                        }
                                        createMaterialMutation.mutate({
                                          name: newMaterialName.trim().toUpperCase(),
                                          unit: newMaterialUnit.trim().toUpperCase(),
                                        });
                                      }}
                                      disabled={createMaterialMutation.isPending}
                                      className="px-2 bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50 text-[10px] font-black border border-slate-950 rounded flex items-center justify-center transition-all h-6"
                                    >
                                      {createMaterialMutation.isPending ? "..." : "ADD"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Dimensions Height, Width, Length inputs */}
                            <div className="space-y-1.5 border-t border-slate-950/10 pt-1.5">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-800 font-extrabold uppercase w-28">Measurement:</span>
                                <div className="flex gap-2 items-center flex-1 justify-start">
                                  <input
                                    id="edit-meta-plotmeasurement"
                                    type="number"
                                    step="0.01"
                                    value={editMetaDetails.plotMeasurement || ""}
                                    onChange={(e) => handleMetaDetailsChange("plotMeasurement", e.target.value)}
                                    placeholder="0"
                                    className="w-20 bg-slate-100 border border-slate-950 rounded px-2 py-0.5 text-right focus:outline-none text-[#2B547E] font-black font-mono h-6.5"
                                  />
                                  <span className="font-mono text-slate-950 text-xs font-black">
                                    {editMetaDetails.plotUnit || "CFT"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pl-3">
                                <span className="text-[10px] text-slate-800 font-extrabold uppercase">H:</span>
                                <input
                                  id="edit-meta-plotheight"
                                  type="number"
                                  step="0.01"
                                  value={editMetaDetails.plotHeight || ""}
                                  onChange={(e) => handleMetaDetailsChange("plotHeight", e.target.value)}
                                  placeholder="0.0"
                                  className="w-11 bg-white border border-slate-950 rounded px-1 py-0.5 text-right focus:outline-none font-mono h-5.5 text-slate-900 text-[11px]"
                                />
                                <span className="text-slate-955 font-black">×</span>
                                <span className="text-[10px] text-slate-800 font-extrabold uppercase">W:</span>
                                <input
                                  id="edit-meta-plotwidth"
                                  type="number"
                                  step="0.01"
                                  value={editMetaDetails.plotWidth || ""}
                                  onChange={(e) => handleMetaDetailsChange("plotWidth", e.target.value)}
                                  placeholder="0.0"
                                  className="w-11 bg-white border border-slate-950 rounded px-1 py-0.5 text-right focus:outline-none font-mono h-5.5 text-slate-900 text-[11px]"
                                />
                                <span className="text-slate-955 font-black">×</span>
                                <span className="text-[10px] text-slate-800 font-extrabold uppercase">L:</span>
                                <input
                                  id="edit-meta-plotlength"
                                  type="number"
                                  step="0.01"
                                  value={editMetaDetails.plotLength || ""}
                                  onChange={(e) => handleMetaDetailsChange("plotLength", e.target.value)}
                                  placeholder="0.0"
                                  className="w-11 bg-white border border-slate-950 rounded px-1 py-0.5 text-right focus:outline-none font-mono h-5.5 text-slate-900 text-[11px]"
                                />
                                <span className="text-[10px] text-slate-800 italic font-bold">
                                  (Auto {editMetaDetails.plotUnit || "CFT"})
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* PLOT SPECIFICATIONS */}
                          <div className="space-y-1.5 border-b border-slate-950/15 pb-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-800 font-extrabold uppercase w-28">Plot Area:</span>
                              <div className="flex gap-2 items-center flex-1 justify-start">
                                <input
                                  id="edit-meta-plotmeasurement"
                                  type="number"
                                  step="0.01"
                                  value={editMetaDetails.plotMeasurement || ""}
                                  onChange={(e) => handleMetaDetailsChange("plotMeasurement", e.target.value)}
                                  placeholder="0"
                                  className="w-20 bg-slate-100 border border-slate-950 rounded px-2 py-0.5 text-right focus:outline-none text-[#2B547E] font-black font-mono h-6.5"
                                />
                                <select
                                  id="edit-meta-plotunit"
                                  value={editMetaDetails.plotUnit || "SFT"}
                                  onChange={(e) => handleMetaDetailsChange("plotUnit", e.target.value)}
                                  className="bg-white border border-slate-950 rounded px-1 py-0.5 focus:outline-none cursor-pointer font-black h-6.5 text-slate-900 text-[10px]"
                                >
                                  <option value="SFT">SFT</option>
                                  <option value="SQM">SQM</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pl-3">
                              <span className="text-[10px] text-slate-800 font-extrabold uppercase">L:</span>
                              <input
                                id="edit-meta-plotlength-plot"
                                type="number"
                                step="0.01"
                                value={editMetaDetails.plotLength || ""}
                                onChange={(e) => handleMetaDetailsChange("plotLength", e.target.value)}
                                placeholder="0.0"
                                className="w-14 bg-white border border-slate-950 rounded px-1.5 py-0.5 text-right focus:outline-none font-mono h-5.5 text-slate-900 text-[11px]"
                              />
                              <span className="text-slate-955 font-black">×</span>
                              <span className="text-[10px] text-slate-800 font-extrabold uppercase">W:</span>
                              <input
                                id="edit-meta-plotwidth-plot"
                                type="number"
                                step="0.01"
                                value={editMetaDetails.plotWidth || ""}
                                onChange={(e) => handleMetaDetailsChange("plotWidth", e.target.value)}
                                placeholder="0.0"
                                className="w-14 bg-white border border-slate-950 rounded px-1.5 py-0.5 text-right focus:outline-none font-mono h-5.5 text-slate-900 text-[11px]"
                              />
                              <span className="text-[10px] text-slate-800 italic font-bold">(Auto SFT)</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Financial & Calculation Fields */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-slate-800 font-extrabold uppercase block mb-0.5">Rate:</span>
                          <input
                            id="edit-meta-rate"
                            type="number"
                            step="0.01"
                            value={editMetaDetails.rate || ""}
                            onChange={(e) => handleMetaDetailsChange("rate", e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-slate-950 rounded px-2 py-0.5 text-right focus:outline-none font-mono h-6 text-slate-900 text-xs"
                          />
                        </div>

                        <div>
                          <span className="text-slate-800 font-extrabold uppercase block mb-0.5">Gross Amt:</span>
                          <input
                            id="edit-meta-amount"
                            type="number"
                            step="0.01"
                            value={editMetaDetails.amount || ""}
                            onChange={(e) => handleMetaDetailsChange("amount", e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-100 border border-slate-950 rounded px-2 py-0.5 text-right focus:outline-none text-[#2B547E] font-black font-mono h-6 text-xs"
                          />
                        </div>

                        <div>
                          <span className="text-slate-800 font-extrabold uppercase block mb-0.5">Comm/Unit:</span>
                          <input
                            id="edit-meta-commission"
                            type="number"
                            step="0.01"
                            value={editMetaDetails.commission || ""}
                            onChange={(e) => handleMetaDetailsChange("commission", e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border border-slate-950 rounded px-2 py-0.5 text-right focus:outline-none font-mono h-6 text-slate-900 text-xs"
                          />
                        </div>

                        <div>
                          <span className="text-slate-800 font-extrabold uppercase block mb-0.5">Total Comm:</span>
                          <input
                            id="edit-meta-totalcommission"
                            type="number"
                            step="0.01"
                            value={editMetaDetails.totalCommission || ""}
                            onChange={(e) => handleMetaDetailsChange("totalCommission", e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-100 border border-slate-950 rounded px-2 py-0.5 text-right focus:outline-none text-[#1E3E64] font-black font-mono h-6 text-xs"
                          />
                        </div>

                        <div>
                          <span className="text-slate-800 font-extrabold uppercase block mb-0.5">Cash / Finance:</span>
                          <select
                            id="edit-meta-cashfinance"
                            value={editMetaDetails.cashFinance || "CASH"}
                            onChange={(e) => handleMetaDetailsChange("cashFinance", e.target.value)}
                            className="w-full bg-white border border-slate-950 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer font-black h-6 text-slate-900 text-xs"
                          >
                            <option value="CASH">CASH</option>
                            <option value="FINANCE">FINANCE</option>
                          </select>
                        </div>

                        <div>
                          <span className="text-slate-800 font-extrabold uppercase block mb-0.5">Finance Amt:</span>
                          <input
                            id="edit-meta-financeamount"
                            type="number"
                            step="0.01"
                            value={editMetaDetails.financeAmount || ""}
                            disabled={editMetaDetails.cashFinance !== "FINANCE"}
                            onChange={(e) => handleMetaDetailsChange("financeAmount", e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white disabled:bg-slate-100 border border-slate-950 rounded px-2 py-0.5 text-right focus:outline-none font-mono h-6 text-slate-900 text-xs"
                          />
                        </div>
                      </div>

                      {/* Form Actions Footer inside the Specifications block */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-950/15 mt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingMetadata(false)}
                          className="px-3 py-1 border border-slate-950 bg-[#C0C0C0] text-slate-900 font-black hover:bg-slate-300 rounded shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 transition-all cursor-pointer focus:outline-none text-[10px] uppercase"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updateLedgerMutation.isPending}
                          className="px-3 py-1 border border-slate-950 bg-[#2B547E] hover:bg-[#1E3E64] disabled:opacity-50 text-white font-black rounded shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 transition-all cursor-pointer uppercase focus:outline-none text-[10px]"
                        >
                          {updateLedgerMutation.isPending ? "Saving..." : "Save Corrected Info"}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 max-w-xl gap-4 font-bold">
                  <div className="space-y-1">
                    {ledgerTypeTab === "COMPANY" ? (
                      <>
                        <div 
                          className={`p-1 px-1.5 rounded transition-all flex items-center group/field ${
                            selectedLedgerId !== "all" ? "cursor-pointer hover:bg-slate-200/60" : ""
                          }`}
                          onClick={(e) => {
                            if (selectedLedgerId !== "all") {
                              e.stopPropagation();
                              startEditingMetadata("name");
                            }
                          }}
                        >
                          <span className="text-slate-400 mr-2 uppercase text-[10px]">Name :</span>
                          <span className={`uppercase font-black text-xs ${
                            selectedLedgerId !== "all" 
                              ? "text-slate-955 underline decoration-dashed group-hover/field:text-[#2B547E]" 
                              : "text-slate-900"
                          }`}>
                            {activeDisplayDetails.name}
                          </span>
                          {selectedLedgerId !== "all" && (
                            <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                          )}
                        </div>

                        <div 
                          className={`p-1 px-1.5 rounded transition-all flex items-center group/field ${
                            selectedLedgerId !== "all" ? "cursor-pointer hover:bg-slate-200/60" : ""
                          }`}
                          onClick={(e) => {
                            if (selectedLedgerId !== "all") {
                              e.stopPropagation();
                              startEditingMetadata("address");
                            }
                          }}
                        >
                          <span className="text-slate-400 mr-2 uppercase text-[10px]">Address :</span>
                          <span className={`uppercase font-black ${
                            selectedLedgerId !== "all" 
                              ? "text-slate-955 underline decoration-dashed group-hover/field:text-[#2B547E]" 
                              : "text-slate-900"
                          }`}>
                            {activeDisplayDetails.address}
                          </span>
                          {selectedLedgerId !== "all" && (
                            <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                          )}
                        </div>

                        <div 
                          className={`p-1 px-1.5 rounded transition-all flex items-center group/field ${
                            selectedLedgerId !== "all" ? "cursor-pointer hover:bg-slate-200/60" : ""
                          }`}
                          onClick={(e) => {
                            if (selectedLedgerId !== "all") {
                              e.stopPropagation();
                              startEditingMetadata("phone");
                            }
                          }}
                        >
                          <span className="text-slate-400 mr-2 uppercase text-[10px]">Phone No. :</span>
                          <span className={`uppercase font-black font-mono ${
                            selectedLedgerId !== "all" 
                              ? "text-slate-955 underline decoration-dashed group-hover/field:text-[#2B547E]" 
                              : "text-slate-900"
                          }`}>
                            {activeDisplayDetails.phone}
                          </span>
                          {selectedLedgerId !== "all" && (
                            <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div 
                          className="cursor-pointer hover:bg-slate-200/60 p-1 px-1.5 rounded transition-all flex items-center group/field"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingMetadata("name");
                          }}
                        >
                          <span className="text-slate-400 mr-2 uppercase text-[10px]">Name :</span>
                          <span className="text-slate-955 font-black text-xs uppercase underline decoration-dashed group-hover/field:text-[#2B547E] group-hover/field:decoration-solid">
                            {selectedLedger?.name || "SELECT ACCOUNT"}
                          </span>
                          <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                        </div>
                        
                        {(() => {
                          const details = parsePartyDetails(selectedLedger?.contactPerson);
                          if (details) {
                            return (
                              <>
                                <div 
                                  className="cursor-pointer hover:bg-slate-200/60 p-1 px-1.5 rounded transition-all flex items-center group/field"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingMetadata("category");
                                  }}
                                >
                                  <span className="text-slate-400 mr-2 uppercase text-[10px]">Category :</span>
                                  <span className="bg-[#2B547E] text-white px-2 py-0.5 rounded text-[10px] uppercase font-extrabold font-mono group-hover/field:bg-[#1E3E64]">
                                    {details.customerExtra || "CUSTOMER"}
                                  </span>
                                  <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                                </div>
                                
                                <div 
                                  className="cursor-pointer hover:bg-slate-200/60 p-1 px-1.5 rounded transition-all flex items-center group/field"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingMetadata("reference");
                                  }}
                                >
                                  <span className="text-slate-400 mr-2 uppercase text-[10px]">Reference :</span>
                                  <span className="text-slate-900 uppercase font-black underline decoration-dashed group-hover/field:text-[#2B547E]">
                                    {details.reference || "N/A"}
                                  </span>
                                  <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                                </div>
                                
                                <div 
                                  className="cursor-pointer hover:bg-slate-200/60 p-1 px-1.5 rounded transition-all flex items-center group/field"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditingMetadata("address");
                                  }}
                                >
                                  <span className="text-slate-400 mr-2 uppercase text-[10px]">Address :</span>
                                  <span className="text-slate-900 uppercase font-black underline decoration-dashed group-hover/field:text-[#2B547E]">
                                    {details.address || "N/A"}
                                  </span>
                                  <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                                </div>
                                
                                {details.dueDate && (
                                  <div 
                                    className="cursor-pointer hover:bg-slate-200/60 p-1 px-1.5 rounded transition-all flex items-center group/field"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingMetadata("duedate");
                                    }}
                                  >
                                    <span className="text-slate-400 mr-2 uppercase text-[10px]">Due Date :</span>
                                    <span className="text-rose-600 uppercase font-black font-mono underline decoration-dashed group-hover/field:text-rose-800">
                                      {details.dueDate}
                                    </span>
                                    <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                                  </div>
                                )}
                              </>
                            );
                          } else {
                            return (
                              <div 
                                className="cursor-pointer hover:bg-slate-200/60 p-1 px-1.5 rounded transition-all flex items-center group/field"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingMetadata("address");
                                }}
                              >
                                <span className="text-slate-400 mr-2 uppercase text-[10px]">Address :</span>
                                <span className="text-slate-900 uppercase underline decoration-dashed group-hover/field:text-[#2B547E]">
                                  {selectedLedger?.contactPerson || ""}
                                </span>
                                <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                              </div>
                            );
                          }
                        })()}

                        <div 
                          className="cursor-pointer hover:bg-slate-200/60 p-1 px-1.5 rounded transition-all flex items-center group/field"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingMetadata("phone");
                          }}
                        >
                          <span className="text-slate-400 mr-2 uppercase text-[10px]">Phone No. :</span>
                          <span className="text-slate-900 uppercase font-mono font-black underline decoration-dashed group-hover/field:text-[#2B547E]">
                            {selectedLedger?.phone || ""}
                          </span>
                          <span className="opacity-0 group-hover/field:opacity-100 ml-1.5 text-[9px] text-[#2B547E] font-bold">✏️ edit</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Styled sub-card for party details if parsed */}
                  {(() => {
                    return null; // Hidden by user's request to hide the yellow specifications block
                    const details = parsePartyDetails(selectedLedger?.contactPerson);
                    if (!details) return null;
                    const isMaterial = details.measurementType === "OTHER" || !!details.materialName;
                    return (
                      <div 
                        className="bg-[#ECC30B] border-2 border-slate-955 rounded p-3 text-[11px] space-y-1 shadow-md text-slate-900 font-mono relative overflow-hidden cursor-pointer hover:bg-[#F2D02B] transition-all group/specs"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingMetadata("plotmeasurement");
                        }}
                      >
                        {/* Decorative small sticker banner */}
                        <div 
                          className="absolute right-[-24px] top-[10px] rotate-[45deg] bg-slate-900 text-white font-black text-[8px] py-0.5 px-7 uppercase tracking-widest border-y border-white hover:bg-slate-800 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingMetadata("cashfinance");
                          }}
                        >
                          {details.cashFinance || "CASH"}
                        </div>
                        
                        <div className="text-xs font-black uppercase text-slate-955 border-b border-slate-950/20 pb-1 flex justify-between">
                          <span>{isMaterial ? "📐 Material Specifications" : "📐 Plot Specifications"}</span>
                          <span className="opacity-0 group-hover/specs:opacity-100 text-[9px] text-slate-950 font-black animate-pulse">✏️ CLICK TO EDIT SPECS</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1">
                          {isMaterial ? (
                            <>
                              <div 
                                className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingMetadata("materialname");
                                }}
                              >
                                <span className="text-slate-800 uppercase font-extrabold mr-1">Material:</span>
                                <span className="font-black text-slate-950 font-mono underline decoration-dotted">
                                  {details.materialName || "N/A"}
                                </span>
                              </div>
                              <div 
                                className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingMetadata("plotlength");
                                }}
                              >
                                <span className="text-slate-800 uppercase font-extrabold mr-1">Measurement:</span>
                                <span className="font-black text-slate-955 font-mono underline decoration-dotted">
                                  {details.plotHeight && details.plotWidth && details.plotLength 
                                    ? `${details.plotHeight} × ${details.plotWidth} × ${details.plotLength} = ` 
                                    : ""}
                                  {details.plotMeasurement || "0"} {details.plotUnit || "CFT"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div 
                              className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingMetadata("plotlength-plot");
                                }}
                            >
                              <span className="text-slate-800 uppercase font-extrabold mr-1">Plot Area:</span>
                              <span className="font-black text-slate-955 font-mono underline decoration-dotted">
                                {details.plotLength && details.plotWidth ? `${details.plotLength} × ${details.plotWidth} = ` : ""}
                                {details.plotMeasurement || "0"} {details.plotUnit || "SFT"}
                              </span>
                            </div>
                          )}
                          <div 
                            className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingMetadata("rate");
                            }}
                          >
                            <span className="text-slate-800 uppercase font-extrabold mr-1">Rate:</span>
                            <span className="font-black text-slate-955 font-mono underline decoration-dotted">
                              ₹{parseFloat(details.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div 
                            className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingMetadata("amount");
                            }}
                          >
                            <span className="text-slate-800 uppercase font-extrabold mr-1">Gross Amt:</span>
                            <span className="font-black text-[#2B547E] font-mono underline decoration-dotted">
                              ₹{parseFloat(details.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div 
                            className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingMetadata("commission");
                            }}
                          >
                            <span className="text-slate-800 uppercase font-extrabold mr-1">Commission:</span>
                            <span className="font-black text-slate-955 font-mono underline decoration-dotted">
                              ₹{parseFloat(details.commission || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div 
                            className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingMetadata("totalcommission");
                            }}
                          >
                            <span className="text-slate-800 uppercase font-extrabold mr-1">Total Comm:</span>
                            <span className="font-black text-[#1E3E64] font-mono underline decoration-dotted">
                              ₹{parseFloat(details.totalCommission || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {details.cashFinance === "FINANCE" && (
                            <div 
                              className="hover:bg-amber-400/50 p-0.5 rounded transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingMetadata("financeamount");
                              }}
                            >
                              <span className="text-slate-800 uppercase font-extrabold mr-1">Financed Amt:</span>
                              <span className="font-black text-emerald-800 font-mono underline decoration-dotted">
                                ₹{parseFloat(details.financeAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {details.mobileNo && details.mobileNo !== details.phoneNo && (
                          <div 
                            className="text-[10px] text-slate-800 border-t border-slate-955/10 mt-1.5 pt-1 uppercase font-bold hover:bg-amber-400/50 transition-all rounded p-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingMetadata("altmobile");
                            }}
                          >
                            <span>Alt Mobile: <span className="underline decoration-dotted font-black text-slate-955">{details.mobileNo}</span></span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Tally Spreadsheet sky blue Grid Table */}
            <div 
              ref={tableContainerRef} 
              className={`bg-[#E0F0F8] overflow-auto relative border border-slate-800 scroll-smooth ${
                action === "entry" 
                  ? "max-h-[280px] min-h-[280px] h-[280px]" 
                  : "max-h-[calc(100vh-270px)] min-h-[380px]"
              }`}
            >
              <table className="w-full border-collapse font-mono text-[13px] sm:text-sm text-slate-900">
                
                 {/* Headers */}
                <thead>
                  {ledgerTypeTab === "COMPANY" ? (
                    <tr className={`bg-[#2B547E] text-white border-b-2 border-slate-800 font-extrabold uppercase text-[12px] text-left ${action === "entry" ? "h-9" : ""}`}>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold w-24`}>Date</th>
                      {!isParticularLedgerOpen && (
                        <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold w-72`}>Particulars (Name / Mob / Addr)</th>
                      )}
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold w-72`}>Material</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-24`}>Qty</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-center w-20`}>Unit</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-24`}>Rate</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-center w-20`}>Dr / Cr</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-32`}>Debit</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-32`}>Credit</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-40 ${action === "delete" ? "border-r border-slate-800" : ""}`}>Amount</th>
                      {action === "delete" && (
                        <th className="sticky top-0 bg-[#2B547E] z-20 border-b border-slate-800 py-3 px-4 text-white font-extrabold text-center w-20">Delete</th>
                      )}
                    </tr>
                  ) : (
                    <tr className={`bg-[#2B547E] text-white border-b-2 border-slate-800 font-extrabold uppercase text-[12px] text-left ${action === "entry" ? "h-9" : ""}`}>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold w-24`}>Date</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold w-72`}>Particulars</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-24`}>Qty</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-center w-20`}>Unit</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-24`}>Rate</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-center w-20`}>Dr / Cr</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-32`}>Debit</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-r border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-32`}>Credit</th>
                      <th className={`sticky top-0 bg-[#2B547E] z-20 border-b border-slate-800 ${action === "entry" ? "py-2" : "py-3"} px-4 text-white font-extrabold text-right w-40 ${action === "delete" ? "border-r border-slate-800" : ""}`}>Amount</th>
                      {action === "delete" && (
                        <th className="sticky top-0 bg-[#2B547E] z-20 border-b border-slate-800 py-3 px-4 text-white font-extrabold text-center w-20">Delete</th>
                      )}
                    </tr>
                  )}
                </thead>
 
                {/* Rows Grid */}
                <tbody>{statementData.transactions.map((tx: any, idx: number) => {
                    if (action === "correction" && editingTransactionId === tx.id) {
                      return (
                        <tr 
                          key={tx.id} 
                          ref={editingTransactionRowRef}
                          className="bg-amber-50/70 border-2 border-[#2B547E] font-bold text-xs uppercase"
                        >
                          <td className="border-r border-slate-300 p-1.5 w-24">
                            <input 
                              id="edit-inline-date"
                              type="text"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              onKeyDown={(e) => handleInlineFieldKeyDown(e, "date")}
                              placeholder="Date"
                              required
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-center focus:outline-none focus:border-slate-800 h-7"
                            />
                          </td>

                          {ledgerTypeTab === "COMPANY" ? (
                            <>
                              {!isParticularLedgerOpen && (
                                <td className="border-r border-slate-300 p-1.5 w-72 relative">
                                  <div ref={editParticularSelectorRef} className="w-full space-y-1">
                                    <div className="flex gap-1.5 items-center">
                                      <select
                                        id="edit-inline-type"
                                        value={editType}
                                        onChange={(e) => {
                                          const type = e.target.value as "TO" | "BY";
                                          setEditType(type);
                                        }}
                                        onKeyDown={(e) => handleInlineFieldKeyDown(e, "type")}
                                        className="bg-white border border-slate-300 rounded px-1 py-1 text-xs font-black font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7"
                                      >
                                        <option value="BY">By</option>
                                        <option value="TO">To</option>
                                      </select>
                                      <div className="relative flex-1 flex items-center bg-white border border-slate-300 rounded overflow-hidden h-7">
                                        <input 
                                          id="edit-inline-particular"
                                          type="text"
                                          value={editParticularText}
                                          onChange={(e) => {
                                            setEditParticularText(e.target.value);
                                            setIsEditParticularSuggestionsOpen(true);
                                            setHighlightedEditParticularIndex(-1);
                                          }}
                                          onFocus={() => {
                                            setIsEditParticularSuggestionsOpen(true);
                                            setHighlightedEditParticularIndex(-1);
                                          }}
                                          onKeyDown={handleParticularInputKeyDown}
                                          placeholder="Account"
                                          required
                                          className="w-full px-2 py-0.5 text-xs font-bold uppercase focus:outline-none placeholder:text-slate-400 font-mono"
                                        />
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setIsEditParticularSuggestionsOpen((prev) => !prev);
                                            setHighlightedEditParticularIndex(-1);
                                          }}
                                          className="px-1 border-l border-slate-200 text-slate-400 hover:text-slate-655 transition-colors focus:outline-none flex items-center justify-center h-full"
                                        >
                                          <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex gap-1 items-center">
                                      <input 
                                        id="edit-inline-narration"
                                        type="text"
                                        value={editNarrationText}
                                        onChange={(e) => setEditNarrationText(e.target.value)}
                                        onKeyDown={(e) => handleInlineFieldKeyDown(e, "narration")}
                                        placeholder="Narration (e.g. CASH)"
                                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                                      />
                                      <input 
                                        type="text"
                                        value={editChallanNo}
                                        onChange={(e) => setEditChallanNo(e.target.value)}
                                        placeholder="CH"
                                        className="w-12 bg-white border border-slate-300 rounded px-1 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 text-center font-mono h-7 shrink-0"
                                      />
                                    </div>

                                    {isEditParticularSuggestionsOpen && (
                                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[999] max-h-40 overflow-y-auto font-mono text-xs uppercase">
                                        {filteredEditLedgerSuggestions.length === 0 ? (
                                          <div className="p-2 text-slate-400 italic">No matching accounts</div>
                                        ) : (
                                          filteredEditLedgerSuggestions.map((ledger: any, index: number) => {
                                            const isActive = highlightedEditParticularIndex === index;
                                            return (
                                              <button
                                                key={ledger.id}
                                                id={`edit-part-opt-${index}`}
                                                type="button"
                                                onClick={() => {
                                                  setEditParticularText(ledger.name.toUpperCase());
                                                  setIsEditParticularSuggestionsOpen(false);
                                                  setHighlightedEditParticularIndex(-1);
                                                  setTimeout(() => {
                                                    document.getElementById("edit-inline-narration")?.focus();
                                                  }, 50);
                                                }}
                                                onMouseEnter={() => setHighlightedEditParticularIndex(index)}
                                                className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                                  isActive 
                                                    ? "bg-[#2B547E] text-white font-extrabold" 
                                                    : "bg-white hover:bg-slate-200 text-slate-900"
                                                }`}
                                              >
                                                {ledger.name.toUpperCase()}
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )}

                              {/* Material (search / create inline) */}
                              <td className="border-r border-slate-300 p-1.5 w-72 relative">
                                <input 
                                  id="edit-inline-material"
                                  type="text"
                                  value={editMaterial}
                                  onChange={(e) => {
                                    setEditMaterial(e.target.value.toUpperCase());
                                    setHighlightedEditMaterialIndex(-1);
                                  }}
                                  placeholder="Material"
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                                  onKeyDown={(e) => {
                                    const isSuggestionsOpen = filteredEditMaterialSuggestions.length > 0;
                                    if (isSuggestionsOpen) {
                                      if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setHighlightedEditMaterialIndex((prev) => {
                                          const next = prev + 1;
                                          return next >= filteredEditMaterialSuggestions.length ? 0 : next;
                                        });
                                        return;
                                      }
                                      if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setHighlightedEditMaterialIndex((prev) => {
                                          const next = prev - 1;
                                          return next < 0 ? filteredEditMaterialSuggestions.length - 1 : next;
                                        });
                                        return;
                                      }
                                      if (e.key === "Enter") {
                                        let targetIndex = highlightedEditMaterialIndex;
                                        if (targetIndex === -1 && editMaterial.trim() !== "" && filteredEditMaterialSuggestions.length > 0) {
                                          targetIndex = 0;
                                        }
                                        if (targetIndex >= 0 && targetIndex < filteredEditMaterialSuggestions.length) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const mat = filteredEditMaterialSuggestions[targetIndex];
                                          setEditMaterial(mat.name.toUpperCase());
                                          setEditUnit(mat.unit.toUpperCase());
                                          setHighlightedEditMaterialIndex(-1);
                                          setTimeout(() => {
                                            document.getElementById("edit-inline-qty")?.focus();
                                          }, 50);
                                          return;
                                        }
                                      }
                                    }
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const exactMatch = existingMaterials.find(m => m.name.toUpperCase() === editMaterial.trim().toUpperCase());
                                      if (exactMatch) {
                                        setEditMaterial(exactMatch.name.toUpperCase());
                                        setEditUnit(exactMatch.unit.toUpperCase());
                                      }
                                      setTimeout(() => {
                                        document.getElementById("edit-inline-qty")?.focus();
                                      }, 50);
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      document.getElementById("edit-inline-date")?.focus();
                                    }
                                  }}
                                />
                                {document.activeElement === document.getElementById("edit-inline-material") && filteredEditMaterialSuggestions.length > 0 && (
                                  <div className="absolute left-0 top-full mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 w-64 font-mono text-slate-900 text-xs font-bold p-2 max-h-36 overflow-y-auto space-y-0.5">
                                    {filteredEditMaterialSuggestions.map((mat, index) => {
                                      const isHighlighted = highlightedEditMaterialIndex === index;
                                      return (
                                        <div
                                          key={mat.id}
                                          onMouseEnter={() => setHighlightedEditMaterialIndex(index)}
                                          className={`flex items-center justify-between rounded px-2 py-1 group ${
                                            isHighlighted ? "bg-[#2B547E] text-white" : "hover:bg-slate-100 text-slate-900"
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditMaterial(mat.name.toUpperCase());
                                              setEditUnit(mat.unit.toUpperCase());
                                              setTimeout(() => {
                                                document.getElementById("edit-inline-qty")?.focus();
                                              }, 50);
                                            }}
                                            className={`flex-1 text-left font-black text-[11px] uppercase flex justify-between items-center focus:outline-none mr-2 ${
                                              isHighlighted ? "text-white" : "text-slate-900"
                                            }`}
                                          >
                                            <span>{mat.name.toUpperCase()}</span>
                                            <span className={`text-[9px] lowercase ${isHighlighted ? "text-white/80" : "text-slate-500"}`}>({mat.unit.toUpperCase()})</span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>

                              {/* Quantity */}
                              <td className="border-r border-slate-300 p-1.5 w-24">
                                <input 
                                  id="edit-inline-qty"
                                  type="number"
                                  step="0.01"
                                  value={editQty}
                                  onChange={(e) => setEditQty(e.target.value)}
                                  placeholder="Qty"
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-slate-800 h-7"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      document.getElementById("edit-inline-unit")?.focus();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      document.getElementById("edit-inline-material")?.focus();
                                    }
                                  }}
                                />
                              </td>

                              {/* Unit */}
                              <td className="border-r border-slate-300 p-1.5 w-20">
                                <select
                                  id="edit-inline-unit"
                                  value={editUnit}
                                  onChange={(e) => setEditUnit(e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-xs font-bold font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      document.getElementById("edit-inline-rate")?.focus();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      document.getElementById("edit-inline-qty")?.focus();
                                    }
                                  }}
                                >
                                  {availableUnits.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Rate */}
                              <td className="border-r border-slate-300 p-1.5 w-24">
                                <input 
                                  id="edit-inline-rate"
                                  type="number"
                                  step="0.01"
                                  value={editRate}
                                  onChange={(e) => setEditRate(e.target.value)}
                                  placeholder="Rate"
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-slate-800 h-7"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const qtyVal = parseFloat(editQty) || 0;
                                      const rateVal = parseFloat(editRate) || 0;
                                      const calculatedAmount = qtyVal * rateVal;
                                      if (calculatedAmount > 0) {
                                        setEditAmountText(calculatedAmount.toString());
                                      }
                                      document.getElementById("edit-inline-debit")?.focus() || document.getElementById("edit-inline-credit")?.focus();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      document.getElementById("edit-inline-unit")?.focus();
                                    }
                                  }}
                                />
                              </td>

                              <td className="border-r border-slate-300 p-1.5 text-center text-slate-500 w-20">
                                {editType === "TO" ? "Dr" : "Cr"}
                              </td>
                              <td className="border-r border-slate-300 p-1.5 w-32">
                                <input 
                                  id="edit-inline-debit"
                                  type="number"
                                  step="0.01"
                                  value={editType === "TO" ? editAmountText : ""}
                                  onChange={(e) => {
                                    setEditAmountText(e.target.value);
                                    if (e.target.value) {
                                      setEditType("TO");
                                    }
                                  }}
                                  onKeyDown={(e) => handleInlineFieldKeyDown(e, "debit")}
                                  placeholder="Debit"
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                                />
                              </td>
                              <td className="border-r border-slate-300 p-1.5 w-32">
                                <input 
                                  id="edit-inline-credit"
                                  type="number"
                                  step="0.01"
                                  value={editType === "BY" ? editAmountText : ""}
                                  onChange={(e) => {
                                    setEditAmountText(e.target.value);
                                    if (e.target.value) {
                                      setEditType("BY");
                                    }
                                  }}
                                  onKeyDown={(e) => handleInlineFieldKeyDown(e, "credit")}
                                  placeholder="Credit"
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="border-r border-slate-300 p-1.5 w-72 relative">
                                <div ref={editParticularSelectorRef} className="w-full space-y-1">
                                  <div className="flex gap-1.5 items-center">
                                    <select
                                      id="edit-inline-type"
                                      value={editType}
                                      onChange={(e) => {
                                        const type = e.target.value as "TO" | "BY";
                                        setEditType(type);
                                      }}
                                      onKeyDown={(e) => handleInlineFieldKeyDown(e, "type")}
                                      className="bg-white border border-slate-300 rounded px-1 py-1 text-xs font-black font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7"
                                    >
                                      <option value="BY">By</option>
                                      <option value="TO">To</option>
                                    </select>
                                    <div className="relative flex-1 flex items-center bg-white border border-slate-300 rounded overflow-hidden h-7">
                                      <input 
                                        id="edit-inline-particular"
                                        type="text"
                                        value={editParticularText}
                                        onChange={(e) => {
                                          setEditParticularText(e.target.value);
                                          setIsEditParticularSuggestionsOpen(true);
                                          setHighlightedEditParticularIndex(-1);
                                        }}
                                        onFocus={() => {
                                          setIsEditParticularSuggestionsOpen(true);
                                          setHighlightedEditParticularIndex(-1);
                                        }}
                                        onKeyDown={handleParticularInputKeyDown}
                                        placeholder="Account"
                                        required
                                        className="w-full px-2 py-0.5 text-xs font-bold uppercase focus:outline-none placeholder:text-slate-400 font-mono"
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setIsEditParticularSuggestionsOpen((prev) => !prev);
                                          setHighlightedEditParticularIndex(-1);
                                        }}
                                        className="px-1 border-l border-slate-200 text-slate-400 hover:text-slate-655 transition-colors focus:outline-none flex items-center justify-center h-full"
                                      >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex gap-1 items-center">
                                    <input 
                                      id="edit-inline-narration"
                                      type="text"
                                      value={editNarrationText}
                                      onChange={(e) => setEditNarrationText(e.target.value)}
                                      onKeyDown={(e) => handleInlineFieldKeyDown(e, "narration")}
                                      placeholder="Narration (e.g. CASH)"
                                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                                    />
                                  </div>

                                  {isEditParticularSuggestionsOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[999] max-h-40 overflow-y-auto font-mono text-xs uppercase">
                                      {filteredEditLedgerSuggestions.length === 0 ? (
                                        <div className="p-2 text-slate-400 italic">No matching accounts</div>
                                      ) : (
                                        filteredEditLedgerSuggestions.map((ledger: any, index: number) => {
                                          const isActive = highlightedEditParticularIndex === index;
                                          return (
                                            <button
                                              key={ledger.id}
                                              type="button"
                                              onClick={() => {
                                                setEditParticularText(ledger.name.toUpperCase());
                                                setIsEditParticularSuggestionsOpen(false);
                                                setHighlightedEditParticularIndex(-1);
                                                setTimeout(() => {
                                                  document.getElementById("edit-inline-narration")?.focus();
                                                }, 50);
                                              }}
                                              onMouseEnter={() => setHighlightedEditParticularIndex(index)}
                                              className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                                isActive 
                                                  ? "bg-[#2B547E] text-white font-extrabold" 
                                                  : "bg-white hover:bg-slate-200 text-slate-900"
                                              }`}
                                            >
                                              {ledger.name.toUpperCase()}
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="border-r border-slate-300 p-1.5 text-center text-slate-500 w-24">-</td>
                              <td className="border-r border-slate-300 p-1.5 text-center text-slate-500 w-20">-</td>
                              <td className="border-r border-slate-300 p-1.5 text-center text-slate-500 w-24">-</td>

                              <td className="border-r border-slate-300 p-1.5 text-center text-slate-500 w-20">
                                {editType === "TO" ? "Dr" : "Cr"}
                              </td>
                              <td className="border-r border-slate-300 p-1.5 w-32">
                                <input 
                                  id="edit-inline-debit"
                                  type="number"
                                  step="0.01"
                                  value={editType === "TO" ? editAmountText : ""}
                                  onChange={(e) => {
                                    setEditAmountText(e.target.value);
                                    if (e.target.value) {
                                      setEditType("TO");
                                    }
                                  }}
                                  onKeyDown={(e) => handleInlineFieldKeyDown(e, "debit")}
                                  placeholder="Debit"
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                                />
                              </td>
                              <td className="border-r border-slate-300 p-1.5 w-32">
                                <input 
                                  id="edit-inline-credit"
                                  type="number"
                                  step="0.01"
                                  value={editType === "BY" ? editAmountText : ""}
                                  onChange={(e) => {
                                    setEditAmountText(e.target.value);
                                    if (e.target.value) {
                                      setEditType("BY");
                                    }
                                  }}
                                  onKeyDown={(e) => handleInlineFieldKeyDown(e, "credit")}
                                  placeholder="Credit"
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                                />
                              </td>
                            </>
                          )}

                          <td className="p-1.5 text-right font-black w-40">
                            {tx.runningBalance === 0 ? "NILL" : `${tx.balanceSign.toUpperCase()} ${Math.abs(tx.runningBalance).toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    }

                    const compDetails = ledgerTypeTab === "COMPANY" ? parseCompanyTransactionPaymentMode(tx.paymentMode) : null;
                    const address = compDetails?.address || "";
                    const mobile = compDetails?.mobile || "";
                    const material = compDetails?.material || "";
                    const qty = compDetails?.qty || 0;
                    const unit = compDetails?.unit || "";
                    const rate = compDetails?.rate || 0;
                    const { particular: parsedName } = parseEntry(tx.expenseType);

                    return (
                      <tr 
                        key={tx.id} 
                        id={`tx-row-${tx.id}`}
                        tabIndex={0}
                        onKeyDown={(e) => handleRowKeyDown(e, tx, idx)}
                        onFocus={() => {
                          setFocusedRowIndex(idx);
                          setHoveredOrFocusedTx(tx);
                        }}
                        onMouseEnter={() => setHoveredOrFocusedTx(tx)}
                        onMouseLeave={() => setHoveredOrFocusedTx(null)}
                        onClick={() => {
                          if (action === "correction") {
                            handleEditClick(tx);
                            setTimeout(() => {
                              document.getElementById("edit-inline-date")?.focus();
                            }, 100);
                          }
                        }}
                        className={`font-black uppercase text-slate-955 group focus:outline-none focus:bg-[#2B547E] focus:text-white border-b border-slate-400 ${action === "entry" ? "h-9" : ""} ${
                          action === "correction" 
                            ? "hover:bg-amber-50 cursor-pointer bg-amber-50/10 text-slate-955" 
                            : action === "delete"
                            ? "hover:bg-red-50/70 cursor-pointer bg-red-50/10 text-slate-955"
                            : "hover:bg-[#D0E5F5]/60 text-slate-955"
                        }`}
                      >
                        <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-slate-700 group-focus:text-white`}>
                          <div>{tx.date}</div>
                        </td>
                        {(!isParticularLedgerOpen || ledgerTypeTab !== "COMPANY") && (
                          <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4`}>
                            {ledgerTypeTab === "COMPANY" ? (
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 group-focus:text-white uppercase">{parsedName}</span>
                                {tx.referenceNumber && tx.referenceNumber !== "DIRECT_FORM_V2" && tx.referenceNumber !== "AUTO_DEBIT" && tx.referenceNumber !== "COMPANY_DIRECT" && tx.referenceNumber !== "LEDGER_DIRECT" && (
                                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold whitespace-nowrap group-focus:bg-slate-700 group-focus:text-white">
                                    CH: {tx.referenceNumber}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="group-focus:text-white">{tx.particulars}</span>
                              </div>
                            )}
                          </td>
                        )}
                        {ledgerTypeTab === "COMPANY" && (
                          <>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-slate-800 group-focus:text-white uppercase`}>
                              <div className="flex items-center gap-2">
                                <span>{material || "-"}</span>
                                {tx.referenceNumber && tx.referenceNumber !== "DIRECT_FORM_V2" && tx.referenceNumber !== "AUTO_DEBIT" && tx.referenceNumber !== "COMPANY_DIRECT" && tx.referenceNumber !== "LEDGER_DIRECT" && (
                                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold whitespace-nowrap group-focus:bg-slate-700 group-focus:text-white">
                                    CH: {tx.referenceNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-slate-800 group-focus:text-white font-mono`}>{qty > 0 ? qty.toString() : "-"}</td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-center text-slate-800 group-focus:text-white font-bold`}>{unit || "-"}</td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-slate-800 group-focus:text-white font-mono`}>{rate > 0 ? rate.toFixed(2) : "-"}</td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-center text-slate-650 group-focus:text-white`}>{tx.isDebit ? "DR" : "CR"}</td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-red-700 group-focus:text-white/90`}>
                              {tx.debit > 0 ? tx.debit.toFixed(2) : "0.00"}
                            </td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-emerald-700 group-focus:text-white/90`}>
                              {tx.credit > 0 ? tx.credit.toFixed(2) : "0.00"}
                            </td>
                          </>
                        )}
                        {ledgerTypeTab !== "COMPANY" && (
                          <>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-slate-800 group-focus:text-white font-mono`}>
                              {tx.qty !== null && tx.qty !== undefined ? tx.qty.toString() : "-"}
                            </td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-center text-slate-800 group-focus:text-white font-bold`}>
                              {tx.unit || "-"}
                            </td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-slate-800 group-focus:text-white font-mono`}>
                              {tx.rate !== null && tx.rate !== undefined ? tx.rate.toFixed(2) : "-"}
                            </td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-center text-slate-650 group-focus:text-white`}>
                              {tx.isDebit ? "DR" : "CR"}
                            </td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-red-700 group-focus:text-white/90`}>
                              {tx.debit > 0 ? tx.debit.toFixed(2) : "0.00"}
                            </td>
                            <td className={`border-r border-slate-400 ${action === "entry" ? "py-2" : "py-3"} px-4 text-right text-emerald-700 group-focus:text-white/90`}>
                              {tx.credit > 0 ? tx.credit.toFixed(2) : "0.00"}
                            </td>
                          </>
                        )}
                        <td className={`py-2 px-4 text-right font-black group-focus:text-white ${action === "delete" ? "border-r border-slate-400" : ""}`}>{tx.runningBalance === 0 ? "NILL" : `${tx.balanceSign.toUpperCase()} ${Math.abs(tx.runningBalance).toFixed(2)}`}</td>
                        {action === "delete" && (
                          <td className="py-2 px-3 text-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 hover:bg-red-100 hover:text-red-700 border border-transparent hover:border-red-300 rounded text-red-655 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Are you sure you want to delete this entry?")) {
                                  deleteTransactionMutation.mutate(tx.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {selectedSiteId && selectedSiteId !== "all" && action === "entry" ? (
                    ledgerTypeTab === "COMPANY" ? (
                      <tr className="bg-slate-50 border-t-2 border-slate-400 font-bold text-xs uppercase h-11">
                        {/* Date Input */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-24 z-10">
                          <input 
                            type="text"
                            ref={compDateInputRef}
                            value={compDate}
                            onChange={(e) => setCompDate(e.target.value)}
                            onFocus={(e) => e.target.setSelectionRange(0, 2)}
                            placeholder="Date"
                            required
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (isParticularLedgerOpen) {
                                  setCompActiveStep("MATERIAL");
                                  setTimeout(() => compMaterialInputRef.current?.focus(), 50);
                                } else {
                                  setCompActiveStep("NAME");
                                  setTimeout(() => compTypeSelectRef.current?.focus(), 50);
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isSidebarOpen) {
                                  setIsSidebarOpen(true);
                                }
                                setTimeout(() => {
                                  accountInputRef.current?.focus();
                                  accountInputRef.current?.select();
                                }, 50);
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-center focus:outline-none focus:border-slate-800"
                          />
                        </td>

                        {/* Particulars (Name / Mob / Addr) */}
                        {!isParticularLedgerOpen && (
                          <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-72 relative z-10">
                            <div className="flex gap-1.5 items-center w-full relative">
                            <select
                              ref={compTypeSelectRef}
                              value={compType}
                              onChange={(e) => setCompType(e.target.value as "BY" | "TO")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  compNameInputRef.current?.focus();
                                  compNameInputRef.current?.select();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCompActiveStep("DATE");
                                  setTimeout(() => {
                                    if (compDateInputRef.current) {
                                      compDateInputRef.current.focus();
                                      compDateInputRef.current.setSelectionRange(0, 2);
                                    }
                                  }, 50);
                                }
                              }}
                              className="bg-white border border-slate-300 rounded px-1 py-1 text-xs font-black font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7"
                            >
                              <option value="BY">By</option>
                              <option value="TO">To</option>
                            </select>

                            <div className="relative flex-1 flex items-center bg-white border border-slate-300 rounded overflow-hidden h-7">
                              <input 
                                type="text"
                                ref={compNameInputRef}
                                value={compName}
                                placeholder="ENTER ACCOUNT NAME"
                                required
                                onChange={(e) => {
                                  setCompName(e.target.value.toUpperCase());
                                  setCompActiveStep("NAME");
                                  setHighlightedCompNameIndex(-1);
                                }}
                                onFocus={() => {
                                  setCompActiveStep("NAME");
                                  setHighlightedCompNameIndex(-1);
                                }}
                                onKeyDown={(e) => {
                                  const isSuggestionsOpen = compName.trim() !== "" && filteredCompNameSuggestions.length > 0;
                                  
                                  if (isSuggestionsOpen) {
                                    if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setHighlightedCompNameIndex((prev) => {
                                        const next = prev + 1;
                                        return next >= filteredCompNameSuggestions.length ? 0 : next;
                                      });
                                      return;
                                    }
                                    if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setHighlightedCompNameIndex((prev) => {
                                        const next = prev - 1;
                                        return next < 0 ? filteredCompNameSuggestions.length - 1 : next;
                                      });
                                      return;
                                    }
                                    if (e.key === "Enter") {
                                      let targetIndex = highlightedCompNameIndex;
                                      if (targetIndex === -1 && filteredCompNameSuggestions.length > 0) {
                                        targetIndex = 0;
                                      }
                                      if (targetIndex >= 0 && targetIndex < filteredCompNameSuggestions.length) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const ledger = filteredCompNameSuggestions[targetIndex];
                                        setCompName(ledger.name.toUpperCase());
                                        const parsed = parsePartyDetails(ledger.contactPerson);
                                        if (parsed) {
                                          setCompAddress(parsed.address || "");
                                          setCompMobile(parsed.mobileNo || "");
                                        } else {
                                          setCompAddress(ledger.contactPerson || "");
                                          setCompMobile(ledger.phone || "");
                                        }
                                        setHighlightedCompNameIndex(-1);
                                        
                                        triggerNewEstimatePrompt(() => {
                                          setCompActiveStep("ADDRESS_MOBILE");
                                          setTimeout(() => compAddressInputRef.current?.focus(), 50);
                                        });
                                        return;
                                      }
                                    }
                                  }

                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const existing = (ledgers || []).find((l: any) => l.name.toUpperCase() === compName.trim().toUpperCase() && l.type === "Company");
                                    if (existing) {
                                      const parsed = parsePartyDetails(existing.contactPerson);
                                      if (parsed) {
                                        setCompAddress(parsed.address || "");
                                        setCompMobile(parsed.mobileNo || "");
                                      } else {
                                        setCompAddress(existing.contactPerson || "");
                                        setCompMobile(existing.phone || "");
                                      }
                                    }
                                    
                                    triggerNewEstimatePrompt(() => {
                                      setCompActiveStep("ADDRESS_MOBILE");
                                      setTimeout(() => compAddressInputRef.current?.focus(), 50);
                                    });
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    compTypeSelectRef.current?.focus();
                                  }
                                }}
                                className="flex-1 bg-white px-2 py-0.5 text-xs font-bold uppercase focus:outline-none placeholder:text-slate-400 font-mono"
                              />
                            </div>

                            {/* Address & Mobile Floating Popup */}
                            {compActiveStep === "ADDRESS_MOBILE" && (
                              <div className="absolute left-0 top-full mt-1 bg-[#ECC30B] border-2 border-slate-900 rounded p-2 shadow-lg z-50 w-64 font-mono text-slate-900 text-xs font-bold space-y-1">
                                <div className="text-[10px] uppercase tracking-wider text-slate-800 border-b border-slate-955/20 pb-0.5 mb-1 font-extrabold flex justify-between">
                                  <span>📁 Contact details</span>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      setCompActiveStep("MATERIAL");
                                      setTimeout(() => compMaterialInputRef.current?.focus(), 50);
                                    }} 
                                    className="text-[9px] text-[#2B547E] hover:text-slate-955 underline uppercase font-black"
                                  >
                                    [SKIP]
                                  </button>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[9px] text-slate-800 uppercase block font-black">Address:</span>
                                  <textarea
                                    ref={compAddressInputRef}
                                    rows={1}
                                    value={compAddress}
                                    onChange={(e) => setCompAddress(e.target.value.toUpperCase())}
                                    placeholder="Company Address"
                                    className="w-full bg-white border border-slate-400 rounded px-1.5 py-0.5 text-xs font-mono resize-none focus:outline-none focus:border-slate-800 text-slate-900 uppercase font-bold"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        compMobileInputRef.current?.focus();
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCompActiveStep("NAME");
                                        compNameInputRef.current?.focus();
                                      }
                                    }}
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[9px] text-slate-800 uppercase block font-black">Mobile No:</span>
                                  <input
                                    type="text"
                                    ref={compMobileInputRef}
                                    value={compMobile}
                                    onChange={(e) => setCompMobile(e.target.value)}
                                    placeholder="Mobile No."
                                    className="w-full bg-white border border-slate-400 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:border-slate-800 text-slate-900 font-bold"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCompActiveStep("MATERIAL");
                                        setTimeout(() => compMaterialInputRef.current?.focus(), 50);
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        compAddressInputRef.current?.focus();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Existing Auto Suggestions */}
                            {compActiveStep === "NAME" && compName.trim() !== "" && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[60] max-h-24 overflow-y-auto font-mono text-[11px] uppercase">
                                {filteredCompNameSuggestions.map((ledger: any, index: number) => {
                                  const isActive = highlightedCompNameIndex === index;
                                  return (
                                    <button
                                      key={ledger.id}
                                      type="button"
                                      onClick={() => {
                                        setCompName(ledger.name.toUpperCase());
                                        const parsed = parsePartyDetails(ledger.contactPerson);
                                        if (parsed) {
                                          setCompAddress(parsed.address || "");
                                          setCompMobile(parsed.mobileNo || "");
                                        } else {
                                          setCompAddress(ledger.contactPerson || "");
                                          setCompMobile(ledger.phone || "");
                                        }
                                        setHighlightedCompNameIndex(-1);
                                        
                                        triggerNewEstimatePrompt(() => {
                                          setCompActiveStep("ADDRESS_MOBILE");
                                          setTimeout(() => compAddressInputRef.current?.focus(), 50);
                                        });
                                      }}
                                      onMouseEnter={() => setHighlightedCompNameIndex(index)}
                                      className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                        isActive ? "bg-[#2B547E] text-white font-extrabold" : "bg-white hover:bg-slate-200 text-slate-900"
                                      }`}
                                    >
                                      {ledger.name.toUpperCase()} (EXISTING)
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                        {/* Material (search / create inline) */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-72 relative z-10">
                          <input 
                            type="text"
                            ref={compMaterialInputRef}
                            value={compMaterial}
                            placeholder="Material"
                            onChange={(e) => {
                              setCompMaterial(e.target.value.toUpperCase());
                              setCompActiveStep("MATERIAL");
                              setHighlightedCompMaterialIndex(-1);
                            }}
                            onFocus={() => {
                              setCompActiveStep("MATERIAL");
                              setHighlightedCompMaterialIndex(-1);
                            }}
                            onKeyDown={(e) => {
                              const isSuggestionsOpen = compActiveStep === "MATERIAL" && !isCreatingNewCompMaterial && filteredCompMaterialSuggestions.length > 0;
                              
                              if (isSuggestionsOpen) {
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setHighlightedCompMaterialIndex((prev) => {
                                    const next = prev + 1;
                                    return next >= filteredCompMaterialSuggestions.length ? 0 : next;
                                  });
                                  return;
                                }
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setHighlightedCompMaterialIndex((prev) => {
                                    const next = prev - 1;
                                    return next < 0 ? filteredCompMaterialSuggestions.length - 1 : next;
                                  });
                                  return;
                                }
                                if (e.key === "Enter") {
                                  let targetIndex = highlightedCompMaterialIndex;
                                  if (targetIndex === -1 && compMaterial.trim() !== "" && filteredCompMaterialSuggestions.length > 0) {
                                    targetIndex = 0;
                                  }
                                  if (targetIndex >= 0 && targetIndex < filteredCompMaterialSuggestions.length) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const mat = filteredCompMaterialSuggestions[targetIndex];
                                    setCompMaterial(mat.name.toUpperCase());
                                    setCompUnit(mat.unit.toUpperCase());
                                    setCompActiveStep("QTY");
                                    setHighlightedCompMaterialIndex(-1);
                                    setTimeout(() => {
                                      compQtyInputRef.current?.focus();
                                      compQtyInputRef.current?.select();
                                    }, 50);
                                    return;
                                  }
                                }
                              }

                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (compMaterial.trim() === "" && highlightedCompMaterialIndex === -1) {
                                  setCompActiveStep("CRDR");
                                  setTimeout(() => compCrDrSelectRef.current?.focus(), 50);
                                } else {
                                  const exactMatch = existingMaterials.find(m => m.name.toUpperCase() === compMaterial.trim().toUpperCase());
                                  if (exactMatch) {
                                    setCompMaterial(exactMatch.name.toUpperCase());
                                    setCompUnit(exactMatch.unit.toUpperCase());
                                  }
                                  setCompActiveStep("QTY");
                                  setTimeout(() => {
                                    compQtyInputRef.current?.focus();
                                    compQtyInputRef.current?.select();
                                  }, 50);
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isParticularLedgerOpen) {
                                  setCompActiveStep("DATE");
                                  setTimeout(() => compDateInputRef.current?.focus(), 50);
                                } else {
                                  setCompActiveStep("ADDRESS_MOBILE");
                                  setTimeout(() => compAddressInputRef.current?.focus(), 50);
                                }
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                          />
                          {compActiveStep === "MATERIAL" && (
                            <div className="absolute left-0 top-full mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 w-64 font-mono text-slate-900 text-xs font-bold p-1.5 space-y-1.5">
                              <div className="text-[10px] uppercase text-slate-700 font-extrabold tracking-wider border-b pb-0.5">
                                Select Material:
                              </div>
                              {isCreatingNewCompMaterial ? (
                                <div className="bg-[#ECC30B]/20 border border-slate-400 rounded p-1.5 space-y-1">
                                  <span className="text-[8px] uppercase tracking-wide text-slate-700 block font-black">Register Material:</span>
                                  <div className="flex flex-col gap-1">
                                    <input 
                                      type="text"
                                      placeholder="Material Name"
                                      value={newCompMaterialName}
                                      onChange={(e) => setNewCompMaterialName(e.target.value.toUpperCase())}
                                      className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-[11px] text-slate-900 font-mono focus:outline-none uppercase font-bold"
                                    />
                                    <div className="flex gap-1 items-center justify-between">
                                      {!isCreatingCustomUnit ? (
                                        <select
                                          value={newCompMaterialUnit}
                                          onChange={(e) => {
                                            if (e.target.value === "CREATE_NEW") {
                                              setIsCreatingCustomUnit(true);
                                              setCustomUnitName("");
                                            } else {
                                              setNewCompMaterialUnit(e.target.value);
                                            }
                                          }}
                                          className="bg-white border border-slate-350 rounded px-0.5 py-0.5 text-[10px] text-slate-900 focus:outline-none cursor-pointer font-bold"
                                        >
                                          {availableUnits.map((u) => (
                                            <option key={u} value={u}>{u}</option>
                                          ))}
                                          <option value="CREATE_NEW">+ NEW</option>
                                        </select>
                                      ) : (
                                        <div className="flex gap-0.5 items-center bg-white border border-slate-350 rounded px-0.5 py-0.5 shrink-0">
                                          <input
                                            type="text"
                                            placeholder="Unit"
                                            value={customUnitName}
                                            onChange={(e) => setCustomUnitName(e.target.value.toUpperCase())}
                                            className="w-8 bg-white border border-slate-300 rounded px-0.5 text-[9px] text-slate-900 font-mono uppercase focus:outline-none font-bold"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                e.preventDefault();
                                                const trimmed = customUnitName.trim().toUpperCase();
                                                if (trimmed) {
                                                  if (!availableUnits.includes(trimmed)) {
                                                    setAvailableUnits((prev) => [...prev, trimmed]);
                                                  }
                                                  setNewCompMaterialUnit(trimmed);
                                                }
                                                setIsCreatingCustomUnit(false);
                                              } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                setIsCreatingCustomUnit(false);
                                              }
                                            }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const trimmed = customUnitName.trim().toUpperCase();
                                              if (trimmed) {
                                                if (!availableUnits.includes(trimmed)) {
                                                  setAvailableUnits((prev) => [...prev, trimmed]);
                                                }
                                                setNewCompMaterialUnit(trimmed);
                                              }
                                              setIsCreatingCustomUnit(false);
                                            }}
                                            className="px-0.5 bg-slate-950 text-white text-[8px] font-bold border rounded uppercase"
                                          >
                                            OK
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setIsCreatingCustomUnit(false)}
                                            className="px-0.5 bg-slate-200 text-slate-800 text-[8px] font-bold border rounded uppercase font-mono"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      )}
                                      <div className="flex gap-1 items-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!newCompMaterialName.trim()) {
                                              toast.error("Material name is required");
                                              return;
                                            }
                                            createMaterialMutation.mutate(
                                              { name: newCompMaterialName.trim().toUpperCase(), unit: newCompMaterialUnit },
                                              {
                                                onSuccess: (res) => {
                                                  const newMat = res.data.data;
                                                  setCompMaterial(newMat.name.toUpperCase());
                                                  setCompUnit(newMat.unit.toUpperCase());
                                                  setIsCreatingNewCompMaterial(false);
                                                  setNewCompMaterialName("");
                                                  setCompActiveStep("QTY");
                                                  setTimeout(() => compQtyInputRef.current?.focus(), 50);
                                                }
                                              }
                                            );
                                          }}
                                          className="bg-slate-950 hover:bg-slate-900 text-white font-extrabold text-[9px] px-1.5 py-0.5 border rounded uppercase"
                                        >
                                          Reg
                                        </button>
                                        <button 
                                          type="button" 
                                          onClick={() => setIsCreatingNewCompMaterial(false)}
                                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-[9px] px-1 py-0.5 border rounded uppercase"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="max-h-[72px] overflow-y-auto space-y-0.5">
                                  {filteredCompMaterialSuggestions.map((mat, index) => {
                                    const isHighlighted = highlightedCompMaterialIndex === index;
                                    return (
                                      <div
                                        key={mat.id}
                                        id={`material-suggestion-${index}`}
                                        onMouseEnter={() => setHighlightedCompMaterialIndex(index)}
                                        className={`flex items-center justify-between rounded px-2 py-0.5 group ${
                                          isHighlighted ? "bg-[#2B547E] text-white" : "hover:bg-slate-100 text-slate-900"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCompMaterial(mat.name.toUpperCase());
                                            setCompUnit(mat.unit.toUpperCase());
                                            setCompActiveStep("QTY");
                                            setTimeout(() => compQtyInputRef.current?.focus(), 50);
                                          }}
                                          className={`flex-1 text-left font-black text-[11px] uppercase flex justify-between items-center focus:outline-none mr-2 ${
                                            isHighlighted ? "text-white" : "text-slate-900"
                                          }`}
                                        >
                                          <span>{mat.name.toUpperCase()}</span>
                                          <span className={`text-[9px] lowercase ${isHighlighted ? "text-white/80" : "text-slate-500"}`}>({mat.unit.toUpperCase()})</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Are you sure you want to delete material "${mat.name.toUpperCase()}"?`)) {
                                              deleteMaterialMutation.mutate(mat.id);
                                            }
                                          }}
                                          className={`text-red-500 hover:text-red-750 opacity-60 hover:opacity-100 font-extrabold text-xs px-1 border border-transparent hover:border-red-300 rounded hover:bg-red-50 cursor-pointer flex items-center justify-center shrink-0 w-4 h-4 font-mono select-none`}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewCompMaterialName(compMaterial);
                                      setIsCreatingNewCompMaterial(true);
                                    }}
                                    className="w-full text-center py-1 bg-blue-50 hover:bg-blue-100 rounded border border-dashed border-blue-300 text-blue-750 text-[10px] font-black uppercase"
                                  >
                                    + [ REGISTER NEW MATERIAL ]
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-24 z-10">
                          <input 
                            type="number"
                            step="0.01"
                            ref={compQtyInputRef}
                            value={compQty}
                            onChange={(e) => setCompQty(e.target.value)}
                            placeholder="Qty"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setCompActiveStep("RATE");
                                setTimeout(() => compRateInputRef.current?.focus(), 50);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setCompActiveStep("MATERIAL");
                                compMaterialInputRef.current?.focus();
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-slate-800"
                          />
                        </td>

                        {/* Unit */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-24 z-10">
                          <input 
                            type="text"
                            ref={compUnitInputRef}
                            value={compUnit}
                            placeholder="Unit"
                            onChange={(e) => {
                              setCompUnit(e.target.value.toUpperCase());
                              setCompActiveStep("UNIT");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                const trimmed = compUnit.trim().toUpperCase();
                                if (trimmed && !availableUnits.includes(trimmed)) {
                                  setAvailableUnits((prev) => [...prev, trimmed]);
                                }
                                setCompActiveStep("RATE");
                                setTimeout(() => {
                                  compRateInputRef.current?.focus();
                                  compRateInputRef.current?.select();
                                }, 50);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setCompActiveStep("QTY");
                                compQtyInputRef.current?.focus();
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                          />
                          
                          {compActiveStep === "UNIT" && (
                            <div className="absolute left-0 top-full mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 w-44 font-mono text-slate-900 text-xs font-bold p-1.5 space-y-1">
                              <div className="text-[9px] uppercase text-slate-650 font-extrabold tracking-wider border-b pb-0.5 mb-1 flex justify-between items-center">
                                <span>Select Unit:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newU = window.prompt("Enter new unit name:");
                                    if (newU && newU.trim().toUpperCase()) {
                                      const trimmed = newU.trim().toUpperCase();
                                      if (!availableUnits.includes(trimmed)) {
                                        setAvailableUnits((prev) => [...prev, trimmed]);
                                      }
                                      setCompUnit(trimmed);
                                    }
                                  }}
                                  className="text-[9px] bg-slate-950 text-white px-1 py-0.5 rounded hover:bg-slate-900 uppercase font-black"
                                >
                                  + Add
                                </button>
                              </div>
                              <div className="max-h-24 overflow-y-auto space-y-0.5">
                                {availableUnits.map((u) => (
                                  <div 
                                    key={u}
                                    className="flex items-center justify-between rounded px-1.5 py-0.5 hover:bg-slate-100 group text-slate-900"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCompUnit(u);
                                        setCompActiveStep("RATE");
                                        setTimeout(() => {
                                          compRateInputRef.current?.focus();
                                          compRateInputRef.current?.select();
                                        }, 50);
                                      }}
                                      className="flex-1 text-left font-black text-[11px] uppercase mr-2"
                                    >
                                      {u}
                                    </button>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newName = window.prompt(`Rename unit "${u}" to:`, u);
                                          if (newName && newName.trim().toUpperCase()) {
                                            const trimmed = newName.trim().toUpperCase();
                                            setAvailableUnits((prev) => prev.map((item) => item === u ? trimmed : item));
                                            if (compUnit === u) {
                                              setCompUnit(trimmed);
                                            }
                                          }
                                        }}
                                        className="text-blue-600 hover:text-blue-800 text-[10px]"
                                        title="Rename"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm(`Are you sure you want to delete unit "${u}"?`)) {
                                            setAvailableUnits((prev) => prev.filter((item) => item !== u));
                                            if (compUnit === u) {
                                              setCompUnit(availableUnits[0] || "");
                                            }
                                          }
                                        }}
                                        className="text-red-500 hover:text-red-750 font-extrabold text-xs"
                                        title="Delete"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Rate */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-24 z-10">
                          <input 
                            type="number"
                            step="0.01"
                            ref={compRateInputRef}
                            value={compRate}
                            onChange={(e) => setCompRate(e.target.value)}
                            placeholder="Rate"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                setCompActiveStep("CRDR");
                                setTimeout(() => compCrDrSelectRef.current?.focus(), 50);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setCompActiveStep("UNIT");
                                compUnitInputRef.current?.focus();
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-slate-800 h-7"
                          />
                        </td>

                        {/* Cr/Dr Selection Dropdown */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-20 text-center z-10">
                          <select
                            ref={compCrDrSelectRef}
                            value={compCrDr}
                            onChange={(e) => setCompCrDr(e.target.value as "DR" | "CR")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                const qtyVal = parseFloat(compQty) || 0;
                                const rateVal = parseFloat(compRate) || 0;
                                const calculatedAmount = qtyVal * rateVal;
                                if (!compMaterial.trim() || calculatedAmount <= 0) {
                                  if (compCrDr === "DR") {
                                    setCompActiveStep("DEBIT");
                                    setTimeout(() => compDebitInputRef.current?.focus(), 50);
                                  } else {
                                    setCompActiveStep("CREDIT");
                                    setTimeout(() => compCreditInputRef.current?.focus(), 50);
                                  }
                                } else {
                                  handleCompanyVoucherSubmit();
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!compMaterial.trim()) {
                                  setCompActiveStep("MATERIAL");
                                  compMaterialInputRef.current?.focus();
                                } else {
                                  setCompActiveStep("RATE");
                                  compRateInputRef.current?.focus();
                                }
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-xs font-bold font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7 text-center"
                          >
                            <option value="DR">DR</option>
                            <option value="CR">CR</option>
                          </select>
                        </td>

                        {/* Debit calculated or input column */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-32 text-right font-mono font-bold text-red-700 text-xs z-10">
                          {compCrDr === "DR" ? (
                            (parseFloat(compQty) * parseFloat(compRate) || 0) > 0 ? (
                              (parseFloat(compQty) * parseFloat(compRate)).toFixed(2)
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                ref={compDebitInputRef}
                                value={compAmount}
                                onChange={(e) => setCompAmount(e.target.value)}
                                placeholder="Debit"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCompanyVoucherSubmit();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCompActiveStep("CRDR");
                                    compCrDrSelectRef.current?.focus();
                                  }
                                }}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-slate-800 h-7"
                              />
                            )
                          ) : "-"}
                        </td>

                        {/* Credit calculated or input column */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-32 text-right font-mono font-bold text-emerald-700 text-xs z-10">
                          {compCrDr === "CR" ? (
                            (parseFloat(compQty) * parseFloat(compRate) || 0) > 0 ? (
                              (parseFloat(compQty) * parseFloat(compRate)).toFixed(2)
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                ref={compCreditInputRef}
                                value={compAmount}
                                onChange={(e) => setCompAmount(e.target.value)}
                                placeholder="Credit"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleCompanyVoucherSubmit();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCompActiveStep("CRDR");
                                    compCrDrSelectRef.current?.focus();
                                  }
                                }}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-slate-800 h-7"
                              />
                            )
                          ) : "-"}
                        </td>

                        {/* Amount & ADD button */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 p-1.5 w-40 relative z-10">
                          <div className="flex items-center gap-1.5">
                            <span className="flex-1 text-right font-mono font-black text-slate-900 text-xs">
                              {((parseFloat(compQty) * parseFloat(compRate) || 0) > 0 
                                ? (parseFloat(compQty) * parseFloat(compRate)) 
                                : (parseFloat(compAmount) || 0)
                              ).toFixed(2)}
                            </span>
                            <button 
                              type="button"
                              onClick={handleCompanyVoucherSubmit}
                              disabled={createMutation.isPending}
                              className="bg-[#2B547E] hover:bg-[#1E3E64] text-white font-black text-[10px] px-2 py-1 rounded shadow cursor-pointer h-7 shrink-0 transition-colors uppercase"
                            >
                              {createMutation.isPending ? "..." : "ADD"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : selectedLedgerId ? (
                      <tr className="bg-slate-50 border-t-2 border-slate-400 font-bold h-11">
                        {/* Date Input */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-24 z-10">
                          <input 
                            type="text"
                            ref={dateInputRef}
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                            onFocus={(e) => e.target.setSelectionRange(0, 2)}
                            placeholder="Date"
                            required
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                entryTypeRef.current?.focus();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isSidebarOpen) {
                                  setIsSidebarOpen(true);
                                }
                                setTimeout(() => {
                                  accountInputRef.current?.focus();
                                  accountInputRef.current?.select();
                                }, 50);
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-center focus:outline-none focus:border-slate-800"
                          />
                        </td>

                        {/* Particulars/Narration Input + BY/TO Select */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-72 z-10">
                          <div className="flex flex-col gap-1 w-full relative">
                            <div className="flex gap-1.5 items-center w-full">
                              <select
                                ref={entryTypeRef}
                                value={entryType}
                                onChange={(e) => {
                                  const type = e.target.value as "TO" | "BY";
                                  setEntryType(type);
                                  if (type === "TO") {
                                    setCreditAmount("");
                                  } else {
                                    setDebitAmount("");
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (selectedLedgerId === "all") {
                                      document.getElementById("entry-inline-account")?.focus();
                                    } else {
                                      particularInputRef.current?.focus();
                                      particularInputRef.current?.select();
                                    }
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (dateInputRef.current) {
                                      dateInputRef.current.focus();
                                      dateInputRef.current.setSelectionRange(0, 2);
                                    }
                                  }
                                }}
                                className="bg-white border border-slate-300 rounded px-1 py-1 text-xs font-black font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7"
                              >
                                <option value="BY">By</option>
                                <option value="TO">To</option>
                              </select>

                              {selectedLedgerId === "all" ? (
                                <div ref={entryAccountSelectorRef} className="relative flex-1 flex items-center bg-white border border-slate-300 rounded overflow-hidden h-7">
                                  <input 
                                    id="entry-inline-account"
                                    type="text"
                                    value={entryAccountSearchVal}
                                    placeholder="ENTER ACCOUNT NAME"
                                    required
                                    onChange={(e) => {
                                      setEntryAccountSearchVal(e.target.value);
                                      setIsEntryAccountSuggestionsOpen(true);
                                      setHighlightedEntryAccountIndex(-1);
                                    }}
                                    onFocus={() => {
                                      setIsEntryAccountSuggestionsOpen(true);
                                      setHighlightedEntryAccountIndex(-1);
                                    }}
                                    onKeyDown={(e) => {
                                      if (!isEntryAccountSuggestionsOpen) {
                                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                          setIsEntryAccountSuggestionsOpen(true);
                                          e.preventDefault();
                                        }
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          particularInputRef.current?.focus();
                                          particularInputRef.current?.select();
                                        }
                                        if (e.key === "Escape") {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          entryTypeRef.current?.focus();
                                        }
                                        return;
                                      }
                                      if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        setHighlightedEntryAccountIndex((prev) => {
                                          const next = prev + 1;
                                          return next >= filteredEntryAccountSuggestions.length ? 0 : next;
                                        });
                                      } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        setHighlightedEntryAccountIndex((prev) => {
                                          const next = prev - 1;
                                          return next < 0 ? filteredEntryAccountSuggestions.length - 1 : next;
                                        });
                                      } else if (e.key === "Enter") {
                                        let targetIndex = highlightedEntryAccountIndex;
                                        if (targetIndex === -1 && filteredEntryAccountSuggestions.length > 0) {
                                          targetIndex = 0;
                                        }
                                        if (targetIndex >= 0 && targetIndex < filteredEntryAccountSuggestions.length) {
                                          e.preventDefault();
                                          const ledger = filteredEntryAccountSuggestions[targetIndex];
                                          setSelectedEntryLedgerId(ledger.id);
                                          setEntryAccountSearchVal(ledger.name.toUpperCase());
                                          setIsEntryAccountSuggestionsOpen(false);
                                          setHighlightedEntryAccountIndex(-1);
                                          setTimeout(() => {
                                            particularInputRef.current?.focus();
                                            particularInputRef.current?.select();
                                          }, 50);
                                        }
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsEntryAccountSuggestionsOpen(false);
                                        setHighlightedEntryAccountIndex(-1);
                                      }
                                    }}
                                    className="w-full px-2 py-0.5 text-xs font-bold uppercase focus:outline-none placeholder:text-slate-400 font-mono"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsEntryAccountSuggestionsOpen((prev) => !prev);
                                      setHighlightedEntryAccountIndex(-1);
                                    }}
                                    className="px-1 border-l border-slate-200 text-slate-400 hover:text-slate-650 transition-colors focus:outline-none flex items-center justify-center h-full"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  
                                  {isEntryAccountSuggestionsOpen && (
                                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[999] max-h-40 overflow-y-auto font-mono text-xs uppercase text-left">
                                      {filteredEntryAccountSuggestions.length === 0 ? (
                                        <div className="p-2 text-slate-400 italic">No matching accounts</div>
                                      ) : (
                                        filteredEntryAccountSuggestions.map((ledger: any, index: number) => {
                                          const isActive = highlightedEntryAccountIndex === index;
                                          return (
                                            <button
                                              key={ledger.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedEntryLedgerId(ledger.id);
                                                setEntryAccountSearchVal(ledger.name.toUpperCase());
                                                setIsEntryAccountSuggestionsOpen(false);
                                                setHighlightedEntryAccountIndex(-1);
                                                setTimeout(() => {
                                                  particularInputRef.current?.focus();
                                                  particularInputRef.current?.select();
                                                }, 50);
                                              }}
                                              onMouseEnter={() => setHighlightedEntryAccountIndex(index)}
                                              className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 last:border-b-0 font-black uppercase text-[11px] ${
                                                isActive ? "bg-[#2B547E] text-white font-extrabold" : "bg-white hover:bg-slate-200 text-slate-900"
                                              }`}
                                            >
                                              {ledger.name.toUpperCase()}
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input 
                                  type="text"
                                  ref={particularInputRef}
                                  value={particularText}
                                  placeholder="Narration Details"
                                  required
                                  onChange={(e) => setParticularText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      if (entryType === "TO") {
                                        debitAmountRef.current?.focus();
                                        debitAmountRef.current?.select();
                                      } else {
                                        creditAmountRef.current?.focus();
                                        creditAmountRef.current?.select();
                                      }
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      entryTypeRef.current?.focus();
                                    }
                                  }}
                                  className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                                />
                              )}
                            </div>

                            {selectedLedgerId === "all" && (
                              <input 
                                type="text"
                                ref={particularInputRef}
                                value={particularText}
                                placeholder="Narration Details"
                                required
                                onChange={(e) => setParticularText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (entryType === "TO") {
                                      debitAmountRef.current?.focus();
                                      debitAmountRef.current?.select();
                                    } else {
                                      creditAmountRef.current?.focus();
                                      creditAmountRef.current?.select();
                                    }
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    document.getElementById("entry-inline-account")?.focus();
                                  }
                                }}
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                              />
                            )}
                          </div>
                        </td>

                        {/* Spacers for Qty, Unit, Rate */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 text-center text-slate-500 w-24 z-10">
                          -
                        </td>
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 text-center text-slate-500 w-20 z-10">
                          -
                        </td>
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 text-center text-slate-500 w-24 z-10">
                          -
                        </td>

                        {/* Dr/Cr spacer */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 text-center text-slate-500 w-20 z-10">
                          -
                        </td>

                        {/* Debit Input */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-32 z-10">
                          <input 
                            type="number"
                            step="0.01"
                            ref={debitAmountRef}
                            value={debitAmount}
                            onChange={(e) => {
                              setDebitAmount(e.target.value);
                              if (e.target.value) {
                                setEntryType("TO");
                                setCreditAmount("");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (debitAmount) {
                                  handleAddEntrySubmit(e);
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                particularInputRef.current?.focus();
                                particularInputRef.current?.select();
                              }
                            }}
                            placeholder="Debit"
                            disabled={entryType === "BY"}
                            className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                          />
                        </td>

                        {/* Credit Input */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 w-32 z-10">
                          <input 
                            type="number"
                            step="0.01"
                            ref={creditAmountRef}
                            value={creditAmount}
                            onChange={(e) => {
                              setCreditAmount(e.target.value);
                              if (e.target.value) {
                                setEntryType("BY");
                                setDebitAmount("");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (creditAmount) {
                                  handleAddEntrySubmit(e);
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                particularInputRef.current?.focus();
                                particularInputRef.current?.select();
                              }
                            }}
                            placeholder="Credit"
                            disabled={entryType === "TO"}
                            className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                          />
                        </td>

                        {/* Dr / Cr spacer */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 border-r border-slate-400 p-1.5 text-center text-slate-500 w-20 z-10">
                          -
                        </td>

                        {/* Add Entry Button */}
                        <td className="relative bg-slate-50 border-t-2 border-slate-400 p-1.5 text-center w-40 z-10">
                          <button 
                            type="button"
                            onClick={handleAddEntrySubmit}
                            disabled={createMutation.isPending}
                            className="w-full bg-[#2B547E] hover:bg-[#1E3E64] text-white font-extrabold text-xs py-1 rounded transition-all shadow active:translate-y-0.5 tracking-wider uppercase h-7 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {createMutation.isPending ? "Adding..." : "+ ADD ENTRY"}
                          </button>
                        </td>
                      </tr>
                    ) : null
                  ) : null}

                  {selectedSiteId && selectedSiteId !== "all" && action === "entry" && (
                    <tr className="select-none pointer-events-none border-none">
                      <td colSpan={12} className="h-32 bg-transparent border-none"></td>
                    </tr>
                  )}

                  {(() => {
                    const hasDirectRow = selectedSiteId && selectedSiteId !== "all" && (ledgerTypeTab === "COMPANY" || selectedLedgerId) && action === "entry";
                    const fillerCount = action === "entry" ? 0 : Math.max(0, 5 - statementData.transactions.length - (hasDirectRow ? 1 : 0));
                    const rows = [];
                    for (let i = 0; i < fillerCount; i++) {
                      rows.push(
                        ledgerTypeTab === "COMPANY" ? (
                          <tr key={`filler-${i}`} className="border-b border-slate-355 select-none bg-white/40">
                            <td className="border-r border-slate-350 py-3 px-4 h-9.5"></td>
                            {!isParticularLedgerOpen && (
                              <td className="border-r border-slate-350 py-3 px-4"></td>
                            )}
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4 text-center"></td>
                            <td className="border-r border-slate-350 py-3 px-4 text-right"></td>
                            <td className="border-r border-slate-350 py-3 px-4 text-right"></td>
                            <td className={`py-3 px-4 text-right ${action === "delete" ? "border-r" : ""}`}></td>
                            {action === "delete" && (
                              <td className="py-2 px-3 text-center"></td>
                            )}
                          </tr>
                        ) : (
                          <tr key={`filler-${i}`} className="border-b border-slate-355 select-none bg-white/40">
                            <td className="border-r border-slate-350 py-3 px-4 h-9.5"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4"></td>
                            <td className="border-r border-slate-350 py-3 px-4 text-right text-slate-350"></td>
                            <td className="border-r border-slate-350 py-3 px-4 text-right text-slate-350"></td>
                            <td className={`py-3 px-4 text-right ${action === "delete" ? "border-r" : ""}`}></td>
                            {action === "delete" && (
                              <td className="py-2 px-3 text-center"></td>
                            )}
                          </tr>
                        )
                      );
                    }
                    return rows;
                  })()}</tbody>
 
              </table>
            </div>

            {/* Error or Empty placeholder when no site or account chosen */}
            {(!selectedSiteId || selectedSiteId === "all" || !selectedLedgerId) && (
              <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-xs flex flex-col justify-center items-center text-center p-8 z-10 font-bold text-xs uppercase tracking-wider text-slate-500 select-none">
                <Wallet className="h-10 w-10 text-slate-400 mb-2 animate-bounce" />
                {!selectedSiteId || selectedSiteId === "all"
                  ? "Select a specific Construction Site on the Left Selector to load Ledgers!"
                  : `Select a specific Account Ledger or '${ledgerTypeTab === "COMPANY" ? "+ CREATE NEW ACCOUNT" : "ALL ACCOUNTS"}' from the selector suggestions to view transactions!`
                }
              </div>
            )}

          </div>

        </div>
      )}
        </>
      )}









      {showNewEstimatePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#D3DFEE] border-2 border-slate-950 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden w-[450px] font-mono select-none flex flex-col">
            {/* Title Bar */}
            <div className="bg-[#2B547E] border-b-2 border-slate-950 px-3 py-2 flex items-center justify-between text-white shrink-0">
              <span className="text-xs font-black uppercase tracking-wider font-mono">Challan Session / चालान सत्र</span>
              <span className="text-[10px] bg-[#ECC30B] text-slate-950 font-black px-1.5 py-0.5 rounded-xs animate-pulse">CHALLAN SELECT?</span>
            </div>

            {/* Content */}
            <div className="p-6 bg-[#E5ECF4] space-y-4 text-slate-950 text-center">
              <p className="text-xs text-slate-700 font-bold uppercase leading-normal">
                Customer Has Returned / ग्राहक दुबारा आया है
              </p>
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-wide leading-relaxed">
                Do you want to start a new challan or continue the previous session?<br/>
                क्या आप नया चालान शुरू करना चाहते हैं या पुराना जारी रखना चाहते हैं?
              </h3>
              <div className="flex justify-center gap-4 text-[11px] text-slate-650 font-bold uppercase bg-white/40 p-2.5 border border-slate-300 rounded">
                <div>
                  <span className="block text-[9px] text-slate-500 font-extrabold">Continue / पुराना:</span>
                  <span className="font-mono bg-white border border-slate-350 px-1.5 py-0.5 rounded text-slate-900 font-black text-xs block mt-1">
                    {selectedLedger ? getLastChallanNoForLedger(selectedLedger.name, siteDaybooks) || challanNo : (compName ? getLastChallanNoForLedger(compName, siteDaybooks) || challanNo : challanNo)}
                  </span>
                </div>
                <div className="flex items-center text-slate-400 font-black text-lg">→</div>
                <div>
                  <span className="block text-[9px] text-slate-500 font-extrabold">New Challan / नया:</span>
                  <span className="font-mono bg-[#ECC30B] border border-slate-950 px-1.5 py-0.5 rounded text-slate-950 font-black text-xs block mt-1">
                    {getNextChallanNoForDate(getTargetDateStr(), siteDaybooks)}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-[#2B547E] font-bold bg-white/70 py-2 px-3 border border-slate-300 rounded uppercase">
                💡 Press <span className="font-mono bg-white border border-slate-950 px-1 py-0.5 text-xs font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">Enter</span> to Start New, or <span className="font-mono bg-white border border-slate-950 px-1 py-0.5 text-xs font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">Esc</span> to Continue Previous
              </div>
            </div>

            {/* Buttons */}
            <div className="bg-white border-t border-slate-300 p-4 flex justify-center gap-3">
              <button
                ref={startNewButtonRef}
                type="button"
                onClick={handleConfirmNewEstimate}
                className="bg-[#2B547E] hover:bg-[#1E3E64] text-white font-extrabold text-[10px] px-4 py-2.5 rounded transition-all shadow-md active:translate-y-0.5 tracking-wider uppercase border border-slate-700 cursor-pointer flex-1 focus:ring-2 focus:ring-slate-950 focus:outline-none"
              >
                Start New Challan / नया चालान
              </button>
              
              <button
                ref={continueButtonRef}
                type="button"
                onClick={handleCancelNewEstimate}
                className="bg-slate-500 hover:bg-slate-600 text-white font-extrabold text-[10px] px-4 py-2.5 rounded transition-all shadow-md active:translate-y-0.5 tracking-wider uppercase border border-slate-600 cursor-pointer flex-1 focus:ring-2 focus:ring-slate-950 focus:outline-none"
              >
                Continue Previous / पुराना रखें
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={
      <div className="font-mono p-6 space-y-4">
        <div className="h-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-96 bg-slate-200 rounded animate-pulse" />
      </div>
    }>
      <LedgerContent />
    </Suspense>
  );
}
