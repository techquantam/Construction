"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, Building2, User, Phone, MapPin, Wallet, ArrowDown, FileSpreadsheet, Trash2 } from "lucide-react";
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
  // Materials & Brands
  "BALU GANGA": "गंगा बालू",
  "BALU GHAGHRA": "घाघरा बालू",
  "BALU": "बालू",
  "GANGA": "गंगा",
  "GHAGHRA": "घाघरा",
  "BLADE STEEL CUTTING": "ब्लेड स्टील कटिंग",
  "BLADE": "ब्लेड",
  "CUTTING": "कटिंग",
  "TATA": "टाटा",
  "RHL": "आर.एच.एल.",
  "FARAWA": "फावड़ा",
  "CHETAK": "चेतक",
  "J BOX DEEP": "जे. बॉक्स डीप",
  "J BOX": "जे. बॉक्स",
  "BOX DEEP": "बॉक्स डीप",
  "BOX": "बॉक्स",
  "DEEP": "डीप",
  "J": "जे.",
  "ACC CONCRETE": "एसीसी कंक्रीट",
  "ACC GOLD": "एसीसी गोल्ड",
  "ACC": "एसीसी",
  "CONCRETE": "कंक्रीट",
  "GOLD": "गोल्ड",
  "GALLANT": "गैलेंट",
  "BEND": "बेंड",
  "HEAVY": "हैवी",
  "CART": "गाड़ी",
  "CEMENT": "सीमेंट",
  "SAND": "बालू / रेत",
  "STEEL": "स्टील",
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

  // Cash / Payments
  "RECD CASH": "प्राप्त नकद",
  "RECD": "प्राप्त",
  "CASH": "नकद",
  "RECEIVED CASH": "प्राप्त नकद",
  "RECEIVED": "प्राप्त",
  "PAYMENT": "भुगतान",
  "PAID": "भुगतान किया",
  "BALANCE": "शेष",

  // General terms
  "TEST": "टेस्ट",
  "TESTING": "टेस्टिंग",

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
  return text.toUpperCase();
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

