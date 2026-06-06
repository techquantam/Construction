"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { Calendar, Search, ArrowDown, Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
      .replace(/ph/g, "f")
      .replace(/ch/g, "c")
      .replace(/jh/g, "j")
      .replace(/th/g, "t")
      .replace(/dhh/g, "d")
      .replace(/zh/g, "z")
      .replace(/a/g, "")
      .replace(/e/g, "")
      .replace(/i/g, "")
      .replace(/o/g, "")
      .replace(/u/g, "")
      .replace(/w/g, "")
      .replace(/y/g, "");
  };
  const cleanName = cleanStr(name);
  const cleanQuery = cleanStr(query);
  return cleanName.includes(cleanQuery) || name.toLowerCase().includes(query.toLowerCase());
}

function DayBookContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedSiteId, setSelectedSiteId, sites, modifyQuery } = useApp();
  const action = searchParams.get("action") || "entry";

  // Daybook edit states
  const isSubmittingRef = useRef(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editType, setEditType] = useState<"TO" | "BY">("BY");
  const [editParticularText, setEditParticularText] = useState("");
  const [editNarrationText, setEditNarrationText] = useState("");
  const [editAmountText, setEditAmountText] = useState("");
  const [editChallanNo, setEditChallanNo] = useState("");
  const editingRowRef = useRef<HTMLTableRowElement>(null);

  // Edit particular autocomplete suggestions states
  const [isEditParticularSuggestionsOpen, setIsEditParticularSuggestionsOpen] = useState(false);
  const [highlightedEditParticularIndex, setHighlightedEditParticularIndex] = useState<number>(-1);
  const editParticularSelectorRef = useRef<HTMLDivElement>(null);

  // Search input and dropdown states for Site Selector
  const [siteSearchVal, setSiteSearchVal] = useState("");
  const [isSiteSuggestionsOpen, setIsSiteSuggestionsOpen] = useState(false);
  const [highlightedSiteIndex, setHighlightedSiteIndex] = useState<number>(-1);
  const siteSelectorRef = useRef<HTMLDivElement>(null);

  // Ledger and Particular Autocomplete states
  const [isParticularSuggestionsOpen, setIsParticularSuggestionsOpen] = useState(false);
  const [highlightedParticularIndex, setHighlightedParticularIndex] = useState<number>(-1);
  const particularSelectorRef = useRef<HTMLDivElement>(null);
  const narrationInputRef = useRef<HTMLInputElement>(null);

  // Refs for focusing Site Name and Date inputs
  const siteInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const entryTypeRef = useRef<HTMLSelectElement>(null);
  const particularInputRef = useRef<HTMLInputElement>(null);
  const debitAmountRef = useRef<HTMLInputElement>(null);
  const creditAmountRef = useRef<HTMLInputElement>(null);

  // New Ledger Prompt states
  const [showCreateLedgerModal, setShowCreateLedgerModal] = useState(false);
  const [pendingLedgerName, setPendingLedgerName] = useState("");
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  // New Material inline creation states
  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialUnit, setNewMaterialUnit] = useState("CFT");
  const [isCreatingNewMaterial, setIsCreatingNewMaterial] = useState(false);

  // Party Details form states
  const [showPartyDetailsModal, setShowPartyDetailsModal] = useState(false);
  const [partyFormData, setPartyFormData] = useState({
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

  const handlePartyFormChange = (field: string, value: string) => {
    setPartyFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      const plot = parseFloat(updated.plotMeasurement) || 0;

      // 2. Auto-calculate AMOUNT = PLOT MEASUREMENT * RATE
      const rateVal = parseFloat(updated.rate) || 0;
      updated.amount = plot > 0 && rateVal > 0 ? (plot * rateVal).toFixed(2) : "";
      
      // 3. Auto-calculate TOTAL COMMISSION = COMMISSION * PLOT MEASUREMENT
      const comm = parseFloat(updated.commission) || 0;
      updated.totalCommission = comm > 0 && plot > 0 ? (comm * plot).toFixed(2) : "";
      
      return updated;
    });
  };

  const handlePartyDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    createLedgerMutation.mutate({
      name: pendingLedgerName,
      type: "Party",
      contactPerson: JSON.stringify(partyFormData),
      phone: partyFormData.phoneNo || partyFormData.mobileNo || "",
      openingBalance: 0
    });
  };

  // Refs for Party Details form fields
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const commissionRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const materialSelectRef = useRef<HTMLSelectElement>(null);
  const plotMeasurementRef = useRef<HTMLInputElement>(null);
  const plotUnitRef = useRef<HTMLSelectElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const totalCommissionRef = useRef<HTMLInputElement>(null);

  const getPartyFormFields = () => {
    return [
      addressRef,
      phoneRef,
      mobileRef,
      referenceRef,
      commissionRef,
      dueDateRef,
      plotMeasurementRef,
      plotUnitRef,
      rateRef,
      amountRef,
      totalCommissionRef
    ];
  };

  const focusAndSelectField = (ref: React.RefObject<any>) => {
    if (ref.current) {
      ref.current.focus();
      if ('select' in ref.current && typeof ref.current.select === 'function') {
        ref.current.select();
      }
    }
  };

  const handlePartyFormKeyDown = (e: React.KeyboardEvent, ref: React.RefObject<any>) => {
    const fields = getPartyFormFields();
    const index = fields.indexOf(ref);
    if (index === -1) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (index === fields.length - 1) {
        handlePartyDetailsSubmit(e);
      } else {
        focusAndSelectField(fields[index + 1]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (index === 0) {
        setShowPartyDetailsModal(false);
        setPendingLedgerName("");
        setPendingPayload(null);
        toast.info("Account creation cancelled.");
      } else {
        focusAndSelectField(fields[index - 1]);
      }
    }
  };

  // Autofocus address input when modal opens
  useEffect(() => {
    if (showPartyDetailsModal) {
      const timer = setTimeout(() => {
        focusAndSelectField(addressRef);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showPartyDetailsModal]);

  // Form states for the "Add Entry" panel
  const [entryDate, setEntryDate] = useState<string>(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}`;
  });
  const [entryType, setEntryType] = useState<"TO" | "BY">("BY"); // Default matches "By" in screenshot
  const [particularText, setParticularText] = useState("");
  const [narrationText, setNarrationText] = useState("");
  const [debitAmount, setDebitAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [challanNo, setChallanNo] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("current_challan_no") || "1001";
    }
    return "1001";
  });

  const updateChallanNo = (val: string) => {
    setChallanNo(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("current_challan_no", val);
    }
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

  // Sync site search input value with the globally selected site
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

  // Focus and select site input text on page mount
  useEffect(() => {
    setSelectedSiteId("");
    if (siteInputRef.current) {
      siteInputRef.current.focus();
      siteInputRef.current.select();
    }
    setIsSiteSuggestionsOpen(true);
  }, []);

  // Click outside listener for site suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (siteSelectorRef.current && !siteSelectorRef.current.contains(event.target as Node)) {
        setIsSiteSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Global Escape interceptor inside Daybook to close modals before the layout's global handler can close the page
  useEffect(() => {
    const handleLocalEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPartyDetailsModal) {
          const fields = getPartyFormFields();
          const activeIndex = fields.findIndex(ref => ref.current === document.activeElement);
          if (activeIndex === 0 || activeIndex === -1) {
            e.preventDefault();
            e.stopPropagation();
            setShowPartyDetailsModal(false);
            setPendingLedgerName("");
            setPendingPayload(null);
            toast.info("Account creation cancelled.");
          }
        } else if (showCreateLedgerModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowCreateLedgerModal(false);
          setPendingLedgerName("");
          setPendingPayload(null);
          toast.info("Account creation cancelled.");
        }
      }
    };
    window.addEventListener("keydown", handleLocalEsc, true); // capture phase
    return () => {
      window.removeEventListener("keydown", handleLocalEsc, true);
    };
  }, [showPartyDetailsModal, showCreateLedgerModal]);

  // Auto-scroll highlighted list item into view
  useEffect(() => {
    if (highlightedSiteIndex >= 0 && isSiteSuggestionsOpen) {
      const el = document.getElementById(`site-opt-${highlightedSiteIndex}`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedSiteIndex, isSiteSuggestionsOpen]);

  // Query: Fetch all Ledgers for checking existence and Autocomplete
  const { data: ledgersData } = useQuery({
    queryKey: ["ledgers"],
    queryFn: async () => {
      const response = await api.get("/ledgers");
      return response.data.data;
    },
  });
  const existingLedgers: any[] = ledgersData || [];

  // Query: Fetch Daybook items for the selected site
  const { data: dayBooks } = useQuery({
    queryKey: ["daybooks", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId || selectedSiteId === "all") return [];
      const response = await api.get(`/daybooks?siteId=${selectedSiteId}`);
      return response.data.data;
    },
    enabled: !!selectedSiteId && selectedSiteId !== "all",
  });

  // Mutate: Create a new Ledger Account (Tally-style inline creation)
  const createLedgerMutation = useMutation({
    mutationFn: async (ledgerData: any) => {
      isSubmittingRef.current = true;
      return await api.post("/ledgers", ledgerData);
    },
    onSuccess: async () => {
      isSubmittingRef.current = true;
      try {
        queryClient.invalidateQueries({ queryKey: ["ledgers"] });
        toast.success(`Ledger Account created successfully`);
        
        // Automatically post auto-debit entry to Daybook if form amount is greater than zero
        const plotAmt = parseFloat(partyFormData.amount) || 0;
        let autoDebitSuccess = false;

        if (plotAmt > 0) {
          try {
            const measurement = partyFormData.plotMeasurement;
            const unit = partyFormData.plotUnit;
            const rate = partyFormData.rate;
            const autoNarration = `${measurement} ${unit} @ ${rate}/=`;
            
            let parsedDate = new Date();
            try {
              parsedDate = parseInputDate(entryDate);
              if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date();
              }
            } catch {
              parsedDate = new Date();
            }

            const autoDebitPayload = {
              siteId: selectedSiteId,
              date: parsedDate.toISOString(),
              expenseType: `To ${pendingLedgerName}`,
              amount: plotAmt,
              paymentMode: autoNarration.toUpperCase(),
              description: "AUTO-DEBIT NEW PARTY PLOT ENTRY",
              referenceNumber: "AUTO_DEBIT",
            };

            await createMutation.mutateAsync(autoDebitPayload);
            autoDebitSuccess = true;
          } catch (err) {
            console.error("Failed to post auto-debit entry:", err);
          }
        }

        // Automatically post the original pending entry if it has a non-zero amount
        let pendingPayloadSuccess = false;
        if (pendingPayload && (parseFloat(pendingPayload.amount) || 0) > 0) {
          try {
            // Adjust expenseType to make sure it includes the created ledger name correctly
            const prefix = entryType === "TO" ? "To " : "By ";
            pendingPayload.expenseType = `${prefix}${pendingLedgerName.trim().toUpperCase()}`;

            await createMutation.mutateAsync(pendingPayload);
            pendingPayloadSuccess = true;
          } catch (err) {
            console.error("Failed to post pending entry:", err);
          }
        }

        // Clear pending state & close modals
        setShowCreateLedgerModal(false);
        setShowPartyDetailsModal(false);
        setPendingLedgerName("");
        setPendingPayload(null);

        if (pendingPayloadSuccess) {
          // Since original entry was also successfully posted, clear all inputs and focus date input
          setParticularText("");
          setNarrationText("");
          setDebitAmount("");
          setCreditAmount("");
          
          setTimeout(() => {
            dateInputRef.current?.focus();
            dateInputRef.current?.select();
          }, 150);
        } else {
          // Fallback/Legacy flow if no original entry was posted
          setDebitAmount("");
          setCreditAmount("");
          setParticularText(pendingLedgerName);
          
          setTimeout(() => {
            narrationInputRef.current?.focus();
          }, 150);

          toast.info("Please fill in the Narration and click '+ ADD ENTRY' or press Enter to submit.");
        }
      } finally {
        isSubmittingRef.current = false;
      }
    },
    onError: (error: any) => {
      isSubmittingRef.current = false;
      toast.error(error.response?.data?.message || "Failed to create ledger account");
      setShowCreateLedgerModal(false);
    }
  });

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
      setPartyFormData((prev) => ({
        ...prev,
        materialName: newMat.name.toUpperCase(),
        plotUnit: newMat.unit.toUpperCase(), // Auto-set unit to new material unit
      }));
      
      // Reset inline material fields
      setNewMaterialName("");
      setNewMaterialUnit("CFT");
      setIsCreatingNewMaterial(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create material");
    }
  });

  // Helper parser for stored expenseType
  const parseEntry = (item: any) => {
    const text = item.expenseType || "";
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

  // Combine official ledgers and any unique names previously used in daybook transactions of the CURRENT site
  const allLedgerNames = (() => {
    const namesSet = new Set<string>();
    
    // 1. Add names used in this site's daybook transactions (dayBooks is already site-specific)
    if (dayBooks) {
      dayBooks.forEach((item: any) => {
        const { particular } = parseEntry(item);
        if (particular) {
          namesSet.add(particular.trim().toUpperCase());
        }
      });
    }
    
    // 2. Always ensure default standard ledgers (like CASH, SBI, etc. if they exist in existingLedgers) are available for all sites
    const standardDefaults = ["CASH", "SBI", "BANK", "UPI", "CHEQUE"];
    existingLedgers.forEach((l: any) => {
      if (l.name && standardDefaults.includes(l.name.toUpperCase())) {
        namesSet.add(l.name.toUpperCase());
      }
    });

    // 3. Return as array of objects with id and name
    return Array.from(namesSet).map((name) => {
      const dbLedger = existingLedgers.find((l: any) => l.name.toUpperCase() === name);
      return {
        id: dbLedger ? dbLedger.id : name,
        name: name
      };
    });
  })();

  // Filter particular ledger suggestions based on text input
  const filteredLedgerSuggestions = (() => {
    const s = particularText.trim().toUpperCase();
    const activeLedger = allLedgerNames.find((l) => l.name.toUpperCase() === s);
    const isSearching = s !== "" && s !== activeLedger?.name?.toUpperCase();
    
    if (!isSearching) return allLedgerNames;
    return allLedgerNames.filter((ledger) => matchesFuzzy(ledger.name, particularText));
  })();

  // Click outside listener for particular suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (particularSelectorRef.current && !particularSelectorRef.current.contains(event.target as Node)) {
        setIsParticularSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter edit particular suggestions
  const filteredEditLedgerSuggestions = (() => {
    const s = editParticularText.trim().toUpperCase();
    const activeLedger = allLedgerNames.find((l) => l.name.toUpperCase() === s);
    const isSearching = s !== "" && s !== activeLedger?.name?.toUpperCase();
    
    if (!isSearching) return allLedgerNames;
    return allLedgerNames.filter((ledger) => matchesFuzzy(ledger.name, editParticularText));
  })();

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

  // Click outside listener for the active inline editing row
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editingEntryId && editingRowRef.current && !editingRowRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        if (!target.closest(".z-\\[999\\]") && !target.closest(".z-\\[9999\\]")) {
          setEditingEntryId(null);
          setIsEditParticularSuggestionsOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingEntryId]);

  // Auto-scroll highlighted particular option into view
  useEffect(() => {
    if (highlightedParticularIndex >= 0 && isParticularSuggestionsOpen) {
      const el = document.getElementById(`part-opt-${highlightedParticularIndex}`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedParticularIndex, isParticularSuggestionsOpen]);

  // Keypress listener for Ledger Creation Modal [Y]es / [N]o
  useEffect(() => {
    if (!showCreateLedgerModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "y") {
        e.preventDefault();
        setShowCreateLedgerModal(false);
        setPartyFormData({
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
        setShowPartyDetailsModal(true);
      } else if (key === "n") {
        e.preventDefault();
        setShowCreateLedgerModal(false);
        setPendingLedgerName("");
        setPendingPayload(null);
        toast.info("Transaction cancelled. Ledger was not created.");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCreateLedgerModal, pendingLedgerName, pendingPayload]);

  // Mutate: Create Daybook Entry
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
      
      // Reset inputs but keep Date and Type for fast entry flow
      setParticularText("");
      setNarrationText("");
      setDebitAmount("");
      setCreditAmount("");
      
      setTimeout(() => {
        dateInputRef.current?.focus();
        dateInputRef.current?.select();
      }, 100);
    },
    onError: (error: any) => {
      isSubmittingRef.current = false;
      toast.error(error.response?.data?.message || "Failed to add entry");
    },
  });

  // Mutate: Delete Daybook Entry
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/daybooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Entry deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete entry");
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (siteId: string) => {
      return await api.delete(`/daybooks/site/${siteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("All DayBook entries deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete all entries");
    },
  });

  const handleDeleteAllDayBooks = () => {
    if (!selectedSiteId || selectedSiteId === "all") return;
    const activeSite = sites.find((s) => s.id === selectedSiteId);
    const siteLabel = activeSite ? activeSite.name : "this site";
    const isConfirmed = window.confirm(
      `⚠️ WARNING: PERMANENT DATA LOSS!\n\nAre you sure you want to delete ALL DayBook entries for site "${siteLabel.toUpperCase()}"?\n\nThis action cannot be undone. Click OK to proceed.`
    );
    if (isConfirmed) {
      deleteAllMutation.mutate(selectedSiteId);
    }
  };

  // Mutate: Update Daybook Entry
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; payload: any }) => {
      return await api.put(`/daybooks/${data.id}`, data.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Day Book entry corrected successfully");
      cancelInlineEdit();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update entry");
    },
  });

  const handleEditClick = (item: any) => {
    const { type, particular } = parseEntry(item);
    setEditingEntryId(item.id);
    setEditDate(formatRenderDate(item.date));
    setEditType(type);
    setEditParticularText(particular);
    setEditNarrationText(item.paymentMode || "");
    setEditAmountText(item.amount.toString());
    setEditChallanNo(item.referenceNumber || "");
  };

  const submitInlineEdit = () => {
    if (!editingEntryId) return;
    if (!editParticularText.trim()) {
      toast.error("Particular ledger name is required");
      return;
    }
    const amountVal = parseFloat(editAmountText);
    if (isNaN(amountVal) || amountVal <= 0) {
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

    const payload = {
      siteId: selectedSiteId,
      date: parsedDate.toISOString(),
      expenseType: combinedExpenseType,
      amount: amountVal,
      paymentMode: editNarrationText.trim().toUpperCase() || "CASH",
      description: "DAY BOOK DIRECT ENTRY CORRECTION",
      referenceNumber: null,
    };

    updateMutation.mutate({ id: editingEntryId, payload });
  };

  const cancelInlineEdit = () => {
    setEditingEntryId(null);
    setIsEditParticularSuggestionsOpen(false);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitInlineEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelInlineEdit();
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
        } else {
          e.preventDefault();
          submitInlineEdit();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setIsEditParticularSuggestionsOpen(false);
        setHighlightedEditParticularIndex(-1);
      }
    } else {
      if (e.key === "Enter") {
        e.preventDefault();
        submitInlineEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelInlineEdit();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsEditParticularSuggestionsOpen(true);
        e.preventDefault();
      }
    }
  };



  // Autocomplete suggestions filter
  const filteredSiteSuggestions = (() => {
    if (!sites) return [];
    const activeSite = sites.find((s) => s.id === selectedSiteId);
    const isSearching = siteSearchVal.trim() !== "" && siteSearchVal.toUpperCase() !== activeSite?.name?.toUpperCase();
    if (!isSearching) return sites;
    return sites.filter((site) => matchesFuzzy(site.name, siteSearchVal));
  })();

  // Keep highlightedSiteIndex synchronized with the selected site when dropdown is open
  useEffect(() => {
    if (isSiteSuggestionsOpen && filteredSiteSuggestions.length > 0) {
      const currentIdx = filteredSiteSuggestions.findIndex((s) => s.id === selectedSiteId);
      if (currentIdx >= 0) {
        setHighlightedSiteIndex(currentIdx);
      } else {
        setHighlightedSiteIndex(0);
      }
    }
  }, [isSiteSuggestionsOpen, selectedSiteId, filteredSiteSuggestions]);

  // Convert date picker picker (YYYY-MM-DD) or typed DD.MM.YY to standard Date
  const parseInputDate = (dateStr: string) => {
    if (dateStr.includes(".")) {
      // Input is formatted e.g. "01.05.26" -> split and parse
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

  // Process data chronologically and calculate running totals
  const processedData = (() => {
    if (!dayBooks) return { items: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };

    // Filter out auto-debit transactions from daybook rendering & calculations
    const nonAutoDebitDaybooks = dayBooks.filter((item: any) => item.referenceNumber !== "AUTO_DEBIT");

    // 1. Sort all daybook items chronologically: oldest first
    const sorted = [...nonAutoDebitDaybooks].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    let cumulativeBalance = 0.0;
    let totalDebit = 0.0;
    let totalCredit = 0.0;

    const itemsWithBalances = sorted.map((item: any) => {
      const { type, particular } = parseEntry(item);
      const debitVal = type === "TO" ? item.amount : 0.0;
      const creditVal = type === "BY" ? item.amount : 0.0;
      
      cumulativeBalance = cumulativeBalance + debitVal - creditVal;
      totalDebit += debitVal;
      totalCredit += creditVal;

      return {
        ...item,
        parsedType: type,
        parsedParticular: particular,
        debit: debitVal,
        credit: creditVal,
        runningBalance: cumulativeBalance,
      };
    });

    // 2. Filter using global search modifyQuery
    const filtered = itemsWithBalances.filter((item: any) => {
      const q = modifyQuery.toLowerCase();
      if (!q) return true;
      return (
        item.parsedParticular.toLowerCase().includes(q) ||
        item.parsedType.toLowerCase().includes(q) ||
        (item.paymentMode && item.paymentMode.toLowerCase().includes(q)) ||
        item.debit.toString().includes(q) ||
        item.credit.toString().includes(q)
      );
    });

    return {
      items: filtered,
      totalDebit,
      totalCredit,
      finalBalance: cumulativeBalance,
    };
  })();

  // Handle Add Entry action
  const handleAddEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || createMutation.isPending) {
      return;
    }
    if (!selectedSiteId || selectedSiteId === "all") {
      toast.error("Please select a specific Site from the dropdown suggestions first");
      return;
    }
    if (!particularText.trim()) {
      toast.error("Particular ledger name is required");
      return;
    }

    const typedParticular = particularText.trim().toUpperCase();
    const ledgerExists = existingLedgers.some(
      (l: any) => l.name.toUpperCase() === typedParticular
    );

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

    const prefix = entryType === "TO" ? "To " : "By ";
    const combinedExpenseType = `${prefix}${typedParticular}`;

    const payload = {
      siteId: selectedSiteId,
      date: parsedDate.toISOString(),
      expenseType: combinedExpenseType, // e.g. "By AKHAND" or "To RUCHI ELECTRONICS"
      amount,
      paymentMode: narrationText.trim().toUpperCase() || "CASH", // Narration e.g. "CASH"
      description: "DAY BOOK DIRECT ENTRY",
      referenceNumber: null,
    };

    if (!ledgerExists) {
      setPendingLedgerName(typedParticular);
      setPendingPayload(payload);
      setShowCreateLedgerModal(true);
    } else {
      // Validate amount ONLY for existing ledgers
      if (entryType === "TO") {
        if (amount <= 0) {
          toast.error("Debit amount must be greater than zero");
          return;
        }
      } else {
        if (amount <= 0) {
          toast.error("Credit amount must be greater than zero");
          return;
        }
      }
      isSubmittingRef.current = true;
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="font-mono text-slate-800 max-w-7xl mx-auto space-y-4">
      
      {/* VISUAL CARDFRAME CONTAINER STYLED EXACTLY LIKE SCREENSHOT */}
      <div className="bg-[#E5ECF4] border border-slate-300 rounded shadow-md overflow-hidden p-4 space-y-4">
        
        {/* SITE SELECT PANEL WITH AUTO-SUGGEST */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3" ref={siteSelectorRef}>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xs uppercase text-slate-700 tracking-wider">Site name :</span>
              
              <div className="relative w-[340px]">
              <div className="relative flex items-center bg-white border border-slate-400 rounded overflow-hidden">
                <input 
                  type="text"
                  ref={siteInputRef}
                  value={siteSearchVal}
                  placeholder="TYPE 1-2 LETTERS TO SEARCH SITE (e.g. CYVANTA)..."
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
                      if (e.key === "Enter") {
                        if (selectedSiteId && selectedSiteId !== "all") {
                          e.preventDefault();
                          dateInputRef.current?.focus();
                          dateInputRef.current?.select();
                        }
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
                      if (highlightedSiteIndex >= 0 && highlightedSiteIndex < filteredSiteSuggestions.length) {
                        e.preventDefault();
                        const site = filteredSiteSuggestions[highlightedSiteIndex];
                        setSelectedSiteId(site.id);
                        setSiteSearchVal(site.name.toUpperCase());
                        setIsSiteSuggestionsOpen(false);
                        setHighlightedSiteIndex(-1);
                      } else if (filteredSiteSuggestions.length > 0) {
                        e.preventDefault();
                        const site = filteredSiteSuggestions[0];
                        setSelectedSiteId(site.id);
                        setSiteSearchVal(site.name.toUpperCase());
                        setIsSiteSuggestionsOpen(false);
                        setHighlightedSiteIndex(-1);
                      } else {
                        if (selectedSiteId && selectedSiteId !== "all") {
                          e.preventDefault();
                          setIsSiteSuggestionsOpen(false);
                          dateInputRef.current?.focus();
                          dateInputRef.current?.select();
                        }
                      }
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsSiteSuggestionsOpen(false);
                      setHighlightedSiteIndex(-1);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-400 uppercase tracking-wide"
                />
                <button 
                  type="button"
                  onClick={() => {
                    setIsSiteSuggestionsOpen((prev) => !prev);
                    setHighlightedSiteIndex(-1);
                  }}
                  className="px-2 border-l border-slate-300 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ABSOLUTE FLOATING SUGGESTIONS PANEL */}
              {isSiteSuggestionsOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 max-h-48 overflow-y-auto font-mono text-xs uppercase animate-in fade-in duration-100">
                  {filteredSiteSuggestions.length === 0 ? (
                    <div className="p-3 text-slate-400 italic text-[11px]">
                      No matching construction sites found
                    </div>
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
                              dateInputRef.current?.focus();
                              dateInputRef.current?.select();
                            }, 50);
                          }}
                          onMouseEnter={() => setHighlightedSiteIndex(index)}
                          className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-b-0 transition-colors font-black text-xs uppercase ${
                            isActive 
                              ? "bg-[#2B547E] text-white font-extrabold" 
                              : "bg-white hover:bg-slate-200 text-slate-900"
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
          {selectedSiteId && selectedSiteId !== "all" && action === "delete" && processedData.items.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllDayBooks}
              className="bg-red-600 hover:bg-red-750 bg-red-700 text-white border border-slate-950 font-black text-[10px] px-3 py-1.5 rounded shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:shadow-none transition-all active:translate-y-0.5 uppercase tracking-widest cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>DELETE ALL ENTRIES</span>
            </button>
          )}
        </div>

        {/* SPECIFIC TALLY STATEMENT TABLE */}
        <form onSubmit={handleAddEntrySubmit} className="bg-white border border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto min-h-[320px]">
            <table className="w-full border-collapse border-2 border-slate-800 font-mono text-[13px] sm:text-sm text-slate-900">
              
              {/* HEADERS MATCHING SCREENSHOT EXACTLY */}
              <thead>
                <tr className="bg-[#2B547E] text-white border-b-2 border-slate-800 font-extrabold uppercase text-[12px]"><th className="border border-slate-800 py-3 px-4 w-28 text-left text-white font-extrabold">Date</th><th className="border border-slate-800 py-3 px-4 text-left w-72 text-white font-extrabold">Particular</th><th className="border border-slate-800 py-3 px-4 text-left w-40 text-white font-extrabold"></th><th className="border border-slate-800 py-3 px-4 text-right w-36 text-white font-extrabold">Debit</th><th className="border border-slate-800 py-3 px-4 text-right w-36 text-white font-extrabold">Credit</th><th className="border border-slate-800 py-3 px-4 text-center w-20 text-white font-extrabold">Dr/Cr</th><th className="border border-slate-800 py-3 px-4 text-right w-44 text-white font-extrabold">Amount</th>{action === "delete" && (<th className="border border-slate-800 py-3 px-4 text-center w-24 text-white font-extrabold">Delete</th>)}</tr>
              </thead>

              {/* TABLE BODY */}
              <tbody>{processedData.items.length === 0 ? (
                  <tr>
                    <td colSpan={action === "delete" ? 8 : 7} className="text-center py-10 bg-slate-50 text-slate-400 italic">
                      {!selectedSiteId || selectedSiteId === "all" 
                        ? "Select a specific site to view Day Book accounts." 
                        : "No transaction records found for this site."
                      }
                    </td>
                  </tr>
                ) : (
                  processedData.items.map((item: any) => {
                    const balanceSign = item.runningBalance < 0 ? "Cr" : "Dr";
                    const balanceAbs = Math.abs(item.runningBalance);

                    if (editingEntryId === item.id) {
                      return (
                        <tr 
                          key={item.id} 
                          ref={editingRowRef}
                          className="bg-amber-50/50 border-2 border-[#2B547E] font-bold"
                        >
                          <td className="border border-slate-300 p-1.5 w-28">
                            <input 
                              type="text"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              onFocus={(e) => {
                                setTimeout(() => {
                                  e.target.setSelectionRange(0, 2);
                                }, 0);
                              }}
                              onKeyDown={handleInlineKeyDown}
                              placeholder="Date"
                              required
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-center focus:outline-none focus:border-slate-800"
                            />
                          </td>

                          <td className="border border-slate-300 p-1.5 min-w-[200px] relative">
                            <div ref={editParticularSelectorRef} className="w-full">
                              <div className="flex gap-1.5 items-center">
                                <select
                                  value={editType}
                                  onChange={(e) => {
                                    const type = e.target.value as "TO" | "BY";
                                    setEditType(type);
                                  }}
                                  className="bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-black font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7"
                                >
                                  <option value="BY">By</option>
                                  <option value="TO">To</option>
                                </select>
                                <div className="relative flex-1 flex items-center bg-white border border-slate-300 rounded overflow-hidden h-7">
                                  <input 
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
                                    placeholder="Particular"
                                    required
                                    className="w-full px-2 py-0.5 text-xs font-bold uppercase focus:outline-none placeholder:text-slate-400 font-mono"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsEditParticularSuggestionsOpen((prev) => !prev);
                                      setHighlightedEditParticularIndex(-1);
                                    }}
                                    className="px-1 border-l border-slate-200 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center h-full"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* ABSOLUTE FLOATING SUGGESTIONS PANEL FOR EDIT PARTICULAR */}
                              {isEditParticularSuggestionsOpen && (
                                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[999] max-h-48 overflow-y-auto font-mono text-xs uppercase animate-in fade-in duration-100">
                                  {filteredEditLedgerSuggestions.length === 0 ? (
                                    <div className="p-3 text-slate-400 italic text-[11px]">
                                      No matching ledgers found
                                    </div>
                                  ) : (
                                    filteredEditLedgerSuggestions.map((ledger, index) => {
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
                                          }}
                                          onMouseEnter={() => setHighlightedEditParticularIndex(index)}
                                          className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-b-0 transition-colors font-black text-xs uppercase text-slate-900 ${
                                            isActive 
                                              ? "bg-[#2B547E] text-white font-extrabold" 
                                              : "bg-white hover:bg-slate-200"
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

                          <td className="border border-slate-300 p-1.5 w-44">
                            <div className="flex gap-1 items-center">
                              <input 
                                type="text"
                                value={editNarrationText}
                                onChange={(e) => setEditNarrationText(e.target.value)}
                                onKeyDown={handleInlineKeyDown}
                                placeholder="Narration"
                                className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                              />
                            </div>
                          </td>

                          <td className="border border-slate-300 p-1.5 w-36">
                            <input 
                              type="number"
                              step="0.01"
                              value={editType === "TO" ? editAmountText : ""}
                              onChange={(e) => {
                                  setEditAmountText(e.target.value);
                                  if (e.target.value) {
                                    setEditType("TO");
                                  }
                              }}
                              onKeyDown={handleInlineKeyDown}
                              placeholder="Debit"
                              disabled={editType === "BY"}
                              className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                            />
                          </td>

                          <td className="border border-slate-300 p-1.5 w-36">
                            <input 
                              type="number"
                              step="0.01"
                              value={editType === "BY" ? editAmountText : ""}
                              onChange={(e) => {
                                  setEditAmountText(e.target.value);
                                  if (e.target.value) {
                                    setEditType("BY");
                                  }
                              }}
                              onKeyDown={handleInlineKeyDown}
                              placeholder="Credit"
                              disabled={editType === "TO"}
                              className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                            />
                          </td>

                          <td className="border border-slate-300 p-1.5 text-center font-bold text-slate-500 w-20">
                            {editType === "TO" ? "Dr" : "Cr"}
                          </td>

                          <td className="border border-slate-300 p-1.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {item.runningBalance.toFixed(2)}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => {
                          if (action === "correction") {
                            handleEditClick(item);
                          }
                        }}
                        className={`font-black uppercase border-b border-slate-400 transition-colors ${
                          action === "correction" 
                            ? "hover:bg-amber-50 cursor-pointer bg-amber-50/10 text-slate-950" 
                            : "hover:bg-[#D0E5F5]/40 text-slate-950"
                        }`}
                      >
                        <td className="border border-slate-400 py-3 px-4 text-slate-700">{formatRenderDate(item.date)}</td>
                        <td className="border border-slate-400 py-3 px-4 uppercase text-slate-950 font-black">
                          <span className="font-extrabold text-slate-500 mr-1.5">{item.parsedType === "TO" ? "To" : "By"}</span>
                          {item.parsedParticular}
                        </td>
                        <td className="border border-slate-400 py-3 px-4 uppercase text-slate-650 font-bold w-40">{item.paymentMode || "CASH"}</td>
                        <td className="border border-slate-400 py-3 px-4 text-right font-black text-slate-955 text-slate-950 whitespace-nowrap">{item.debit > 0 ? item.debit.toFixed(2) : "-"}</td>
                        <td className="border border-slate-400 py-3 px-4 text-right font-black text-slate-955 text-slate-950 whitespace-nowrap">{item.credit > 0 ? item.credit.toFixed(2) : "-"}</td>
                        <td className="border border-slate-400 py-3 px-4 text-center font-black text-slate-600">{balanceSign}</td>
                        <td className="border border-slate-400 py-3 px-4 text-right font-black text-slate-955 text-slate-950 whitespace-nowrap">{item.runningBalance.toFixed(2)}</td>
                        {action === "delete" && (
                          <td className="border border-slate-400 py-2 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Are you sure you want to delete this entry?")) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                              className="bg-red-600 hover:bg-red-750 bg-red-700 text-white font-black text-xs w-6 h-6 rounded flex items-center justify-center transition-all shadow-sm border border-red-700 mx-auto"
                            >
                              X
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}{selectedSiteId && selectedSiteId !== "all" && action === "entry" ? (
                  <tr className="bg-slate-50 border-t-2 border-slate-400 font-bold">
                    <td className="border border-slate-300 p-1.5 w-28">
                      <input 
                        type="text"
                        ref={dateInputRef}
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        onFocus={(e) => {
                          setTimeout(() => {
                            e.target.setSelectionRange(0, 2);
                          }, 0);
                        }}
                        placeholder="Date"
                        required
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            entryTypeRef.current?.focus();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            siteInputRef.current?.focus();
                            siteInputRef.current?.select();
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-center focus:outline-none focus:border-slate-800"
                      />
                    </td>

                    <td className="border border-slate-300 p-1.5 min-w-[200px] relative">
                      <div ref={particularSelectorRef} className="w-full">
                        <div className="flex gap-1.5 items-center">
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
                                particularInputRef.current?.focus();
                                particularInputRef.current?.select();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                dateInputRef.current?.focus();
                                dateInputRef.current?.select();
                              }
                            }}
                            className="bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-black font-mono focus:outline-none focus:border-slate-800 cursor-pointer h-7"
                          >
                            <option value="BY">By</option>
                            <option value="TO">To</option>
                          </select>
                          <div className="relative flex-1 flex items-center bg-white border border-slate-300 rounded overflow-hidden h-7">
                            <input 
                              ref={particularInputRef}
                              type="text"
                              value={particularText}
                              placeholder="Particular"
                              required
                              onChange={(e) => {
                                setParticularText(e.target.value);
                                setIsParticularSuggestionsOpen(true);
                                setHighlightedParticularIndex(-1);
                              }}
                              onFocus={() => {
                                setIsParticularSuggestionsOpen(true);
                                setHighlightedParticularIndex(-1);
                              }}
                              onKeyDown={(e) => {
                                // If suggestion is open and arrow keys are used, handle them first
                                if (isParticularSuggestionsOpen) {
                                  if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setHighlightedParticularIndex((prev) => {
                                      const next = prev + 1;
                                      return next >= filteredLedgerSuggestions.length ? 0 : next;
                                    });
                                    return;
                                  } else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setHighlightedParticularIndex((prev) => {
                                      const next = prev - 1;
                                      return next < 0 ? filteredLedgerSuggestions.length - 1 : next;
                                    });
                                    return;
                                  }
                                } else {
                                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                    setIsParticularSuggestionsOpen(true);
                                    e.preventDefault();
                                    return;
                                  }
                                }

                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (isParticularSuggestionsOpen) {
                                    setIsParticularSuggestionsOpen(false);
                                    setHighlightedParticularIndex(-1);
                                  } else {
                                    dateInputRef.current?.focus();
                                    dateInputRef.current?.select();
                                  }
                                  return;
                                }

                                // Handle Enter key
                                if (e.key === "Enter") {
                                  // If a suggestion is highlighted, select it
                                  if (
                                    isParticularSuggestionsOpen &&
                                    highlightedParticularIndex >= 0 &&
                                    highlightedParticularIndex < filteredLedgerSuggestions.length
                                  ) {
                                    e.preventDefault();
                                    const ledger = filteredLedgerSuggestions[highlightedParticularIndex];
                                    setParticularText(ledger.name.toUpperCase());
                                    setIsParticularSuggestionsOpen(false);
                                    setHighlightedParticularIndex(-1);
                                    setTimeout(() => {
                                      narrationInputRef.current?.focus();
                                      narrationInputRef.current?.select();
                                    }, 50);
                                    return;
                                  }

                                  // If no suggestion is highlighted, check if the typed text is a new ledger
                                  const typedParticular = particularText.trim().toUpperCase();
                                  if (typedParticular) {
                                    const ledgerExists = existingLedgers.some(
                                      (l: any) => l.name.toUpperCase() === typedParticular
                                    );

                                    if (!ledgerExists) {
                                      e.preventDefault();

                                      if (!selectedSiteId || selectedSiteId === "all") {
                                        toast.error("Please select a specific Site from the dropdown suggestions first");
                                        return;
                                      }
                                      
                                      // Construct pending payload with fallback amounts (since user might not have typed them yet)
                                      let amount = 0.0;
                                      if (entryType === "TO") {
                                        amount = parseFloat(debitAmount) || 0;
                                      } else {
                                        amount = parseFloat(creditAmount) || 0;
                                      }

                                      const prefix = entryType === "TO" ? "To " : "By ";
                                      const combinedExpenseType = `${prefix}${typedParticular}`;

                                      let parsedDate = new Date();
                                      try {
                                        parsedDate = parseInputDate(entryDate);
                                        if (isNaN(parsedDate.getTime())) {
                                          parsedDate = new Date();
                                        }
                                      } catch {
                                        parsedDate = new Date();
                                      }

                                      const payload = {
                                        siteId: selectedSiteId,
                                        date: parsedDate.toISOString(),
                                        expenseType: combinedExpenseType,
                                        amount,
                                        paymentMode: narrationText.trim().toUpperCase() || "CASH",
                                        description: "DAY BOOK DIRECT ENTRY",
                                        referenceNumber: "DIRECT_FORM_V2",
                                      };

                                      setPendingLedgerName(typedParticular);
                                      setPendingPayload(payload);
                                      setIsParticularSuggestionsOpen(false);
                                      setShowCreateLedgerModal(true);
                                    } else {
                                      // Existing ledger, go to narration
                                      e.preventDefault();
                                      narrationInputRef.current?.focus();
                                      narrationInputRef.current?.select();
                                    }
                                  }
                                }
                              }}
                              className="w-full px-2 py-0.5 text-xs font-bold uppercase focus:outline-none placeholder:text-slate-400 font-mono"
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                setIsParticularSuggestionsOpen((prev) => !prev);
                                setHighlightedParticularIndex(-1);
                              }}
                              className="px-1 border-l border-slate-200 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none flex items-center justify-center h-full"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* ABSOLUTE FLOATING SUGGESTIONS PANEL FOR PARTICULAR */}
                        {isParticularSuggestionsOpen && (
                          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border-2 border-slate-900 rounded shadow-lg z-[999] max-h-48 overflow-y-auto font-mono text-xs uppercase animate-in duration-100">
                            {filteredLedgerSuggestions.length === 0 ? (
                              <div className="p-3 text-slate-400 italic text-[11px]">
                                No matching ledgers found (Will prompt to create)
                              </div>
                            ) : (
                              filteredLedgerSuggestions.map((ledger, index) => {
                                const isActive = highlightedParticularIndex === index;
                                return (
                                  <button
                                    key={ledger.id}
                                    id={`part-opt-${index}`}
                                    type="button"
                                    onClick={() => {
                                      setParticularText(ledger.name.toUpperCase());
                                      setIsParticularSuggestionsOpen(false);
                                      setHighlightedParticularIndex(-1);
                                    }}
                                    onMouseEnter={() => setHighlightedParticularIndex(index)}
                                    className={`w-full text-left px-3 py-2 border-b border-slate-100 last:border-b-0 transition-colors font-black text-xs uppercase text-slate-900 ${
                                      isActive 
                                        ? "bg-[#2B547E] text-white font-extrabold" 
                                        : "bg-white hover:bg-slate-200"
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

                    <td className="border border-slate-300 p-1.5 w-40">
                      <input 
                        type="text"
                        ref={narrationInputRef}
                        value={narrationText}
                        onChange={(e) => setNarrationText(e.target.value)}
                        placeholder="Narration"
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
                            particularInputRef.current?.focus();
                            particularInputRef.current?.select();
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800 placeholder:text-slate-400 font-mono h-7"
                      />
                    </td>

                    <td className="border border-slate-300 p-1.5 w-36">
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
                            narrationInputRef.current?.focus();
                            narrationInputRef.current?.select();
                          }
                        }}
                        placeholder="Debit"
                        disabled={entryType === "BY"}
                        className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                      />
                    </td>

                    <td className="border border-slate-350 p-1.5 w-36">
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
                            narrationInputRef.current?.focus();
                            narrationInputRef.current?.select();
                          }
                        }}
                        placeholder="Credit"
                        disabled={entryType === "TO"}
                        className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono h-7"
                      />
                    </td>

                    <td className="border border-slate-300 p-1.5 text-center font-bold text-slate-400 w-20">
                      -
                    </td>

                    <td className="border border-slate-300 p-1.5 text-center">
                      <button 
                        type="submit"
                        disabled={createMutation.isPending}
                        className="w-full bg-[#2B547E] hover:bg-[#1E3E64] text-white font-extrabold text-xs py-1 rounded transition-all shadow active:translate-y-0.5 tracking-wider uppercase h-7 flex items-center justify-center gap-1"
                      >
                        {createMutation.isPending ? "Adding..." : "+ ADD ENTRY"}
                      </button>
                    </td>
                  </tr>
                ) : null}</tbody>

            </table>
          </div>

          {/* TABLE FOOTER SUMMARY BAR MATCHING IMAGE */}
          <div className="bg-[#D9E2F3] border-t-2 border-slate-800 py-3 px-6 flex justify-end items-center gap-8 font-black text-slate-900 text-sm tracking-wider uppercase">
            <div>
              <span>Debit : </span>
              <span className="text-slate-900">{processedData.totalDebit.toFixed(2)}</span>
            </div>
            <div>
              <span>Credit : </span>
              <span className="text-slate-900">{processedData.totalCredit.toFixed(2)}</span>
            </div>
            <div className="bg-[#2B547E] text-white px-3.5 py-2 rounded shadow-[1px_1px_3px_rgba(0,0,0,0.15)] text-sm">
              <span>Balance : </span>
              <span>{processedData.finalBalance.toFixed(2)}</span>
            </div>
          </div>

        </form>

      </div>



      {/* LEDGER ACCOUNT CREATION CONFIRMATION MODAL */}
      {showCreateLedgerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#E5ECF4] border-2 border-[#2B547E] rounded shadow-2xl overflow-hidden w-[420px] font-mono select-none transform transition-all duration-200 scale-100">
            {/* Header bar */}
            <div className="bg-[#2B547E] text-white px-4 py-2 text-xs font-black uppercase tracking-wider flex justify-between items-center">
              <span>Account Creation Request</span>
              <span className="animate-pulse text-yellow-300">⚠ ACTION REQUIRED</span>
            </div>
            
            {/* Modal Body */}
            <div className="p-5 text-center space-y-4">
              <p className="text-xs text-slate-700 font-bold uppercase leading-relaxed">
                Ledger Account <span className="text-[#2B547E] font-black underline">"{pendingLedgerName}"</span> does not exist in your books of accounts.
              </p>
              <p className="text-sm text-slate-950 font-black uppercase">
                Would you like to create a new Ledger Account?
              </p>
              
              <div className="text-[11px] text-[#2B547E] font-bold bg-white/70 py-1.5 px-3 border border-slate-300 rounded">
                Press [Y] key for Yes, or [N] key for No
              </div>
            </div>            {/* Modal Footer / Buttons */}
            <div className="bg-white border-t border-slate-300 p-4 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateLedgerModal(false);
                  setPartyFormData({
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
                  setShowPartyDetailsModal(true);
                }}
                disabled={createLedgerMutation.isPending}
                className="bg-[#2B547E] hover:bg-[#1E3E64] disabled:opacity-50 text-white font-extrabold text-xs px-6 py-2.5 rounded transition-all shadow-md active:translate-y-0.5 tracking-wider uppercase flex items-center gap-2 border border-slate-700"
              >
                <span className="bg-white text-[#2B547E] font-black px-1.5 py-0.5 rounded text-[10px]">Y</span>
                Yes, Create Account
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowCreateLedgerModal(false);
                  setPendingLedgerName("");
                  setPendingPayload(null);
                  toast.info("Transaction cancelled. Ledger was not created.");
                }}
                disabled={createLedgerMutation.isPending}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs px-6 py-2.5 rounded transition-all shadow-md active:translate-y-0.5 tracking-wider uppercase flex items-center gap-2 border border-red-700"
              >
                <span className="bg-white text-red-600 font-black px-1.5 py-0.5 rounded text-[10px]">N</span>
                No, Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETRO WINDOWS STYLE PARTY DETAILS FORM MODAL */}
      {showPartyDetailsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#D3DFEE] border-2 border-slate-950 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden w-[480px] font-mono select-none flex flex-col">
            
            {/* Title Bar */}
            <div className="bg-[#2B547E] border-b-2 border-slate-950 px-3 py-2 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase tracking-wider font-mono">Party_Details</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-5 h-5 bg-[#D3DFEE] border border-slate-950 text-slate-900 text-[11px] font-extrabold flex items-center justify-center rounded-xs shadow-[1px_1px_0px_0px_rgba(255,255,255,1)] cursor-pointer select-none">_</span>
                <span className="w-5 h-5 bg-[#D3DFEE] border border-slate-950 text-[10px] font-extrabold flex items-center justify-center rounded-xs shadow-[1px_1px_0px_0px_rgba(255,255,255,1)] cursor-pointer select-none">[]</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPartyDetailsModal(false);
                    setPendingLedgerName("");
                    setPendingPayload(null);
                    toast.info("Account creation cancelled.");
                  }}
                  className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white border border-slate-950 text-[11px] font-extrabold flex items-center justify-center rounded-xs shadow-[1px_1px_0px_0px_rgba(255,255,255,0.4)] transition-colors focus:outline-none"
                >
                  X
                </button>
              </div>
            </div>

            {/* Form Content */}
            <form onSubmit={handlePartyDetailsSubmit} className="p-4 space-y-3 bg-[#E5ECF4] text-xs font-bold text-slate-800">
              
              {/* Site Name and Party's Name Info Fields */}
              <div className="space-y-2 border border-slate-400 p-2.5 bg-slate-50/50 rounded">
                <div className="flex items-center justify-between gap-3">
                  <span className="w-32 text-left uppercase tracking-wide">SITE NAME :</span>
                  <input
                    type="text"
                    readOnly
                    value={siteSearchVal || "CYVANTA"}
                    className="flex-1 bg-slate-100 border border-slate-400 rounded px-2.5 py-1 text-slate-700 focus:outline-none uppercase font-black"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="w-32 text-left uppercase tracking-wide">{"PARTY'S NAME :"}</span>
                  <input
                    type="text"
                    readOnly
                    value={pendingLedgerName}
                    className="flex-1 bg-slate-100 border border-slate-400 rounded px-2.5 py-1 text-[#2B547E] focus:outline-none uppercase font-black"
                  />
                </div>
              </div>

              {/* Golden Yellow Details Container */}
              <div className="bg-[#ECC30B] border-2 border-slate-950 rounded p-3 space-y-2 shadow-[inset_1px_1px_4px_rgba(0,0,0,0.15)]">

                {/* 1. Address */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">1. ADDRESS</span>
                  <textarea
                    ref={addressRef}
                    rows={2}
                    value={partyFormData.address}
                    onChange={(e) => handlePartyFormChange("address", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, addressRef)}
                    className="flex-1 bg-white border border-slate-400 rounded px-2 py-1 focus:outline-none focus:border-slate-800 font-mono text-slate-900 resize-none h-12 text-xs"
                  />
                </div>

                {/* 2. Phone No. */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">2. PHONE NO.</span>
                  <input
                    ref={phoneRef}
                    type="text"
                    value={partyFormData.phoneNo}
                    onChange={(e) => handlePartyFormChange("phoneNo", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, phoneRef)}
                    className="flex-1 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 font-mono h-6 text-slate-900"
                  />
                </div>

                {/* 3. Mobile No. */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">3. MOBILE NO.</span>
                  <input
                    ref={mobileRef}
                    type="text"
                    value={partyFormData.mobileNo}
                    onChange={(e) => handlePartyFormChange("mobileNo", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, mobileRef)}
                    className="flex-1 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 font-mono h-6 text-slate-900"
                  />
                </div>

                {/* 4. Reference */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">4. REFERENCE</span>
                  <input
                    ref={referenceRef}
                    type="text"
                    value={partyFormData.reference}
                    onChange={(e) => handlePartyFormChange("reference", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, referenceRef)}
                    className="flex-1 bg-white border border-slate-400 rounded px-2.5 py-0.5 focus:outline-none focus:border-slate-800 font-mono h-6 text-slate-900 text-xs font-bold"
                  />
                </div>

                {/* 5. Commission */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">5. COMMISSION</span>
                  <input
                    ref={commissionRef}
                    type="number"
                    step="0.01"
                    value={partyFormData.commission}
                    onChange={(e) => handlePartyFormChange("commission", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, commissionRef)}
                    className="w-32 bg-white border border-slate-400 rounded px-2 py-0.5 text-right focus:outline-none focus:border-slate-800 font-mono h-6 text-slate-900"
                  />
                </div>

                {/* 6. Due Date */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">6. DUE DATE</span>
                  <input
                    ref={dueDateRef}
                    type="text"
                    value={partyFormData.dueDate}
                    onChange={(e) => handlePartyFormChange("dueDate", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, dueDateRef)}
                    className="w-48 bg-white border border-slate-400 rounded px-2 py-0.5 focus:outline-none focus:border-slate-800 text-center font-mono h-6 text-slate-900"
                  />
                </div>

                {/* 7. Plot Measurement block */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">7. PLOT MEASUREMENT</span>
                  <div className="flex gap-2 items-center flex-1 justify-between">
                    <div className="flex gap-1.5 items-center">
                      <input
                        ref={plotMeasurementRef}
                        type="number"
                        step="0.01"
                        value={partyFormData.plotMeasurement}
                        onChange={(e) => handlePartyFormChange("plotMeasurement", e.target.value)}
                        onKeyDown={(e) => handlePartyFormKeyDown(e, plotMeasurementRef)}
                        className="w-20 bg-white border border-slate-400 rounded px-2 py-0.5 text-right focus:outline-none focus:border-slate-800 text-slate-900 font-mono h-6 text-xs font-bold"
                      />
                      <select
                        ref={plotUnitRef}
                        value={partyFormData.plotUnit}
                        onChange={(e) => handlePartyFormChange("plotUnit", e.target.value)}
                        onKeyDown={(e) => handlePartyFormKeyDown(e, plotUnitRef)}
                        className="bg-white border border-slate-400 rounded px-1.5 py-0.5 focus:outline-none focus:border-slate-800 cursor-pointer font-black h-6 text-slate-900 text-xs font-bold"
                      >
                        <option value="SFT">SFT</option>
                        <option value="SQM">SQM</option>
                      </select>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <span className="text-slate-900 font-extrabold uppercase text-[10px]">RATE:</span>
                      <input
                        ref={rateRef}
                        type="number"
                        step="0.01"
                        value={partyFormData.rate}
                        onChange={(e) => handlePartyFormChange("rate", e.target.value)}
                        onKeyDown={(e) => handlePartyFormKeyDown(e, rateRef)}
                        className="w-20 bg-white border border-slate-400 rounded px-2 py-0.5 text-right focus:outline-none focus:border-slate-800 font-mono h-6 text-slate-900 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 8. AMOUNT */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-800/20 pb-1.5">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">8. AMOUNT</span>
                  <input
                    ref={amountRef}
                    type="number"
                    step="0.01"
                    value={partyFormData.amount}
                    onChange={(e) => handlePartyFormChange("amount", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, amountRef)}
                    className="w-32 bg-[#F1F5F9] border border-slate-400 rounded px-2 py-0.5 text-right focus:outline-none text-[#2B547E] font-black font-mono h-6"
                  />
                </div>

                {/* 9. TOTAL COMMISSION */}
                <div className="flex items-center justify-between gap-3">
                  <span className="w-36 text-slate-900 font-extrabold uppercase">9. TOTAL COMMISSION</span>
                  <input
                    ref={totalCommissionRef}
                    type="number"
                    step="0.01"
                    value={partyFormData.totalCommission}
                    onChange={(e) => handlePartyFormChange("totalCommission", e.target.value)}
                    onKeyDown={(e) => handlePartyFormKeyDown(e, totalCommissionRef)}
                    className="w-32 bg-[#F1F5F9] border border-slate-400 rounded px-2 py-0.5 text-right focus:outline-none text-[#2B547E] font-black font-mono h-6"
                  />
                </div>

              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createLedgerMutation.isPending}
                  className="px-5 py-2 border border-slate-950 bg-[#2B547E] hover:bg-[#1E3E64] disabled:opacity-50 text-white font-black rounded shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 transition-all cursor-pointer uppercase focus:outline-none"
                >
                  {createLedgerMutation.isPending ? "SAVING..." : "SAVE & CREATE"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}

export default function DayBookPage() {
  return (
    <Suspense fallback={
      <div className="font-mono p-6 space-y-4">
        <div className="h-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-96 bg-slate-200 rounded animate-pulse" />
      </div>
    }>
      <DayBookContent />
    </Suspense>
  );
}
