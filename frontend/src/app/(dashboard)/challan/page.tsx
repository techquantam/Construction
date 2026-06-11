"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, Building2, User, Phone, MapPin, Wallet, ArrowDown, FileSpreadsheet } from "lucide-react";
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

// Parses JSON or unstructured payment mode strings
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

    const subParts = beforeAt.split(/\s+/);
    if (subParts.length >= 2) {
      const qty = subParts[0];
      const unit = subParts.slice(1).join(" ");
      return { qty, unit, rate: ratePart, isStructured: true, isCompany: false, material: "", raw: cleanUpper };
    }
  }
  return { qty: "", unit: "", rate: "", isStructured: false, isCompany: false, material: "", raw: cleanUpper };
}

// Parses Party contact person detail JSON
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

// Formats render date as DD.MM.YY
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

const HINDI_DICTIONARY: { [key: string]: string } = {
  // Materials
  "BALU GANGA": "गंगा बालू",
  "BALU": "बालू",
  "GANGA": "गंगा",
  "CART": "गाड़ी",
  "CEMENT": "सीमेंट",
  "SAND": "बालू / रेत",
  "STEEL": "स्टील / लोहा",
  "IRON": "लोहा",
  "BRICKS": "ईंट",
  "BRICK": "ईंट",
  "RODI": "रोड़ी",
  "GITI": "गिट्टी",
  "STONE": "पत्थर",
  "DUST": "डस्ट",
  "TILES": "टाइल",
  "CHIPS": "चिप्स",
  "PAINT": "पेंट",
  "PIPES": "पाइप",
  "TRANSPORT": "परिवहन",
  "DIESEL": "डीजल",
  "LABOUR": "मजदूरी",
  "WOOD": "लकड़ी",
  "SOIL": "मिट्टी",
  "PLASTER": "प्लास्टर",
  "PUTTY": "पुट्टी",
  "AGGREGATE": "गिट्टी",
  "RODEE": "रोड़ी",
  "COARSE SAND": "मोटा बालू",
  "FINE SAND": "महीन रेत",
  "JUNCTION": "जंक्शन",
  "BOX": "बॉक्स",
  "SURFACE": "सरफेस",
  "RAFT": "राफ्ट",
  "SLAB": "स्लैब",
  "MM": "मिमी",
  "NO.": "नंबर",
  "NOS": "नंबर",
  "PCS": "पीस",
  "BAGS": "बोरी",
  "BAG": "बोरी",
  "CFT": "सीएफटी",
  "KG": "किग्रा",
  "TON": "टन",
  "MT": "मीट्रिक टन",
  "LITRE": "लीटर",
  "LTR": "लीटर",
  "METER": "मीटर",
  "MTR": "मीटर",
  "FEET": "फिट",
  "FT": "फिट",

  // Suppliers & Names
  "SADA SHIV": "सदा शिव",
  "SADA": "सदा",
  "SHIV": "शिव",
  "ANKIT AWASTHI": "अंकित अवस्थी",
  "ANKIT": "अंकित",
  "AWASTHI": "अवस्थी",
  "DIRECT CLIENT": "प्रत्यक्ष ग्राहक",
  "ADMIN": "एडमिन",
  "SUPPLIER": "आपूर्तिकर्ता",
  "CONTRACTOR": "ठेकेदार",
  "PARTY": "पार्टी",

  // Locations & Addresses
  "KAPATANAGANAJ": "कप्तानगंज",
  "KAPTANGANJ": "कप्तानगंज",
  "PIPL": "पीआईपीएल",
  "MOTINAGAR": "मोतीनगर",
  "MOTI NAGAR": "मोतीनगर",
  "MOTI": "मोती",
  "NAGAR": "नगर",
  "LUCKNOW": "लखनऊ",
  "KANPUR": "कानपुर",
  "DELHI": "दिल्ली",
  "ROAD": "मार्ग",
  "STREET": "गली",
  "SECTOR": "सेक्टर",
  "COLONY": "कालोनी",
  "GALI": "गली",
  "OFFICE": "कार्यालय",
  "HOME": "घर",
  "SHOP": "दुकान",
  "MARKET": "बाजार",
  "NEAR": "के पास",
  "OPPOSITE": "के सामने",
  "BEHIND": "के पीछे",
  "MAIN": "मुख्य",
  "BLOCK": "ब्लॉक",
  "UTTAR PRADESH": "उत्तर प्रदेश",
  "UP": "उत्तर प्रदेश",
  "NOT AVAILABLE": "उपलब्ध नहीं",
  "N/A": "उपलब्ध नहीं"
};