const getNextChallanNoForDate = (dateStr: string, daybooks: any[] | null | undefined, localDirectChallans?: any[]): string => {
  let maxN = 0;

  const checkRef = (ref: string) => {
    if (ref && typeof ref === "string" && ref.startsWith(dateStr + "/")) {
      const parts = ref.split("/");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxN) {
          maxN = num;
        }
      }
    }
  };

  if (daybooks && daybooks.length > 0) {
    daybooks.forEach((item: any) => {
      checkRef(item.referenceNumber);
    });
  }

  if (localDirectChallans && localDirectChallans.length > 0) {
    localDirectChallans.forEach((ch: any) => {
      checkRef(ch.challanNo);
    });
  }

  return `${dateStr}/${maxN + 1}`;
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
  const [selectedCompanyChallanNo, setSelectedCompanyChallanNo] = useState<string | null>(null);
  const [focusedChallanIndex, setFocusedChallanIndex] = useState<number>(0);

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

  // Query: Fetch all daybook entries across all sites (to determine recent site/company)
  const { data: allDaybookData } = useQuery({
    queryKey: ["allDaybooks"],
    queryFn: async () => {
      const res = await api.get("/daybooks");
      return res.data.data || [];
    }
  });

  // Focus states for input highlight
  const [isSiteFocused, setIsSiteFocused] = useState(false);
  const [isLedgerFocused, setIsLedgerFocused] = useState(false);

  // Print Mode State
  const [printCopy, setPrintCopy] = useState<"copy1" | "copy2" | "both">("both");

  // States for Direct Challan Creation
  const [challanFormMode, setChallanFormMode] = useState<"DIRECT" | "COMPANY">("DIRECT");
  const [directAddress, setDirectAddress] = useState("");
  const [directMobile, setDirectMobile] = useState("");
  const [showDirectChallanModal, setShowDirectChallanModal] = useState(false);
  const [showCreditPopup, setShowCreditPopup] = useState(false);
  const [isSavingCredit, setIsSavingCredit] = useState(false);
  const [creditDate, setCreditDate] = useState("");
  const [creditParticulars, setCreditParticulars] = useState("CREDIT AMOUNT");
  const [creditAmount, setCreditAmount] = useState("");

  // States for Add Row Popup
  const [showAddRowPopup, setShowAddRowPopup] = useState(false);
  const [addRowMaterial, setAddRowMaterial] = useState("");
  const [addRowQty, setAddRowQty] = useState("");
  const [addRowUnit, setAddRowUnit] = useState("CFT");
  const [addRowRate, setAddRowRate] = useState("");
  const [isAddRowMaterialSuggestionsOpen, setIsAddRowMaterialSuggestionsOpen] = useState(false);
  const [highlightedAddRowMaterialIndex, setHighlightedAddRowMaterialIndex] = useState(-1);
  const addRowMaterialSelectorRef = useRef<HTMLDivElement>(null);

  // Modal Site Autocomplete States
  const [modalSiteSearchVal, setModalSiteSearchVal] = useState("");
  const [isModalSiteSuggestionsOpen, setIsModalSiteSuggestionsOpen] = useState(false);
  const [highlightedModalSiteIndex, setHighlightedModalSiteIndex] = useState(-1);
  const modalSiteSelectorRef = useRef<HTMLDivElement>(null);
  const modalSiteInputRef = useRef<HTMLInputElement>(null);

  // Modal Customer Autocomplete States
  const [isModalCustomerSuggestionsOpen, setIsModalCustomerSuggestionsOpen] = useState(false);
  const [highlightedModalCustomerIndex, setHighlightedModalCustomerIndex] = useState(-1);
  const modalCustomerSelectorRef = useRef<HTMLDivElement>(null);
  const modalCustomerInputRef = useRef<HTMLInputElement>(null);
  const hasAutoOpenedRef = useRef(false);
  const [directChallan, setDirectChallan] = useState<{
    customerName: string;
    address?: string;
    mobile?: string;
    date: string;
    challanNo: string;
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

  // Local direct challans history for today
  const [localDirectChallans, setLocalDirectChallans] = useState<any[]>([]);
  const [sidebarDate, setSidebarDate] = useState(getTodayDateStr());

  // Load local direct challans from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("today_direct_challans");
        if (stored) {
          setLocalDirectChallans(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Failed to load local direct challans", e);
      }
    }
  }, []);

  // Auto-open entry form modal on page mount (default to company ledger)
  useEffect(() => {
    if (!hasAutoOpenedRef.current && sites) {
      if (allDaybookData) {
        openDirectChallanModal("COMPANY");
        hasAutoOpenedRef.current = true;
      } else {
        const timer = setTimeout(() => {
          if (!hasAutoOpenedRef.current) {
            openDirectChallanModal("COMPANY");
            hasAutoOpenedRef.current = true;
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [sites, allDaybookData]);

  // Helper to load a company challan from the sidebar
  const loadCompanyChallan = async (siteId: string, customerName: string, challanNo?: string) => {
    setDirectChallan(null);
    setSelectedSiteId(siteId);
    if (challanNo) {
      setSelectedCompanyChallanNo(challanNo);
    }

    const siteObj = sites?.find((s: any) => s.id === siteId);
    if (siteObj) {
      setSiteSearchVal(siteObj.name.toUpperCase());
    }

    setLedgerSearchVal(customerName.toUpperCase());

    try {
      const response = await api.get(`/ledgers?siteId=${siteId}`);
      const siteLedgers = response.data.data || [];
      const matched = siteLedgers.find(
        (l: any) => l.name.toUpperCase() === customerName.toUpperCase() && l.type === "Company"
      );
      if (matched) {
        setSelectedLedgerId(matched.id);
      } else {
        setSelectedLedgerId(customerName.toUpperCase());
      }
    } catch (err) {
      setSelectedLedgerId(customerName.toUpperCase());
    }
  };

  // Helper to load a direct challan from the sidebar
  const loadDirectChallan = (challan: any) => {
    setDirectChallan(challan);
    setSelectedSiteId(null);
    setSelectedLedgerId(null);
    setSiteSearchVal("");
    setLedgerSearchVal("");
  };

  const handleDeleteWholeChallan = async (ch: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = `Are you sure you want to delete the ENTIRE Challan No. ${ch.challanNo}?`;
    if (!window.confirm(confirmMsg)) return;

    if (ch.type === "DIRECT") {
      setLocalDirectChallans((prev) => {
        const updated = prev.filter((c) => c.challanNo !== ch.challanNo);
        if (typeof window !== "undefined") {
          localStorage.setItem("today_direct_challans", JSON.stringify(updated));
        }
        return updated;
      });
      if (directChallan && directChallan.challanNo === ch.challanNo) {
        setDirectChallan(null);
      }
      toast.success("Direct challan deleted successfully");
      return;
    }

    try {
      const promises = ch.items.map((item: any) => api.delete(`/daybooks/${item.id}`));
      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: ["daybooks", ch.siteId] });
      queryClient.invalidateQueries({ queryKey: ["ledgers", ch.siteId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allDaybooks"] });

      if (challanData && challanData.challanNo === ch.challanNo && selectedSiteId === ch.siteId) {
        setSelectedLedgerId(null);
        setLedgerSearchVal("");
        setSelectedCompanyChallanNo(null);
      }
      toast.success("Company challan deleted successfully");
    } catch (err) {
      toast.error("Failed to delete company challan entries");
    }
  };

  const [directDate, setDirectDate] = useState("");
  const [directCustomer, setDirectCustomer] = useState("");
  const [directItems, setDirectItems] = useState<{
    id: string;
    material: string;
    qty: string;
    unit: string;
    rate: string;
    amount: string;
    type: "TO" | "BY";
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
      type: "TO",
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
  
  const validateRowInline = (idx: number): boolean => {
    const item = directItems[idx];
    if (!item) return true;

    if (!item.material.trim()) {
      toast.error(`Please enter Material Name in row ${idx + 1}`);
      setTimeout(() => {
        const el = document.getElementById(`direct-material-input-${idx}`);
        if (el) {
          el.focus();
          (el as HTMLInputElement).select();
        }
      }, 50);
      return false;
    }

    const qtyVal = parseFloat(item.qty);
    if (!item.qty.trim() || isNaN(qtyVal) || qtyVal <= 0) {
      toast.error(`Please enter Quantity (> 0) in row ${idx + 1}`);
      setTimeout(() => {
        const el = document.getElementById(`direct-qty-input-${idx}`);
        if (el) {
          el.focus();
          (el as HTMLInputElement).select();
        }
      }, 50);
      return false;
    }

    if (!item.unit.trim()) {
      toast.error(`Please enter Unit in row ${idx + 1}`);
      setTimeout(() => {
        const el = document.getElementById(`direct-unit-input-${idx}`);
        if (el) {
          el.focus();
          (el as HTMLInputElement).select();
        }
      }, 50);
      return false;
    }

    const rateVal = parseFloat(item.rate);
    if (!item.rate.trim() || isNaN(rateVal) || rateVal <= 0) {
      toast.error(`Please enter Rate (> 0) in row ${idx + 1}`);
      setTimeout(() => {
        const el = document.getElementById(`direct-rate-input-${idx}`);
        if (el) {
          el.focus();
          (el as HTMLInputElement).select();
        }
      }, 50);
      return false;
    }

    return true;
  };

  const handleGridKeyDown = (
    idx: number,
    colName: "material" | "qty" | "unit" | "rate",
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    const focusInput = (rowIdx: number, column: "material" | "qty" | "unit" | "rate") => {
      const elId = `direct-${column}-input-${rowIdx}`;
      const el = document.getElementById(elId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
        return true;
      }
      return false;
    };

    if (e.key === "ArrowUp") {
      if (idx > 0) {
        e.preventDefault();
        focusInput(idx - 1, colName);
      }
    } else if (e.key === "ArrowDown") {
      if (idx < directItems.length - 1) {
        // Validate current row before going down
        if (!validateRowInline(idx)) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        focusInput(idx + 1, colName);
      }
    } else if (e.key === "ArrowLeft") {
      const target = e.currentTarget;
      const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
      const isNumberInput = target.type === "number";

      if (isAtStart || target.value === "" || isNumberInput) {
        if (colName === "qty") {
          e.preventDefault();
          focusInput(idx, "material");
        } else if (colName === "unit") {
          e.preventDefault();
          focusInput(idx, "qty");
        } else if (colName === "rate") {
          e.preventDefault();
          focusInput(idx, "unit");
        } else if (colName === "material") {
          if (idx > 0) {
            e.preventDefault();
            focusInput(idx - 1, "rate");
          }
        }
      }
    } else if (e.key === "ArrowRight") {
      const target = e.currentTarget;
      const isAtEnd =
        target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
      const isNumberInput = target.type === "number";

      if (isAtEnd || target.value === "" || isNumberInput) {
        if (colName === "material") {
          e.preventDefault();
          focusInput(idx, "qty");
        } else if (colName === "qty") {
          e.preventDefault();
          focusInput(idx, "unit");
        } else if (colName === "unit") {
          e.preventDefault();
          focusInput(idx, "rate");
        } else if (colName === "rate") {
          if (idx < directItems.length - 1) {
            // Validate current row before going to next row
            if (!validateRowInline(idx)) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            focusInput(idx + 1, "material");
          }
        }
      }
    }
  };

  const handleAddDirectItem = () => {
    if (directItems.length > 0) {
      if (!validateRowInline(directItems.length - 1)) {
        return;
      }
    }
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
          type: prev[prev.length - 1]?.type || "TO",
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
      handleGridKeyDown(idx, "material", e);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      handleGridKeyDown(idx, "material", e);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const next = item.highlightedMaterialIndex + 1;
      const index = next >= suggestions.length ? suggestions.length - 1 : next;
      updateDirectItem(idx, { highlightedMaterialIndex: index });
      setTimeout(() => {
        const el = document.getElementById(`mat-opt-${idx}-${index}`);
        if (el) el.scrollIntoView({ block: "nearest" });
      }, 10);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const next = item.highlightedMaterialIndex - 1;
      const index = next < 0 ? 0 : next;
      updateDirectItem(idx, { highlightedMaterialIndex: index });
      setTimeout(() => {
        const el = document.getElementById(`mat-opt-${idx}-${index}`);
        if (el) el.scrollIntoView({ block: "nearest" });
      }, 10);
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      let sIdx = item.highlightedMaterialIndex;
      if (sIdx === -1 && suggestions.length > 0) {
        sIdx = 0;
      }
      if (sIdx >= 0 && sIdx < suggestions.length) {
        const mat = suggestions[sIdx];
        updateDirectItem(idx, {
          material: mat.name.toUpperCase(),
          unit: mat.unit?.toUpperCase() || "CFT",
          rate: mat.rate !== undefined && mat.rate !== null ? String(mat.rate) : "",
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
        modalSiteInputRef.current?.focus();
        modalSiteInputRef.current?.select();
      }, 50);
    }
  }, [showDirectChallanModal]);

  const openDirectChallanModal = (mode: "DIRECT" | "COMPANY" = "DIRECT") => {
    setChallanFormMode(mode);
    setDirectDate(getTodayDateStr());

    let targetSiteId = selectedSiteId;
    let targetSiteName = "";

    // 1. Find recent site from all daybooks (where a company challan was created)
    if (allDaybookData && allDaybookData.length > 0) {
      const companyChallanEntries = allDaybookData
        .filter((item: any) => item.description === "COMPANY_LEDGER_ENTRY")
        .sort((a: any, b: any) => {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          if (timeA !== timeB) return timeB - timeA;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

      if (companyChallanEntries.length > 0) {
        targetSiteId = companyChallanEntries[0].siteId;
      } else if (allDaybookData.length > 0) {
        // fallback to any newest daybook entry site
        targetSiteId = allDaybookData[0].siteId;
      }
    }

    // Fallback if still not determined
    if (!targetSiteId && sites && sites.length > 0) {
      targetSiteId = sites[0].id;
    }

    if (targetSiteId && sites) {
      const matchedSite = sites.find((s: any) => s.id === targetSiteId);
      if (matchedSite) {
        targetSiteName = matchedSite.name.toUpperCase();
      }
    }

    setSelectedSiteId(targetSiteId);
    setModalSiteSearchVal(targetSiteName);

    let defaultCustomer = "";
    let defaultAddress = "";
    let defaultMobile = "";

    if (mode === "COMPANY" && targetSiteId) {
      // Find the most recently used company in the determined targetSiteId daybooks
      if (allDaybookData && allDaybookData.length > 0) {
        const siteCompanyEntries = allDaybookData
          .filter((item: any) => item.siteId === targetSiteId && item.description === "COMPANY_LEDGER_ENTRY" && item.expenseType)
          .sort((a: any, b: any) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            if (timeA !== timeB) return timeB - timeA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

        if (siteCompanyEntries.length > 0) {
          const newestEntry = siteCompanyEntries[0];
          const text = newestEntry.expenseType || "";
          let name = "";
          if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
          else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();

          if (name) {
            // Find in activeSiteCompanyLedgers list matching targetSiteId
            const matchedLedger = activeSiteCompanyLedgers.find((l: any) => l.name.toUpperCase() === name);
            if (matchedLedger) {
              defaultCustomer = matchedLedger.name.toUpperCase();
              const details = parsePartyDetails(matchedLedger.contactPerson);
              if (details) {
                defaultAddress = details.address || "";
                defaultMobile = details.mobileNo || details.phoneNo || "";
              } else {
                defaultAddress = matchedLedger.contactPerson || "";
                defaultMobile = matchedLedger.phone || "";
              }
            } else {
              defaultCustomer = name;
              const parsedMode = parsePaymentModeDetails(newestEntry.paymentMode || "");
              if (parsedMode && parsedMode.isCompany) {
                defaultAddress = parsedMode.address || "";
                defaultMobile = parsedMode.mobile || "";
              }
            }
          }
        }
      }

      if (!defaultCustomer && selectedLedgerId && selectedSiteId === targetSiteId) {
        const matchedLedger = activeSiteCompanyLedgers.find((l: any) => String(l.id) === String(selectedLedgerId));
        if (matchedLedger) {
          defaultCustomer = matchedLedger.name.toUpperCase();
          const details = parsePartyDetails(matchedLedger.contactPerson);
          if (details) {
            defaultAddress = details.address || "";
            defaultMobile = details.mobileNo || details.phoneNo || "";
          } else {
            defaultAddress = matchedLedger.contactPerson || "";
            defaultMobile = matchedLedger.phone || "";
          }
        }
      }

      if (!defaultCustomer && activeSiteCompanyLedgers.length > 0) {
        const firstLedger = activeSiteCompanyLedgers[0];
        defaultCustomer = firstLedger.name.toUpperCase();
        const details = parsePartyDetails(firstLedger.contactPerson);
        if (details) {
          defaultAddress = details.address || "";
          defaultMobile = details.mobileNo || details.phoneNo || "";
        } else {
          defaultAddress = firstLedger.contactPerson || "";
          defaultMobile = firstLedger.phone || "";
        }
      }
    }

    setDirectCustomer(defaultCustomer);
    setDirectAddress(defaultAddress);
    setDirectMobile(defaultMobile);

    setDirectItems([
      {
        id: "direct-item-1",
        material: "",
        qty: "",
        unit: "CFT",
        rate: "",
        amount: "",
        type: "TO",
        isMaterialSuggestionsOpen: false,
        highlightedMaterialIndex: -1
      }
    ]);
    setShowDirectChallanModal(true);
  };

  const createChallanMutation = useMutation({
    mutationFn: async (payload: {
      date: Date;
      customerName: string;
      address: string;
      mobile: string;
      items: {
        material: string;
        qty: number;
        unit: string;
        rate: number;
        amount: number;
        type: "TO" | "BY";
      }[];
    }) => {
      if (!selectedSiteId) {
        throw new Error("Please select a Construction Site first");
      }

      const cleanCustomerName = payload.customerName.trim().toUpperCase();

      // 1. Find or create the company ledger account
      const existingLedger = activeSiteCompanyLedgers.find(
        (l) => l.name.toUpperCase() === cleanCustomerName
      );

      let ledgerId = "";
      if (existingLedger && !existingLedger.isVirtual) {
        ledgerId = existingLedger.id;
      } else {
        // Create the company ledger
        const ledgerRes = await api.post("/ledgers", {
          type: "Company",
          name: cleanCustomerName,
          contactPerson: JSON.stringify({
            address: payload.address.trim().toUpperCase() || "N/A",
            mobileNo: payload.mobile.trim() || "N/A",
            customerExtra: "CUSTOMER",
            measurementType: "OTHER",
            plotUnit: payload.items[0]?.unit?.toUpperCase() || "CFT"
          }),
          phone: payload.mobile.trim() || "N/A",
          openingBalance: 0,
          siteId: selectedSiteId
        });

        if (ledgerRes.data && ledgerRes.data.data) {
          ledgerId = ledgerRes.data.data.id;
        }
      }

      // 2. Generate new Challan Number for the date
      const d = payload.date;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).substring(2);
      const dateStr = `${day}.${month}.${year}`;

      const generatedChallanNo = getNextChallanNoForDate(dateStr, siteDaybookData || [], localDirectChallans);

      // 3. Post daybook entry for each material item
      const promises = payload.items.map(async (item) => {
        const serializedPaymentMode = JSON.stringify({
          type: "CompanyTransaction",
          address: payload.address.trim().toUpperCase() || "N/A",
          mobile: payload.mobile.trim() || "N/A",
          material: item.material.trim().toUpperCase(),
          qty: item.qty,
          unit: item.unit.trim().toUpperCase() || "CFT",
          crDr: item.type === "TO" ? "DR" : "CR",
          rate: item.rate
        });

        const daybookPayload = {
          siteId: selectedSiteId,
          date: payload.date.toISOString(),
          expenseType: item.type === "TO" ? `To ${cleanCustomerName}` : `By ${cleanCustomerName}`,
          amount: item.amount,
          paymentMode: serializedPaymentMode,
          description: "COMPANY_LEDGER_ENTRY",
          referenceNumber: generatedChallanNo,
        };

        return api.post("/daybooks", daybookPayload);
      });

      await Promise.all(promises);

      return { ledgerId, cleanCustomerName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["daybooks", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["ledgers", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allDaybooks"] });

      toast.success("Company Ledger Challan saved and generated successfully!");

      const siteObj = sites?.find((s: any) => s.id === selectedSiteId);
      if (siteObj) {
        setSiteSearchVal(siteObj.name.toUpperCase());
      }

      setSelectedLedgerId(data.ledgerId);
      setLedgerSearchVal(data.cleanCustomerName);
      setDirectChallan(null);
      setSelectedCompanyChallanNo(null);
      setShowDirectChallanModal(false);
    },
    onError: (err: any) => {
      toast.error(err.message || err.response?.data?.message || "Failed to save Company Ledger Challan");
    }
  });

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

    if (challanFormMode === "COMPANY" && !directCustomer.trim()) {
      toast.error("Customer Name is required");
      return;
    }

    // 1. Filter out completely empty items
    const nonBlankItems = directItems.filter(item => 
      item.material.trim() !== "" || item.qty.trim() !== "" || item.rate.trim() !== ""
    );

    if (nonBlankItems.length === 0) {
      toast.error("Please add at least one material");
      const firstMat = document.getElementById("direct-material-input-0");
      if (firstMat) {
        firstMat.focus();
        (firstMat as HTMLInputElement).select();
      }
      return;
    }

    // 2. Validate all rows that are not completely empty
    for (let i = 0; i < directItems.length; i++) {
      const item = directItems[i];
      const isCompletelyEmpty = !item.material.trim() && !item.qty.trim() && !item.rate.trim();
      if (isCompletelyEmpty) {
        continue;
      }
      if (!validateRowInline(i)) {
        return;
      }
    }

    // 3. Prepare items payload (excluding completely empty items)
    const items = directItems
      .filter(item => !(!item.material.trim() && !item.qty.trim() && !item.rate.trim()))
      .map((item) => {
        const qtyVal = parseFloat(item.qty) || 0;
        const rateVal = parseFloat(item.rate) || 0;
        const amtVal = qtyVal * rateVal;

        return {
          material: item.material.trim().toUpperCase(),
          qty: qtyVal,
          unit: item.unit.trim().toUpperCase() || "CFT",
          rate: rateVal,
          amount: parseFloat(amtVal.toFixed(2)),
          type: item.type || "TO"
        };
      });

    if (challanFormMode === "COMPANY") {
      createChallanMutation.mutate({
        date: parsedDate,
        customerName: directCustomer,
        address: directAddress,
        mobile: directMobile,
        items
      });
    } else {
      const directItemsFormatted = items.map((item, idx) => ({
        id: `direct-item-${idx + 1}`,
        date: parsedDate.toISOString(),
        type: item.type as "TO" | "BY",
        material: item.material,
        qty: item.qty,
        unit: item.unit,
        rate: item.rate,
        amount: item.amount,
        particulars: "DIRECT SALE / CASH",
        reference: "DIRECT_CHALLAN"
      }));

      // Generate sequential challan number for direct mode as well
      const d = parsedDate;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear()).substring(2);
      const dateStr = `${day}.${month}.${year}`;

      const generatedChallanNo = getNextChallanNoForDate(dateStr, siteDaybookData || [], localDirectChallans);

      const newDirectChallan = {
        customerName: directCustomer.trim().toUpperCase() || "DIRECT CLIENT",
        address: directAddress.trim().toUpperCase() || "N/A",
        mobile: directMobile.trim() || "N/A",
        date: parsedDate.toISOString(),
        challanNo: generatedChallanNo,
        items: directItemsFormatted,
        siteId: selectedSiteId || ""
      };

      setDirectChallan(newDirectChallan);

      setLocalDirectChallans((prev) => {
        const filtered = prev.filter((c) => c.challanNo !== generatedChallanNo);
        const updated = [...filtered, newDirectChallan];
        if (typeof window !== "undefined") {
          localStorage.setItem("today_direct_challans", JSON.stringify(updated));
        }
        return updated;
      });

      setShowDirectChallanModal(false);
      toast.success("Direct Challan generated successfully for preview");
    }
  };

  // Mount hooks or page layout effects

  // Memoized list of today's challans (both Company and Direct)
  const todayChallansList = useMemo(() => {
    const todayStr = sidebarDate || getTodayDateStr();
    const list: any[] = [];

    // 1. Group today's Company Challans from allDaybookData
    if (allDaybookData && allDaybookData.length > 0) {
      const todayCompanyEntries = allDaybookData.filter((item: any) => {
        if (item.description !== "COMPANY_LEDGER_ENTRY") return false;
        return formatRenderDate(item.date) === todayStr;
      });

      const groups: { [ref: string]: any[] } = {};
      todayCompanyEntries.forEach((item: any) => {
        const ref = item.referenceNumber || "AUTO";
        if (!groups[ref]) groups[ref] = [];
        groups[ref].push(item);
      });

      Object.keys(groups).forEach((ref) => {
        const entries = groups[ref];
        if (entries.length === 0) return;

        const firstEntry = entries[0];
        const text = firstEntry.expenseType || "";
        let customerName = "COMPANY CLIENT";
        if (text.toUpperCase().startsWith("TO ")) {
          customerName = text.substring(3).trim().toUpperCase();
        } else if (text.toUpperCase().startsWith("BY ")) {
          customerName = text.substring(3).trim().toUpperCase();
        }

        const items = entries.map((item: any) => {
          const parsed = parsePaymentModeDetails(item.paymentMode || "");
          const qty = parseFloat(parsed.qty) || 0;
          const rate = parseFloat(parsed.rate) || 0;
          const amount = qty > 0 && rate > 0 ? qty * rate : item.amount;
          const isDebit = (item.expenseType || "").toUpperCase().startsWith("TO ");
          return {
            id: item.id,
            material: parsed.material || "UNKNOWN",
            qty,
            unit: parsed.unit || "CFT",
            rate,
            amount,
            type: isDebit ? "TO" as const : "BY" as const
          };
        }).filter(item => item.material && (item.qty > 0 || item.amount > 0));

        const totalAmount = items.reduce((sum, item) => {
          return item.type === "BY" ? sum - item.amount : sum + item.amount;
        }, 0);

        list.push({
          type: "COMPANY" as const,
          challanNo: ref,
          date: firstEntry.date,
          customerName,
          siteId: firstEntry.siteId,
          items,
          totalAmount,
          createdAt: firstEntry.createdAt
        });
      });
    }

    // 2. Add today's local Direct Challans
    const todayDirects = localDirectChallans.filter((c: any) => {
      return formatRenderDate(c.date) === todayStr;
    });

    todayDirects.forEach((c: any) => {
      const totalAmount = c.items.reduce((sum: number, item: any) => {
        return item.type === "BY" ? sum - item.amount : sum + item.amount;
      }, 0);
      list.push({
        type: "DIRECT" as const,
        challanNo: c.challanNo,
        date: c.date,
        customerName: c.customerName,
        siteId: c.siteId || "",
        items: c.items.map((item: any) => ({
          id: item.id,
          material: item.material,
          qty: item.qty,
          unit: item.unit,
          rate: item.rate,
          amount: item.amount,
          type: item.type || "TO"
        })),
        totalAmount,
        createdAt: c.date
      });
    });

    // Sort sequentially by the sequence number in referenceNumber/challanNo
    const getSeqNum = (ref: string) => {
      if (!ref) return 0;
      const parts = ref.split("/");
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) return num;
      }
      return 0;
    };

    return list.sort((a, b) => {
      const seqA = getSeqNum(a.challanNo);
      const seqB = getSeqNum(b.challanNo);
      return seqB - seqA;
    });
  }, [allDaybookData, localDirectChallans, sidebarDate]);

  // Reset focus index when today's challans list changes
  useEffect(() => {
    setFocusedChallanIndex(0);
  }, [todayChallansList]);



  // Close autocomplete dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (siteSelectorRef.current && !siteSelectorRef.current.contains(event.target as Node)) {
        setIsSiteSuggestionsOpen(false);
      }
      if (ledgerSelectorRef.current && !ledgerSelectorRef.current.contains(event.target as Node)) {
        setIsLedgerSuggestionsOpen(false);
      }
      if (modalCustomerSelectorRef.current && !modalCustomerSelectorRef.current.contains(event.target as Node)) {
        setIsModalCustomerSuggestionsOpen(false);
      }
      if (modalSiteSelectorRef.current && !modalSiteSelectorRef.current.contains(event.target as Node)) {
        setIsModalSiteSuggestionsOpen(false);
      }
      if (addRowMaterialSelectorRef.current && !addRowMaterialSelectorRef.current.contains(event.target as Node)) {
        setIsAddRowMaterialSuggestionsOpen(false);
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

  // Autocomplete filter for modal sites suggestions list
  const filteredModalSites = (() => {
    if (!sites) return [];
    const isSearching = modalSiteSearchVal.trim() !== "";
    if (!isSearching) return sites;
    return sites.filter((site: any) => matchesFuzzy(site.name, modalSiteSearchVal));
  })();

  const selectModalSite = (site: any) => {
    setSelectedSiteId(site.id);
    setModalSiteSearchVal(site.name.toUpperCase());
    setIsModalSiteSuggestionsOpen(false);
    setHighlightedModalSiteIndex(-1);
    setSelectedCompanyChallanNo(null);

    // Reset customer details when site is selected inside the modal
    setDirectCustomer("");
    setDirectAddress("");
    setDirectMobile("");

    setTimeout(() => {
      directDateInputRef.current?.focus();
      directDateInputRef.current?.select();
    }, 100);
  };

  const handleModalSiteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isModalSiteSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsModalSiteSuggestionsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedModalSiteIndex((prev) => {
        const next = prev + 1;
        const index = next >= filteredModalSites.length ? filteredModalSites.length - 1 : next;
        setTimeout(() => {
          const el = document.getElementById(`modal-site-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);
        return index;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedModalSiteIndex((prev) => {
        const next = prev - 1;
        const index = next < 0 ? 0 : next;
        setTimeout(() => {
          const el = document.getElementById(`modal-site-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);
        return index;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let idx = highlightedModalSiteIndex;
      if (idx === -1 && filteredModalSites.length > 0) idx = 0;
      if (idx >= 0 && idx < filteredModalSites.length) {
        const site = filteredModalSites[idx];
        selectModalSite(site);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsModalSiteSuggestionsOpen(false);
      setHighlightedModalSiteIndex(-1);
    }
  };

  // Autocomplete filter for modal customer suggestions list
  const filteredModalCustomers = (() => {
    if (challanFormMode !== "COMPANY") return [];
    if (!directCustomer.trim()) return activeSiteCompanyLedgers;
    return activeSiteCompanyLedgers.filter((ledger) =>
      matchesFuzzy(ledger.name, directCustomer)
    );
  })();

  const selectModalCustomer = (ledger: any) => {
    setDirectCustomer(ledger.name.toUpperCase());

    const details = parsePartyDetails(ledger.contactPerson);
    if (details) {
      setDirectAddress(details.address || "");
      setDirectMobile(details.mobileNo || details.phoneNo || "");
    } else {
      setDirectAddress(ledger.contactPerson || "");
      setDirectMobile(ledger.phone || "");
    }

    setIsModalCustomerSuggestionsOpen(false);
    setHighlightedModalCustomerIndex(-1);

    setTimeout(() => {
      if (challanFormMode === "COMPANY") {
        const addrEl = document.getElementById("modal-address-input") as HTMLInputElement | null;
        if (addrEl) {
          addrEl.focus();
          addrEl.select();
        }
      } else {
        const matEl = document.getElementById("direct-material-input-0") as HTMLInputElement | null;
        if (matEl) {
          matEl.focus();
          matEl.select();
        }
      }
    }, 100);
  };

  const handleModalCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (challanFormMode !== "COMPANY") return;

    if (!isModalCustomerSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsModalCustomerSuggestionsOpen(true);
        e.preventDefault();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (challanFormMode === "COMPANY") {
          const addrEl = document.getElementById("modal-address-input") as HTMLInputElement | null;
          if (addrEl) {
            addrEl.focus();
            addrEl.select();
          }
        } else {
          const matEl = document.getElementById("direct-material-input-0") as HTMLInputElement | null;
          if (matEl) {
            matEl.focus();
            matEl.select();
          }
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedModalCustomerIndex((prev) => {
        const next = prev + 1;
        const index = next >= filteredModalCustomers.length ? filteredModalCustomers.length - 1 : next;
        setTimeout(() => {
          const el = document.getElementById(`modal-cust-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);
        return index;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedModalCustomerIndex((prev) => {
        const next = prev - 1;
        const index = next < 0 ? 0 : next;
        setTimeout(() => {
          const el = document.getElementById(`modal-cust-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);
        return index;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let idx = highlightedModalCustomerIndex;
      if (idx === -1 && filteredModalCustomers.length > 0) idx = 0;
      if (idx >= 0 && idx < filteredModalCustomers.length) {
        const ledger = filteredModalCustomers[idx];
        selectModalCustomer(ledger);
      } else {
        // Custom name entered - proceed to next field!
        setIsModalCustomerSuggestionsOpen(false);
        setHighlightedModalCustomerIndex(-1);
        setTimeout(() => {
          if (challanFormMode === "COMPANY") {
            const addrEl = document.getElementById("modal-address-input") as HTMLInputElement | null;
            if (addrEl) {
              addrEl.focus();
              addrEl.select();
            }
          } else {
            const matEl = document.getElementById("direct-material-input-0") as HTMLInputElement | null;
            if (matEl) {
              matEl.focus();
              matEl.select();
            }
          }
        }, 100);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsModalCustomerSuggestionsOpen(false);
      setHighlightedModalCustomerIndex(-1);
    }
  };

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
        setSelectedCompanyChallanNo(null);

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
        setSelectedCompanyChallanNo(null);
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
      const totalPaid = items.reduce((sum: number, item: any) => {
        return item.type === "BY" ? sum + item.amount : sum;
      }, 0);
      const totalDebit = items.reduce((sum: number, item: any) => {
        return item.type === "TO" ? sum + item.amount : sum;
      }, 0);
      const totalAmount = items.reduce((sum: number, item: any) => {
        return item.type === "BY" ? sum - item.amount : sum + item.amount;
      }, 0);
      return {
        items,
        totalQty,
        totalPaid,
        totalDebit,
        totalAmount,
        outstandingBalance: 0,
        challanNo: directChallan.challanNo
      };
    }

    if (!selectedSiteId || !selectedLedgerId || !siteDaybookData) {
      return { items: [], totalQty: 0, totalPaid: 0, totalDebit: 0, totalAmount: 0, outstandingBalance: 0, challanNo: "" };
    }

    const selectedLedgerObj = activeSiteCompanyLedgers.find((l) => String(l.id) === String(selectedLedgerId));
    if (!selectedLedgerObj) return { items: [], totalQty: 0, totalPaid: 0, totalDebit: 0, totalAmount: 0, outstandingBalance: 0, challanNo: "" };

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

    // Find the latest group by max createdAt timestamp or select selectedCompanyChallanNo if set
    let latestChallanNo = selectedCompanyChallanNo && groups[selectedCompanyChallanNo]
      ? selectedCompanyChallanNo
      : "";

    if (!latestChallanNo) {
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
    }

    // If no groups found, return empty
    if (!latestChallanNo) {
      return { items: [], totalQty: 0, totalPaid: 0, totalDebit: 0, totalAmount: 0, outstandingBalance: 0, challanNo: "" };
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
    let totalPaid = 0;
    let totalDebit = 0;
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
        if (isDebit) {
          totalAmount += calculatedAmount;
          totalDebit += calculatedAmount;
        } else {
          totalAmount -= calculatedAmount;
          totalPaid += calculatedAmount;
        }

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
      totalPaid,
      totalDebit,
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

  const supplierAddress = selectedLedgerObj
    ? (contactPersonDetails ? contactPersonDetails.address : (selectedLedgerObj.contactPerson || "NOT AVAILABLE"))
    : (directChallan ? (directChallan.address || "N/A") : "NOT AVAILABLE");

  const supplierPhone = selectedLedgerObj
    ? (contactPersonDetails ? (contactPersonDetails.mobileNo || contactPersonDetails.phoneNo) : (selectedLedgerObj.phone || "NOT AVAILABLE"))
    : (directChallan ? (directChallan.mobile || "N/A") : "NOT AVAILABLE");

  const selectedSiteObj = sites?.find((s: any) => s.id === selectedSiteId);

  // Generate stable deterministic Challan Serial Number based on latest challan batch No
  const challanSerial = directChallan ? directChallan.challanNo : (challanData.challanNo || "1001");

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
      queryClient.invalidateQueries({ queryKey: ["allDaybooks"] });
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
      queryClient.invalidateQueries({ queryKey: ["allDaybooks"] });
      toast.success("Challan item deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete item");
    }
  });

  const handleSaveRow = (id: string, material: string, qty: number, unit: string, rate: number, rawItem: any, itemType?: "TO" | "BY", newAmount?: number) => {
    if (!material.trim()) {
      toast.error("Material name is required");
      return;
    }

    const isCreditEntry = itemType === "BY" || (!itemType && rawItem && (rawItem.expenseType || "").toUpperCase().startsWith("BY "));
    const isDirectCredit = directChallan && (!itemType ? directChallan.items.find(it => it.id === id)?.type === "BY" : itemType === "BY");

    if (!(isCreditEntry || isDirectCredit)) {
      if (qty <= 0) {
        toast.error("Quantity must be greater than zero");
        return;
      }
      if (rate <= 0) {
        toast.error("Rate must be greater than zero");
        return;
      }
    }

    if (directChallan) {
      setDirectChallan((prev) => {
        if (!prev) return null;
        const updatedItems = prev.items.map((item) => {
          if (item.id === id) {
            const isItemCredit = itemType === "BY" || item.type === "BY";
            return {
              ...item,
              material: material.trim().toUpperCase(),
              qty: qty,
              unit: unit.trim().toUpperCase(),
              rate: rate,
              amount: newAmount !== undefined ? newAmount : (isItemCredit ? (qty > 0 && rate > 0 ? qty * rate : item.amount) : qty * rate),
              type: itemType || item.type
            };
          }
          return item;
        });
        const updatedChallan = {
          ...prev,
          items: updatedItems
        };
        setLocalDirectChallans((prevList) => {
          const updated = prevList.map(c => c.challanNo === prev.challanNo ? updatedChallan : c);
          if (typeof window !== "undefined") {
            localStorage.setItem("today_direct_challans", JSON.stringify(updated));
          }
          return updated;
        });
        return updatedChallan;
      });
      toast.success("Direct challan item updated successfully");
      return;
    }

    let originalParsedDetails: any = {};
    if (rawItem.paymentMode && rawItem.paymentMode.trim().startsWith("{") && rawItem.paymentMode.trim().endsWith("}")) {
      try {
        originalParsedDetails = JSON.parse(rawItem.paymentMode);
      } catch { }
    }

    const updatedPaymentMode = JSON.stringify({
      ...originalParsedDetails,
      material: material.trim().toUpperCase(),
      qty: qty,
      unit: unit.trim().toUpperCase(),
      rate: rate,
      crDr: itemType === "TO" ? "DR" : (itemType === "BY" ? "CR" : (originalParsedDetails.crDr || "DR"))
    });

    const calculatedAmount = newAmount !== undefined ? newAmount : ((isCreditEntry || isDirectCredit) ? (qty > 0 && rate > 0 ? qty * rate : (rawItem?.amount || qty * rate)) : qty * rate);

    let updatedExpenseType = rawItem.expenseType;
    if (itemType) {
      let ledgerName = rawItem.expenseType || "";
      if (ledgerName.toUpperCase().startsWith("TO ")) {
        ledgerName = ledgerName.substring(3).trim();
      } else if (ledgerName.toUpperCase().startsWith("BY ")) {
        ledgerName = ledgerName.substring(3).trim();
      }
      updatedExpenseType = itemType === "TO" ? `To ${ledgerName}` : `By ${ledgerName}`;
    }

    const payload = {
      siteId: rawItem.siteId,
      date: rawItem.date,
      expenseType: updatedExpenseType,
      amount: calculatedAmount,
      paymentMode: updatedPaymentMode,
      description: rawItem.description,
      referenceNumber: rawItem.referenceNumber
    };

    updateMutation.mutate({ id, payload });
  };

  const handleDeleteRow = (id: string) => {
    if (window.confirm("Are you sure you want to delete this item from the challan?")) {
      if (directChallan) {
        setDirectChallan((prev) => {
          if (!prev) return null;
          const remainingItems = prev.items.filter((item) => item.id !== id);
          if (remainingItems.length === 0) {
            setLocalDirectChallans((prevList) => {
              const updated = prevList.filter(c => c.challanNo !== prev.challanNo);
              if (typeof window !== "undefined") {
                localStorage.setItem("today_direct_challans", JSON.stringify(updated));
              }
              return updated;
            });
            return null; // close preview panel if no items left
          }
          const updatedChallan = {
            ...prev,
            items: remainingItems
          };
          setLocalDirectChallans((prevList) => {
            const updated = prevList.map(c => c.challanNo === prev.challanNo ? updatedChallan : c);
            if (typeof window !== "undefined") {
              localStorage.setItem("today_direct_challans", JSON.stringify(updated));
            }
            return updated;
          });
          return updatedChallan;
        });
        toast.success("Direct challan item deleted successfully");
        return;
      }
      deleteMutation.mutate(id);
    }
  };

  const handleAddNewRow = async () => {
    if (directChallan) {
      const newItem = {
        id: `direct-item-${Date.now()}-${Math.random()}`,
        date: directChallan.date,
        type: "TO" as const,
        material: "NEW MATERIAL",
        qty: 0,
        unit: "CFT",
        rate: 0,
        amount: 0,
        particulars: "DIRECT SALE / CASH",
        reference: "DIRECT_CHALLAN"
      };
      const updatedChallan = {
        ...directChallan,
        items: [...directChallan.items, newItem]
      };
      setDirectChallan(updatedChallan);
      setLocalDirectChallans((prevList) => {
        const updated = prevList.map(c => c.challanNo === directChallan.challanNo ? updatedChallan : c);
        if (typeof window !== "undefined") {
          localStorage.setItem("today_direct_challans", JSON.stringify(updated));
        }
        return updated;
      });
      toast.success("New item added to direct challan");
      return;
    }

    if (!selectedSiteId || !selectedLedgerId || !challanData.items.length) {
      toast.error("No active company challan selected to add item to");
      return;
    }

    const firstItem = challanData.items[0];
    const rawItem = firstItem.rawItem;

    const serializedPaymentMode = JSON.stringify({
      type: "CompanyTransaction",
      address: supplierAddress.trim().toUpperCase() || "N/A",
      mobile: supplierPhone.trim() || "N/A",
      material: "NEW MATERIAL",
      qty: 0,
      unit: "CFT",
      crDr: "DR",
      rate: 0
    });

    const daybookPayload = {
      siteId: selectedSiteId,
      date: rawItem.date,
      expenseType: rawItem.expenseType,
      amount: 0,
      paymentMode: serializedPaymentMode,
      description: "COMPANY_LEDGER_ENTRY",
      referenceNumber: rawItem.referenceNumber,
    };

    try {
      await api.post("/daybooks", daybookPayload);
      queryClient.invalidateQueries({ queryKey: ["daybooks", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["ledgers", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      toast.success("New item added to challan successfully");
    } catch (err) {
      toast.error("Failed to add new item to challan");
    }
  };

  const openCreditPopup = () => {
    setCreditDate(getTodayDateStr());
    setCreditParticulars("CREDIT AMOUNT");
    setCreditAmount("");
    setIsSavingCredit(false);
    setShowCreditPopup(true);
    setTimeout(() => {
      const el = document.getElementById("credit-date-input") as HTMLInputElement | null;
      if (el) { el.focus(); el.select(); }
    }, 50);
  };

  const handleSaveCreditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCredit) return;

    const amt = parseFloat(creditAmount) || 0;
    if (amt <= 0) {
      toast.error("Credit amount must be greater than zero");
      return;
    }
    if (!creditDate.trim()) {
      toast.error("Credit date is required");
      return;
    }

    let parsedDate = new Date();
    try {
      parsedDate = parseInputDate(creditDate);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date();
      }
    } catch {
      toast.error("Invalid Date format. Use DD.MM.YY");
      return;
    }

    setIsSavingCredit(true);

    if (directChallan) {
      const newItem = {
        id: `direct-item-${Date.now()}-${Math.random()}`,
        date: parsedDate.toISOString(),
        type: "BY" as const,
        material: creditParticulars.trim().toUpperCase() || "CREDIT AMOUNT",
        qty: 0,
        unit: "BAGS",
        rate: 0,
        amount: amt,
        particulars: "CREDIT ENTRY",
        reference: directChallan.challanNo
      };
      const updatedChallan = {
        ...directChallan,
        items: [...directChallan.items, newItem]
      };
      setDirectChallan(updatedChallan);
      setLocalDirectChallans((prevList) => {
        const updated = prevList.map(c => c.challanNo === directChallan.challanNo ? updatedChallan : c);
        if (typeof window !== "undefined") {
          localStorage.setItem("today_direct_challans", JSON.stringify(updated));
        }
        return updated;
      });
      setShowCreditPopup(false);
      setIsSavingCredit(false);
      toast.success("Credit entry added to direct challan");
      return;
    }

    if (!selectedSiteId || !selectedLedgerObj) {
      toast.error("No active site or company ledger selected");
      setIsSavingCredit(false);
      return;
    }

    const cleanCustomerName = selectedLedgerObj.name.toUpperCase();
    const serializedPaymentMode = JSON.stringify({
      type: "CompanyTransaction",
      address: supplierAddress.trim().toUpperCase() || "N/A",
      mobile: supplierPhone.trim() || "N/A",
      material: creditParticulars.trim().toUpperCase() || "CREDIT AMOUNT",
      qty: 0,
      unit: "BAGS",
      crDr: "CR",
      rate: 0
    });

    const daybookPayload = {
      siteId: selectedSiteId,
      date: parsedDate.toISOString(),
      expenseType: `By ${cleanCustomerName}`,
      amount: amt,
      paymentMode: serializedPaymentMode,
      description: "COMPANY_LEDGER_ENTRY",
      referenceNumber: challanSerial,
    };

    try {
      await api.post("/daybooks", daybookPayload);
      queryClient.invalidateQueries({ queryKey: ["daybooks", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["ledgers", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allDaybooks"] });
      setShowCreditPopup(false);
      toast.success("Credit entry added successfully");
    } catch (err) {
      toast.error("Failed to save credit entry");
    } finally {
      setIsSavingCredit(false);
    }
  };

  const openAddRowPopup = () => {
    setAddRowMaterial("");
    setAddRowQty("");
    setAddRowUnit("CFT");
    setAddRowRate("");
    setShowAddRowPopup(true);
    setTimeout(() => {
      const el = document.getElementById("add-row-material-input") as HTMLInputElement | null;
      if (el) { el.focus(); el.select(); }
    }, 50);
  };

  const handleSaveNewRow = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyVal = parseFloat(addRowQty) || 0;
    const rateVal = parseFloat(addRowRate) || 0;
    const amtVal = qtyVal * rateVal;

    if (!addRowMaterial.trim()) {
      toast.error("Material name is required");
      return;
    }
    if (qtyVal <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    if (rateVal <= 0) {
      toast.error("Rate must be greater than zero");
      return;
    }

    if (directChallan) {
      const newItem = {
        id: `direct-item-${Date.now()}-${Math.random()}`,
        date: directChallan.date,
        type: "TO" as const,
        material: addRowMaterial.trim().toUpperCase(),
        qty: qtyVal,
        unit: addRowUnit.trim().toUpperCase() || "CFT",
        rate: rateVal,
        amount: amtVal,
        particulars: "DIRECT SALE / CASH",
        reference: "DIRECT_CHALLAN"
      };
      const updatedChallan = {
        ...directChallan,
        items: [...directChallan.items, newItem]
      };
      setDirectChallan(updatedChallan);
      setLocalDirectChallans((prevList) => {
        const updated = prevList.map(c => c.challanNo === directChallan.challanNo ? updatedChallan : c);
        if (typeof window !== "undefined") {
          localStorage.setItem("today_direct_challans", JSON.stringify(updated));
        }
        return updated;
      });
      setShowAddRowPopup(false);
      toast.success("New item added to direct challan");
      return;
    }

    if (!selectedSiteId || !selectedLedgerId || !challanData.items.length) {
      toast.error("No active company challan selected to add item to");
      return;
    }

    const firstItem = challanData.items[0];
    const rawItem = firstItem.rawItem;

    const serializedPaymentMode = JSON.stringify({
      type: "CompanyTransaction",
      address: supplierAddress.trim().toUpperCase() || "N/A",
      mobile: supplierPhone.trim() || "N/A",
      material: addRowMaterial.trim().toUpperCase(),
      qty: qtyVal,
      unit: addRowUnit.trim().toUpperCase() || "CFT",
      crDr: "DR",
      rate: rateVal
    });

    const daybookPayload = {
      siteId: selectedSiteId,
      date: rawItem.date,
      expenseType: rawItem.expenseType,
      amount: amtVal,
      paymentMode: serializedPaymentMode,
      description: "COMPANY_LEDGER_ENTRY",
      referenceNumber: rawItem.referenceNumber,
    };

    try {
      await api.post("/daybooks", daybookPayload);
      queryClient.invalidateQueries({ queryKey: ["daybooks", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["ledgers", selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allDaybooks"] });
      setShowAddRowPopup(false);
      toast.success("New item added to challan successfully");
    } catch (err) {
      toast.error("Failed to add new item to challan");
    }
  };

  const handleAddRowMaterialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, suggestions: any[]) => {
    if (!isAddRowMaterialSuggestionsOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsAddRowMaterialSuggestionsOpen(true);
        e.preventDefault();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowAddRowPopup(false);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = highlightedAddRowMaterialIndex + 1;
      const index = next >= suggestions.length ? suggestions.length - 1 : next;
      setHighlightedAddRowMaterialIndex(index);
      setTimeout(() => {
        const el = document.getElementById(`add-row-mat-opt-${index}`);
        if (el) el.scrollIntoView({ block: "nearest" });
      }, 10);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = highlightedAddRowMaterialIndex - 1;
      const index = next < 0 ? 0 : next;
      setHighlightedAddRowMaterialIndex(index);
      setTimeout(() => {
        const el = document.getElementById(`add-row-mat-opt-${index}`);
        if (el) el.scrollIntoView({ block: "nearest" });
      }, 10);
    } else if (e.key === "Enter") {
      e.preventDefault();
      let sIdx = highlightedAddRowMaterialIndex;
      if (sIdx === -1 && suggestions.length > 0) {
        sIdx = 0;
      }
      if (sIdx >= 0 && sIdx < suggestions.length) {
        const mat = suggestions[sIdx];
        setAddRowMaterial(mat.name.toUpperCase());
        setAddRowUnit(mat.unit?.toUpperCase() || "CFT");
        if (mat.rate !== undefined && mat.rate !== null && mat.rate !== 0) {
          setAddRowRate(String(mat.rate));
        }
        setIsAddRowMaterialSuggestionsOpen(false);
        setHighlightedAddRowMaterialIndex(-1);
      } else {
        setIsAddRowMaterialSuggestionsOpen(false);
        setHighlightedAddRowMaterialIndex(-1);
      }
      setTimeout(() => {
        const qtyEl = document.getElementById("add-row-qty-input") as HTMLInputElement | null;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        }
      }, 50);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsAddRowMaterialSuggestionsOpen(false);
      setHighlightedAddRowMaterialIndex(-1);
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
      // F2 and F4 switch modes / open modal (work even when inputs are focused)
      if (e.key === "F2") {
        e.preventDefault();
        openDirectChallanModal("COMPANY");
        setShowDirectChallanModal(true);
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        openDirectChallanModal("DIRECT");
        setShowDirectChallanModal(true);
        return;
      }
      // F6 opens the Add Credit popup directly (works even when inputs are focused)
      if (e.key === "F6") {
        e.preventDefault();
        if (challanData && challanData.items && challanData.items.length > 0) {
          openCreditPopup();
        } else {
          toast.error("Please load a challan first to add a credit entry");
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.hasAttribute("contenteditable")
      );

      // 0. If modal is open and F1 is pressed, trigger the submit button
      if (showDirectChallanModal && e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        const submitBtn = document.getElementById("modal-submit-btn") as HTMLButtonElement | null;
        if (submitBtn) {
          submitBtn.click();
        }
        return;
      }

      if (showCreditPopup && e.key === "Escape") {
        e.preventDefault();
        setShowCreditPopup(false);
        return;
      }

      if (showAddRowPopup && e.key === "Escape") {
        e.preventDefault();
        setShowAddRowPopup(false);
        return;
      }

      if (!showDirectChallanModal && !showCreditPopup && !showAddRowPopup && (e.key === "n" || e.key === "N") && !isInputFocused) {
        e.preventDefault();
        if (challanData && challanData.items && challanData.items.length > 0) {
          openAddRowPopup();
        } else {
          toast.error("Please load a challan first to add a row");
        }
        return;
      }

      // 1. If modal is open and Escape is pressed, check if any suggestions dropdown is open
      if (showDirectChallanModal && e.key === "Escape") {
        if (activeEl && (
          activeEl.id.startsWith("direct-qty-input-") ||
          activeEl.id.startsWith("direct-unit-input-") ||
          activeEl.id.startsWith("direct-rate-input-")
        )) {
          return;
        }

        const anyDropdownOpen = directItems.some(item => item.isMaterialSuggestionsOpen);
        if (anyDropdownOpen) {
          return;
        }
        e.preventDefault();
        setShowDirectChallanModal(false);
        return;
      }

      // 2. If modal is closed and 'd' or 'D' is pressed, open the modal immediately in DIRECT mode
      if (!showDirectChallanModal && (e.key === "d" || e.key === "D") && !isInputFocused) {
        e.preventDefault();
        openDirectChallanModal("DIRECT");
        return;
      }

      // 3. If modal is closed and 'c' or 'C' is pressed, open the modal in COMPANY mode
      if (!showDirectChallanModal && (e.key === "c" || e.key === "C") && !isInputFocused) {
        e.preventDefault();
        openDirectChallanModal("COMPANY");
        return;
      }

      // If modal is open and 'n' or 'N' is pressed when no input is focused, add a new row!
      if (showDirectChallanModal && (e.key === "n" || e.key === "N") && !isInputFocused) {
        e.preventDefault();
        handleAddDirectItem();
        return;
      }

      if (isInputFocused) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedChallanIndex((prev) => {
          const next = prev + 1;
          if (next < todayChallansList.length) {
            setTimeout(() => {
              const el = document.getElementById(`sidebar-challan-row-${next}`);
              if (el) el.scrollIntoView({ block: "nearest" });
            }, 10);
            return next;
          }
          return prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedChallanIndex((prev) => {
          const next = prev - 1;
          if (next >= 0) {
            setTimeout(() => {
              const el = document.getElementById(`sidebar-challan-row-${next}`);
              if (el) el.scrollIntoView({ block: "nearest" });
            }, 10);
            return next;
          }
          return prev;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (todayChallansList.length > 0 && focusedChallanIndex >= 0 && focusedChallanIndex < todayChallansList.length) {
          const targetCh = todayChallansList[focusedChallanIndex];
          if (targetCh.type === "DIRECT") {
            loadDirectChallan(targetCh);
          } else {
            loadCompanyChallan(targetCh.siteId, targetCh.customerName, targetCh.challanNo);
          }
        }
      }

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
  }, [challanData, selectedLedgerObj, challanSerial, selectedSiteId, showDirectChallanModal, handleAddDirectItem, directItems, todayChallansList, directChallan, focusedChallanIndex]);

  const renderItemRow = (item: any, displayIndex: number) => {
    const isCredit = item.type === "BY";
    const cellPadding = isCredit ? "py-1.5 px-3" : "py-1 px-2";
    const cellBorder = isCredit ? "border-r border-slate-800" : "border-r border-slate-300";
    return (
      <tr
        key={item.id}
        className={isCredit
          ? "bg-slate-100 border-t-2 border-b-2 border-slate-800 font-black text-slate-955 text-[11px] uppercase group/row"
          : "hover:bg-slate-50 uppercase text-slate-900 group/row"
        }
      >
        <td className={`${cellPadding} ${cellBorder} text-center text-slate-700 relative w-12 shrink-0`}>
          <span className="group-hover/row:hidden">{displayIndex}</span>
          <button
            type="button"
            onClick={() => handleDeleteRow(item.id)}
            className="hidden group-hover/row:block absolute inset-0 m-auto text-red-655 font-black hover:text-red-700 text-sm no-print"
            title="Delete Row"
          >
            ×
          </button>
        </td>
        <td className={`${cellPadding} ${cellBorder} text-slate-955 font-extrabold`}>
          <EditableCell
            value={item.material}
            displayValue={translateBilingual(item.material)}
            onSave={(newVal) => handleSaveRow(item.id, newVal, item.qty, item.unit, item.rate, item.rawItem)}
          />
        </td>
        <td className={`${cellPadding} ${cellBorder} text-right font-mono text-slate-955 w-24`}>
          <EditableCell
            value={item.qty}
            type="number"
            className="text-right font-mono"
            onSave={(newVal) => handleSaveRow(item.id, item.material, parseFloat(newVal) || 0, item.unit, item.rate, item.rawItem)}
          />
        </td>
        <td className={`${cellPadding} ${cellBorder} text-center font-bold text-slate-500 w-20`}>
          {isCredit ? (
            "-"
          ) : (
            <EditableCell
              value={item.unit}
              className="text-center"
              onSave={(newVal) => handleSaveRow(item.id, item.material, item.qty, newVal, item.rate, item.rawItem)}
            />
          )}
        </td>
        <td className={`${cellPadding} ${cellBorder} w-20 ${isCredit ? "text-center font-bold text-slate-500" : "text-right font-mono text-slate-655"}`}>
          {isCredit ? (
            "RECEIVED"
          ) : (
            <EditableCell
              value={item.rate}
              type="number"
              className="text-right font-mono"
              onSave={(newVal) => handleSaveRow(item.id, item.material, item.qty, item.unit, parseFloat(newVal) || 0, item.rawItem)}
            />
          )}
        </td>
        <td className={`${cellPadding} text-right font-mono text-slate-955 w-36`}>
          <div className="flex items-center justify-end gap-1.5 h-full">
            {item.qty === 0 && item.rate === 0 ? (
              <EditableCell
                value={item.amount}
                displayValue={item.amount.toFixed(2)}
                type="number"
                className="text-right font-mono"
                onSave={(newVal) => {
                  const parsedAmt = parseFloat(newVal) || 0;
                  handleSaveRow(item.id, item.material, item.qty, item.unit, item.rate, item.rawItem, item.type, parsedAmt);
                }}
              />
            ) : (
              <span>{item.amount > 0 ? item.amount.toFixed(2) : "-"}</span>
            )}
            {item.amount > 0 && (
              <span className={`ml-1 text-[11px] font-bold ${item.type === "TO" ? "text-red-750" : "text-emerald-750"}`}>
                {item.type === "TO" ? "DR" : "CR"}
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="font-mono text-slate-800 max-w-[96%] sm:max-w-[98%] mx-auto space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Selectors, Preview and Editor Panels) */}
        <div className="lg:col-span-9 space-y-4">
          {/* Search Filter Widgets Bar */}
          <div className="bg-[#E5ECF4] border-2 border-slate-800 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 print:hidden select-none">
            <div className="flex items-center justify-between border-b-2 border-slate-350 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-700" />
                <span className="font-bold text-xs uppercase text-slate-700">CHALLAN SELECTOR SYSTEM</span>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => openDirectChallanModal("DIRECT")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 font-extrabold text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none"
                >
                  Direct Challan / डायरेक्ट चालान (D)
                </button>
                <button
                  type="button"
                  onClick={() => openDirectChallanModal("COMPANY")}
                  className="px-3 py-1.5 bg-[#2B547E] hover:bg-[#1E3E64] text-white border-2 border-slate-900 font-extrabold text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none"
                >
                  Company Ledger Challan / कंपनी लेजर चालान (C)
                </button>
              </div>
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
                    translate="no"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
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
                      setSelectedCompanyChallanNo(null);
                    }}
                    onFocus={() => {
                      setIsSiteFocused(true);
                      setIsSiteSuggestionsOpen(true);
                    }}
                    onBlur={() => setIsSiteFocused(false)}
                    onKeyDown={handleSiteKeyDown}
                    placeholder="TYPE SITE NAME OR ARROW DOWN..."
                    className="w-full px-3 py-2 text-xs uppercase border-none focus:outline-none placeholder-slate-400 font-bold bg-transparent notranslate"
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
                            setSelectedCompanyChallanNo(null);

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
                          <span className="pointer-events-none select-none notranslate" translate="no">
                            {site.name.toUpperCase()}
                          </span>
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
                    translate="no"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
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
                      setSelectedCompanyChallanNo(null);
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
                    className="w-full px-3 py-2 text-xs uppercase border-none focus:outline-none placeholder-slate-400 font-bold bg-transparent disabled:cursor-not-allowed notranslate"
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
                  <div translate="no" className="absolute left-0 right-0 mt-1 bg-white border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-50 max-h-[350px] overflow-y-auto notranslate">
                    {filteredLedgers.map((ledger: any, idx: number) => {
                      const isHighlighted = idx === highlightedLedgerIndex;
                      const isSelected = ledger.id === selectedLedgerId;

                      return (
                        <button
                          key={ledger.id}
                          id={`acct-opt-${idx}`}
                          translate="no"
                          onClick={() => {
                            setSelectedLedgerId(ledger.id);
                            setLedgerSearchVal(ledger.name.toUpperCase());
                            setIsLedgerSuggestionsOpen(false);
                            setHighlightedLedgerIndex(-1);
                            if (directChallan) {
                              setDirectChallan(null);
                            }
                            setSelectedCompanyChallanNo(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-slate-100 last:border-0 notranslate ${isHighlighted
                            ? "bg-amber-400 text-slate-955 font-black"
                            : isSelected
                              ? "bg-amber-100 text-amber-900"
                              : "hover:bg-slate-100 text-slate-700"
                            }`}
                        >
                          <span className="truncate block py-0.5 pointer-events-none select-none notranslate" translate="no">{ledger.name.toUpperCase()} {ledger.isVirtual ? "(VIRTUAL)" : ""}</span>
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
              <div
                className="print-container bg-white border-2 border-slate-850 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden print:border-2 print:border-black print:shadow-none animate-in fade-in zoom-in-95 duration-200"
                style={{ zoom: 0.8 }}
              >

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
                  zoom: 1 !important;
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
                <div className="p-4 bg-white print:p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:block print:space-y-0">

                    {/* COPY 1: WITHOUT RATE & AMOUNT */}
                    <div className={`space-y-4 ${printCopy === "copy2" ? "print:hidden" : ""}`}>
                      <div className="text-center border-b-2 border-slate-800 pb-2">
                        <h1 className="text-xl font-black tracking-widest text-slate-955 uppercase estimate-title">ESTIMATE</h1>
                      </div>

                      <div className="border border-slate-850 p-3 bg-slate-50/50">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-bold font-mono">
                          <div className="sm:col-span-2 space-y-1">
                            <span className="text-slate-955 font-black uppercase text-xs block supplier-name">{translateBilingual(selectedLedgerObj?.name || directChallan?.customerName || "")}</span>
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
                                  <tr key={item.id} className="hover:bg-slate-50 uppercase text-slate-900 group/row">
                                    <td className="py-1 px-2 border-r border-slate-300 text-center text-slate-700 relative w-12 shrink-0">
                                      <span className="group-hover/row:hidden">{idx + 1}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRow(item.id)}
                                        className="hidden group-hover/row:block absolute inset-0 m-auto text-red-655 font-black hover:text-red-700 text-sm no-print"
                                        title="Delete Row"
                                      >
                                        ×
                                      </button>
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 text-slate-955 font-extrabold">
                                      <EditableCell
                                        value={item.material}
                                        displayValue={translateBilingual(item.material)}
                                        onSave={(newVal) => handleSaveRow(item.id, newVal, item.qty, item.unit, item.rate, item.rawItem)}
                                      />
                                    </td>
                                    <td className="py-1 px-2 border-r border-slate-300 text-right font-mono text-slate-955 w-24">
                                      <EditableCell
                                        value={item.qty}
                                        type="number"
                                        className="text-right font-mono"
                                        onSave={(newVal) => handleSaveRow(item.id, item.material, parseFloat(newVal) || 0, item.unit, item.rate, item.rawItem)}
                                      />
                                    </td>
                                    <td className="py-1 px-2 text-center font-bold text-slate-500 w-20">
                                      <EditableCell
                                        value={item.unit}
                                        className="text-center"
                                        onSave={(newVal) => handleSaveRow(item.id, item.material, item.qty, newVal, item.rate, item.rawItem)}
                                      />
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr><td colSpan={4} className="py-8 text-center text-slate-400 font-bold uppercase tracking-widest">NO MATERIALS FOUND</td></tr>
                              )}
                            </tbody>

                          </table>
                        </div>
                      </div>

                      {/* COPY 1 Action buttons bar (directly below copy 1 content) */}
                      <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-4 items-center justify-between no-print select-none">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Shortcut keys: 1 PRINT ESTIMATE | F3 EXCEL | N ADD ROW</div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={openAddRowPopup}
                            className="px-4 py-2 bg-blue-750 bg-blue-700 text-white border-2 border-blue-955 font-bold text-xs uppercase hover:bg-blue-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer rounded"
                          >
                            <span>+ Add Row / नया आइटम (N)</span>
                          </button>
                          <button type="button" onClick={handlePrintWithoutRate} className="px-4 py-2 bg-slate-900 text-white border-2 border-slate-955 font-bold text-xs uppercase hover:bg-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer">
                            <Printer className="h-4 w-4" /> <span>[1] PRINT ESTIMATE</span>
                          </button>
                          <button type="button" onClick={handleExportExcel} className="px-4 py-2 bg-emerald-700 text-white border-2 border-emerald-950 font-bold text-xs uppercase hover:bg-emerald-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer">
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
                            <span className="text-slate-955 font-black uppercase text-xs block supplier-name">{translateBilingual(selectedLedgerObj?.name || directChallan?.customerName || "")}</span>
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
                                <th className="py-1.5 px-3 text-right w-36">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300 font-black text-[12px]">
                              {challanData.items.length > 0 ? (
                                (() => {
                                  const debitItems = challanData.items.filter((item: any) => item.type === "TO");
                                  const creditItems = challanData.items.filter((item: any) => item.type === "BY");
                                  return (
                                    <>
                                      {debitItems.map((item: any, idx: number) => renderItemRow(item, idx + 1))}

                                      <tr className="bg-slate-100 border-t-2 border-b-2 border-slate-800 font-black text-slate-955 text-[11px]">
                                        <td colSpan={4} className="py-1.5 px-3 border-r border-slate-800"></td>
                                        <td className="py-1.5 px-3 border-r border-slate-800 text-right total-label">TOTAL:</td>
                                        <td className="py-1.5 px-3 text-right text-amber-900 font-black font-mono total-value">{challanData.totalDebit.toFixed(2)} DR</td>
                                      </tr>

                                      {creditItems.map((item: any, idx: number) => renderItemRow(item, debitItems.length + idx + 1))}
                                    </>
                                  );
                                })()
                              ) : (
                                <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-bold uppercase tracking-widest">NO MATERIALS FOUND</td></tr>
                              )}
                            </tbody>
                            {challanData.items.length > 0 && (
                              <tfoot>
                                {/* Row 2: TOTAL REMAIN */}
                                <tr className="bg-slate-100 border-t-2 border-b-2 border-slate-800 font-black text-slate-955 text-[11px]">
                                  <td colSpan={4} className="py-1.5 px-3 border-r border-slate-800"></td>
                                  <td className="py-1.5 px-3 border-r border-slate-800 text-right total-label text-amber-900">BALANCE:</td>
                                  <td className="py-1.5 px-3 text-right text-amber-900 font-black font-mono total-value">
                                    {challanData.totalAmount < 0
                                      ? `${Math.abs(challanData.totalAmount).toFixed(2)} CR`
                                      : `${challanData.totalAmount.toFixed(2)} DR`
                                    }
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>

                      {/* COPY 2 Action buttons bar (directly below copy 2 content) */}
                      <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-4 items-center justify-between no-print select-none">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Shortcut keys: 2 PRINT WITH RATE | F6 ADD CREDIT</div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={openCreditPopup}
                            className="px-4 py-2 bg-emerald-700 text-white border-2 border-emerald-950 font-bold text-xs uppercase hover:bg-emerald-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer rounded"
                          >
                            <span>Add Credit / क्रेडिट जोड़ें (F6)</span>
                          </button>
                          <button type="button" onClick={handlePrintWithRate} className="px-4 py-2 bg-[#2B547E] text-white border-2 border-slate-955 font-bold text-xs uppercase hover:bg-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2">
                            <Printer className="h-4 w-4" /> <span>[2] PRINT WITH RATE</span>
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>


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
        </div>

        {/* Right Column: Today's Challans Sidebar Table */}
        <div className="bg-[#E5ECF4] border-2 border-slate-800 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3 print:hidden select-none lg:col-span-3 rounded">
          <div className="flex items-center justify-between border-b-2 border-slate-350 pb-2 mb-2 bg-[#2B547E] text-white p-2 px-2.5 rounded">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="font-bold text-xs uppercase tracking-wider">CHALLANS ({todayChallansList.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black text-slate-200">DATE:</span>
              <input
                type="text"
                value={sidebarDate}
                onChange={(e) => setSidebarDate(e.target.value)}
                placeholder="DD.MM.YY"
                className="bg-white text-slate-900 border border-slate-900 text-[10px] font-mono font-bold px-1.5 py-0.5 w-20 rounded text-center focus:outline-none focus:ring-1 focus:ring-amber-400 uppercase"
              />
            </div>
          </div>

          {todayChallansList.length > 0 ? (
            <div className="overflow-x-auto border-2 border-slate-800 bg-white max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-800 uppercase font-black text-slate-800 text-[10px]">
                    <th className="py-1.5 px-2 border-r border-slate-800 text-center w-24">No.</th>
                    <th className="py-1.5 px-2 text-left">Party Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-bold text-[11px]">
                  {todayChallansList.map((ch, idx) => {
                    const isSelected = directChallan
                      ? (ch.type === "DIRECT" && ch.challanNo === directChallan.challanNo)
                      : (ch.type === "COMPANY" && ch.challanNo === challanData.challanNo && ch.siteId === selectedSiteId);

                    const isFocused = idx === focusedChallanIndex;

                    return (
                      <tr
                        key={`${ch.type}-${ch.challanNo}`}
                        id={`sidebar-challan-row-${idx}`}
                        onClick={() => {
                          setFocusedChallanIndex(idx);
                          if (ch.type === "DIRECT") {
                            loadDirectChallan(ch);
                          } else {
                            loadCompanyChallan(ch.siteId, ch.customerName, ch.challanNo);
                          }
                        }}
                        className={`group cursor-pointer uppercase border-b border-slate-200 last:border-0 hover:bg-[#ECC30B]/20 transition-colors ${isFocused
                          ? "bg-[#ECC30B] hover:bg-[#ECC30B] text-slate-955 border-l-4 border-l-slate-955 font-black font-mono"
                          : isSelected
                            ? "bg-slate-100/80 text-slate-900 border-l-4 border-l-slate-400 font-bold"
                            : "text-slate-800"
                          }`}
                      >
                        <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-950 font-black font-mono text-[10px] tracking-tighter">
                          {ch.challanNo}
                        </td>
                        <td className="py-1.5 px-2 font-black text-slate-950 flex items-center justify-between min-w-0" title={ch.customerName}>
                          <span className="truncate">{ch.customerName}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                            {ch.type === "DIRECT" && (
                              <span className="text-[8px] bg-emerald-600 text-white px-1 py-0.5 rounded font-extrabold shrink-0">
                                DIRECT
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteWholeChallan(ch, e)}
                              className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 p-0.5 rounded transition-all duration-150 cursor-pointer flex items-center justify-center"
                              title="Delete Challan"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-dashed border-slate-400 p-8 text-center text-slate-500 text-xs font-bold uppercase rounded bg-white">
              No Challans Found for Date
            </div>
          )}
        </div>
      </div>

      {/* Direct Challan Modal */}
      {showDirectChallanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#D3DFEE] border-2 border-slate-955 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden w-[840px] max-w-[95vw] font-mono flex flex-col select-none">
            {/* Title Bar / Mode Switcher */}
            <div className={`border-b-2 border-slate-950 p-1 flex items-center justify-between text-white shrink-0 ${challanFormMode === "COMPANY" ? "bg-[#2B547E]" : "bg-emerald-700"}`}>
              <div className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => openDirectChallanModal("COMPANY")}
                  className={`px-3 py-1.5 border border-slate-950 rounded transition-all cursor-pointer font-extrabold ${challanFormMode === "COMPANY" ? "bg-white text-[#2B547E] shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]" : "bg-transparent text-slate-200 border-transparent hover:text-white hover:border-slate-300"}`}
                >
                  Company Ledger [F2] / कंपनी लेजर
                </button>
                <button
                  type="button"
                  onClick={() => openDirectChallanModal("DIRECT")}
                  className={`px-3 py-1.5 border border-slate-950 rounded transition-all cursor-pointer font-extrabold ${challanFormMode === "DIRECT" ? "bg-white text-emerald-700 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]" : "bg-transparent text-slate-200 border-transparent hover:text-white hover:border-slate-300"}`}
                >
                  Direct Challan [F4] / डायरेक्ट चालान
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectChallanModal(false)}
                className="bg-red-650 hover:bg-red-700 text-white font-black text-xs px-2.5 py-1 rounded border border-slate-955 active:translate-y-0.5 cursor-pointer mr-1 font-bold"
              >
                X
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleCreateDirectChallan} className="p-6 bg-[#E5ECF4] space-y-4 text-slate-955">
              <div className="space-y-4">

                {/* Site and Date Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Construction Site */}
                  <div className="relative" ref={modalSiteSelectorRef}>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Select Construction Site / साइट का नाम:</label>
                    <input
                      ref={modalSiteInputRef}
                      type="text"
                      translate="no"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      required
                      value={modalSiteSearchVal}
                      onChange={(e) => {
                        setModalSiteSearchVal(e.target.value);
                        setIsModalSiteSuggestionsOpen(true);
                        setHighlightedModalSiteIndex(-1);
                        if (selectedSiteId) {
                          setSelectedSiteId(null);
                        }
                      }}
                      onFocus={() => {
                        setIsModalSiteSuggestionsOpen(true);
                        setHighlightedModalSiteIndex(-1);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsModalSiteSuggestionsOpen(false), 200);
                      }}
                      onKeyDown={handleModalSiteKeyDown}
                      placeholder="TYPE SITE NAME OR ARROW DOWN..."
                      className={`w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none notranslate ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
                    />

                    {/* Modal Site Autocomplete dropdown */}
                    {isModalSiteSuggestionsOpen && filteredModalSites.length > 0 && (
                      <div translate="no" className="absolute left-0 right-0 mt-1 bg-white border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-[99999] max-h-48 overflow-y-auto notranslate">
                        {filteredModalSites.map((site: any, idx: number) => {
                          const isHighlighted = idx === highlightedModalSiteIndex;
                          const isSelected = site.id === selectedSiteId;
                          return (
                            <button
                              key={site.id}
                              id={`modal-site-opt-${idx}`}
                              type="button"
                              translate="no"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectModalSite(site);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-slate-100 last:border-0 notranslate ${isHighlighted
                                ? "bg-amber-400 text-slate-955 font-black"
                                : isSelected
                                  ? "bg-amber-100 text-amber-900"
                                  : "hover:bg-slate-100 text-slate-700"
                                }`}
                            >
                              <span className="pointer-events-none select-none notranslate" translate="no">
                                {site.name.toUpperCase()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Date Input */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Date / दिनांक (DD.MM.YY):</label>
                    <input
                      ref={directDateInputRef}
                      type="text"
                      required
                      value={directDate}
                      onChange={(e) => setDirectDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          modalCustomerInputRef.current?.focus();
                          modalCustomerInputRef.current?.select();
                        }
                      }}
                      placeholder="DD.MM.YY"
                      className={`w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
                    />
                  </div>
                </div>

                {/* Customer Name and Address Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Name */}
                  <div className="relative" ref={modalCustomerSelectorRef}>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Customer Name / ग्राहक का नाम:</label>
                    <input
                      ref={modalCustomerInputRef}
                      type="text"
                      translate="no"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      required={challanFormMode === "COMPANY"}
                      value={directCustomer}
                      disabled={challanFormMode === "COMPANY" && !selectedSiteId}
                      onChange={(e) => {
                        setDirectCustomer(e.target.value.toUpperCase());
                        setIsModalCustomerSuggestionsOpen(true);
                        setHighlightedModalCustomerIndex(-1);
                      }}
                      onFocus={() => {
                        if (challanFormMode === "COMPANY" && selectedSiteId) {
                          setIsModalCustomerSuggestionsOpen(true);
                          setHighlightedModalCustomerIndex(-1);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsModalCustomerSuggestionsOpen(false), 200);
                      }}
                      onKeyDown={handleModalCustomerKeyDown}
                      placeholder={
                        challanFormMode === "COMPANY" && !selectedSiteId
                          ? "SELECT SITE FIRST..."
                          : challanFormMode === "COMPANY"
                            ? "ENTER CUSTOMER / SUPPLIER NAME"
                            : "ENTER CUSTOMER NAME (OPTIONAL)"
                      }
                      className={`w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed notranslate ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
                    />

                    {/* Modal Customer Autocomplete dropdown */}
                    {isModalCustomerSuggestionsOpen && filteredModalCustomers.length > 0 && (
                      <div translate="no" className="absolute left-0 right-0 mt-1 bg-white border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-[99999] max-h-48 overflow-y-auto notranslate">
                        {filteredModalCustomers.map((ledger: any, idx: number) => {
                          const isHighlighted = idx === highlightedModalCustomerIndex;
                          const isSelected = ledger.name.toUpperCase() === directCustomer.toUpperCase();
                          return (
                            <button
                              key={ledger.id}
                              id={`modal-cust-opt-${idx}`}
                              type="button"
                              translate="no"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectModalCustomer(ledger);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-slate-100 last:border-0 notranslate ${isHighlighted
                                ? "bg-amber-400 text-slate-955 font-black"
                                : isSelected
                                  ? "bg-amber-100 text-amber-900"
                                  : "hover:bg-slate-100 text-slate-700"
                                }`}
                            >
                              <span className="truncate block py-0.5 pointer-events-none select-none notranslate" translate="no">{ledger.name.toUpperCase()} {ledger.isVirtual ? "(VIRTUAL)" : ""}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Address / पता (Optional):</label>
                    <input
                      id="modal-address-input"
                      type="text"
                      translate="no"
                      disabled={challanFormMode === "COMPANY" && !selectedSiteId}
                      value={directAddress}
                      onChange={(e) => setDirectAddress(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const mobEl = document.getElementById("modal-mobile-input") as HTMLInputElement | null;
                          if (mobEl) {
                            mobEl.focus();
                            mobEl.select();
                          }
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          modalCustomerInputRef.current?.focus();
                          modalCustomerInputRef.current?.select();
                        }
                      }}
                      placeholder="ENTER ADDRESS"
                      className={`w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed notranslate ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
                    />
                  </div>
                </div>

                {/* Mobile No */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Mobile No / मोबाइल नंबर (Optional):</label>
                    <input
                      id="modal-mobile-input"
                      type="text"
                      translate="no"
                      disabled={challanFormMode === "COMPANY" && !selectedSiteId}
                      value={directMobile}
                      onChange={(e) => setDirectMobile(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const matEl = document.getElementById("direct-material-input-0") as HTMLInputElement | null;
                          if (matEl) {
                            matEl.focus();
                            matEl.select();
                          }
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          const addrEl = document.getElementById("modal-address-input") as HTMLInputElement | null;
                          if (addrEl) {
                            addrEl.focus();
                            addrEl.select();
                          }
                        }
                      }}
                      placeholder="ENTER MOBILE NO."
                      className={`w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed notranslate ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
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
                            translate="no"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            value={item.material}
                            onChange={(e) => {
                              updateDirectItem(idx, {
                                material: e.target.value.toUpperCase(),
                                isMaterialSuggestionsOpen: true,
                                highlightedMaterialIndex: -1
                              });
                            }}
                            onFocus={() => {
                              for (let r = 0; r < idx; r++) {
                                if (!validateRowInline(r)) {
                                  return;
                                }
                              }
                              updateDirectItem(idx, { isMaterialSuggestionsOpen: true, highlightedMaterialIndex: -1 });
                            }}
                            onClick={() => {
                              for (let r = 0; r < idx; r++) {
                                if (!validateRowInline(r)) {
                                  return;
                                }
                              }
                              updateDirectItem(idx, { isMaterialSuggestionsOpen: true });
                            }}
                            onBlur={() => {
                              setTimeout(() => updateDirectItem(idx, { isMaterialSuggestionsOpen: false }), 200);
                            }}
                            onKeyDown={(e) => handleMaterialKeyDown(idx, e, suggestions)}
                            placeholder="Type Material..."
                            className={`w-full bg-white border border-slate-955 rounded px-2.5 py-1 text-xs font-bold focus:outline-none uppercase notranslate ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
                          />
                          {item.isMaterialSuggestionsOpen && suggestions.length > 0 && (
                            <div translate="no" className="absolute left-0 right-0 mt-1 bg-white border border-slate-955 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-[10000] max-h-32 overflow-y-auto notranslate">
                              {suggestions.map((mat: any, sIdx: number) => {
                                const isHighlighted = sIdx === item.highlightedMaterialIndex;
                                return (
                                  <button
                                    key={mat.id || sIdx}
                                    id={`mat-opt-${idx}-${sIdx}`}
                                    type="button"
                                    translate="no"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      updateDirectItem(idx, {
                                        material: mat.name.toUpperCase(),
                                        unit: mat.unit?.toUpperCase() || "CFT",
                                        rate: mat.rate !== undefined && mat.rate !== null ? String(mat.rate) : "",
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
                                    className={`w-full text-left px-2.5 py-1 text-[11px] font-bold border-b border-slate-100 last:border-0 notranslate ${isHighlighted ? "bg-amber-400 text-slate-955" : "hover:bg-slate-100 text-slate-700"
                                      }`}
                                  >
                                    <span className="pointer-events-none select-none notranslate" translate="no">
                                      {mat.name.toUpperCase()} ({mat.unit || "CFT"})
                                    </span>
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
                            onFocus={() => {
                              for (let r = 0; r < idx; r++) {
                                if (!validateRowInline(r)) {
                                  return;
                                }
                              }
                              const currentItem = directItems[idx];
                              if (!currentItem || !currentItem.material.trim()) {
                                toast.error("Please enter Material Name first");
                                const el = document.getElementById(`direct-material-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                                return;
                              }
                            }}
                            onKeyDown={(e) => {
                              handleGridKeyDown(idx, 'qty', e);
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const el = document.getElementById(`direct-unit-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                const el = document.getElementById(`direct-material-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                              }
                            }}
                            placeholder="Qty"
                            className={`w-full bg-white border border-slate-955 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
                          />
                        </div>

                        {/* Unit Input */}
                        <div className="col-span-2">
                          <input
                            id={`direct-unit-input-${idx}`}
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateDirectItem(idx, { unit: e.target.value.toUpperCase() })}
                            onFocus={() => {
                              for (let r = 0; r < idx; r++) {
                                if (!validateRowInline(r)) {
                                  return;
                                }
                              }
                              const currentItem = directItems[idx];
                              if (!currentItem || !currentItem.material.trim()) {
                                toast.error("Please enter Material Name first");
                                const el = document.getElementById(`direct-material-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                                return;
                              }
                              const qtyVal = parseFloat(currentItem.qty);
                              if (!currentItem.qty.trim() || isNaN(qtyVal) || qtyVal <= 0) {
                                toast.error("Please enter Quantity (> 0) first");
                                const el = document.getElementById(`direct-qty-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                                return;
                              }
                            }}
                            onKeyDown={(e) => {
                              handleGridKeyDown(idx, 'unit', e);
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const el = document.getElementById(`direct-rate-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                const el = document.getElementById(`direct-qty-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                              }
                            }}
                            placeholder="Unit"
                            className={`w-full bg-white border border-slate-955 rounded px-2 py-1 text-xs font-bold text-center focus:outline-none uppercase ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
                          />
                        </div>

                        {/* Rate Input */}
                        <div className="col-span-1">
                          <input
                            id={`direct-rate-input-${idx}`}
                            type="number"
                            step="any"
                            value={item.rate}
                            onChange={(e) => updateDirectItem(idx, { rate: e.target.value })}
                            onFocus={() => {
                              for (let r = 0; r < idx; r++) {
                                if (!validateRowInline(r)) {
                                  return;
                                }
                              }
                              const currentItem = directItems[idx];
                              if (!currentItem || !currentItem.material.trim()) {
                                toast.error("Please enter Material Name first");
                                const el = document.getElementById(`direct-material-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                                return;
                              }
                              const qtyVal = parseFloat(currentItem.qty);
                              if (!currentItem.qty.trim() || isNaN(qtyVal) || qtyVal <= 0) {
                                toast.error("Please enter Quantity (> 0) first");
                                const el = document.getElementById(`direct-qty-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                                return;
                              }
                              if (!currentItem.unit.trim()) {
                                toast.error("Please enter Unit first");
                                const el = document.getElementById(`direct-unit-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                                return;
                              }
                            }}
                            onKeyDown={(e) => {
                              handleGridKeyDown(idx, 'rate', e);
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const isLastRow = idx === directItems.length - 1;
                                if (isLastRow) {
                                  handleAddDirectItem();
                                } else {
                                  if (!validateRowInline(idx)) {
                                    return;
                                  }
                                  const nextMatInput = document.getElementById(`direct-material-input-${idx + 1}`);
                                  if (nextMatInput) {
                                    nextMatInput.focus();
                                    (nextMatInput as HTMLInputElement).select();
                                  }
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                const el = document.getElementById(`direct-unit-input-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select(); }
                              }
                            }}
                            placeholder="Rate"
                            className={`w-full bg-white border border-slate-955 rounded px-2 py-1 text-xs font-bold font-mono text-right focus:outline-none ${challanFormMode === "COMPANY" ? "focus:border-[#2B547E]" : "focus:border-emerald-600"}`}
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
                  id="modal-submit-btn"
                  type="submit"
                  disabled={createChallanMutation.isPending}
                  className={`w-full text-white font-extrabold text-[10px] py-2.5 rounded transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none border-2 border-slate-955 cursor-pointer uppercase tracking-wider text-center ${challanFormMode === "COMPANY" ? "bg-[#2B547E] hover:bg-[#1E3E64]" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {createChallanMutation.isPending ? "Generating & Saving..." : (challanFormMode === "COMPANY" ? "Generate & Save Company Challan / चालान बनाएं [F1]" : "Generate Challan / चालान बनाएं [F1]")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Entry Modal */}
      {showCreditPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#D3DFEE] border-2 border-slate-955 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden w-[400px] max-w-[95vw] font-mono flex flex-col select-none">
            <div className="border-b-2 border-slate-950 px-3 py-2 flex items-center justify-between text-white shrink-0 bg-emerald-700">
              <span className="text-xs font-black uppercase tracking-wider">Add Credit Entry / क्रेडिट प्रविष्टि जोड़ें</span>
              <button
                type="button"
                onClick={() => setShowCreditPopup(false)}
                className="bg-red-650 hover:bg-red-700 text-white font-black text-xs px-2.5 py-1 rounded border border-slate-955 active:translate-y-0.5 cursor-pointer font-bold"
              >
                X
              </button>
            </div>
            <form onSubmit={handleSaveCreditEntry} className="p-6 bg-[#E5ECF4] space-y-4 text-slate-955">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Date / दिनांक (DD.MM.YY):</label>
                  <input
                    id="credit-date-input"
                    type="text"
                    required
                    value={creditDate}
                    onChange={(e) => setCreditDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const nextEl = document.getElementById("credit-particulars-input") as HTMLInputElement | null;
                        if (nextEl) { nextEl.focus(); nextEl.select(); }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setShowCreditPopup(false);
                      }
                    }}
                    placeholder="DD.MM.YY"
                    className="w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Particulars / विवरण:</label>
                  <input
                    id="credit-particulars-input"
                    type="text"
                    required
                    value={creditParticulars}
                    onChange={(e) => setCreditParticulars(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const nextEl = document.getElementById("credit-amount-input") as HTMLInputElement | null;
                        if (nextEl) { nextEl.focus(); nextEl.select(); }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        const prevEl = document.getElementById("credit-date-input") as HTMLInputElement | null;
                        if (prevEl) { prevEl.focus(); prevEl.select(); }
                      }
                    }}
                    placeholder="Particulars"
                    className="w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-600 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Credit Amount / क्रेडिट राशि:</label>
                  <input
                    id="credit-amount-input"
                    type="number"
                    step="any"
                    required
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!isSavingCredit) {
                          handleSaveCreditEntry(e);
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        const prevEl = document.getElementById("credit-particulars-input") as HTMLInputElement | null;
                        if (prevEl) { prevEl.focus(); prevEl.select(); }
                      }
                    }}
                    placeholder="Amount"
                    className="w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold font-mono text-right focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="bg-white border-t border-slate-300 -mx-6 -mb-6 p-4 mt-4">
                <button
                  id="credit-submit-btn"
                  type="submit"
                  disabled={isSavingCredit}
                  className={`w-full text-white font-extrabold text-[10px] py-2.5 rounded transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none border-2 border-slate-955 cursor-pointer uppercase tracking-wider text-center bg-emerald-600 hover:bg-emerald-700 ${isSavingCredit ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSavingCredit ? "Saving..." : "Save Credit Entry / क्रेडिट प्रविष्टि सहेजें"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {showAddRowPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#D3DFEE] border-2 border-slate-955 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden w-[400px] max-w-[95vw] font-mono flex flex-col select-none">
            <div className="border-b-2 border-slate-955 px-3 py-2 flex items-center justify-between text-white shrink-0 bg-blue-700">
              <span className="text-xs font-black uppercase tracking-wider">Add Material Row / नया आइटम जोड़ें</span>
              <button
                type="button"
                onClick={() => setShowAddRowPopup(false)}
                className="bg-red-655 hover:bg-red-700 text-white font-black text-xs px-2.5 py-1 rounded border border-slate-955 active:translate-y-0.5 cursor-pointer font-bold animate-pulse"
              >
                X
              </button>
            </div>
            <form onSubmit={handleSaveNewRow} className="p-6 bg-[#E5ECF4] space-y-4 text-slate-955">
              <div className="space-y-4">
                {/* Material Input with Autocomplete */}
                <div className="relative" ref={addRowMaterialSelectorRef}>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Material Name / सामग्री:</label>
                  <input
                    id="add-row-material-input"
                    type="text"
                    translate="no"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    required
                    value={addRowMaterial}
                    onChange={(e) => {
                      setAddRowMaterial(e.target.value.toUpperCase());
                      setIsAddRowMaterialSuggestionsOpen(true);
                      setHighlightedAddRowMaterialIndex(-1);
                    }}
                    onFocus={() => {
                      setIsAddRowMaterialSuggestionsOpen(true);
                      setHighlightedAddRowMaterialIndex(-1);
                    }}
                    onBlur={() => {
                      setTimeout(() => setIsAddRowMaterialSuggestionsOpen(false), 200);
                    }}
                    onKeyDown={(e) => {
                      const suggestions = (() => {
                        const q = addRowMaterial.trim().toUpperCase();
                        if (!existingMaterials) return [];
                        if (!q) return existingMaterials;
                        return existingMaterials.filter((m: any) => matchesFuzzy(m.name, q));
                      })();
                      handleAddRowMaterialKeyDown(e, suggestions);
                    }}
                    placeholder="Type Material..."
                    className="w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-blue-600 uppercase font-mono notranslate"
                  />
                  {isAddRowMaterialSuggestionsOpen && (
                    (() => {
                      const suggestions = (() => {
                        const q = addRowMaterial.trim().toUpperCase();
                        if (!existingMaterials) return [];
                        if (!q) return existingMaterials;
                        return existingMaterials.filter((m: any) => matchesFuzzy(m.name, q));
                      })();
                      if (suggestions.length === 0) return null;
                      return (
                        <div translate="no" className="absolute left-0 right-0 mt-1 bg-white border border-slate-955 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] z-[10000] max-h-32 overflow-y-auto notranslate">
                          {suggestions.map((mat: any, sIdx: number) => {
                            const isHighlighted = sIdx === highlightedAddRowMaterialIndex;
                            return (
                              <button
                                key={mat.id || sIdx}
                                id={`add-row-mat-opt-${sIdx}`}
                                type="button"
                                translate="no"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setAddRowMaterial(mat.name.toUpperCase());
                                  setAddRowUnit(mat.unit?.toUpperCase() || "CFT");
                                  if (mat.rate !== undefined && mat.rate !== null && mat.rate !== 0) {
                                    setAddRowRate(String(mat.rate));
                                  }
                                  setIsAddRowMaterialSuggestionsOpen(false);
                                  setHighlightedAddRowMaterialIndex(-1);
                                  setTimeout(() => {
                                    const qtyEl = document.getElementById("add-row-qty-input") as HTMLInputElement | null;
                                    if (qtyEl) {
                                      qtyEl.focus();
                                      qtyEl.select();
                                    }
                                  }, 50);
                                }}
                                className={`w-full text-left px-2.5 py-1 text-[11px] font-bold border-b border-slate-100 last:border-0 notranslate ${isHighlighted ? "bg-amber-400 text-slate-955" : "hover:bg-slate-100 text-slate-700"
                                  }`}
                              >
                                <span className="pointer-events-none select-none notranslate" translate="no">
                                  {mat.name.toUpperCase()} ({mat.unit || "CFT"})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Qty Input */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Quantity / मात्रा:</label>
                  <input
                    id="add-row-qty-input"
                    type="number"
                    step="any"
                    required
                    value={addRowQty}
                    onChange={(e) => setAddRowQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const nextEl = document.getElementById("add-row-unit-input") as HTMLInputElement | null;
                        if (nextEl) { nextEl.focus(); nextEl.select(); }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        const prevEl = document.getElementById("add-row-material-input") as HTMLInputElement | null;
                        if (prevEl) { prevEl.focus(); prevEl.select(); }
                      }
                    }}
                    placeholder="Qty"
                    className="w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold font-mono text-right focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Unit Input */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Unit / इकाई:</label>
                  <input
                    id="add-row-unit-input"
                    type="text"
                    required
                    value={addRowUnit}
                    onChange={(e) => setAddRowUnit(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const nextEl = document.getElementById("add-row-rate-input") as HTMLInputElement | null;
                        if (nextEl) { nextEl.focus(); nextEl.select(); }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        const prevEl = document.getElementById("add-row-qty-input") as HTMLInputElement | null;
                        if (prevEl) { prevEl.focus(); prevEl.select(); }
                      }
                    }}
                    placeholder="Unit"
                    className="w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold text-center focus:outline-none focus:border-blue-600 uppercase"
                  />
                </div>

                {/* Rate Input */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-655 mb-1">Rate / दर:</label>
                  <input
                    id="add-row-rate-input"
                    type="number"
                    step="any"
                    required
                    value={addRowRate}
                    onChange={(e) => setAddRowRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveNewRow(e);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        const prevEl = document.getElementById("add-row-unit-input") as HTMLInputElement | null;
                        if (prevEl) { prevEl.focus(); prevEl.select(); }
                      }
                    }}
                    placeholder="Rate"
                    className="w-full bg-white border-2 border-slate-955 rounded px-2.5 py-1.5 text-xs font-bold font-mono text-right focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
              <div className="bg-white border-t border-slate-300 -mx-6 -mb-6 p-4 mt-4">
                <button
                  id="add-row-submit-btn"
                  type="submit"
                  className="w-full text-white font-extrabold text-[10px] py-2.5 rounded transition-all shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none border-2 border-slate-955 cursor-pointer uppercase tracking-wider text-center bg-blue-600 hover:bg-blue-700"
                >
                  Save Material Row / आइटम सहेजें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditableCellProps {
  value: string | number;
  onSave: (newVal: string) => void;
  type?: "text" | "number";
  className?: string;
  displayValue?: string;
}

function EditableCell({
  value,
  onSave,
  type = "text",
  className = "",
  displayValue
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== String(value)) {
      onSave(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setIsEditing(false);
      if (localValue !== String(value)) {
        onSave(localValue);
      }
    } else if (e.key === "Escape") {
      setLocalValue(String(value));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type={type}
        step="any"
        value={localValue}
        onChange={(e) => setLocalValue(type === "number" ? e.target.value : e.target.value.toUpperCase())}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`w-full bg-white border border-slate-350 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-slate-800 uppercase ${className}`}
      />
    );
  }

  const showVal = displayValue !== undefined ? displayValue : (value === 0 || value === "0" ? "-" : String(value));

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-slate-100/80 rounded px-1 py-0.5 min-h-[20px] transition-colors ${className}`}
      title="Click to edit"
    >
      {showVal || "-"}
    </div>
  );
}