function phoneticTransliterateWord(word: string): string {
  const cleanWord = word.toUpperCase().trim();
  if (!cleanWord) return "";

  if (HINDI_DICTIONARY[cleanWord]) {
    return HINDI_DICTIONARY[cleanWord];
  }

  // If already contains Hindi characters, return as-is
  if (/[\u0900-\u097F]/.test(word)) {
    return word;
  }

  let i = 0;
  let result = "";
  const len = cleanWord.length;

  const startsWithVowel = (char: string) => char && "AEIOU".includes(char);

  while (i < len) {
    let matched = false;
    const peek = (n: number) => cleanWord.substring(i, i + n);

    // 1. 3-character blends
    const blends3 = [
      { eng: "CHH", hin: "छ" },
      { eng: "SHR", hin: "श्र" },
      { eng: "GYA", hin: "ज्ञा" },
      { eng: "KSH", hin: "क्ष" },
    ];
    for (const blend of blends3) {
      if (peek(3) === blend.eng) {
        result += blend.hin;
        i += 3;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2. 2-character blends
    const blends2 = [
      { eng: "SH", hin: "श" },
      { eng: "CH", hin: "च" },
      { eng: "KH", hin: "ख" },
      { eng: "GH", hin: "घ" },
      { eng: "JH", hin: "झ" },
      { eng: "BH", hin: "भ" },
      { eng: "DH", hin: "ध" },
      { eng: "TH", hin: "थ" },
      { eng: "PH", hin: "फ" },
      { eng: "GY", hin: "ज्ञ" },
      { eng: "TR", hin: "त्र" },
      { eng: "KS", hin: "क्ष" },
      { eng: "AI", hin: "ै" },
      { eng: "AU", hin: "ौ" },
      { eng: "EE", hin: "ी" },
      { eng: "OO", hin: "ू" },
    ];
    for (const blend of blends2) {
      if (peek(2) === blend.eng) {
        if (i === 0) {
          if (blend.eng === "AI") { result += "ऐ"; i += 2; matched = true; break; }
          if (blend.eng === "AU") { result += "औ"; i += 2; matched = true; break; }
          if (blend.eng === "EE") { result += "ई"; i += 2; matched = true; break; }
          if (blend.eng === "OO") { result += "ऊ"; i += 2; matched = true; break; }
        }
        result += blend.hin;
        i += 2;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const char = cleanWord[i];

    // Nasal anusvara shortcut (e.g. ANKIT, SAND)
    if (char === "N" && i + 1 < len && !startsWithVowel(cleanWord[i + 1])) {
      result += "ं";
      i += 1;
      continue;
    }

    // Vowels
    if (char === "A") {
      if (i === 0) {
        if (peek(2) === "AA") { result += "आ"; i += 2; }
        else { result += "अ"; i += 1; }
      } else {
        if (peek(2) === "AA") { result += "ा"; i += 2; }
        else {
          const remaining = cleanWord.substring(i + 1);
          if (remaining.length <= 2 && !startsWithVowel(remaining[0])) {
            result += "ा";
          } else if (i === len - 1) {
            result += "ा";
          }
          i += 1;
        }
      }
      continue;
    }

    if (char === "E") {
      result += (i === 0) ? "ए" : "े";
      i += 1;
      continue;
    }

    if (char === "I") {
      result += (i === 0) ? "इ" : "ि";
      i += 1;
      continue;
    }

    if (char === "O") {
      result += (i === 0) ? "ओ" : "ो";
      i += 1;
      continue;
    }

    if (char === "U") {
      result += (i === 0) ? "उ" : "ु";
      i += 1;
      continue;
    }

    // Consonants
    const singleConsonants: { [key: string]: string } = {
      "B": "ब", "C": "क", "D": "द", "F": "फ", "G": "ग",
      "H": "ह", "J": "ज", "K": "क", "L": "ल", "M": "म",
      "N": "न", "P": "प", "Q": "क", "R": "र", "S": "स",
      "T": "त", "V": "व", "W": "व", "X": "क्स", "Y": "य",
      "Z": "ज़"
    };

    if (singleConsonants[char]) {
      result += singleConsonants[char];
    } else {
      result += char;
    }
    i += 1;
  }

  return result;
}

function translateToHindi(text: string): string {
  if (!text) return "";
  const upperText = text.toUpperCase().trim();

  if (HINDI_DICTIONARY[upperText]) {
    return HINDI_DICTIONARY[upperText];
  }

  const words = text.split(/\s+/);
  const translatedWords = words.map(word => {
    const cleanWord = word.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleanWord) return word;
    if (HINDI_DICTIONARY[cleanWord]) {
      return HINDI_DICTIONARY[cleanWord];
    }
    return phoneticTransliterateWord(word);
  });

  return translatedWords.join(" ");
}

function translateBilingual(text: string): string {
  if (!text) return "";
  const hindi = translateToHindi(text);
  if (hindi.toUpperCase() === text.toUpperCase()) {
    return text;
  }
  return `${text.toUpperCase()} [${hindi}]`;
}

const getTodayDateStr = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).substring(2);
  return `${day}.${month}.${year}`;
};

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

export default function ChallanPage() {
  // Query: Fetch all sites
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const response = await api.get("/sites");
      return response.data.data;
    },
  });

  // Query: Fetch all materials
  const { data: existingMaterials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const response = await api.get("/materials");
      return response.data.data || [];
    },
  });

  // States for Site Autocomplete Selection
  const [siteSearchVal, setSiteSearchVal] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isSiteSuggestionsOpen, setIsSiteSuggestionsOpen] = useState(false);
  const [highlightedSiteIndex, setHighlightedSiteIndex] = useState<number>(-1);
  const siteSelectorRef = useRef<HTMLDivElement>(null);
  const siteInputRef = useRef<HTMLInputElement>(null);

  // Query: Fetch all ledgers
  const { data: ledgers } = useQuery({
    queryKey: ["ledgers", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId) return [];
      const response = await api.get(`/ledgers?siteId=${selectedSiteId}`);
      return response.data.data;
    },
    enabled: !!selectedSiteId,
  });

  // States for Account (Supplier) Autocomplete Selection
  const [ledgerSearchVal, setLedgerSearchVal] = useState("");
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [isLedgerSuggestionsOpen, setIsLedgerSuggestionsOpen] = useState(false);
  const [highlightedLedgerIndex, setHighlightedLedgerIndex] = useState<number>(-1);
  const ledgerSelectorRef = useRef<HTMLDivElement>(null);
  const ledgerInputRef = useRef<HTMLInputElement>(null);

  // Query: Fetch all daybook entries for the selected site
  const { data: siteDaybookData } = useQuery({
    queryKey: ["daybooks", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId) return [];
      const res = await api.get(`/daybooks?siteId=${selectedSiteId}`);
      return res.data.data;
    },
    enabled: !!selectedSiteId,
  });

  // Focus states for input highlight
  const [isSiteFocused, setIsSiteFocused] = useState(false);
  const [isLedgerFocused, setIsLedgerFocused] = useState(false);

  // Print Mode State
  const [printCopy, setPrintCopy] = useState<"copy1" | "copy2" | "both">("both");

  // States for Direct Challan Creation
  const [showDirectChallanModal, setShowDirectChallanModal] = useState(false);
  const [directChallan, setDirectChallan] = useState<{
    customerName: string;
    date: string;
    items: {
      id: string;
      date: string;
      type: "TO" | "BY";
      material: string;
      qty: number;
      unit: string;
      rate: number;
      amount: number;
      particulars: string;
      reference: string;
    }[];
  } | null>(null);

  const [directDate, setDirectDate] = useState("");
  const [directCustomer, setDirectCustomer] = useState("");
  const [directItems, setDirectItems] = useState<{
    id: string;
    material: string;
    qty: string;
    unit: string;
    rate: string;
    amount: string;
    isMaterialSuggestionsOpen: boolean;
    highlightedMaterialIndex: number;
  }[]>([
    {
      id: "direct-item-1",
      material: "",
      qty: "",
      unit: "CFT",
      rate: "",
      amount: "",
      isMaterialSuggestionsOpen: false,
      highlightedMaterialIndex: -1
    }
  ]);

  const directDateInputRef = useRef<HTMLInputElement>(null);

  const updateDirectItem = (idx: number, fields: Partial<typeof directItems[0]>) => {
    setDirectItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...fields };
      
      const qtyVal = parseFloat(next[idx].qty) || 0;
      const rateVal = parseFloat(next[idx].rate) || 0;
      if (qtyVal > 0 && rateVal > 0) {
        next[idx].amount = (qtyVal * rateVal).toFixed(2);
      } else {
        if (fields.qty !== undefined || fields.rate !== undefined) {
          next[idx].amount = "";
        }
      }
      return next;
    });
  };

  const handleAddDirectItem = () => {
    setDirectItems((prev) => {
      const nextIdx = prev.length;
      setTimeout(() => {
        const el = document.getElementById(`direct-material-input-${nextIdx}`);
        if (el) {
          el.focus();
        }
      }, 50);
      return [
        ...prev,
        {
          id: `direct-item-${Date.now()}-${Math.random()}`,
          material: "",
          qty: "",
          unit: prev[prev.length - 1]?.unit || "CFT",
          rate: "",
          amount: "",
          isMaterialSuggestionsOpen: false,
          highlightedMaterialIndex: -1
        }
      ];
    });
  };

  const handleDeleteDirectItem = (idx: number) => {
    setDirectItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleMaterialKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>, suggestions: any[]) => {
    const item = directItems[idx];
    if (!item.isMaterialSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        updateDirectItem(idx, { isMaterialSuggestionsOpen: true });
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = item.highlightedMaterialIndex + 1;
      const index = next >= suggestions.length ? suggestions.length - 1 : next;
      updateDirectItem(idx, { highlightedMaterialIndex: index });
      setTimeout(() => {
        const el = document.getElementById(`mat-opt-${idx}-${index}`);
        if (el) el.scrollIntoView({ block: "nearest" });
      }, 10);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = item.highlightedMaterialIndex - 1;
      const index = next < 0 ? 0 : next;
      updateDirectItem(idx, { highlightedMaterialIndex: index });
      setTimeout(() => {
        const el = document.getElementById(`mat-opt-${idx}-${index}`);
        if (el) el.scrollIntoView({ block: "nearest" });
      }, 10);
    } else if (e.key === "Enter") {
      e.preventDefault();
      let sIdx = item.highlightedMaterialIndex;
      if (sIdx === -1 && suggestions.length > 0) {
        sIdx = 0;
      }
      if (sIdx >= 0 && sIdx < suggestions.length) {
        const mat = suggestions[sIdx];
        updateDirectItem(idx, {
          material: mat.name.toUpperCase(),
          unit: mat.unit?.toUpperCase() || "CFT",
          isMaterialSuggestionsOpen: false,
          highlightedMaterialIndex: -1
        });
      } else {
        updateDirectItem(idx, {
          isMaterialSuggestionsOpen: false,
          highlightedMaterialIndex: -1
        });
      }
      setTimeout(() => {
        const qtyEl = document.getElementById(`direct-qty-input-${idx}`) as HTMLInputElement | null;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        }
      }, 50);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      updateDirectItem(idx, { isMaterialSuggestionsOpen: false, highlightedMaterialIndex: -1 });
    }
  };

  useEffect(() => {
    if (showDirectChallanModal) {
      setTimeout(() => {
        directDateInputRef.current?.focus();
        directDateInputRef.current?.select();
      }, 50);
    }
  }, [showDirectChallanModal]);

  const openDirectChallanModal = () => {
    setDirectDate(getTodayDateStr());
    setDirectCustomer("");
    setDirectItems([
      {
        id: "direct-item-1",
        material: "",
        qty: "",
        unit: "CFT",
        rate: "",
        amount: "",
        isMaterialSuggestionsOpen: false,
        highlightedMaterialIndex: -1
      }
    ]);
    setShowDirectChallanModal(true);
  };

  const handleCreateDirectChallan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directDate.trim()) {
      toast.error("Date is required");
      return;
    }

    let parsedDate = new Date();
    try {
      parsedDate = parseInputDate(directDate);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
      }
    } catch {
      toast.error("Invalid Date format. Use DD.MM.YY");
      return;
    }

    const validItems = directItems.filter(item => item.material.trim() !== "");
    if (validItems.length === 0) {
      toast.error("Please add at least one material");
      return;
    }

    const items = validItems.map((item, idx) => {
      const qtyVal = parseFloat(item.qty) || 0;
      const rateVal = parseFloat(item.rate) || 0;
      let amtVal = parseFloat(item.amount) || 0;
      if (amtVal <= 0 && qtyVal > 0 && rateVal > 0) {
        amtVal = qtyVal * rateVal;
      }

      return {
        id: `direct-item-${idx + 1}`,
        date: parsedDate.toISOString(),
        type: "BY" as const,
        material: item.material.trim().toUpperCase(),
        qty: qtyVal,
        unit: item.unit.trim().toUpperCase() || "CFT",
        rate: rateVal,
        amount: amtVal,
        particulars: "DIRECT SALE / CASH",
        reference: "DIRECT_CHALLAN"
      };
    });

    setDirectChallan({
      customerName: directCustomer.trim().toUpperCase() || "DIRECT CLIENT",
      date: parsedDate.toISOString(),
      items: items
    });

    setShowDirectChallanModal(false);
    toast.success("Direct Challan generated successfully for preview");
  };

  // Auto-focus site input on page mount
  useEffect(() => {
    setTimeout(() => {
      siteInputRef.current?.focus();
    }, 100);
  }, []);

  // Close autocomplete dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (siteSelectorRef.current && !siteSelectorRef.current.contains(event.target as Node)) {
        setIsSiteSuggestionsOpen(false);
      }
      if (ledgerSelectorRef.current && !ledgerSelectorRef.current.contains(event.target as Node)) {
        setIsLedgerSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter sites for search autocomplete
  const filteredSites = (() => {
    if (!sites) return [];
    const activeSite = sites.find((s: any) => s.id === selectedSiteId);
    const isSearching = siteSearchVal.trim() !== "" && siteSearchVal.toUpperCase() !== activeSite?.name?.toUpperCase();
    if (!isSearching) return sites;
    return sites.filter((site: any) => matchesFuzzy(site.name, siteSearchVal));
  })();

  // Filter accounts/suppliers for selected site daybook
  const activeSiteCompanyLedgers = (() => {
    if (!selectedSiteId || !siteDaybookData) return [];

    // Find unique ledger names used in transactions
    const names = new Set<string>();
    siteDaybookData.forEach((item: any) => {
      const text = item.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
      else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
      if (name) names.add(name);
    });

    const list: any[] = [];

    // Add all registered company ledgers matching type "Company"
    if (ledgers) {
      ledgers.forEach((l: any) => {
        const nameUpper = l.name.toUpperCase();
        if (l.type === "Company") {
          list.push({
            id: l.id,
            name: nameUpper,
            phone: l.phone || "",
            contactPerson: l.contactPerson || "",
            outstandingBalance: l.outstandingBalance || 0,
            isVirtual: false
          });
          names.delete(nameUpper);
        }
      });
    }

    // Add any remaining virtual/unregistered company accounts from daybooks
    names.forEach((name) => {
      list.push({
        id: name,
        name: name,
        phone: "",
        contactPerson: "",
        outstandingBalance: 0,
        isVirtual: true
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Autocomplete filter for accounts suggestions list
  const filteredLedgers = (() => {
    const activeLedger = activeSiteCompanyLedgers.find((l) => String(l.id) === String(selectedLedgerId));
    const isSearching = ledgerSearchVal.trim() !== "" && ledgerSearchVal.toUpperCase() !== activeLedger?.name?.toUpperCase();
    if (!isSearching) return activeSiteCompanyLedgers;

    return activeSiteCompanyLedgers.filter((ledger) => {
      const details = parsePartyDetails(ledger.contactPerson);
      const address = details ? details.address : (ledger.contactPerson || "");
      const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");
      return (
        matchesFuzzy(ledger.name, ledgerSearchVal) ||
        (address && matchesFuzzy(address, ledgerSearchVal)) ||
        (phone && matchesFuzzy(phone, ledgerSearchVal))
      );
    });
  })();

  // Keydown handlers for Autocomplete controls
  const handleSiteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSiteSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsSiteSuggestionsOpen(true);
        e.preventDefault();
      } else if (e.key === "Enter") {
        e.preventDefault();
        ledgerInputRef.current?.focus();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSiteIndex((prev) => {
        const next = prev + 1;
        return next >= filteredSites.length ? filteredSites.length - 1 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? 0 : next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let idx = highlightedSiteIndex;
      if (idx === -1 && filteredSites.length > 0) idx = 0;
      if (idx >= 0 && idx < filteredSites.length) {
        const site = filteredSites[idx];
        setSelectedSiteId(site.id);
        setSiteSearchVal(site.name.toUpperCase());
        setIsSiteSuggestionsOpen(false);
        setHighlightedSiteIndex(-1);

        // Reset account selection when site changes
        setSelectedLedgerId(null);
        setLedgerSearchVal("");

        setTimeout(() => {
          ledgerInputRef.current?.focus();
          ledgerInputRef.current?.select();
        }, 100);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsSiteSuggestionsOpen(false);
      setHighlightedSiteIndex(-1);
    }
  };

  const handleLedgerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isLedgerSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsLedgerSuggestionsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedLedgerIndex((prev) => {
        const next = prev + 1;
        const index = next >= filteredLedgers.length ? filteredLedgers.length - 1 : next;
        setTimeout(() => {
          const el = document.getElementById(`acct-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);
        return index;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedLedgerIndex((prev) => {
        const next = prev - 1;
        const index = next < 0 ? 0 : next;
        setTimeout(() => {
          const el = document.getElementById(`acct-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);
        return index;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let idx = highlightedLedgerIndex;
      if (idx === -1 && filteredLedgers.length > 0) idx = 0;
      if (idx >= 0 && idx < filteredLedgers.length) {
        const ledger = filteredLedgers[idx];
        setSelectedLedgerId(ledger.id);
        setLedgerSearchVal(ledger.name.toUpperCase());
        setIsLedgerSuggestionsOpen(false);
        setHighlightedLedgerIndex(-1);
        ledgerInputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsLedgerSuggestionsOpen(false);
      setHighlightedLedgerIndex(-1);
    }
  };

  // Compile materials transactions (Challan list) chronological
  const challanData = (() => {
    if (directChallan) {
      const items = directChallan.items;
      const totalQty = items.reduce((sum: number, item: any) => sum + item.qty, 0);
      const totalAmount = items.reduce((sum: number, item: any) => sum + item.amount, 0);
      return {
        items,
        totalQty,
        totalAmount,
        outstandingBalance: 0,
        challanNo: "DIRECT"
      };
    }

    if (!selectedSiteId || !selectedLedgerId || !siteDaybookData) {
      return { items: [], totalQty: 0, totalAmount: 0, outstandingBalance: 0, challanNo: "" };
    }

    const selectedLedgerObj = activeSiteCompanyLedgers.find((l) => String(l.id) === String(selectedLedgerId));
    if (!selectedLedgerObj) return { items: [], totalQty: 0, totalAmount: 0, outstandingBalance: 0, challanNo: "" };

    const ledgerNameUpper = selectedLedgerObj.name.toUpperCase();

    // Filter daybook transactions matching the selected supplier ledger across all dates
    const filtered = siteDaybookData.filter((item: any) => {
      const text = item.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
      else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
      return name === ledgerNameUpper;
    });

    // Group transactions by referenceNumber (Challan No)
    const groups: { [key: string]: any[] } = {};
    filtered.forEach((item: any) => {
      const chNo = (item.referenceNumber || "1001").toUpperCase();
      if (chNo === "AUTO_DEBIT") return;
      if (!groups[chNo]) {
        groups[chNo] = [];
      }
      groups[chNo].push(item);
    });

    // Find the latest group by max createdAt timestamp
    let latestChallanNo = "";
    let maxCreatedAt = 0;

    Object.keys(groups).forEach((chNo) => {
      groups[chNo].forEach((item) => {
        const time = new Date(item.createdAt).getTime();
        if (time > maxCreatedAt) {
          maxCreatedAt = time;
          latestChallanNo = chNo;
        }
      });
    });

    // If no groups found, return empty
    if (!latestChallanNo) {
      return { items: [], totalQty: 0, totalAmount: 0, outstandingBalance: 0, challanNo: "" };
    }

    const latestGroup = groups[latestChallanNo] || [];

    // Sort the latest group chronologically
    const sorted = [...latestGroup].sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const items: any[] = [];
    let totalQty = 0;
    let totalAmount = 0;
    let siteDebitSum = 0;
    let siteCreditSum = 0;

    sorted.forEach((item: any) => {
      const text = item.expenseType || "";
      const isDebit = text.toUpperCase().startsWith("TO ");
      const parsed = parsePaymentModeDetails(item.paymentMode || "CASH");

      const qtyVal = parseFloat(parsed.qty) || 0;
      const rateVal = parseFloat(parsed.rate) || 0;
      const calculatedAmount = qtyVal > 0 && rateVal > 0 ? qtyVal * rateVal : item.amount;

      if (isDebit) {
        siteDebitSum += calculatedAmount;
      } else {
        siteCreditSum += calculatedAmount;
      }

      // ONLY include in printed challan items list if a material is actually specified
      if (parsed.material && (qtyVal > 0 || calculatedAmount > 0)) {
        if (parsed.isCompany) {
          totalQty += qtyVal;
        }
        totalAmount += calculatedAmount;

        items.push({
          id: item.id,
          date: item.date,
          type: isDebit ? "TO" : "BY",
          material: parsed.material,
          qty: qtyVal,
          unit: parsed.unit || "BAGS",
          rate: rateVal,
          amount: calculatedAmount,
          particulars: isDebit ? "STOCK DELIVERED" : "STOCK RETURN / PAYMENT",
          reference: item.referenceNumber || "-",
          rawItem: item
        });
      }
    });

    // Supplier site outstanding balance: Credit (BY) minus Debit (TO)
    // Credit represents materials supplied (we owe them), Debit represents payments we made to them (we paid off)
    const calculatedSiteBalance = siteCreditSum - siteDebitSum;

    return {
      items,
      totalQty,
      totalAmount,
      outstandingBalance: calculatedSiteBalance,
      challanNo: latestChallanNo
    };
  })();

  const selectedLedgerObj = selectedLedgerId
    ? activeSiteCompanyLedgers.find((l) => String(l.id) === String(selectedLedgerId))
    : null;

  // Retrieve contact person profiles (address and mobile)
  const contactPersonDetails = selectedLedgerObj
    ? parsePartyDetails(selectedLedgerObj.contactPerson)
    : null;

  const supplierAddress = contactPersonDetails
    ? contactPersonDetails.address
    : (selectedLedgerObj?.contactPerson || "NOT AVAILABLE");

  const supplierPhone = contactPersonDetails
    ? contactPersonDetails.mobileNo || contactPersonDetails.phoneNo
    : (selectedLedgerObj?.phone || "NOT AVAILABLE");

  const selectedSiteObj = sites?.find((s: any) => s.id === selectedSiteId);

  // Generate stable deterministic Challan Serial Number based on latest challan batch No
  const challanSerial = directChallan ? "DIRECT" : (challanData.challanNo || "1001");

  const challanDateStr = challanData.items.length > 0
    ? formatRenderDate(challanData.items[0].date)
    : formatRenderDate(new Date().toISOString());

  // Export to Excel CSV utility
  const handleExportExcel = () => {
    if (!challanData.items.length) {
      toast.error("No challan details to export");
      return;
    }

    const headers = ["S.No", "Date", "Material", "Description", "Quantity", "Unit"];
    const rows = challanData.items.map((item: any, idx: number) => [
      idx + 1,
      formatRenderDate(item.date),
      translateBilingual(item.material),
      item.particulars,
      item.qty || "-",
      item.unit || "-"
    ]);

    rows.push([
      "TOTAL",
      "",
      "",
      "",
      challanData.totalQty,
      ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + [
        `"ESTIMATE"`,
        `"No:","${challanSerial}"`,
        `"Site Name:","${selectedSiteObj?.name?.toUpperCase() || ""}"`,
        `"Supplier:","${translateBilingual(selectedLedgerObj?.name || "")}"`,
        `"Address:","${translateBilingual(supplierAddress)}"`,
        `"Mobile:","${supplierPhone}"`,
        "",
        headers.join(","),
        ...rows.map(e => e.map(val => `"${val}"`).join(","))
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `challan_report_${selectedLedgerObj?.name || "supplier"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel CSV file downloaded successfully");
  };

  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; payload: any }) => {
      return await api.put(`/daybooks/${data.id}`, data.payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Challan item updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update item");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.delete(`/daybooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("Challan item deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete item");
    }
  });

  const handleSaveRow = (id: string, material: string, qty: number, unit: string, rate: number, rawItem: any) => {
    if (!material.trim()) {
      toast.error("Material name is required");
      return;
    }
    if (qty <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    if (rate <= 0) {
      toast.error("Rate must be greater than zero");
      return;
    }

    let originalParsedDetails: any = {};
    if (rawItem.paymentMode && rawItem.paymentMode.trim().startsWith("{") && rawItem.paymentMode.trim().endsWith("}")) {
      try {
        originalParsedDetails = JSON.parse(rawItem.paymentMode);
      } catch {}
    }

    const updatedPaymentMode = JSON.stringify({
      ...originalParsedDetails,
      material: material.trim().toUpperCase(),
      qty: qty,
      unit: unit.trim().toUpperCase(),
      rate: rate
    });

    const calculatedAmount = qty * rate;

    const payload = {
      siteId: rawItem.siteId,
      date: rawItem.date,
      expenseType: rawItem.expenseType,
      amount: calculatedAmount,
      paymentMode: updatedPaymentMode,
      description: rawItem.description,
      referenceNumber: rawItem.referenceNumber
    };

    updateMutation.mutate({ id, payload });
  };

  const handleDeleteRow = (id: string) => {
    if (window.confirm("Are you sure you want to delete this item from the challan?")) {
      deleteMutation.mutate(id);
    }
  };

  const handlePrintWithoutRate = () => {
    setPrintCopy("copy1");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintCopy("both");
      }, 500);
    }, 100);
  };

  const handlePrintWithRate = () => {
    setPrintCopy("copy2");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintCopy("both");
      }, 500);
    }, 100);
  };

  // Connect hotkeys (1: Print Without Rate, 2: Print With Rate, F3: Excel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. If modal is open and Escape is pressed, check if any suggestions dropdown is open
      if (showDirectChallanModal && e.key === "Escape") {
        const anyDropdownOpen = directItems.some(item => item.isMaterialSuggestionsOpen);
        if (anyDropdownOpen) {
          return;
        }
        e.preventDefault();
        setShowDirectChallanModal(false);
        return;
      }

      // 2. If modal is closed and 'd' or 'D' is pressed, open the modal immediately and prevent typing in inputs
      if (!showDirectChallanModal && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        openDirectChallanModal();
        return;
      }

      // Avoid triggering print shortcuts if typing in search input fields
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.hasAttribute("contenteditable")
      );

      // If modal is open and 'n' or 'N' is pressed when no input is focused, add a new row!
      if (showDirectChallanModal && (e.key === "n" || e.key === "N") && !isInputFocused) {
        e.preventDefault();
        handleAddDirectItem();
        return;
      }

      if (isInputFocused) return;

      if (e.key === "1") {
        e.preventDefault();
        handlePrintWithoutRate();
      } else if (e.key === "2") {
        e.preventDefault();
        handlePrintWithRate();
      } else if (e.key === "F3") {
        e.preventDefault();
        handleExportExcel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [challanData, selectedLedgerObj, challanSerial, selectedSiteId, showDirectChallanModal, handleAddDirectItem]);

  return (
    <div className="font-mono text-slate-800 max-w-[96%] sm:max-w-[98%] mx-auto space-y-4">
      {/* Search Filter Widgets Bar */}
      <div className="bg-[#E5ECF4] border-2 border-slate-800 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 print:hidden select-none">
        <div className="flex items-center justify-between border-b-2 border-slate-350 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-700" />
            <span className="font-bold text-xs uppercase text-slate-700">CHALLAN SELECTOR SYSTEM</span>
          </div>
          <button
            type="button"
            onClick={openDirectChallanModal}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 font-extrabold text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none"
          >
            Direct Challan / डायरेक्ट चालान (D)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Site Selector Widget */}
          <div ref={siteSelectorRef} className="relative">
            <label className="block text-xs font-bold mb-1.5 uppercase text-slate-700">
              1. Select Construction Site
            </label>
            <div
              className={`flex items-center border-2 transition-all bg-white relative ${isSiteFocused ? "border-amber-500 ring-2 ring-amber-400/20" : "border-slate-800"
                }`}
            >
              <input
                ref={siteInputRef}
                type="text"
                value={siteSearchVal}
                onChange={(e) => {
                  setSiteSearchVal(e.target.value);
                  setIsSiteSuggestionsOpen(true);
                  if (selectedSiteId) {
                    setSelectedSiteId(null);
                    setSelectedLedgerId(null);
                    setLedgerSearchVal("");
                  }
                  if (directChallan) {
                    setDirectChallan(null);
                  }
                }}
                onFocus={() => {
                  setIsSiteFocused(true);
                  setIsSiteSuggestionsOpen(true);
                }}
                onBlur={() => setIsSiteFocused(false)}
                onKeyDown={handleSiteKeyDown}
                placeholder="TYPE SITE NAME OR ARROW DOWN..."
                className="w-full px-3 py-2 text-xs uppercase border-none focus:outline-none placeholder-slate-400 font-bold bg-transparent"
              />
              <button
                type="button"
                onClick={() => setIsSiteSuggestionsOpen((prev) => !prev)}
                className="px-3 border-l border-slate-300 h-full text-slate-650 hover:bg-slate-100 py-2.5"
              >
                ▼
              </button>
            </div>

            {/* Site Autocomplete dropdown */}
            {isSiteSuggestionsOpen && filteredSites.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-50 max-h-48 overflow-y-auto">
                {filteredSites.map((site: any, idx: number) => {
                  const isHighlighted = idx === highlightedSiteIndex;
                  const isSelected = site.id === selectedSiteId;
                  return (
                    <button
                      key={site.id}
                      onClick={() => {
                        setSelectedSiteId(site.id);
                        setSiteSearchVal(site.name.toUpperCase());
                        setIsSiteSuggestionsOpen(false);
                        setHighlightedSiteIndex(-1);

                        setSelectedLedgerId(null);
                        setLedgerSearchVal("");
                        if (directChallan) {
                          setDirectChallan(null);
                        }

                        setTimeout(() => {
                          ledgerInputRef.current?.focus();
                        }, 100);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-slate-100 last:border-0 ${isHighlighted
                        ? "bg-amber-400 text-slate-950 font-black"
                        : isSelected
                          ? "bg-amber-100 text-amber-900"
                          : "hover:bg-slate-100 text-slate-700"
                        }`}
                    >
                      {site.name.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account/Supplier Selector Widget */}
          <div ref={ledgerSelectorRef} className="relative">
            <label className="block text-xs font-bold mb-1.5 uppercase text-slate-700">
              2. Select Supplier/Account
            </label>
            <div
              className={`flex items-center border-2 transition-all bg-white relative ${!selectedSiteId
                ? "border-slate-300 opacity-60 cursor-not-allowed"
                : isLedgerFocused
                  ? "border-amber-500 ring-2 ring-amber-400/20"
                  : "border-slate-800"
                }`}
            >
              <input
                ref={ledgerInputRef}
                type="text"
                disabled={!selectedSiteId}
                value={ledgerSearchVal}
                onChange={(e) => {
                  setLedgerSearchVal(e.target.value);
                  setIsLedgerSuggestionsOpen(true);
                  if (selectedLedgerId) {
                    setSelectedLedgerId(null);
                  }
                  if (directChallan) {
                    setDirectChallan(null);
                  }
                }}
                onFocus={(e) => {
                  setIsLedgerFocused(true);
                  setIsLedgerSuggestionsOpen(true);
                  e.target.select();
                }}
                onBlur={() => setIsLedgerFocused(false)}
                onKeyDown={handleLedgerKeyDown}
                placeholder={
                  selectedSiteId
                    ? "TYPE ACCOUNT OR ARROW DOWN..."
                    : "SELECT SITE FIRST..."
                }
                className="w-full px-3 py-2 text-xs uppercase border-none focus:outline-none placeholder-slate-400 font-bold bg-transparent disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={!selectedSiteId}
                onClick={() => setIsLedgerSuggestionsOpen((prev) => !prev)}
                className="px-3 border-l border-slate-300 h-full text-slate-650 hover:bg-slate-100 py-2.5 disabled:opacity-40"
              >
                ▼
              </button>
            </div>

            {/* Account Suggestions Autocomplete list */}
            {isLedgerSuggestionsOpen && filteredLedgers.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-50 max-h-[350px] overflow-y-auto">
                {filteredLedgers.map((ledger: any, idx: number) => {
                  const isHighlighted = idx === highlightedLedgerIndex;
                  const isSelected = ledger.id === selectedLedgerId;

                  return (
                    <button
                      key={ledger.id}
                      id={`acct-opt-${idx}`}
                      onClick={() => {
                        setSelectedLedgerId(ledger.id);
                        setLedgerSearchVal(ledger.name.toUpperCase());
                        setIsLedgerSuggestionsOpen(false);
                        setHighlightedLedgerIndex(-1);
                        if (directChallan) {
                          setDirectChallan(null);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-slate-100 last:border-0 ${isHighlighted
                        ? "bg-amber-400 text-slate-955 font-black"
                        : isSelected
                          ? "bg-amber-100 text-amber-900"
                          : "hover:bg-slate-100 text-slate-700"
                        }`}
                    >
                      <span className="truncate block py-0.5">{ledger.name.toUpperCase()} {ledger.isVirtual ? "(VIRTUAL)" : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Delivery Challan View Panel */}
      {(selectedSiteId && selectedLedgerId) || directChallan ? (
        <>
          <div className="print-container bg-white border-2 border-slate-850 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden print:border-2 print:border-black print:shadow-none animate-in fade-in zoom-in-95 duration-200">

          {/* Windows retro window frame title bar */}
          <div className="flex items-center justify-between bg-slate-900 text-white px-3 py-1.5 font-mono text-xs font-black shadow-inner select-none no-print">
            <div className="flex items-center gap-2">
              <Printer className="h-3.5 w-3.5" />
              <span>{directChallan ? "Direct_Challan_Print_Panel (Pure Frontend)" : "Challan_Delivery_Print_Panel"}</span>
            </div>
            <div className="flex items-center gap-1">
              {directChallan && (
                <button
                  type="button"
                  onClick={() => setDirectChallan(null)}
                  className="bg-red-650 hover:bg-red-700 text-white font-extrabold text-[9px] px-2 py-0.5 rounded border border-slate-955 active:translate-y-0.5 cursor-pointer uppercase transition-all shadow-sm mr-2 no-print"
                >
                  Exit Direct / बाहर आएं
                </button>
              )}
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-slate-800 text-[8px] flex items-center justify-center font-bold font-sans shadow-sm select-none">_</span>
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-slate-800 text-[8px] flex items-center justify-center font-bold font-sans shadow-sm select-none">&#9633;</span>
              <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-red-650 text-[9px] flex items-center justify-center font-black font-sans shadow-sm select-none">X</span>
            </div>
          </div>

          {/* Dynamic print-only style tag */}
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page { size: portrait; margin: 0; }
                body { visibility: hidden; background: white !important; color: black !important; }
                .print-container, .print-container * { visibility: visible !important; }
                .no-print, .no-print * { display: none !important; visibility: hidden !important; }
                .print-container { 
                  position: absolute !important; 
                  left: 8mm !important; 
                  top: 8mm !important; 
                  right: 8mm !important; 
                  border: 2px solid #000 !important; 
                  padding: 18px !important; 
                  border-radius: 4px !important; 
                  box-shadow: none !important; 
                  background: white !important;
                  display: block !important;
                  z-index: 99999999 !important;
                }
                
                /* Large typography for A5 half-page readability */
                .estimate-title { font-size: 26px !important; font-weight: 900 !important; }
                .supplier-name { font-size: 16px !important; font-weight: 900 !important; }
                .supplier-info { font-size: 13px !important; font-weight: 700 !important; line-height: 1.3 !important; }
                .meta-title { font-size: 11px !important; font-weight: 900 !important; }
                .meta-value { font-size: 16px !important; font-weight: 900 !important; }
                
                table { width: 100% !important; border-collapse: collapse !important; margin-top: 8px !important; }
                th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; font-size: 13px !important; font-weight: 900 !important; }
                td { font-size: 14px !important; font-weight: 800 !important; }
                th, td { border: 1.5px solid #000 !important; padding: 7px 9px !important; }
                .total-label { font-size: 14px !important; font-weight: 900 !important; }
                .total-value { font-size: 14px !important; font-weight: 900 !important; }
              }
            `
          }} />

          {/* Inner content wrapper */}
          <div className="p-8 bg-white print:p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:block print:space-y-0">

              {/* COPY 1: WITHOUT RATE & AMOUNT */}
              <div className={`space-y-4 ${printCopy === "copy2" ? "print:hidden" : ""}`}>
                <div className="text-center border-b-2 border-slate-800 pb-2">
                  <h1 className="text-xl font-black tracking-widest text-slate-955 uppercase estimate-title">ESTIMATE</h1>
                </div>

                <div className="border border-slate-850 p-3 bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-bold font-mono">
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-slate-955 font-black uppercase text-xs block supplier-name">{translateBilingual(selectedLedgerObj?.name || "")}</span>
                      <div className="text-[11px] text-slate-700 uppercase leading-tight supplier-info">
                        <span className="text-slate-400 text-[9px] font-black mr-1">ADDRESS:</span>
                        {translateBilingual(supplierAddress)}
                      </div>
                      <div className="text-[11px] text-slate-700 leading-none supplier-info">
                        <span className="text-slate-400 text-[9px] font-black mr-1">PHONE:</span>
                        {supplierPhone}
                      </div>
                    </div>
                    <div className="border-l border-slate-300 pl-3">
                      <span className="text-slate-500 uppercase block text-[9px] font-black meta-title">NO.</span>
                      <span className="text-slate-955 font-black text-sm block mt-0.5 meta-value">{challanSerial}</span>
                    </div>
                    <div className="border-l border-slate-300 pl-3">
                      <span className="text-slate-500 uppercase block text-[9px] font-black meta-title">DATE</span>
                      <span className="text-slate-955 font-black text-xs block mt-1 meta-value">{challanDateStr}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="overflow-x-auto border border-slate-800">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-800 uppercase font-black text-slate-800 text-[11px]">
                          <th className="py-1.5 px-3 border-r border-slate-800 w-12 text-center">S.No</th>
                          <th className="py-1.5 px-3 border-r border-slate-800">Material Name</th>
                          <th className="py-1.5 px-3 border-r border-slate-800 text-right w-24">Qty</th>
                          <th className="py-1.5 px-3 text-center w-20">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 font-black text-[12px]">
                        {challanData.items.filter((item: any) => item.qty > 0).length > 0 ? (
                          challanData.items.filter((item: any) => item.qty > 0).map((item: any, idx: number) => (
                            <tr key={item.id} className="hover:bg-slate-50 uppercase text-slate-900">
                              <td className="py-1.5 px-3 border-r border-slate-300 text-center text-slate-700">{idx + 1}</td>
                              <td className="py-1.5 px-3 border-r border-slate-300 text-slate-955 font-extrabold">{translateBilingual(item.material)}</td>
                              <td className="py-1.5 px-3 border-r border-slate-300 text-right font-mono text-slate-955">{item.qty > 0 ? item.qty : "-"}</td>
                              <td className="py-1.5 px-3 text-center font-bold text-slate-500">{item.qty > 0 ? item.unit : "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-400 font-bold uppercase tracking-widest">NO MATERIALS FOUND</td></tr>
                        )}
                      </tbody>
                      {challanData.items.filter((item: any) => item.qty > 0).length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t border-slate-800 font-black text-slate-955 text-[11px]">
                            <td colSpan={2} className="py-1.5 px-3 border-r border-slate-800 text-right total-label">TOTAL:</td>
                            <td className="py-1.5 px-3 border-r border-slate-800 text-right text-amber-900 font-black font-mono total-value">{challanData.totalQty}</td>
                            <td className="py-1.5 px-3 text-center text-slate-500">{challanData.items.filter((item: any) => item.qty > 0)[0]?.unit || "-"}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* COPY 1 Action buttons bar (directly below copy 1 content) */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-4 items-center justify-between no-print select-none">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Shortcut keys: 1 PRINT ESTIMATE | F3 EXCEL</div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={handlePrintWithoutRate} className="px-4 py-2 bg-slate-900 text-white border-2 border-slate-955 font-bold text-xs uppercase hover:bg-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2">
                      <Printer className="h-4 w-4" /> <span>[1] PRINT ESTIMATE</span>
                    </button>
                    <button type="button" onClick={handleExportExcel} className="px-4 py-2 bg-emerald-700 text-white border-2 border-emerald-950 font-bold text-xs uppercase hover:bg-emerald-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" /> <span>[F3] EXCEL</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SEPARATOR / CUTTING LINE FOR PRINT */}
              <div className={`hidden print:block border-t-2 border-dashed border-black my-6 ${printCopy !== "both" ? "print:hidden" : ""}`} />

              {/* COPY 2: WITH RATE & AMOUNT */}
              <div className={`space-y-4 ${printCopy === "copy1" ? "print:hidden" : ""}`}>
                <div className="text-center border-b-2 border-slate-800 pb-2">
                  <h1 className="text-xl font-black tracking-widest text-slate-955 uppercase estimate-title">ESTIMATE</h1>
                </div>

                <div className="border border-slate-850 p-3 bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-bold font-mono">
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-slate-955 font-black uppercase text-xs block supplier-name">{translateBilingual(selectedLedgerObj?.name || "")}</span>
                      <div className="text-[11px] text-slate-700 uppercase leading-tight supplier-info">
                        <span className="text-slate-400 text-[9px] font-black mr-1">ADDRESS:</span>
                        {translateBilingual(supplierAddress)}
                      </div>
                      <div className="text-[11px] text-slate-700 leading-none supplier-info">
                        <span className="text-slate-400 text-[9px] font-black mr-1">PHONE:</span>
                        {supplierPhone}
                      </div>
                    </div>
                    <div className="border-l border-slate-300 pl-3">
                      <span className="text-slate-500 uppercase block text-[9px] font-black meta-title">NO.</span>
                      <span className="text-slate-955 font-black text-sm block mt-0.5 meta-value">{challanSerial}</span>
                    </div>
                    <div className="border-l border-slate-300 pl-3">
                      <span className="text-slate-500 uppercase block text-[9px] font-black meta-title">DATE</span>
                      <span className="text-slate-955 font-black text-xs block mt-1 meta-value">{challanDateStr}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="overflow-x-auto border border-slate-800">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-800 uppercase font-black text-slate-800 text-[11px]">
                          <th className="py-1.5 px-3 border-r border-slate-800 w-12 text-center">S.No</th>
                          <th className="py-1.5 px-3 border-r border-slate-800">Material Name</th>
                          <th className="py-1.5 px-3 border-r border-slate-800 text-right w-24">Qty</th>
                          <th className="py-1.5 px-3 border-r border-slate-800 text-center w-20">Unit</th>
                          <th className="py-1.5 px-3 border-r border-slate-800 text-right w-20">Rate</th>
                          <th className="py-1.5 px-3 text-right w-28">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 font-black text-[12px]">
                        {challanData.items.length > 0 ? (
                          challanData.items.map((item: any, idx: number) => (
                            <tr key={item.id} className="hover:bg-slate-50 uppercase text-slate-900">
                              <td className="py-1.5 px-3 border-r border-slate-300 text-center text-slate-700">{idx + 1}</td>
                              <td className="py-1.5 px-3 border-r border-slate-300 text-slate-955 font-extrabold">{translateBilingual(item.material)}</td>
                              <td className="py-1.5 px-3 border-r border-slate-300 text-right font-mono text-slate-955">{item.qty > 0 ? item.qty : "-"}</td>
                              <td className="py-1.5 px-3 border-r border-slate-300 text-center font-bold text-slate-500">{item.qty > 0 ? item.unit : "-"}</td>
                              <td className="py-1.5 px-3 border-r border-slate-300 text-right font-mono text-slate-650">{item.rate > 0 ? item.rate : "-"}</td>
                              <td className="py-1.5 px-3 text-right font-mono text-slate-955">{item.amount > 0 ? item.amount : "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-bold uppercase tracking-widest">NO MATERIALS FOUND</td></tr>
                        )}
                      </tbody>
                      {challanData.items.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 border-t border-slate-800 font-black text-slate-955 text-[11px]">
                            <td colSpan={2} className="py-1.5 px-3 border-r border-slate-800 text-right total-label">TOTAL:</td>
                            <td className="py-1.5 px-3 border-r border-slate-800 text-right text-amber-900 font-black font-mono total-value">{challanData.totalQty}</td>
                            <td className="py-1.5 px-3 border-r border-slate-800 text-center text-slate-500">{challanData.items[0]?.unit || "-"}</td>
                            <td className="py-1.5 px-3 border-r border-slate-800 text-right text-slate-400">-</td>
                            <td className="py-1.5 px-3 text-right text-amber-900 font-black font-mono total-value">{challanData.totalAmount}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                {/* COPY 2 Action buttons bar (directly below copy 2 content) */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-4 items-center justify-between no-print select-none">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Shortcut keys: 2 PRINT WITH RATE</div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={handlePrintWithRate} className="px-4 py-2 bg-[#2B547E] text-white border-2 border-slate-955 font-bold text-xs uppercase hover:bg-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2">
                      <Printer className="h-4 w-4" /> <span>[2] PRINT WITH RATE</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* EDIT CHALLAN SECTION (BOTTOM OF PAGE) */}
        {!directChallan && challanData.items.length > 0 && (
          <div className="bg-[#E5ECF4] border-2 border-slate-800 p-6 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 print:hidden select-none mt-6">
            <div className="flex items-center gap-2 border-b-2 border-slate-350 pb-2 mb-2 bg-[#2B547E] text-white p-3 rounded">
              <Printer className="h-4 w-4" />
              <span className="font-bold text-xs uppercase tracking-wider">EDIT CURRENT CHALLAN DETAILS (NO: {challanSerial})</span>
            </div>

            <div className="overflow-x-auto border-2 border-slate-800 bg-white">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-800 uppercase font-black text-slate-800 text-[11px]">
                    <th className="py-2.5 px-4 border-r border-slate-800">Material Name</th>
                    <th className="py-2.5 px-4 border-r border-slate-800 text-right w-28">Qty</th>
                    <th className="py-2.5 px-4 border-r border-slate-800 text-center w-24">Unit</th>
                    <th className="py-2.5 px-4 border-r border-slate-800 text-right w-28">Rate</th>
                    <th className="py-2.5 px-4 border-r border-slate-800 text-right w-32">Amount</th>
                    <th className="py-2.5 px-4 text-center w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-bold text-xs">
                  {challanData.items.map((item) => (
                    <ChallanRowEditor key={item.id} item={item} onSave={handleSaveRow} onDelete={handleDeleteRow} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="bg-white border-2 border-slate-800 p-16 text-center space-y-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] select-none">
          <div className="w-16 h-16 bg-[#E5ECF4] border-2 border-slate-800 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Building2 className="h-8 w-8 text-slate-750" />
          </div>
          <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">NO CHALLAN DOCUMENT SELECTED</h3>
          <p className="text-xs text-slate-400 font-bold uppercase leading-relaxed max-w-sm mx-auto">Please select a Site and Supplier to proceed.</p>
        </div>
      )}

      {/* Direct Challan Modal */}
      {showDirectChallanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#D3DFEE] border-2 border-slate-955 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden w-[840px] max-w-[95vw] font-mono flex flex-col select-none">
            {/* Title Bar */}
            <div className="bg-emerald-700 border-b-2 border-slate-950 px-3 py-2 flex items-center justify-between text-white shrink-0">
              <span className="text-xs font-black uppercase tracking-wider">Create Direct Challan / डायरेक्ट चालान बनाएँ</span>
              <button
                type="button"
                onClick={() => setShowDirectChallanModal(false)}
                className="bg-red-650 hover:bg-red-700 text-white font-black text-xs px-2 py-0.5 rounded border border-slate-950 active:translate-y-0.5"
              >
                X
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleCreateDirectChallan} className="p-6 bg-[#E5ECF4] space-y-4 text-slate-955">
              <div className="space-y-4">
                
                {/* Date and Customer Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Input */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-650 mb-1">Date / दिनांक (DD.MM.YY):</label>
                    <input
                      ref={directDateInputRef}
                      type="text"
                      required
                      value={directDate}
                      onChange={(e) => setDirectDate(e.target.value)}
                      placeholder="DD.MM.YY"
                      className="w-full bg-white border-2 border-slate-950 rounded px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {/* Customer Name */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-650 mb-1">Customer Name / ग्राहक का नाम:</label>
                    <input
                      type="text"
                      value={directCustomer}
                      onChange={(e) => setDirectCustomer(e.target.value.toUpperCase())}
                      placeholder="ENTER CUSTOMER NAME (OPTIONAL)"
                      className="w-full bg-white border-2 border-slate-950 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Items Section Title */}
                <div className="border-b-2 border-slate-355 border-slate-400 pb-1 flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-slate-700">Materials / सामग्री सूची</span>
                </div>

                {/* Items Table/Grid */}
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2 pb-32">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase text-slate-600 px-1 select-none">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">Material Name / सामग्री</div>
                    <div className="col-span-2 text-right">Qty / मात्रा</div>
                    <div className="col-span-2 text-center">Unit / इकाई</div>
                    <div className="col-span-1 text-right">Rate / दर</div>
                    <div className="col-span-1 text-right">Amount</div>
                  </div>

                  {directItems.map((item, idx) => {
                    const suggestions = (() => {
                      const q = item.material.trim().toUpperCase();
                      if (!existingMaterials) return [];
                      if (!q) return existingMaterials;
                      return existingMaterials.filter((m: any) => matchesFuzzy(m.name, q));
                    })();

                    return (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                        {/* S.No */}
                        <div className="col-span-1 text-center font-bold text-xs text-slate-700">
                          {idx + 1}
                        </div>

                        {/* Material Input with Autocomplete */}
                        <div className="col-span-5 relative">
                          <input
                            id={`direct-material-input-${idx}`}
                            type="text"
                            value={item.material}
                            onChange={(e) => {
                              updateDirectItem(idx, {
                                material: e.target.value.toUpperCase(),
                                isMaterialSuggestionsOpen: true,
                                highlightedMaterialIndex: -1
                              });
                            }}
                            onFocus={() => {
                              updateDirectItem(idx, { isMaterialSuggestionsOpen: true, highlightedMaterialIndex: -1 });
                            }}
                            onClick={() => {
                              updateDirectItem(idx, { isMaterialSuggestionsOpen: true });
                            }}
                            onBlur={() => {
                              setTimeout(() => updateDirectItem(idx, { isMaterialSuggestionsOpen: false }), 200);
                            }}
                            onKeyDown={(e) => handleMaterialKeyDown(idx, e, suggestions)}
                            placeholder="Type Material..."
                            className="w-full bg-white border border-slate-950 rounded px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-emerald-600 uppercase"
                          />
                          {item.isMaterialSuggestionsOpen && suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-950 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-[10000] max-h-32 overflow-y-auto">
                              {suggestions.map((mat: any, sIdx: number) => {
                                const isHighlighted = sIdx === item.highlightedMaterialIndex;
                                return (
                                  <button
                                    key={mat.id || sIdx}
                                    id={`mat-opt-${idx}-${sIdx}`}
                                    type="button"
                                    onMouseDown={() => {
                                      updateDirectItem(idx, {
                                        material: mat.name.toUpperCase(),
                                        unit: mat.unit?.toUpperCase() || "CFT",
                                        isMaterialSuggestionsOpen: false,
                                        highlightedMaterialIndex: -1
                                      });
                                      setTimeout(() => {
                                        const qtyEl = document.getElementById(`direct-qty-input-${idx}`) as HTMLInputElement | null;
                                        if (qtyEl) {
                                          qtyEl.focus();
                                          qtyEl.select();
                                        }
                                      }, 50);
                                    }}
                                    className={`w-full text-left px-2.5 py-1 text-[11px] font-bold border-b border-slate-100 last:border-0 ${
                                      isHighlighted ? "bg-amber-400 text-slate-955" : "hover:bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {mat.name.toUpperCase()} ({mat.unit || "CFT"})
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Qty Input */}
                        <div className="col-span-2">
                          <input
                            id={`direct-qty-input-${idx}`}
                            type="number"
                            step="any"
                            value={item.qty}
                            onChange={(e) => updateDirectItem(idx, { qty: e.target.value })}
                            placeholder="Qty"
                            className="w-full bg-white border border-slate-950 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        {/* Unit Input */}
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateDirectItem(idx, { unit: e.target.value.toUpperCase() })}
                            placeholder="Unit"
                            className="w-full bg-white border border-slate-950 rounded px-2 py-1 text-xs font-bold text-center focus:outline-none focus:border-emerald-600 uppercase"
                          />
                        </div>

                        {/* Rate Input */}
                        <div className="col-span-1">
                          <input
                            type="number"
                            step="any"
                            value={item.rate}
                            onChange={(e) => updateDirectItem(idx, { rate: e.target.value })}
                            placeholder="Rate"
                            className="w-full bg-white border border-slate-950 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        {/* Amount Calculation */}
                        <div className="col-span-1 text-right font-mono font-bold text-xs pr-1">
                          {item.amount || "-"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Item Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleAddDirectItem}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-400 font-extrabold text-[10px] py-2 rounded transition-all active:translate-y-0.5 cursor-pointer uppercase tracking-wider text-center flex items-center justify-center gap-1.5 focus:outline-none"
                  >
                    <span>+ Add Item / नया आइटम जोड़ें (N)</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white border-t border-slate-300 -mx-6 -mb-6 p-4 mt-4">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-2.5 rounded transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none border-2 border-slate-950 cursor-pointer uppercase tracking-wider text-center"
                >
                  Generate Challan / चालान बनाएं
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChallanRowEditorProps {
  item: any;
  onSave: (id: string, material: string, qty: number, unit: string, rate: number, rawItem: any) => void;
  onDelete: (id: string) => void;
}

function ChallanRowEditor({ item, onSave, onDelete }: ChallanRowEditorProps) {
  const [material, setMaterial] = useState(item.material);
  const [qty, setQty] = useState(String(item.qty));
  const [unit, setUnit] = useState(item.unit);
  const [rate, setRate] = useState(String(item.rate));

  const amount = (parseFloat(qty) || 0) * (parseFloat(rate) || 0);

  return (
    <tr className="hover:bg-slate-50 uppercase text-slate-900 border-b border-slate-300 last:border-0">
      <td className="py-2 px-3 border-r border-slate-300">
        <input
          type="text"
          value={material}
          onChange={(e) => setMaterial(e.target.value.toUpperCase())}
          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold uppercase focus:outline-none focus:border-slate-800"
        />
      </td>
      <td className="py-2 px-3 border-r border-slate-300 text-right">
        <input
          type="number"
          step="any"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono"
        />
      </td>
      <td className="py-2 px-3 border-r border-slate-300 text-center">
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value.toUpperCase())}
          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-center focus:outline-none focus:border-slate-800 font-mono"
        />
      </td>
      <td className="py-2 px-3 border-r border-slate-300 text-right">
        <input
          type="number"
          step="any"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right focus:outline-none focus:border-slate-800 font-mono"
        />
      </td>
      <td className="py-2 px-3 border-r border-slate-300 text-right font-mono font-bold text-slate-800">
        {amount > 0 ? amount.toFixed(2) : "-"}
      </td>
      <td className="py-2 px-3 text-center flex items-center justify-center gap-2 h-full">
        <button
          type="button"
          onClick={() => onSave(item.id, material, parseFloat(qty) || 0, unit, parseFloat(rate) || 0, item.rawItem)}
          className="px-3 py-1 bg-emerald-750 bg-emerald-700 text-white border border-emerald-950 text-[10px] font-black uppercase rounded shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] hover:shadow-none hover:bg-emerald-800 active:translate-y-0.5 transition-all cursor-pointer"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="px-3 py-1 bg-red-600 text-white border border-slate-950 text-[10px] font-black uppercase rounded shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] hover:shadow-none hover:bg-red-755 hover:bg-red-700 active:translate-y-0.5 transition-all cursor-pointer"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
