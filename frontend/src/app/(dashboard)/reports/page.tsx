"use client";

import { useState, useEffect, Suspense, useRef, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer, Building2, Wallet, ArrowDown } from "lucide-react";
import { createPortal } from "react-dom";
import api from "@/lib/axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

const HINDI_DICTIONARY: { [key: string]: string } = {
  // Specific Material Translations (User Provided List)
  "PIPE RUBBER 1/2\"": "पाइप रबर 1/2 इंच",
  "GRIT 1/2\" BAG": "गिट्टी 1/2 इंच बोरी",
  "KAMDHENU 20 MM": "कामधेनु 20 मिमी",
  "DUST": "स्टोन डस्ट",
  "SABAR KISAN": "साबर किसान",
  "GURRA": "गुर्रा",
  "HOLD FAST NAIL WALA": "होल्ड फास्ट नेल वाला",
  "GRITT 1/2\" GREY": "ग्रिट 1/2 इंच ग्रे",
  "GALLANT 12 MM": "गैलेंट 12 मिमी",
  "WP+ 1 LTR": "डब्ल्यूपी प्लस 1 लीटर",
  "TMT 10 MM": "टीएमटी 10 मिमी",
  "ULTRATECH WEATHER+": "अल्ट्राटेक वेदर प्लस",
  "GALLANT 25 MM": "गैलेंट 25 मिमी",
  "BUCKET 10 LTR": "बाल्टी 10 लीटर",
  "LW+ 50 LTR": "एलडब्ल्यू प्लस 50 लीटर",
  "PIPE REENA MEDIUM 25 MM": "रीना Medium पाइप 25 मिमी",
  "ACC CONCRETE": "एसीसी कंक्रीट",
  "TMT 8 MM": "टीएमटी 8 मिमी",
  "WP+ 20 LTR": "डब्ल्यूपी प्लस 20 लीटर",
  "LW+ 5 LTR": "एलडब्ल्यू प्लस 5 लीटर",
  "RHL 16 MM": "आरएचएल 16 मिमी",
  "URP 20 KG": "यूआरपी 20 किग्रा",
  "TRIPAL 12'X15'": "तिरपाल 12×15 फीट",
  "COVER BLOCK 25 MM": "कवर ब्लॉक 25 मिमी",
  "BUCKET 15 LTR": "बाल्टी 15 लीटर",
  "RHL 10 MM": "आरएचएल 10 मिमी",
  "TASLA NAREGA ROLEX 17\"": "तसला नरेगा रोलेक्स 17 इंच",
  "SHUTTERING TAPE LOTUS 3\"": "शटरिंग टेप लोटस 3 इंच",
  "TERMINATOR STRUCTURE 1 LTR": "टर्मिनेटर स्ट्रक्चर 1 लीटर",
  "TATA 25 MM": "टाटा 25 मिमी",
  "SHUTTERING OIL 5 LTR PKG": "शटरिंग ऑयल 5 लीटर पैक",
  "SABAR BHAGAT": "साबर भगत",
  "TMT 12 MM": "टीएमटी 12 मिमी",
  "PIPE RUBBER 1\"": "पाइप रबर 1 इंच",
  "NAIL 2\"": "कील 2 इंच",
  "WIRE LOCAL": "लोकल तार",
  "TRIPAL 10'X10'": "तिरपाल 10×10 फीट",
  "GRITT 3/4\" BLACK": "ग्रिट 3/4 इंच काला",
  "GALLANT 10 MM": "गैलेंट 10 मिमी",
  "PIPE REENA EXTRA HEAVY 25 MM": "रीना एक्स्ट्रा हेवी पाइप 25 मिमी",
  "KAMDHENU 16 MM": "कामधेनु 16 मिमी",
  "BEND HEAVY REENA 25 MM": "रीना हेवी बेंड 25 मिमी",
  "FARAWA CHETAK": "फावड़ा चेतक",
  "WP+ 5 LTR": "डब्ल्यूपी प्लस 5 लीटर",
  "BALU": "बालू",
  "KAMDHENU 25 MM": "कामधेनु 25 मिमी",
  "NAIL 4\"": "कील 4 इंच",
  "FREME HEXA": "फ्रेम हेक्सा",
  "CART": "गाड़ी",
  "TMT 20 MM": "टीएमटी 20 मिमी",
  "WP+ 10 LTR": "डब्ल्यूपी प्लस 10 लीटर",
  "LW+ 200 ML": "एलडब्ल्यू प्लस 200 मि.ली.",
  "FAN BOX": "फैन बॉक्स",
  "MORANG MEDIUM": "मोरंग मीडियम",
  "BLADE HEXA": "हेक्सा ब्लेड",
  "JSB": "जेएसबी",
  "KAMDHENU 8 MM": "कामधेनु 8 मिमी",
  "TASLA NAREGA ROLEX 18\"": "तसला नरेगा रोलेक्स 18 इंच",
  "BITUFIX 20KG": "बिटुफिक्स 20 किग्रा",
  "ULTRATECH": "अल्ट्राटेक",
  "RHL 8 MM": "आरएचएल 8 मिमी",
  "SHUTTERING TAPE SUNRISE 2.5\"": "शटरिंग टेप सनराइज 2.5 इंच",
  "GALLANT 16 MM": "गैलेंट 16 मिमी",
  "ACC GOLD": "एसीसी गोल्ड",
  "GALLANT 20 MM": "गैलेंट 20 मिमी",
  "MORANG MAHEEN": "महीन मोरंग",
  "TATA 8 MM": "टाटा 8 मिमी",
  "JAALI KHARCHAL 3'": "जाली खरचल 3 फीट",
  "MYCEM": "माइसेम",
  "LW+ 1 LTR": "एलडब्ल्यू प्लस 1 लीटर",
  "BALU BAG": "बालू बोरी",
  "TRIPAL 12'X18'": "तिरपाल 12×18 फीट",
  "JOINTER 1/2\"": "जॉइंटर 1/2 इंच",
  "MORANG MOTI": "मोती मोरंग",
  "KAMDHENU 12 MM": "कामधेनु 12 मिमी",
  "TATA 20 MM": "टाटा 20 मिमी",
  "RHL 20 MM": "आरएचएल 20 मिमी",
  "TATA 10 MM": "टाटा 10 मिमी",
  "LW+ 10 LTR": "एलडब्ल्यू प्लस 10 लीटर",
  "RHL 12 MM": "आरएचएल 12 मिमी",
  "TATA 12 MM": "टाटा 12 मिमी",
  "SHUTTERING OIL 1 LTR PKG": "शटरिंग ऑयल 1 लीटर पैक",
  "JOINTER 1\"": "जॉइंटर 1 इंच",
  "HOLD FAST BOLT WALA": "होल्ड फास्ट बोल्ट वाला",
  "GALLANT 8 MM": "गैलेंट 8 मिमी",
  "KAMDHENU 10 MM": "कामधेनु 10 मिमी",
  "LW+ 20 LTR": "एलडब्ल्यू प्लस 20 लीटर",
  "URP 500 GRM": "यूआरपी 500 ग्राम",
  "DURMUT DEGCHUNE": "दुर्मुट डेगचूने",
  "JEERA": "जीरा",
  "LIGHT BOX 3\"": "लाइट BOX 3 इंच",
  "PIPE 19 MM": "पाइप 19 मिमी",
  "SHUTTERING TAPE SUNRISE 3\"": "शटरिंग टेप सनराइज 3 इंच",
  "J BOX SURFACE 25 MM": "जे बॉक्स सरफेस 25 मिमी",
  "SHUTTERING OIL LOOSE": "शटरिंग ऑयल खुला",
  "TMT 16 MM": "टीएमटी 16 मिमी",
  "FARAWA PANJABI": "फावड़ा पंजाबी",
  "J BOX DEEP": "जे बॉक्स डीप",
  "URP 1 LTR": "यूआरपी 1 लीटर",
  "URP 10 KG": "यूआरपी 10 किग्रा",
  "L BOW 25 MM": "एल बो 25 मिमी",
  "L BOW 19 MM": "एल बो 19 मिमी",
  "TMT 25 MM": "टीएमटी 25 मिमी",
  "WIRE TATA": "टाटा तार",
  "GRITT 3/4\" GREY": "ग्रिट 3/4 इंच ग्रे",
  "SABAR BK": "साबर बीके",
  "BLADE STEEL CUTTING": "स्टील कटिंग ब्लेड",
  "URP 5 KG": "यूआरपी 5 किग्रा",
  "KJS": "केजेएस",
  "RHL 25 MM": "आरएचएल 25 मिमी",
  "TERMINATOR STRUCTURE 5 LTR": "टर्मिनेटर स्ट्रक्चर 5 लीटर",
  "TATA 16 MM": "टाटा 16 मिमी",

  // Word-level fallbacks & Additional items
  "BALU GANGA": "गंगा बालू",
  "BALU GHAGHRA": "घाघरा बालू",
  "GANGA": "गंगा",
  "GHAGHRA": "घाघरा",
  "FARAWA": "फावड़ा",
  "CHETAK": "चेतक",
  "BOX DEEP": "बॉक्स डीप",
  "BOX": "बॉक्स",
  "DEEP": "डीप",
  "J": "जे.",
  "ACC": "एसीसी",
  "CONCRETE": "कंक्रीट",
  "GOLD": "गोल्ड",
  "BEND": "बेंड",
  "HEAVY": "हैवी",
  "CEMENT": "सीमेंट",
  "SAND": "बालू / रेत",
  "STEEL": "स्टील",
  "IRON": "लोहा",
  "BRICKS": "ईंट",
  "BRICK": "ईंट",
  "RODI": "रोड़ी",
  "GITI": "गिट्टी",
  "STONE": "पत्थर",
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

    if (char === "N" && i + 1 < len && !startsWithVowel(cleanWord[i + 1])) {
      result += "ं";
      i += 1;
      continue;
    }

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
  const eng = text.toUpperCase().trim();
  const hin = translateToHindi(text);
  if (eng === hin || !hin) return eng;
  return `${eng} / ${hin}`;
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const reportType = searchParams.get("type");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [allowedLedgerId, setAllowedLedgerId] = useState<string | null>(null);

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole"));
    setAllowedLedgerId(localStorage.getItem("allowedLedgerId"));
  }, []);

  // Site query
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const response = await api.get("/sites");
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
  const [lgTypedSearchVal, setLgTypedSearchVal] = useState("");
  const [lgSelectedLedgerId, setLgSelectedLedgerId] = useState<string | null>(null);
  const [isLgLedgerSuggestionsOpen, setIsLgLedgerSuggestionsOpen] = useState(false);
  const [highlightedLgLedgerIndex, setHighlightedLgLedgerIndex] = useState<number>(-1);
  const lgLedgerSelectorRef = useRef<HTMLDivElement>(null);
  const [lgFilterDate, setLgFilterDate] = useState("");
  const [lgSelectedRowIndex, setLgSelectedRowIndex] = useState<number>(-1);
  const [dbSelectedRowIndex, setDbSelectedRowIndex] = useState<number>(-1);
  const [smSelectedRowIndex, setSmSelectedRowIndex] = useState<number>(-1);

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

  // PRINT DAYBOOK/LEDGER CUSTOM STATES
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [printStartDate, setPrintStartDate] = useState("");

  // SUMMARY PROMISE DATES STATE
  const [summaryDates, setSummaryDates] = useState<{ [key: string]: string }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("summary_promise_dates");
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const handleUpdateDate = (ledgerId: string, newDate: string) => {
    setSummaryDates((prev) => {
      const updated = { ...prev, [ledgerId]: newDate };
      if (typeof window !== "undefined") {
        localStorage.setItem("summary_promise_dates", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const getTodayDateStr = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}`;
  };
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [showCopiesDialog, setShowCopiesDialog] = useState(false);
  const [copiesCount, setCopiesCount] = useState<1 | 2>(1);
  const [printTargetReport, setPrintTargetReport] = useState<"ledger" | "summary" | "daybook" | null>(null);

  const [printEndDate, setPrintEndDate] = useState("");
  const [printTargetType, setPrintTargetType] = useState<"daybook" | "ledger" | null>(null);
  const [printLayoutMode, setPrintLayoutMode] = useState<"daybook" | "ledger" | "summary" | null>(null);
  // Ledgers query
  const { data: ledgers } = useQuery({
    queryKey: ["ledgers", lgSelectedSiteId, smSelectedSiteId],
    queryFn: async () => {
      const activeSiteId = lgSelectedSiteId || smSelectedSiteId;
      if (!activeSiteId) return [];
      const response = await api.get(`/ledgers?siteId=${activeSiteId}`);
      return response.data.data;
    },
    enabled: !!(lgSelectedSiteId || smSelectedSiteId)
  });

  // Autofocus input refs
  const lgSiteInputRef = useRef<HTMLInputElement>(null);
  const dbSiteInputRef = useRef<HTMLInputElement>(null);
  const lgLedgerInputRef = useRef<HTMLInputElement>(null);
  const smSiteInputRef = useRef<HTMLInputElement>(null);
  const smLedgerInputRef = useRef<HTMLInputElement>(null);
  const printStartDateRef = useRef<HTMLInputElement>(null);

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
  // Auto-populate print date range when print modal opens
  useEffect(() => {
    if (showDateRangeModal && daybookData && daybookData.length > 0) {
      const dates = daybookData
        .map((item: any) => new Date(item.date).getTime())
        .filter((t: number) => !isNaN(t));
      if (dates.length > 0) {
        const minTime = Math.min(...dates);
        const maxTime = Math.max(...dates);
        
        const formatISO = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };
        
        setPrintStartDate(formatISO(new Date(minTime)));
        setPrintEndDate(formatISO(new Date(maxTime)));
      } else {
        setPrintStartDate("");
        setPrintEndDate("");
      }
    }
  }, [showDateRangeModal, daybookData]);

  // Clean up printLayoutMode after printing
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintLayoutMode(null);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  // Trigger window.print() once the print layout is fully rendered in DOM
  useEffect(() => {
    if (printLayoutMode) {
      const timer = setTimeout(() => {
        window.print();
      }, 300); // 300ms ensures DOM has repainted and is ready
      return () => clearTimeout(timer);
    }
  }, [printLayoutMode]);

  // Autofocus the print date selection modal start date input
  useEffect(() => {
    if (showDateRangeModal) {
      const timer = setTimeout(() => {
        printStartDateRef.current?.focus();
        printStartDateRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showDateRangeModal]);

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

  // Keep track of the previous open state of print ledger account suggestions
  const wasLgLedgerSuggestionsOpenRef = useRef(false);

  // Auto-scroll and highlight selected account when dropdown is opened
  useEffect(() => {
    const isOpened = isLgLedgerSuggestionsOpen && !wasLgLedgerSuggestionsOpenRef.current;
    wasLgLedgerSuggestionsOpenRef.current = isLgLedgerSuggestionsOpen;

    if (isOpened && lgSelectedLedgerId) {
      const selectedIndex = filteredLgLedgers.findIndex(
        (l: any) => l.id === lgSelectedLedgerId
      );
      if (selectedIndex >= 0) {
        setHighlightedLgLedgerIndex(selectedIndex);
        setTimeout(() => {
          const el = document.getElementById(`lg-acct-opt-${selectedIndex}`);
          if (el) {
            el.scrollIntoView({ block: "nearest" });
          }
        }, 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLgLedgerSuggestionsOpen, lgSelectedLedgerId]);

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
    if (localStorage.getItem("userRole") === "PRINTER") return;
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

  // Lock site and ledger selectors for PRINTER role
  useEffect(() => {
    if (userRole === "PRINTER" && allowedLedgerId) {
      api.get(`/ledgers/${allowedLedgerId}`)
        .then((res) => {
          if (res.data && res.data.data) {
            const ledger = res.data.data;
            const siteId = ledger.siteId;
            const ledgerName = ledger.name.toUpperCase();
            
            // Lock site IDs
            setLgSelectedSiteId(siteId);
            setSmSelectedSiteId(siteId);
            setDbSelectedSiteId(siteId);
            
            // Lock ledger IDs
            setLgSelectedLedgerId(allowedLedgerId);
            setSmSelectedLedgerId("all");
            
            // Lock search inputs
            setLgLedgerSearchVal(ledgerName);
            setSmLedgerSearchVal("ALL ACCOUNTS");
            
            // Find site name
            if (sites && sites.length > 0) {
              const siteObj = sites.find((s: any) => s.id === siteId);
              if (siteObj) {
                const siteName = siteObj.name.toUpperCase();
                setLgSiteSearchVal(siteName);
                setSmSiteSearchVal(siteName);
                setDbSiteSearchVal(siteName);
              }
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load allowed ledger:", err);
        });
    }
  }, [userRole, allowedLedgerId, sites]);

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
  const activeSiteLedgers = useMemo(() => {
    if (!lgSelectedSiteId || !ledgerDaybookData) return [];
    const names = new Set<string>();
    ledgerDaybookData.forEach((item: any) => {
      const text = item.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
      else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
      if (name) names.add(name);
    });

    const ledgerMap = new Map<string, any>();
    if (ledgers) {
      ledgers.forEach((l: any) => {
        ledgerMap.set(l.name.toUpperCase(), l);
      });
    }

    const list: any[] = [];
    names.forEach((name) => {
      const dbLedger = ledgerMap.get(name);
      list.push({
        id: dbLedger ? dbLedger.id : name,
        name: name,
        phone: dbLedger ? dbLedger.phone || "" : "",
        contactPerson: dbLedger ? dbLedger.contactPerson || "" : "",
        isVirtual: !dbLedger
      });
    });

    // Add all registered database accounts
    if (ledgers && ledgers.length > 0) {
      ledgers.forEach((dbLedger: any) => {
        const ledgerNameUpper = dbLedger.name.toUpperCase();
        if (!names.has(ledgerNameUpper)) {
          list.push({
            id: dbLedger.id,
            name: dbLedger.name.toUpperCase(),
            phone: dbLedger.phone || "",
            contactPerson: dbLedger.contactPerson || "",
            isVirtual: false
          });
        }
      });
    }

    // Sort alphabetically by name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [lgSelectedSiteId, ledgerDaybookData, ledgers]);

  // List of active accounts used in that site's transactions for Summary
  const summaryActiveSiteLedgers = useMemo(() => {
    if (!smSelectedSiteId || !summaryDaybookData) return [];
    const names = new Set<string>();
    summaryDaybookData.forEach((item: any) => {
      const text = item.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) name = text.substring(3).trim().toUpperCase();
      else if (text.toUpperCase().startsWith("BY ")) name = text.substring(3).trim().toUpperCase();
      if (name) names.add(name);
    });

    const ledgerMap = new Map<string, any>();
    if (ledgers) {
      ledgers.forEach((l: any) => {
        ledgerMap.set(l.name.toUpperCase(), l);
      });
    }

    const list: any[] = [];
    names.forEach((name) => {
      const dbLedger = ledgerMap.get(name);
      list.push({
        id: dbLedger ? dbLedger.id : name,
        name: name,
        phone: dbLedger ? dbLedger.phone || "" : "",
        contactPerson: dbLedger ? dbLedger.contactPerson || "" : "",
        isVirtual: !dbLedger
      });
    });

    // Add all registered database accounts
    if (ledgers && ledgers.length > 0) {
      ledgers.forEach((dbLedger: any) => {
        const ledgerNameUpper = dbLedger.name.toUpperCase();
        if (!names.has(ledgerNameUpper)) {
          list.push({
            id: dbLedger.id,
            name: dbLedger.name.toUpperCase(),
            phone: dbLedger.phone || "",
            contactPerson: dbLedger.contactPerson || "",
            isVirtual: false
          });
        }
      });
    }

    // Sort alphabetically by name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [smSelectedSiteId, summaryDaybookData, ledgers]);
  // Filter accounts suggestions list to display active site accounts only
  const filteredLgLedgers = (() => {
    const activeLedger = activeSiteLedgers.find((l) => String(l.id) === String(lgSelectedLedgerId));
    const isSearching = lgTypedSearchVal.trim() !== "" && lgTypedSearchVal.toUpperCase() !== activeLedger?.name?.toUpperCase();
    
    if (!isSearching) {
      return activeSiteLedgers;
    }
    
    const queryUpper = lgTypedSearchVal.trim().toUpperCase();

    const getMatchScore = (ledger: any) => {
      const nameUpper = ledger.name.toUpperCase();
      if (nameUpper === queryUpper) return 1000;
      if (nameUpper.startsWith(queryUpper)) return 900;
      if (nameUpper.includes(queryUpper)) return 800;
      
      const details = parsePartyDetails(ledger.contactPerson);
      const address = (details ? details.address : (ledger.contactPerson || "")) || "";
      const phone = (details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "")) || "";
      
      const addressUpper = address.toUpperCase();
      const phoneUpper = phone.toUpperCase();
      
      if (addressUpper.startsWith(queryUpper) || phoneUpper.startsWith(queryUpper)) return 700;
      if (addressUpper.includes(queryUpper) || phoneUpper.includes(queryUpper)) return 600;
      
      if (matchesFuzzy(ledger.name, lgTypedSearchVal)) return 500;
      if (address && matchesFuzzy(address, lgTypedSearchVal)) return 400;
      if (phone && matchesFuzzy(phone, lgTypedSearchVal)) return 300;
      
      return 0;
    };

    return activeSiteLedgers
      .map((ledger: any) => ({ ledger, score: getMatchScore(ledger) }))
      .filter((item: any) => item.score > 0)
      .sort((a: any, b: any) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.ledger.name.localeCompare(b.ledger.name);
      })
      .map((item: any) => item.ledger);
  })();

  // Filter accounts suggestions list to display active site accounts only for Summary
  const filteredSmLedgers = (() => {
    const isAll = smSelectedLedgerId === "all";
    const activeLedger = isAll ? { name: "ALL ACCOUNTS" } : summaryActiveSiteLedgers.find((l) => String(l.id) === String(smSelectedLedgerId));
    const isSearching = smLedgerSearchVal.trim() !== "" && smLedgerSearchVal.toUpperCase() !== activeLedger?.name?.toUpperCase();
    
    if (!isSearching) {
      return [{ id: "all", name: "ALL ACCOUNTS" }, ...summaryActiveSiteLedgers];
    }
    
    const queryUpper = smLedgerSearchVal.trim().toUpperCase();

    const getMatchScore = (ledger: any) => {
      const nameUpper = ledger.name.toUpperCase();
      if (nameUpper === queryUpper) return 1000;
      if (nameUpper.startsWith(queryUpper)) return 900;
      if (nameUpper.includes(queryUpper)) return 800;
      
      const details = parsePartyDetails(ledger.contactPerson);
      const address = (details ? details.address : (ledger.contactPerson || "")) || "";
      const phone = (details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "")) || "";
      
      const addressUpper = address.toUpperCase();
      const phoneUpper = phone.toUpperCase();
      
      if (addressUpper.startsWith(queryUpper) || phoneUpper.startsWith(queryUpper)) return 700;
      if (addressUpper.includes(queryUpper) || phoneUpper.includes(queryUpper)) return 600;
      
      if (matchesFuzzy(ledger.name, smLedgerSearchVal)) return 500;
      if (address && matchesFuzzy(address, smLedgerSearchVal)) return 400;
      if (phone && matchesFuzzy(phone, smLedgerSearchVal)) return 300;
      
      return 0;
    };

    const matches = summaryActiveSiteLedgers
      .map((ledger: any) => ({ ledger, score: getMatchScore(ledger) }))
      .filter((item: any) => item.score > 0)
      .sort((a: any, b: any) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.ledger.name.localeCompare(b.ledger.name);
      })
      .map((item: any) => item.ledger);

    if (matchesFuzzy("ALL ACCOUNTS", smLedgerSearchVal)) {
      return [{ id: "all", name: "ALL ACCOUNTS" }, ...matches];
    }
    return matches;
  })();
  // Summary list of balances calculation
  const summaryLedgersList = useMemo(() => {
    if (!smSelectedSiteId || !summaryDaybookData) return [];

    let targetLedgers = summaryActiveSiteLedgers;

    // Create a lookup map of daybook totals for each ledger to perform O(1) matching
    const ledgerTotalsMap: { [key: string]: { debit: number; credit: number } } = {};

    summaryDaybookData.forEach((item: any) => {
      const text = item.expenseType || "";
      let isTo = text.toUpperCase().startsWith("TO ");
      let isBy = text.toUpperCase().startsWith("BY ");
      if (!isTo && !isBy) return;

      const name = text.substring(3).trim().toUpperCase();
      if (!name) return;

      let isDebit = isTo;
      const compDetails = item.paymentMode && item.paymentMode.trim().startsWith("{") && item.paymentMode.trim().endsWith("}")
        ? (() => {
            try { return JSON.parse(item.paymentMode); } catch { return null; }
          })()
        : null;

      if (compDetails && compDetails.crDr) {
        isDebit = compDetails.crDr === "DR";
      }

      if (!ledgerTotalsMap[name]) {
        ledgerTotalsMap[name] = { debit: 0, credit: 0 };
      }

      if (isDebit) {
        ledgerTotalsMap[name].debit += item.amount;
      } else {
        ledgerTotalsMap[name].credit += item.amount;
      }
    });

    return targetLedgers.map((ledger) => {
      const details = parsePartyDetails(ledger.contactPerson);
      const address = details ? details.address : (ledger.contactPerson || "");
      const phone = details ? (details.mobileNo || details.phoneNo) : (ledger.phone || "");

      const totals = ledgerTotalsMap[ledger.name.toUpperCase()] || { debit: 0, credit: 0 };
      const totalDebit = totals.debit;
      const totalCredit = totals.credit;

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
    }).filter((item: any) => item.balance !== 0);
  }, [smSelectedSiteId, summaryDaybookData, summaryActiveSiteLedgers]);
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
        return next >= filteredDbSites.length ? filteredDbSites.length - 1 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedDbSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? 0 : next;
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
        dbSiteInputRef.current?.blur();
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
        return next >= filteredLgSites.length ? filteredLgSites.length - 1 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedLgSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? 0 : next;
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
        setLgTypedSearchVal("");

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
        const index = next >= filteredLgLedgers.length ? filteredLgLedgers.length - 1 : next;
        setTimeout(() => {
          const el = document.getElementById(`lg-acct-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);

        // AUTO OPEN THE LEDGER AS THEY SCROLL!
        const ledger = filteredLgLedgers[index];
        if (ledger) {
          setLgSelectedLedgerId(ledger.id);
          setLgLedgerSearchVal(ledger.name.toUpperCase());
          setLgTypedSearchVal(ledger.name.toUpperCase());
        }

        return index;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedLgLedgerIndex((prev) => {
        const next = prev - 1;
        const index = next < 0 ? 0 : next;
        setTimeout(() => {
          const el = document.getElementById(`lg-acct-opt-${index}`);
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 10);

        // AUTO OPEN THE LEDGER AS THEY SCROLL!
        const ledger = filteredLgLedgers[index];
        if (ledger) {
          setLgSelectedLedgerId(ledger.id);
          setLgLedgerSearchVal(ledger.name.toUpperCase());
          setLgTypedSearchVal(ledger.name.toUpperCase());
        }

        return index;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      let targetIndex = highlightedLgLedgerIndex;
      if (targetIndex === -1 && filteredLgLedgers.length > 0) {
        targetIndex = 0;
      }
      if (targetIndex >= 0 && targetIndex < filteredLgLedgers.length) {
        const ledger = filteredLgLedgers[targetIndex];
        setLgSelectedLedgerId(ledger.id);
        setLgLedgerSearchVal(ledger.name.toUpperCase());
        setLgTypedSearchVal(ledger.name.toUpperCase());
      }
      setIsLgLedgerSuggestionsOpen(false);
      setHighlightedLgLedgerIndex(-1);
      lgLedgerInputRef.current?.blur();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      let targetIndex = highlightedLgLedgerIndex;
      if (targetIndex === -1 && filteredLgLedgers.length > 0) {
        targetIndex = 0;
      }
      if (targetIndex >= 0 && targetIndex < filteredLgLedgers.length) {
        const ledger = filteredLgLedgers[targetIndex];
        setLgSelectedLedgerId(ledger.id);
        setLgLedgerSearchVal(ledger.name.toUpperCase());
        setLgTypedSearchVal(ledger.name.toUpperCase());
      }
      setIsLgLedgerSuggestionsOpen(false);
      setHighlightedLgLedgerIndex(-1);
      lgLedgerInputRef.current?.blur();
      
      // Auto highlight and scroll to first row in table
      if (processedLgData.items.length > 0) {
        setLgSelectedRowIndex(0);
        setTimeout(() => {
          const el = document.getElementById("lg-row-0");
          if (el) el.scrollIntoView({ block: "nearest" });
        }, 50);
      }
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
        smSiteInputRef.current?.blur();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSmSiteIndex((prev) => {
        const next = prev + 1;
        return next >= filteredSmSites.length ? filteredSmSites.length - 1 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSmSiteIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? 0 : next;
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

        smSiteInputRef.current?.blur();
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
        const index = next >= filteredSmLedgers.length ? filteredSmLedgers.length - 1 : next;
        const ledger = filteredSmLedgers[index];
        if (ledger) {
          setSmSelectedLedgerId(ledger.id);
          setSmLedgerSearchVal(ledger.name.toUpperCase());
          setTimeout(() => {
            const el = document.getElementById(`sm-acct-opt-${index}`);
            if (el) el.scrollIntoView({ block: "nearest" });
          }, 10);
        }
        return index;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSmLedgerIndex((prev) => {
        const next = prev - 1;
        const index = next < 0 ? 0 : next;
        const ledger = filteredSmLedgers[index];
        if (ledger) {
          setSmSelectedLedgerId(ledger.id);
          setSmLedgerSearchVal(ledger.name.toUpperCase());
          setTimeout(() => {
            const el = document.getElementById(`sm-acct-opt-${index}`);
            if (el) el.scrollIntoView({ block: "nearest" });
          }, 10);
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

    // Filter out auto-debit, ledger direct entries, and company ledger entries from daybook rendering & calculations
    const filteredDbData = daybookData.filter((item: any) => 
      item.referenceNumber !== "AUTO_DEBIT" && 
      item.description !== "LEDGER DIRECT ENTRY" &&
      item.description !== "COMPANY_LEDGER_ENTRY"
    );

    const sorted = [...filteredDbData].sort((a: any, b: any) => {
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
        particulars: parsed.isCompany
          ? (parsed.material ? parsed.material.toUpperCase() : cleanParticular.toUpperCase())
          : cleanParticular.toUpperCase(),
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

  // CUSTOM PRINT HELPERS & HANDLERS
  const parseInputDate = (str: string): Date | null => {
    if (!str) return null;
    const cleaned = str.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) return d;
    }
    const dotParts = cleaned.split(".");
    if (dotParts.length === 3) {
      const day = parseInt(dotParts[0], 10);
      const month = parseInt(dotParts[1], 10) - 1;
      let year = parseInt(dotParts[2], 10);
      if (dotParts[2].length === 2) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const slashParts = cleaned.split("/");
    if (slashParts.length === 3) {
      const day = parseInt(slashParts[0], 10);
      const month = parseInt(slashParts[1], 10) - 1;
      let year = parseInt(slashParts[2], 10);
      if (slashParts[2].length === 2) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  const stripTime = (d: Date): Date => {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const formatPrintDateLedger = (dateInput: Date | string): string => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}`;
  };

  const formatPrintDateDaybook = (dateInput: Date | string): string => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTitleDate = (dateStr: string): string => {
    const d = parseInputDate(dateStr);
    if (!d) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).substring(2);
    return `${day}.${month}.${year}`;
  };

  const getAccountName = (expenseType: string): string => {
    const text = (expenseType || "").trim().toUpperCase();
    if (text.startsWith("TO ")) return text.substring(3).trim();
    if (text.startsWith("BY ")) return text.substring(3).trim();
    return text;
  };

  const getPrintParticulars = (item: any): string => {
    const mode = item.paymentMode || "CASH";
    const clean = mode.trim();
    if (clean.startsWith("{") && clean.endsWith("}")) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.qty && parsed.rate) {
          const unitStr = parsed.unit ? ` ${parsed.unit}` : "";
          return `${parsed.qty}${unitStr} @ ${parsed.rate}/=`;
        }
        if (parsed.material) {
          return parsed.material.toUpperCase();
        }
      } catch {
        // fallback
      }
    }
    return clean.toUpperCase();
  };

  const getDaybookPrintParticulars = (item: any): string => {
    const type = item.parsedType || "TO";
    const cleanName = getAccountName(item.expenseType || "");
    const prefix = type === "TO" ? "To" : "By";
    return `${prefix} ${cleanName}`;
  };

  const getGroupedLedgersData = () => {
    if (!daybookData) return [];
    const groups: { [name: string]: any[] } = {};
    daybookData.forEach((item: any) => {
      const text = item.expenseType || "";
      const name = getAccountName(text);
      if (!name) return;
      if (!groups[name]) {
        groups[name] = [];
      }
      groups[name].push(item);
    });

    const startDate = parseInputDate(printStartDate);
    const endDate = parseInputDate(printEndDate);
    const groupedList: { name: string; rows: any[] }[] = [];

    Object.keys(groups).forEach((name) => {
      const sorted = [...groups[name]].sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      let cumulativeBalance = 0.0;
      let openingBalance = 0.0;
      const filteredRows: any[] = [];

      sorted.forEach((item: any) => {
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

        const debitVal = isDebit ? item.amount : 0.0;
        const creditVal = !isDebit ? item.amount : 0.0;
        const txDate = stripTime(new Date(item.date));

        if (startDate && txDate < stripTime(startDate)) {
          openingBalance = openingBalance + debitVal - creditVal;
        } else if ((!startDate || txDate >= stripTime(startDate)) && (!endDate || txDate <= stripTime(endDate))) {
          if (startDate && filteredRows.length === 0 && openingBalance !== 0) {
            filteredRows.push({
              isOpening: true,
              date: startDate,
              particulars: "OPENING BALANCE",
              debit: openingBalance > 0 ? openingBalance : 0,
              credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
              drCr: openingBalance > 0 ? "Dr" : "Cr",
              amount: Math.abs(openingBalance)
            });
            cumulativeBalance = openingBalance;
          }

          cumulativeBalance = cumulativeBalance + debitVal - creditVal;
          const status = cumulativeBalance > 0 ? "Dr" : cumulativeBalance < 0 ? "Cr" : "Nil";

          filteredRows.push({
            isOpening: false,
            date: new Date(item.date),
            particulars: getPrintParticulars(item),
            debit: debitVal,
            credit: creditVal,
            drCr: status,
            amount: Math.abs(cumulativeBalance),
            referenceNumber: item.referenceNumber || ""
          });
        }
      });

      if (startDate && filteredRows.length === 0 && openingBalance !== 0) {
        filteredRows.push({
          isOpening: true,
          date: startDate,
          particulars: "OPENING BALANCE",
          debit: openingBalance > 0 ? openingBalance : 0,
          credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
          drCr: openingBalance > 0 ? "Dr" : "Cr",
          amount: Math.abs(openingBalance)
        });
      }

      if (filteredRows.length > 0) {
        groupedList.push({
          name: name.toUpperCase(),
          rows: filteredRows
        });
      }
    });

    return groupedList.sort((a: any, b: any) => a.name.localeCompare(b.name));
  };

  const getPrintDaybookItems = () => {
    if (!daybookData) return { items: [], openingBalance: 0 };
    const filteredDbData = daybookData.filter((item: any) => 
      item.referenceNumber !== "AUTO_DEBIT" && 
      item.description !== "LEDGER DIRECT ENTRY" &&
      item.description !== "COMPANY_LEDGER_ENTRY"
    );

    const sorted = [...filteredDbData].sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const startDate = parseInputDate(printStartDate);
    const endDate = parseInputDate(printEndDate);

    let cumulativeBalance = 0.0;
    let openingBalance = 0.0;
    const items: any[] = [];

    sorted.forEach((item: any) => {
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

      const debitVal = isDebit ? item.amount : 0.0;
      const creditVal = !isDebit ? item.amount : 0.0;
      const txDate = stripTime(new Date(item.date));

      if (startDate && txDate < stripTime(startDate)) {
        openingBalance = openingBalance + debitVal - creditVal;
      } else if ((!startDate || txDate >= stripTime(startDate)) && (!endDate || txDate <= stripTime(endDate))) {
        if (startDate && items.length === 0 && openingBalance !== 0) {
          items.push({
            isOpening: true,
            date: startDate,
            parsedType: openingBalance > 0 ? "TO" : "BY",
            particulars: "OPENING BALANCE",
            displayParticular: "OPENING BALANCE",
            debit: openingBalance > 0 ? openingBalance : 0,
            credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
            drCr: openingBalance > 0 ? "Dr" : (openingBalance < 0 ? "Cr" : "Nil"),
            runningBalance: openingBalance
          });
          cumulativeBalance = openingBalance;
        }

        cumulativeBalance = cumulativeBalance + debitVal - creditVal;
        const status = cumulativeBalance > 0 ? "Dr" : (cumulativeBalance < 0 ? "Cr" : "Nil");

        items.push({
          isOpening: false,
          date: new Date(item.date),
          parsedType: isDebit ? "TO" : "BY",
          particulars: getDaybookPrintParticulars(item),
          displayParticular: getDaybookPrintParticulars(item),
          debit: debitVal,
          credit: creditVal,
          drCr: status,
          runningBalance: cumulativeBalance
        });
      }
    });

    if (startDate && items.length === 0 && openingBalance !== 0) {
      items.push({
        isOpening: true,
        date: startDate,
        parsedType: openingBalance > 0 ? "TO" : "BY",
        particulars: "OPENING BALANCE",
        displayParticular: "OPENING BALANCE",
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        drCr: openingBalance > 0 ? "Dr" : (openingBalance < 0 ? "Cr" : "Nil"),
        runningBalance: openingBalance
      });
    }

    return { items, openingBalance };
  };

  const formatPrintAmount = (val: number): string => {
    if (val === undefined || val === null || isNaN(val)) return "0.00";
    return val.toFixed(2);
  };

  const handleOpenPrintModal = (target: "ledger" | "daybook") => {
    if (!dbSelectedSiteId) {
      toast.error("Please select a Site location first");
      return;
    }
    if (target === "ledger") {
      setPrintStartDate("");
      setPrintEndDate("");
      setPrintTargetReport("ledger");
      setPrintLayoutMode("ledger");
      return;
    }
    setPrintTargetType(target);
    setShowDateRangeModal(true);
  };

  const handleExecutePrint = () => {
    if (!printTargetType) return;
    setPrintTargetReport(printTargetType);
    setShowDateRangeModal(false);
    setPrintLayoutMode(printTargetType);
  };

  const triggerFinalPrint = (copies: 1 | 2) => {
    setCopiesCount(copies);
    setShowCopiesDialog(false);
    if (printTargetReport) {
      setPrintLayoutMode(printTargetReport);
    }
  };

  const handlePrintLedgerPDF = () => {
    if (!lgSelectedSiteId) {
      toast.error("Please select a Site location first");
      return;
    }
    if (!lgSelectedLedgerId) {
      toast.error("Please select an Account Ledger first");
      return;
    }
    setPrintTargetReport("ledger");
    setPrintLayoutMode("ledger");
  };

  const handlePrintSummaryPDF = () => {
    if (!smSelectedSiteId) {
      toast.error("Please select a Site location first");
      return;
    }
    setPrintTargetReport("summary");
    setPrintLayoutMode("summary");
  };

  // EXPORT EXCEL & PDF HANDLERS
  const handlePrintPDF = () => {
    if (!dbSelectedSiteId) {
      toast.error("Please select a Site location first");
      return;
    }
    handleOpenPrintModal("daybook");
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

    const headers = ["Account Name", "Address", "Mobile No.", "Dr/Cr", "Balance", "Date"];
    const rows = dataToExport.map((item: any) => {
      return [
        item.name.toUpperCase(),
        item.address ? item.address.toUpperCase() : "-",
        item.phone || "-",
        item.status,
        item.balance,
        summaryDates[item.id] || getTodayDateStr()
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

  const renderLedgerPrintContent = (copyIndicator: string) => {
    const isSingle = lgSelectedLedgerId && lgSelectedLedgerId !== "all";
    const copyLabel = copyIndicator === "OR" ? "ORIGINAL COPY" : "DUPLICATE COPY";
    
    if (isSingle) {
      const selectedLedgerObj = activeSiteLedgers.find((l: any) => String(l.id) === String(lgSelectedLedgerId)) || 
                               (ledgers ? ledgers.find((l: any) => String(l.id) === String(lgSelectedLedgerId)) : null);
      const selectedLedgerName = selectedLedgerObj ? selectedLedgerObj.name : "";
      const selectedLedgerPhone = selectedLedgerObj ? selectedLedgerObj.phone : "";
      const selectedLedgerAddress = selectedLedgerObj 
        ? (() => {
            const details = parsePartyDetails(selectedLedgerObj.contactPerson);
            return details ? details.address : selectedLedgerObj.contactPerson;
          })()
        : "";

      return (
          <div className="ledger-print-wrapper p-4 bg-white">
          <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
            <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">{copyLabel}</span>
            <span className="font-mono text-xs font-black text-slate-900">DATE: {getTodayDateStr()}</span>
          </div>
          <div className="mb-4 text-xs font-bold font-mono text-slate-900 space-y-1">
            <div className="flex">
              <span className="w-24 text-slate-500">Name :</span>
              <span className="font-black uppercase text-slate-900 supplier-name">
                {translateBilingual(selectedLedgerName)}
              </span>
            </div>
            <div className="flex">
              <span className="w-24 text-slate-500">Address :</span>
              <span className="font-black uppercase text-slate-900 supplier-info">
                {translateBilingual(selectedLedgerAddress)}
              </span>
            </div>
            <div className="flex">
              <span className="w-24 text-slate-500">Phone No. :</span>
              <span className="font-black text-slate-900">
                {selectedLedgerPhone || ""}
              </span>
            </div>
          </div>
          
          <table className="ledger-print-table w-full border-collapse font-mono text-xs text-slate-900">
            <thead>
              <tr className="border-t border-b border-black">
                <th className="py-1 px-1 border-r border-black text-center w-20">DATE</th>
                <th className="py-1 px-1 border-r border-black text-center w-24">CHALLAN NO</th>
                <th className="py-1 px-1 border-r border-black text-left">PARTICULARS</th>
                <th className="py-1 px-1 border-r border-black text-right w-16">QTY</th>
                <th className="py-1 px-1 border-r border-black text-center w-16">UNIT</th>
                <th className="py-1 px-1 border-r border-black text-right w-20">RATE</th>
                <th className="py-1 px-1 border-r border-black text-right w-24">DEBIT</th>
                <th className="py-1 px-1 border-r border-black text-right w-24">CREDIT</th>
                <th className="py-1 px-1 border-r border-black text-center w-14">DR/CR</th>
                <th className="py-1 px-1 text-right w-28">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {processedLgData.items.map((row: any, idx: number) => {
                const rowDrCr = (row.debit > 0 || row.parsedType === "TO") ? "DR" : "CR";
                const runningBalSign = row.runningBalance < 0 ? "CR " : row.runningBalance > 0 ? "DR " : "";
                return (
                  <tr key={idx} className="border-b border-black last:border-b-0">
                    <td className="py-1 px-1 border-r border-black text-center">
                      {formatRenderDate(row.date)}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-center uppercase font-bold text-slate-900 w-24">
                      {row.referenceNumber || "-"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-left uppercase">
                      {row.particulars}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-right">
                      {row.isStructured ? row.qty : "-"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-center">
                      {row.isStructured ? row.unit : "-"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-right">
                      {row.isStructured ? row.rate : "-"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-right">
                      {row.debit > 0 ? formatPrintAmount(row.debit) : "0.00"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-right">
                      {row.credit > 0 ? formatPrintAmount(row.credit) : "0.00"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-center">{rowDrCr}</td>
                    <td className="py-1 px-1 text-right">
                      {row.runningBalance === 0 ? "NILL" : `${runningBalSign}${Math.abs(row.runningBalance).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[11px] text-slate-955">
                <td colSpan={6} className="border-r border-slate-400 px-2 py-1.5 text-right font-black">TOTAL:</td>
                <td className="border-r border-slate-400 px-2 py-1.5 text-right text-slate-955 font-black">
                  {processedLgData.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="border-r border-slate-400 px-2 py-1.5 text-right text-slate-955 font-black">
                  {processedLgData.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="border-r border-slate-400 px-2 py-1.5 text-center text-slate-955 font-black">
                  {processedLgData.finalBalance === 0 ? "NIL" : (processedLgData.finalBalance < 0 ? "CR" : "DR")}
                </td>
                <td className="px-2 py-1.5 text-right text-slate-955 font-black">
                  {processedLgData.finalBalance === 0 ? "NILL" : `${processedLgData.finalBalance < 0 ? "CR " : "DR "}${Math.abs(processedLgData.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    } else {
      const ledgerPrintData = getGroupedLedgersData();
      return (
        <div className="ledger-print-wrapper p-4 bg-white text-slate-900">
          <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
            <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">{copyLabel}</span>
            <span className="font-mono text-xs font-black">DATE: {getTodayDateStr()}</span>
          </div>
          <div className="text-center font-bold text-base uppercase mb-4 estimate-title">
            {printEndDate ? `LEDGER UP TO ( ${formatTitleDate(printEndDate)} )` : "LEDGER ( ALL TRANSACTIONS )"}
          </div>
          {ledgerPrintData.map((group: any) => (
            <div key={group.name} className="ledger-group-block mb-6">
              <div className="font-bold text-xs uppercase mb-1 supplier-name">
                Name: <span className="underline">{translateBilingual(group.name)}</span>
              </div>
              <table className="ledger-print-table w-full border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-t border-b border-black">
                    <th className="py-1 px-1 border-r border-black text-center w-20">DATE</th>
                    <th className="py-1 px-1 border-r border-black text-center w-24">CHALLAN NO</th>
                    <th className="py-1 px-1 border-r border-black text-left">PARTICULARS</th>
                    <th className="py-1 px-1 border-r border-black text-right w-24">DEBIT</th>
                    <th className="py-1 px-1 border-r border-black text-right w-24">CREDIT</th>
                    <th className="py-1 px-1 border-r border-black text-center w-14">DR/CR</th>
                    <th className="py-1 px-1 text-right w-28">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="border-b border-black last:border-b-0">
                      <td className="py-1 px-1 border-r border-black text-center">
                        {row.isOpening ? formatTitleDate(printStartDate) : formatPrintDateLedger(row.date)}
                      </td>
                      <td className="py-1 px-1 border-r border-black text-center uppercase font-bold text-slate-900 w-24">
                        {row.isOpening ? "-" : (row.referenceNumber || "-")}
                      </td>
                      <td className="py-1 px-1 border-r border-black text-left uppercase">
                        {translateBilingual(row.particulars)}
                      </td>
                      <td className="py-1 px-1 border-r border-black text-right">
                        {row.debit > 0 ? formatPrintAmount(row.debit) : "0.00"}
                      </td>
                      <td className="py-1 px-1 border-r border-black text-right">
                        {row.credit > 0 ? formatPrintAmount(row.credit) : "0.00"}
                      </td>
                      <td className="py-1 px-1 border-r border-black text-center">{row.drCr}</td>
                      <td className="py-1 px-1 text-right">{formatPrintAmount(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      );
    }
  };

  const renderSummaryPrintContent = (copyIndicator: string) => {
    const copyLabel = copyIndicator === "OR" ? "ORIGINAL COPY" : "DUPLICATE COPY";
    const selectedLedgerObj = smSelectedLedgerId === "all" || !smSelectedLedgerId
      ? null
      : summaryLedgersList.find((l: any) => String(l.id) === String(smSelectedLedgerId));

    const selectedLedgerName = selectedLedgerObj ? selectedLedgerObj.name : "";
    const selectedLedgerPhone = selectedLedgerObj ? selectedLedgerObj.phone : "";
    const selectedLedgerAddress = selectedLedgerObj ? selectedLedgerObj.address : "";

    const singleAccountBalance = selectedLedgerObj ? selectedLedgerObj.balance : 0;
    const singleAccountStatus = selectedLedgerObj ? selectedLedgerObj.status : "NIL";
    const singleAccountDebit = selectedLedgerObj ? selectedLedgerObj.totalDebit : 0;
    const singleAccountCredit = selectedLedgerObj ? selectedLedgerObj.totalCredit : 0;

    return (
      <div className="summary-print-wrapper p-4 bg-white font-mono text-slate-900">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">{copyLabel}</span>
          <span className="font-mono text-xs font-black">DATE: {getTodayDateStr()}</span>
        </div>
        <div className="text-center font-bold text-base uppercase mb-4 estimate-title">
          ACCOUNTS SUMMARY {smSelectedSiteId ? `( SITE: ${sites?.find((s: any) => s.id === smSelectedSiteId)?.name.toUpperCase() || ""} )` : ""}
        </div>

        {selectedLedgerObj ? (
          <div className="space-y-6 text-slate-900 font-mono">
            <div className="border-b-2 border-black pb-4 space-y-1">
              <div className="flex">
                <span className="w-24 text-slate-500 uppercase">Name :</span>
                <span className="font-black uppercase text-slate-900 supplier-name">
                  {translateBilingual(selectedLedgerName)}
                </span>
              </div>
              <div className="flex">
                <span className="w-24 text-slate-500 uppercase">Address :</span>
                <span className="font-black uppercase text-slate-900 supplier-info">
                  {translateBilingual(selectedLedgerAddress)}
                </span>
              </div>
              <div className="flex">
                <span className="w-24 text-slate-500 uppercase">Mobile No :</span>
                <span className="font-black text-slate-900">
                  {selectedLedgerPhone || ""}
                </span>
              </div>
            </div>

            <div className="border border-black p-4 rounded space-y-4">
              <h5 className="font-black text-xs uppercase tracking-wider text-slate-700">Financial Summary</h5>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border border-black p-3 bg-slate-50">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Debit</div>
                  <div className="text-sm font-black text-slate-900">
                    {singleAccountDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="border border-black p-3 bg-slate-50">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Credit</div>
                  <div className="text-sm font-black text-slate-900">
                    {singleAccountCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="border border-black p-3 bg-slate-50">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Net Balance</div>
                  <div className="text-sm font-black text-slate-900">
                    {singleAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {singleAccountStatus}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <table className="summary-print-table w-full border-collapse font-mono text-xs text-slate-900">
              <thead>
                <tr className="border-t border-b border-black">
                  <th className="py-1.5 px-2 border-r border-black text-center w-12">S.N.</th>
                  <th className="py-1.5 px-2 border-r border-black text-left">Account Name</th>
                  <th className="py-1.5 px-2 border-r border-black text-left">Address</th>
                  <th className="py-1.5 px-2 border-r border-black text-center w-28">Mobile No.</th>
                  <th className="py-1.5 px-2 border-r border-black text-center w-16">Dr/Cr</th>
                  <th className="py-1.5 px-2 text-right w-36">Balance</th>
                </tr>
              </thead>
              <tbody>
                {summaryLedgersList.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-black last:border-b-0">
                    <td className="py-1 px-2 border-r border-black text-center">{idx + 1}</td>
                    <td className="py-1 px-2 border-r border-black text-left font-black">
                      {item.name?.toUpperCase() || "-"}
                    </td>
                    <td className="py-1 px-2 border-r border-black text-left text-[11px]">
                      {item.address?.toUpperCase() || "-"}
                    </td>
                    <td className="py-1 px-2 border-r border-black text-center text-[11px]">{item.phone || "-"}</td>
                    <td className="py-1 px-2 border-r border-black text-center font-bold">{item.status}</td>
                    <td className="py-1 px-2 text-right font-black text-slate-900">
                      {item.balance === 0 ? "NILL" : item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 border border-black p-3 bg-slate-50 space-y-2 font-mono text-slate-900">
              {(() => {
                const drSum = summaryLedgersList.reduce((acc, curr) => acc + (curr.status === "DR" ? curr.balance : 0), 0);
                const crSum = summaryLedgersList.reduce((acc, curr) => acc + (curr.status === "CR" ? curr.balance : 0), 0);
                return (
                  <div className="flex justify-between font-black text-xs">
                    <span>TOTAL DEBIT (DR): {drSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span>TOTAL CREDIT (CR): {crSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDaybookPrintContent = (copyIndicator: string) => {
    const copyLabel = copyIndicator === "OR" ? "ORIGINAL COPY" : "DUPLICATE COPY";
    const daybookPrintData = getPrintDaybookItems();
    return (
      <div className="daybook-print-wrapper p-4 bg-white text-slate-900">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">{copyLabel}</span>
          <span className="font-mono text-xs font-black">DATE: {getTodayDateStr()}</span>
        </div>
        <div className="text-center font-bold text-base uppercase mb-1 estimate-title">
          DAY BOOK {formatTitleDate(printStartDate)} TO {formatTitleDate(printEndDate)}
        </div>
        <div className="text-right text-[10px] font-bold mb-2">Page 1 of 1</div>
        <table className="daybook-print-table w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-t border-b border-black">
              <th className="py-1 px-1.5 border-r border-black text-center w-24">DATE</th>
              <th className="py-1 px-1.5 border-r border-black text-left">PARTICULARS</th>
              <th className="py-1 px-1.5 border-r border-black text-right w-28">DEBIT</th>
              <th className="py-1 px-1.5 border-r border-black text-right w-28">CREDIT</th>
              <th className="py-1 px-1.5 border-r border-black text-center w-14">DR/CR</th>
              <th className="py-1 px-1.5 text-right w-28">R-TOTALS</th>
            </tr>
          </thead>
          <tbody>
            {daybookPrintData.items.map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-black last:border-b-0">
                <td className="py-1 px-1.5 border-r border-black text-center">
                  {row.isOpening ? formatTitleDate(printStartDate) : formatPrintDateDaybook(row.date)}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-left uppercase">
                  {row.particulars}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-right">
                  {row.debit > 0 ? formatPrintAmount(row.debit) : "0.00"}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-right">
                  {row.credit > 0 ? formatPrintAmount(row.credit) : "0.00"}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-center">{row.drCr}</td>
                <td className="py-1 px-1.5 text-right">{row.runningBalance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCopiesSelectorModal = () => {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] animate-in fade-in duration-100 no-print">
        <div className="bg-[#D3DFEE] border-2 border-slate-955 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden w-[380px] max-w-[95vw] font-mono flex flex-col select-none">
          <div className="border-b-2 border-slate-955 px-3 py-2 flex items-center justify-between text-white shrink-0 bg-slate-900">
            <span className="text-xs font-black uppercase tracking-wider">PRINT COPIES / प्रतियों का चयन</span>
            <button
              type="button"
              onClick={() => setShowCopiesDialog(false)}
              className="bg-red-650 hover:bg-red-700 text-white font-black text-xs px-2.5 py-1 rounded border border-slate-955 active:translate-y-0.5 cursor-pointer font-bold"
            >
              X
            </button>
          </div>
          <div className="p-6 bg-[#E5ECF4] space-y-4 text-slate-955 animate-in fade-in">
            <p className="text-center font-bold text-sm uppercase text-slate-800 tracking-wider">
              Select copies to print:
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                id="btn-print-copy-1"
                onClick={() => triggerFinalPrint(1)}
                className="w-full py-2.5 bg-[#FFE600] text-slate-955 border-2 border-slate-900 font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#E5C300] active:translate-y-0.5 active:shadow-none transition-all text-left px-4 flex justify-between items-center"
              >
                <span>1. 1 COPY (ORIGINAL)</span>
                <span className="text-[10px] text-slate-600 font-normal">[Press 1]</span>
              </button>
              <button
                type="button"
                id="btn-print-copy-2"
                onClick={() => triggerFinalPrint(2)}
                className="w-full py-2.5 bg-white text-slate-955 border-2 border-slate-900 font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-100 active:translate-y-0.5 active:shadow-none transition-all text-left px-4 flex justify-between items-center"
              >
                <span>2. 2 COPIES (ORIGINAL & DUPLICATE)</span>
                <span className="text-[10px] text-slate-600 font-normal">[Press 2]</span>
              </button>
            </div>
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowCopiesDialog(false)}
                className="px-4 py-1.5 bg-slate-200 border-2 border-slate-900 text-slate-900 font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-350 active:translate-y-0.5 active:shadow-none transition-all"
              >
                Cancel [Esc]
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const renderLedgerSinglePageContent = (chunk: any[], chunkIdx: number, totalChunks: number, selectedLedgerObj: any) => {
    const selectedLedgerName = selectedLedgerObj ? selectedLedgerObj.name : "";
    const selectedLedgerPhone = selectedLedgerObj ? selectedLedgerObj.phone : "";
    const selectedLedgerAddress = selectedLedgerObj 
      ? (() => {
          const details = parsePartyDetails(selectedLedgerObj.contactPerson);
          return details ? details.address : selectedLedgerObj.contactPerson;
        })()
      : "";

    return (
      <div className="ledger-print-wrapper p-4 bg-white text-slate-900">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">
            LEDGER REPORT / खाता बही
          </span>
          <span className="font-mono text-xs font-black">
            DATE: {getTodayDateStr()} | Page {chunkIdx + 1} of {totalChunks}
          </span>
        </div>
        <div className="mb-4 text-xs font-bold font-mono space-y-1">
          <div className="flex">
            <span className="w-24 text-slate-500">Name :</span>
            <span className="font-black uppercase text-slate-900 supplier-name">
              {translateBilingual(selectedLedgerName)}
            </span>
          </div>
          <div className="flex">
            <span className="w-24 text-slate-500">Address :</span>
            <span className="font-black uppercase text-slate-900 supplier-info">
              {translateBilingual(selectedLedgerAddress)}
            </span>
          </div>
          <div className="flex">
            <span className="w-24 text-slate-500">Phone No. :</span>
            <span className="font-black text-slate-900">
              {selectedLedgerPhone || ""}
            </span>
          </div>
        </div>
        
        <table className="ledger-print-table w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-t border-b border-black">
              <th className="py-1 px-1 border-r border-black text-center w-20">DATE</th>
              <th className="py-1 px-1 border-r border-black text-center w-24">CHALLAN NO</th>
              <th className="py-1 px-1 border-r border-black text-left">PARTICULARS</th>
              <th className="py-1 px-1 border-r border-black text-right w-16">QTY</th>
              <th className="py-1 px-1 border-r border-black text-center w-16">UNIT</th>
              <th className="py-1 px-1 border-r border-black text-right w-20">RATE</th>
              <th className="py-1 px-1 border-r border-black text-right w-24">DEBIT</th>
              <th className="py-1 px-1 border-r border-black text-right w-24">CREDIT</th>
              <th className="py-1 px-1 border-r border-black text-center w-14">DR/CR</th>
              <th className="py-1 px-1 text-right w-28">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {chunk.map((row: any, idx: number) => {
              const rowDrCr = (row.debit > 0 || row.parsedType === "TO") ? "DR" : "CR";
              const runningBalSign = row.runningBalance < 0 ? "CR " : row.runningBalance > 0 ? "DR " : "";
              return (
                <tr key={idx} className="border-b border-black last:border-b-0">
                  <td className="py-1 px-1 border-r border-black text-center">
                    {formatRenderDate(row.date)}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-center uppercase font-bold text-slate-900 w-24">
                    {row.referenceNumber || "-"}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-left uppercase">
                    {row.particulars}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-right">
                    {row.isStructured ? row.qty : "-"}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-center">
                    {row.isStructured ? row.unit : "-"}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-right">
                    {row.isStructured ? row.rate : "-"}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-right">
                    {row.debit > 0 ? formatPrintAmount(row.debit) : "0.00"}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-right">
                    {row.credit > 0 ? formatPrintAmount(row.credit) : "0.00"}
                  </td>
                  <td className="py-1 px-1 border-r border-black text-center">{rowDrCr}</td>
                  <td className="py-1 px-1 text-right">
                    {row.runningBalance === 0 ? "NILL" : `${runningBalSign}${Math.abs(row.runningBalance).toFixed(2)}`}
                  </td>
                </tr>
              );
            })}
            {chunkIdx === totalChunks - 1 && (
              <tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[11px] text-slate-955">
                <td colSpan={6} className="border-r border-slate-400 px-2 py-1.5 text-right font-black">TOTAL:</td>
                <td className="border-r border-slate-400 px-2 py-1.5 text-right text-slate-955 font-black">
                  {processedLgData.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="border-r border-slate-400 px-2 py-1.5 text-right text-slate-955 font-black">
                  {processedLgData.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="border-r border-slate-400 px-2 py-1.5 text-center text-slate-955 font-black">
                  {processedLgData.finalBalance === 0 ? "NIL" : (processedLgData.finalBalance < 0 ? "CR" : "DR")}
                </td>
                <td className="px-2 py-1.5 text-right text-slate-955 font-black">
                  {processedLgData.finalBalance === 0 ? "NILL" : `${processedLgData.finalBalance < 0 ? "CR " : "DR "}${Math.abs(processedLgData.finalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLedgerGroupPageContent = (pageGroups: any[], pageIdx: number, totalPages: number) => {
    return (
      <div className="ledger-print-wrapper p-4 bg-white text-slate-900">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">
            ALL LEDGERS REPORT / समस्त खाता बही
          </span>
          <span className="font-mono text-xs font-black">
            DATE: {getTodayDateStr()} | Page {pageIdx + 1} of {totalPages}
          </span>
        </div>
        
        {pageGroups.map((group: any, gIdx: number) => (
          <div key={gIdx} className="ledger-group-block mb-6">
            <div className="font-bold text-xs uppercase mb-1 supplier-name">
              Name: <span className="underline">{translateBilingual(group.name)}</span> {!group.isFirstPart && <span className="text-slate-500 lowercase font-normal">(continued)</span>}
            </div>
            <table className="ledger-print-table w-full border-collapse font-mono text-xs">
              <thead>
                <tr className="border-t border-b border-black">
                  <th className="py-1 px-1 border-r border-black text-center w-20">DATE</th>
                  <th className="py-1 px-1 border-r border-black text-center w-24">CHALLAN NO</th>
                  <th className="py-1 px-1 border-r border-black text-left">PARTICULARS</th>
                  <th className="py-1 px-1 border-r border-black text-right w-24">DEBIT</th>
                  <th className="py-1 px-1 border-r border-black text-right w-24">CREDIT</th>
                  <th className="py-1 px-1 border-r border-black text-center w-14">DR/CR</th>
                  <th className="py-1 px-1 text-right w-28">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-black last:border-b-0">
                    <td className="py-1 px-1 border-r border-black text-center">
                      {row.isOpening ? formatTitleDate(printStartDate) : formatPrintDateLedger(row.date)}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-center uppercase font-bold text-slate-900 w-24">
                      {row.isOpening ? "-" : (row.referenceNumber || "-")}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-left uppercase">
                      {row.particulars}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-right">
                      {row.debit > 0 ? formatPrintAmount(row.debit) : "0.00"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-right">
                      {row.credit > 0 ? formatPrintAmount(row.credit) : "0.00"}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-center">{row.drCr}</td>
                    <td className="py-1 px-1 text-right">{formatPrintAmount(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  const renderSummaryPageContent = (chunk: any[], chunkIdx: number, totalChunks: number, selectedLedgerObj: any) => {
    const selectedLedgerName = selectedLedgerObj ? selectedLedgerObj.name : "";
    const selectedLedgerPhone = selectedLedgerObj ? selectedLedgerObj.phone : "";
    const selectedLedgerAddress = selectedLedgerObj ? selectedLedgerObj.address : "";

    const singleAccountBalance = selectedLedgerObj ? selectedLedgerObj.balance : 0;
    const singleAccountStatus = selectedLedgerObj ? selectedLedgerObj.status : "NIL";
    const singleAccountDebit = selectedLedgerObj ? selectedLedgerObj.totalDebit : 0;
    const singleAccountCredit = selectedLedgerObj ? selectedLedgerObj.totalCredit : 0;

    return (
      <div className="summary-print-wrapper p-4 bg-white font-mono text-slate-900">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">
            ACCOUNTS SUMMARY
          </span>
          <span className="font-mono text-xs font-black">
            DATE: {getTodayDateStr()} | Page {chunkIdx + 1} of {totalChunks}
          </span>
        </div>

        {selectedLedgerObj ? (
          <div className="space-y-6 text-slate-900 font-mono">
            <div className="border-b-2 border-black pb-4 space-y-1">
              <div className="flex">
                <span className="w-24 text-slate-500 uppercase">Name :</span>
                <span className="font-black uppercase text-slate-900 supplier-name">
                  {selectedLedgerName?.toUpperCase() || ""}
                </span>
              </div>
              <div className="flex">
                <span className="w-24 text-slate-500 uppercase">Address :</span>
                <span className="font-black uppercase text-slate-900 supplier-info">
                  {selectedLedgerAddress?.toUpperCase() || ""}
                </span>
              </div>
              <div className="flex">
                <span className="w-24 text-slate-500 uppercase">Mobile No :</span>
                <span className="font-black text-slate-900">
                  {selectedLedgerPhone || ""}
                </span>
              </div>
            </div>

            <div className="border border-black p-4 rounded space-y-4">
              <h5 className="font-black text-xs uppercase tracking-wider text-slate-700">Financial Summary</h5>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border border-black p-3 bg-slate-50">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Debit</div>
                  <div className="text-sm font-black text-slate-900">
                    {singleAccountDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="border border-black p-3 bg-slate-50">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Credit</div>
                  <div className="text-sm font-black text-slate-900">
                    {singleAccountCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="border border-black p-3 bg-slate-50">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Net Balance</div>
                  <div className="text-sm font-black text-slate-900">
                    {singleAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} {singleAccountStatus}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <table className="summary-print-table w-full border-collapse font-mono text-xs text-slate-900">
              <thead>
                <tr className="border-t border-b border-black">
                  <th className="py-1.5 px-2 border-r border-black text-center w-12">S.N.</th>
                  <th className="py-1.5 px-2 border-r border-black text-left">Account Name</th>
                  <th className="py-1.5 px-2 border-r border-black text-left">Address</th>
                  <th className="py-1.5 px-2 border-r border-black text-center w-28">Mobile No.</th>
                  <th className="py-1.5 px-2 border-r border-black text-center w-16">Dr/Cr</th>
                  <th className="py-1.5 px-2 text-right w-36">Balance</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((item: any, idx: number) => {
                  const serialNo = chunkIdx * 18 + idx + 1;
                  return (
                    <tr key={idx} className="border-b border-black last:border-b-0">
                      <td className="py-1 px-2 border-r border-black text-center">{serialNo}</td>
                      <td className="py-1 px-2 border-r border-black text-left font-black">
                        {item.name?.toUpperCase() || "-"}
                      </td>
                      <td className="py-1 px-2 border-r border-black text-left text-[11px]">
                        {item.address?.toUpperCase() || "-"}
                      </td>
                      <td className="py-1 px-2 border-r border-black text-center text-[11px]">{item.phone || "-"}</td>
                      <td className="py-1 px-2 border-r border-black text-center font-bold">{item.status}</td>
                      <td className="py-1 px-2 text-right font-black text-slate-900">
                        {item.balance === 0 ? "NILL" : item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {chunkIdx === totalChunks - 1 && (() => {
              const drSum = summaryLedgersList.reduce((acc: number, curr: any) => acc + (curr.status === "DR" ? curr.balance : 0), 0);
              const crSum = summaryLedgersList.reduce((acc: number, curr: any) => acc + (curr.status === "CR" ? curr.balance : 0), 0);
              return (
                <table className="summary-print-table w-full border-collapse font-mono text-xs">
                  <tbody>
                    <tr className="border-t-2 border-black bg-slate-50 font-black">
                      <td className="py-1.5 px-2 border-r border-black w-12"></td>
                      <td colSpan={2} className="py-1.5 px-2 border-r border-black text-right font-black uppercase">TOTAL DEBIT:</td>
                      <td className="py-1.5 px-2 border-r border-black text-center w-28"></td>
                      <td className="py-1.5 px-2 border-r border-black text-center w-16 font-black" style={{color: "#16a34a"}}>DR</td>
                      <td className="py-1.5 px-2 text-right font-black w-36">{drSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr className="border-t border-black bg-slate-50 font-black">
                      <td className="py-1.5 px-2 border-r border-black w-12"></td>
                      <td colSpan={2} className="py-1.5 px-2 border-r border-black text-right font-black uppercase">TOTAL CREDIT:</td>
                      <td className="py-1.5 px-2 border-r border-black text-center w-28"></td>
                      <td className="py-1.5 px-2 border-r border-black text-center w-16 font-black" style={{color: "#dc2626"}}>CR</td>
                      <td className="py-1.5 px-2 text-right font-black w-36">{crSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  const renderDaybookPageContent = (chunk: any[], chunkIdx: number, totalChunks: number) => {
    return (
      <div className="daybook-print-wrapper p-4 bg-white text-slate-900">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">
            DAY BOOK REPORT / दैनिक बही
          </span>
          <span className="font-mono text-xs font-black">
            DATE: {getTodayDateStr()} | Page {chunkIdx + 1} of {totalChunks}
          </span>
        </div>
        <div className="text-center font-bold text-base uppercase mb-2 estimate-title">
          DAY BOOK {formatTitleDate(printStartDate)} TO {formatTitleDate(printEndDate)}
        </div>
        <table className="daybook-print-table w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="border-t border-b border-black">
              <th className="py-1 px-1.5 border-r border-black text-center w-24">DATE</th>
              <th className="py-1 px-1.5 border-r border-black text-left">PARTICULARS</th>
              <th className="py-1 px-1.5 border-r border-black text-right w-28">DEBIT</th>
              <th className="py-1 px-1.5 border-r border-black text-right w-28">CREDIT</th>
              <th className="py-1 px-1.5 border-r border-black text-center w-14">DR/CR</th>
              <th className="py-1 px-1.5 text-right w-28">R-TOTALS</th>
            </tr>
          </thead>
          <tbody>
            {chunk.map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-black last:border-b-0">
                <td className="py-1 px-1.5 border-r border-black text-center">
                  {row.isOpening ? formatTitleDate(printStartDate) : formatPrintDateDaybook(row.date)}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-left uppercase">
                  {translateBilingual(row.particulars)}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-right">
                  {row.debit > 0 ? formatPrintAmount(row.debit) : "0.00"}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-right">
                  {row.credit > 0 ? formatPrintAmount(row.credit) : "0.00"}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-center">{row.drCr}</td>
                <td className="py-1 px-1.5 text-right">{row.runningBalance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPrintPortalContent = () => {
    return (
      <div id="print-portal-root" className="print-only-layout text-slate-900 bg-white">
        <style>{`
          #print-portal-root,
          #print-portal-root td,
          #print-portal-root th,
          #print-portal-root span,
          #print-portal-root div {
            font-family: var(--font-geist-sans), var(--font-noto-devanagari), 'Nirmala UI', sans-serif !important;
          }
          
          @media print {
            .print-only-layout { display: block !important; }
            @page { size: portrait; margin: 8mm; }
            html, body {
              display: block !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              background: white !important;
              color: black !important;
              font-family: var(--font-geist-sans), var(--font-noto-devanagari), 'Nirmala UI', sans-serif !important;
            }
            
            /* Hide everything under body except the print portal root */
            body > :not(#print-portal-root) {
              display: none !important;
            }
            
            #print-portal-root {
              display: block !important;
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            .print-page {
              page-break-after: always !important;
              break-after: page !important;
              border: 2px solid #000 !important;
              padding: 18px !important;
              border-radius: 4px !important;
              background: white !important;
              box-sizing: border-box !important;
              margin: 0 0 10mm 0 !important;
              display: block !important;
              width: 100% !important;
            }
            .print-blank-page {
              page-break-after: always !important;
              break-after: page !important;
              border: none !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              height: 100% !important;
              min-height: 150mm !important;
              visibility: hidden !important;
            }
            .print-page:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
              margin-bottom: 0 !important;
            }
            
            .estimate-title { font-size: 24px !important; font-weight: 900 !important; }
            .supplier-name { font-size: 16px !important; font-weight: 900 !important; }
            .supplier-info { font-size: 13px !important; font-weight: 700 !important; line-height: 1.3 !important; }
            
            table { width: 100% !important; border-collapse: collapse !important; margin-top: 8px !important; }
            th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; font-size: 12px !important; font-weight: 900 !important; }
            td { font-size: 13px !important; font-weight: 850 !important; }
            th, td { border: 1.5px solid #000 !important; padding: 6px 8px !important; }
          }
        `}</style>

        {printLayoutMode === "ledger" && (() => {
          const isSingle = lgSelectedLedgerId && lgSelectedLedgerId !== "all";
          if (isSingle) {
            const selectedLedgerObj = activeSiteLedgers.find((l: any) => String(l.id) === String(lgSelectedLedgerId)) || 
                                     (ledgers ? ledgers.find((l: any) => String(l.id) === String(lgSelectedLedgerId)) : null);
            const items = processedLgData.items;
            const chunks = chunkArray(items, 15);
            if (chunks.length === 0) {
              return (
                <Fragment>
                  <div className="print-page">
                    {renderLedgerSinglePageContent([], 0, 1, selectedLedgerObj)}
                  </div>
                  <div className="print-page print-blank-page">
                    <div style={{ height: "100%", minHeight: "150mm" }}></div>
                  </div>
                </Fragment>
              );
            }
            return chunks.map((chunk, idx) => (
              <Fragment key={idx}>
                <div className="print-page">
                  {renderLedgerSinglePageContent(chunk, idx, chunks.length, selectedLedgerObj)}
                </div>
                <div className="print-page print-blank-page">
                  <div style={{ height: "100%", minHeight: "150mm" }}></div>
                </div>
              </Fragment>
            ));
          } else {
            const ledgerPrintData = getGroupedLedgersData();
            const pages: any[] = [];
            let currentPageGroups: any[] = [];
            let currentRowCount = 0;

            ledgerPrintData.forEach((group: any) => {
              const groupRows = group.rows;
              let startIdx = 0;
              
              while (startIdx < groupRows.length) {
                const remainingCapacity = 15 - currentRowCount;
                const rowsToTake = Math.min(groupRows.length - startIdx, remainingCapacity);
                
                if (rowsToTake <= 0) {
                  pages.push(currentPageGroups);
                  currentPageGroups = [];
                  currentRowCount = 0;
                  continue;
                }

                const chunkOfRows = groupRows.slice(startIdx, startIdx + rowsToTake);
                currentPageGroups.push({
                  name: group.name,
                  rows: chunkOfRows,
                  isFirstPart: startIdx === 0,
                  isLastPart: startIdx + rowsToTake === groupRows.length
                });
                
                currentRowCount += rowsToTake;
                startIdx += rowsToTake;
              }
            });

            if (currentPageGroups.length > 0) {
              pages.push(currentPageGroups);
            }

            if (pages.length === 0) {
              return (
                <Fragment>
                  <div className="print-page">
                    {renderLedgerGroupPageContent([], 0, 1)}
                  </div>
                  <div className="print-page print-blank-page">
                    <div style={{ height: "100%", minHeight: "150mm" }}></div>
                  </div>
                </Fragment>
              );
            }

            return pages.map((pageGroups, idx) => (
              <Fragment key={idx}>
                <div className="print-page">
                  {renderLedgerGroupPageContent(pageGroups, idx, pages.length)}
                </div>
                <div className="print-page print-blank-page">
                  <div style={{ height: "100%", minHeight: "150mm" }}></div>
                </div>
              </Fragment>
            ));
          }
        })()}

        {printLayoutMode === "summary" && (() => {
          const selectedLedgerObj = smSelectedLedgerId === "all" || !smSelectedLedgerId
            ? null
            : summaryLedgersList.find((l: any) => String(l.id) === String(smSelectedLedgerId));

          if (selectedLedgerObj) {
            return (
              <Fragment>
                <div className="print-page">
                  {renderSummaryPageContent([], 0, 1, selectedLedgerObj)}
                </div>
                <div className="print-page print-blank-page">
                  <div style={{ height: "100%", minHeight: "150mm" }}></div>
                </div>
              </Fragment>
            );
          } else {
            const chunks = chunkArray(summaryLedgersList, 18);
            if (chunks.length === 0) {
              return (
                <Fragment>
                  <div className="print-page">
                    {renderSummaryPageContent([], 0, 1, null)}
                  </div>
                  <div className="print-page print-blank-page">
                    <div style={{ height: "100%", minHeight: "150mm" }}></div>
                  </div>
                </Fragment>
              );
            }
            return chunks.map((chunk, idx) => (
              <Fragment key={idx}>
                <div className="print-page">
                  {renderSummaryPageContent(chunk, idx, chunks.length, null)}
                </div>
                <div className="print-page print-blank-page">
                  <div style={{ height: "100%", minHeight: "150mm" }}></div>
                </div>
              </Fragment>
            ));
          }
        })()}

        {printLayoutMode === "daybook" && (() => {
          const daybookPrintData = getPrintDaybookItems();
          const chunks = chunkArray(daybookPrintData.items, 18);
          if (chunks.length === 0) {
            return (
              <Fragment>
                <div className="print-page">
                  {renderDaybookPageContent([], 0, 1)}
                </div>
                <div className="print-page print-blank-page">
                  <div style={{ height: "100%", minHeight: "150mm" }}></div>
                </div>
              </Fragment>
            );
          }
          return chunks.map((chunk, idx) => (
            <Fragment key={idx}>
              <div className="print-page">
                {renderDaybookPageContent(chunk, idx, chunks.length)}
              </div>
              <div className="print-page print-blank-page">
                <div style={{ height: "100%", minHeight: "150mm" }}></div>
              </div>
            </Fragment>
          ));
        })()}
      </div>
    );
  };

  // Keyboard shortcut listeners (1 for PDF, F3 for Excel, L for Ledger Print, D for Daybook Print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCopiesDialog) {
        if (e.key === "1") {
          e.preventDefault();
          triggerFinalPrint(1);
          return;
        } else if (e.key === "2") {
          e.preventDefault();
          triggerFinalPrint(2);
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowCopiesDialog(false);
          return;
        }
      }

      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable
        ) {
          return;
        }
      }

      if (e.key === "1") {
        e.preventDefault();
        if (reportType === "daybook") {
          handleOpenPrintModal("daybook");
        } else if (reportType === "ledger") {
          handlePrintLedgerPDF();
        } else if (reportType === "summary") {
          handlePrintSummaryPDF();
        }
      } else if (e.key.toUpperCase() === "L") {
        if (reportType === "daybook") {
          e.preventDefault();
          handleOpenPrintModal("ledger");
        }
      } else if (e.key.toUpperCase() === "D") {
        if (reportType === "daybook") {
          e.preventDefault();
          handleOpenPrintModal("daybook");
        }
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
  }, [reportType, processedDbData, processedLgData, dbSelectedSiteId, lgSelectedSiteId, lgSelectedLedgerId, smSelectedSiteId, smSelectedLedgerId, summaryLedgersList, printStartDate, printEndDate, showCopiesDialog, printTargetReport]);


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

  // Auto-select first row (index 0) in Print Summary table when summary data changes
  useEffect(() => {
    if (reportType === "summary" && summaryLedgersList.length > 0) {
      setSmSelectedRowIndex(0);
    } else {
      setSmSelectedRowIndex(-1);
    }
  }, [smSelectedSiteId, summaryLedgersList.length, reportType]);

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
          if (el) {
            el.scrollIntoView({ block: "nearest" });
            if (target === itemsCount - 1) {
              setTimeout(() => {
                const container = el.closest(".overflow-y-auto");
                if (container) {
                  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                }
              }, 50);
            }
          }
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
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        lgLedgerInputRef.current?.focus();
        setTimeout(() => {
          lgLedgerInputRef.current?.select();
        }, 50);
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
    isSmLedgerSuggestionsOpen,
    filteredLgLedgers,
    lgSelectedLedgerId
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
          if (el) {
            el.scrollIntoView({ block: "nearest" });
            if (target === itemsCount - 1) {
              setTimeout(() => {
                const container = el.closest(".overflow-y-auto");
                if (container) {
                  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                }
              }, 50);
            }
          }
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
    isSmSiteSuggestionsOpen
  ]);

  // Global keydown handler for navigating summary rows
  useEffect(() => {
    const handleSmTableKeyDown = (e: KeyboardEvent) => {
      if (reportType !== "summary") return;
      if (
        isSmSiteSuggestionsOpen || 
        isLgSiteSuggestionsOpen || 
        isLgLedgerSuggestionsOpen || 
        isDbSiteSuggestionsOpen
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

      const itemsCount = summaryLedgersList.length;
      if (itemsCount === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSmSelectedRowIndex((prev) => {
          const next = prev + 1;
          const target = next >= itemsCount ? itemsCount - 1 : next;
          // If we are already on the last row and ArrowDown is pressed again, scroll page to absolute bottom
          if (prev === itemsCount - 1) {
            const el = document.getElementById(`sm-row-${prev}`);
            if (el) {
              const container = el.closest(".overflow-y-auto");
              if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
              }
            }
          }
          return target;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSmSelectedRowIndex((prev) => {
          const next = prev - 1;
          const target = next < 0 ? 0 : next;
          return target;
        });
      }
    };

    window.addEventListener("keydown", handleSmTableKeyDown);
    return () => window.removeEventListener("keydown", handleSmTableKeyDown);
  }, [
    reportType, 
    summaryLedgersList.length, 
    isSmSiteSuggestionsOpen,
    isLgSiteSuggestionsOpen, 
    isLgLedgerSuggestionsOpen,
    isDbSiteSuggestionsOpen
  ]);

  // Scroll selected summary row into view after render
  useEffect(() => {
    if (reportType === "summary" && smSelectedRowIndex >= 0) {
      const el = document.getElementById(`sm-row-${smSelectedRowIndex}`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
        // If we just selected the last row, ensure we scroll all the way down to reveal the totals
        if (smSelectedRowIndex === summaryLedgersList.length - 1) {
          setTimeout(() => {
            const container = el.closest(".overflow-y-auto");
            if (container) {
              container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
            }
          }, 50);
        }
      }
    }
  }, [smSelectedRowIndex, reportType, summaryLedgersList.length]);


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

          <div className="grid grid-cols-1 lg:grid-cols-5 font-mono">
            
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
                      disabled={false}
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
                      className={`w-full px-2.5 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-400 uppercase font-mono tracking-wide transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
                        isSmSiteFocused ? "bg-[#FFE600] text-black" : "bg-white text-slate-800"
                      }`}
                    />
                    {true && (
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
                    )}
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
                                smSiteInputRef.current?.blur();
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
 

 
            </div>
 
            {/* RIGHT STATEMENT AREA (Col span 4) */}
            <div className="lg:col-span-4 bg-white p-1 flex flex-col justify-between print-full-width">
              
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
                            <th className="border border-slate-800 py-3 px-3 text-center w-16 text-black font-black">Dr/Cr</th>
                            <th className="border border-slate-800 py-3 px-3 text-right w-36 text-black font-black">Balance</th>
                            <th className="border border-slate-800 py-3 px-3 text-center w-28 text-black font-black">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryLedgersList.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                                No accounts or transactions found for this site.
                              </td>
                            </tr>
                          ) : (
                            <>
                              {summaryLedgersList.map((item: any, idx: number) => {
                                return (
                                  <tr 
                                    key={item.id || item.name} 
                                    id={`sm-row-${idx}`}
                                    onClick={() => setSmSelectedRowIndex(idx)}
                                    className={`border-b border-slate-400 font-black uppercase text-slate-955 animate-in fade-in duration-100 ${
                                      smSelectedRowIndex === idx 
                                        ? "bg-[#FFE600] text-black font-extrabold" 
                                        : "hover:bg-slate-100/60"
                                    }`}
                                  >
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
                                    <td className={`border-r border-slate-400 px-3 py-2 text-center font-black ${
                                      item.status === "DR" ? "text-emerald-700" : item.status === "CR" ? "text-rose-700" : "text-slate-650"
                                    }`}>
                                      {item.status}
                                    </td>
                                    <td className="border-r border-slate-400 px-3 py-2 text-right font-black text-slate-955">
                                      {item.balance === 0 ? "NILL" : item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-center font-bold text-xs w-28">
                                      <EditableCell
                                        value={summaryDates[item.id] || getTodayDateStr()}
                                        onSave={(newVal) => handleUpdateDate(item.id, newVal)}
                                        className="text-center font-mono"
                                      />
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
                                  <td className="px-3 py-2"></td>
                                </tr>
                              ))}
 
                              {/* Table Totals Rows */}
                              {(() => {
                                const drSum = summaryLedgersList.reduce((acc, curr) => acc + (curr.status === "DR" ? curr.balance : 0), 0);
                                const crSum = summaryLedgersList.reduce((acc, curr) => acc + (curr.status === "CR" ? curr.balance : 0), 0);
                                return (
                                  <>
                                    <tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[12px] text-slate-955">
                                      <td colSpan={4} className="border-r border-slate-400 px-3 py-2.5 text-right font-black">TOTAL DEBIT:</td>
                                      <td className="border-r border-slate-400 px-3 py-2.5 text-center text-emerald-700 font-black">
                                        DR
                                      </td>
                                      <td className="border-r border-slate-400 px-3 py-2.5 text-right text-emerald-700 font-black">
                                        {drSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-3 py-2.5"></td>
                                    </tr>
                                    <tr className="bg-[#D3DFEE] font-black border-t border-slate-400 uppercase text-[12px] text-slate-955">
                                      <td colSpan={4} className="border-r border-slate-400 px-3 py-2.5 text-right font-black">TOTAL CREDIT:</td>
                                      <td className="border-r border-slate-400 px-3 py-2.5 text-center text-rose-700 font-black">
                                        CR
                                      </td>
                                      <td className="border-r border-slate-400 px-3 py-2.5 text-right text-rose-700 font-black">
                                        {crSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-3 py-2.5"></td>
                                    </tr>
                                  </>
                                );
                              })()}
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
                    onClick={handlePrintSummaryPDF}
                    className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
                  >
                    <span>[1] PRINT PDF</span>
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
            html, body {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
            }
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
              overflow: visible !important;
              height: auto !important;
            }
            /* Completely ignore modal and page wrapper boxes in print to bypass flex, grid, and scroll containers */
            .flex.h-screen, 
            .flex-1.flex.flex-col.min-w-0.h-full.overflow-hidden,
            .absolute.inset-0.bg-slate-900\\/40, 
            .w-\\[98vw\\], 
            .flex-1.overflow-y-auto.p-6.bg-slate-100,
            .max-w-7xl {
              display: contents !important;
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
              overflow: visible !important;
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
            .grid, .grid-cols-1, .lg\\:grid-cols-5 {
              display: block !important;
            }
            .lg\\:col-span-4 {
              width: 100% !important;
              display: block !important;
            }
          }
        `}</style>
        {showCopiesDialog && renderCopiesSelectorModal()}
        {mounted && typeof window !== "undefined" && printLayoutMode && createPortal(
          renderPrintPortalContent(),
          document.body
        )}
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
                      disabled={false}
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
                      className={`w-full px-2.5 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-400 uppercase font-mono tracking-wide transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
                        isLgSiteFocused ? "bg-[#FFE600] text-black" : "bg-white text-slate-800"
                      }`}
                    />
                    {true && (
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
                    )}
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
                      disabled={false}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLgLedgerSearchVal(val);
                        setLgTypedSearchVal(val);
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
                      onFocus={(e) => {
                        setIsLgLedgerSuggestionsOpen(true);
                        setIsLgLedgerFocused(true);
                        e.target.select();
                        if (lgSelectedLedgerId) {
                          const idx = filteredLgLedgers.findIndex(
                            (l: any) => String(l.id) === String(lgSelectedLedgerId)
                          );
                          if (idx >= 0) {
                            setHighlightedLgLedgerIndex(idx);
                            setTimeout(() => {
                              const el = document.getElementById(`lg-acct-opt-${idx}`);
                              if (el) el.scrollIntoView({ block: "nearest" });
                            }, 50);
                            return;
                          }
                        }
                        setHighlightedLgLedgerIndex(-1);
                      }}
                      onBlur={() => {
                        setTimeout(() => setIsLgLedgerFocused(false), 200);
                      }}
                      onKeyDown={handleLgLedgerKeyDown}
                      className={`w-full px-2.5 py-1.5 text-xs font-black focus:outline-none placeholder:text-slate-455 uppercase font-mono tracking-wide transition-colors disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
                        isLgLedgerFocused ? "bg-[#FFE600] text-black" : "bg-white text-slate-800"
                      }`}
                    />
                    {true && (
                      <button 
                        type="button"
                        onClick={() => {
                          setIsLgLedgerSuggestionsOpen((prev) => {
                            const nextOpen = !prev;
                            if (nextOpen && lgSelectedLedgerId) {
                              const idx = filteredLgLedgers.findIndex(
                                (l: any) => String(l.id) === String(lgSelectedLedgerId)
                              );
                              if (idx >= 0) {
                                setHighlightedLgLedgerIndex(idx);
                                setTimeout(() => {
                                  const el = document.getElementById(`lg-acct-opt-${idx}`);
                                  if (el) el.scrollIntoView({ block: "nearest" });
                                }, 50);
                              }
                            } else {
                              setHighlightedLgLedgerIndex(-1);
                            }
                            return nextOpen;
                          });
                        }}
                        className="px-2 border-l border-slate-300 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none flex items-center justify-center"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
 
                  {isLgLedgerSuggestionsOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-900 rounded shadow-lg z-50 max-h-[350px] overflow-y-auto font-mono text-[11px] uppercase">
                      {filteredLgLedgers.length === 0 ? (
                        <div className="p-2.5 text-slate-400 italic">No matching accounts found</div>
                      ) : (
                        filteredLgLedgers.map((ledger: any, index: number) => {
                          const isActive = highlightedLgLedgerIndex === index;
                          const isSelected = lgSelectedLedgerId === ledger.id;
                          return (
                            <button
                              key={ledger.id}
                              id={`lg-acct-opt-${index}`}
                              type="button"
                              onClick={() => {
                                setLgSelectedLedgerId(ledger.id);
                                setLgLedgerSearchVal(ledger.name.toUpperCase());
                                setLgTypedSearchVal(ledger.name.toUpperCase());
                                setIsLgLedgerSuggestionsOpen(false);
                                setHighlightedLgLedgerIndex(-1);
                              }}
                              onMouseEnter={() => setHighlightedLgLedgerIndex(index)}
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
                      <th className="border border-slate-800 py-3 px-4 text-center w-28 text-black font-black">Challan No</th>
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
                        <td colSpan={10} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                          Please select a Site location to view account ledgers.
                        </td>
                      </tr>
                    ) : !lgSelectedLedgerId ? (
                      <tr>
                        <td colSpan={10} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                          Please select a specific Account Ledger to view transactions.
                        </td>
                      </tr>
                    ) : processedLgData.items.length === 0 ? (
                      <>
                        <tr key="no-records">
                          <td colSpan={10} className="text-center py-12 bg-slate-50 text-slate-400 italic">
                            No transactions recorded for this account.
                          </td>
                        </tr>
                        {lgFillers.map((_, i) => (
                          <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
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
                              <td className="border-r border-slate-450 border-slate-400 px-4 py-2.5 text-center font-bold text-slate-900 w-28">
                                {item.referenceNumber || "-"}
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
                              <td className="px-4 py-2.5 text-right font-black text-slate-955 w-44">
                                {item.runningBalance === 0 ? "NILL" : `${runningBalSign}${Math.abs(item.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                              </td>
                            </tr>
                          );
                        })}
                        {lgFillers.map((_, i) => (
                          <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center w-20"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-right w-36"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                            <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                            <td className="px-4 py-2.5 text-right w-44"></td>
                          </tr>
                        ))}
                        <tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[12px] text-slate-955">
                          <td colSpan={6} className="border-r border-slate-400 px-4 py-3 text-right font-black">TOTAL:</td>
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
                  onClick={handlePrintLedgerPDF}
                  className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
                >
                  <span>[1] PRINT PDF</span>
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
            html, body {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
            }
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
              overflow: visible !important;
              height: auto !important;
            }
            /* Completely ignore modal and page wrapper boxes in print to bypass flex, grid, and scroll containers */
            .flex.h-screen, 
            .flex-1.flex.flex-col.min-w-0.h-full.overflow-hidden,
            .absolute.inset-0.bg-slate-900\\/40, 
            .w-\\[98vw\\], 
            .flex-1.overflow-y-auto.p-6.bg-slate-100,
            .max-w-7xl {
              display: contents !important;
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
              overflow: visible !important;
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
        {showCopiesDialog && renderCopiesSelectorModal()}
        {mounted && typeof window !== "undefined" && printLayoutMode && createPortal(
          renderPrintPortalContent(),
          document.body
        )}
      </div>
    );
  }
  if (reportType === "daybook") {
    const fillerCount = Math.max(0, 10 - processedDbData.items.length);
    const fillers = Array.from({ length: fillerCount });

    const daybookPrintData = getPrintDaybookItems();
    const ledgerPrintData = getGroupedLedgersData();

    return (
      <div className="font-mono text-slate-800 max-w-[96%] sm:max-w-[98%] mx-auto space-y-4">
        
        <div className={printLayoutMode ? "no-print" : ""}>
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
                    disabled={false}
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
                    className="w-full px-3 py-1.5 text-xs font-black bg-[#FFE600] text-slate-955 focus:outline-none placeholder:text-slate-700/60 uppercase font-mono tracking-wider h-8.5 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  {true && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsDbSiteSuggestionsOpen((prev) => !prev);
                        setHighlightedDbSiteIndex(-1);
                      }}
                      className="px-2 border-l border-slate-900 text-slate-955 hover:bg-[#E5C300] transition-colors focus:outline-none flex items-center justify-center h-full text-xs font-bold font-sans"
                    >
                      v
                    </button>
                  )}
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
                              dbSiteInputRef.current?.blur();
                            }}
                            onMouseEnter={() => setHighlightedDbSiteIndex(index)}
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
   
                <tbody>
                  {!dbSelectedSiteId ? (
                    <tr key="no-site">
                      <td colSpan={7} className="text-center py-20 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider italic">
                        Please select a Site name to view daybook transaction tables.
                      </td>
                    </tr>
                  ) : processedDbData.items.length === 0 ? (
                    <>
                      <tr key="no-records">
                        <td colSpan={7} className="text-center py-12 bg-slate-50 text-slate-400 italic">
                          No transactions registered for this site.
                        </td>
                      </tr>
                      {fillers.map((_, i) => (
                        <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                          <td className="border-r border-slate-350 px-4 py-2.5"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                          <td className="px-4 py-2.5 text-right"></td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <>
                      {processedDbData.items.map((item: any, idx: number) => {
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
                      })}
                      {fillers.map((_, i) => (
                        <tr key={`filler-${i}`} className="h-8.5 border-b border-slate-350 select-none bg-white/40">
                          <td className="border-r border-slate-350 px-4 py-2.5"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5 text-right"></td>
                          <td className="border-r border-slate-350 px-4 py-2.5 text-center"></td>
                          <td className="px-4 py-2.5 text-right"></td>
                        </tr>
                      ))}
                      <tr className="bg-[#D3DFEE] font-black border-t-2 border-slate-800 uppercase text-[12px] text-slate-955">
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
                onClick={() => handleOpenPrintModal("ledger")}
                className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-450 border-b-slate-450 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
              >
                <span>[L] PRINT LEDGER</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenPrintModal("daybook")}
                className="px-4 py-2 bg-[#FFE600] border-2 border-white border-r-slate-900 border-b-slate-900 hover:bg-[#E5C300] text-black font-black font-mono text-[11px] shadow-sm active:border-slate-800 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
              >
                <span>[D] PRINT DAYBOOK</span>
              </button>
              <button
                type="button"
                onClick={handleExportDbExcel}
                className="px-4 py-2 bg-slate-200 border-2 border-white border-r-slate-450 border-b-slate-450 hover:bg-slate-300 text-slate-900 font-black font-mono text-[11px] shadow-sm active:border-slate-400 active:border-r-white active:border-b-white uppercase tracking-wider flex items-center gap-1.5 select-none"
              >
                <span>[F3] PRINT EXCEL</span>
              </button>
            </div>

          </div>
        </div>



        {/* DIALOG MODAL */}
        <Dialog open={showDateRangeModal} onOpenChange={setShowDateRangeModal}>
          <DialogContent aria-describedby={undefined} className="max-w-md bg-white border-2 border-slate-900 font-mono text-slate-900 rounded p-0 shadow-2xl no-print">
            <DialogHeader className="sr-only">
              <DialogTitle>Select Print Date Range</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-between bg-[#2B547E] text-white px-3 py-1.5 text-xs font-black shadow-inner select-none">
              <span className="uppercase">Select Print Date Range</span>
              <button
                onClick={() => setShowDateRangeModal(false)}
                className="w-4 h-4 bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs border border-slate-400 shadow-sm"
              >
                X
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="print-start-date" className="text-[10px] font-black uppercase text-slate-650 tracking-wider">
                    From Date:
                  </Label>
                  <Input
                    ref={printStartDateRef}
                    id="print-start-date"
                    type="date"
                    value={printStartDate}
                    onChange={(e) => setPrintStartDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleExecutePrint();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setShowDateRangeModal(false);
                      }
                    }}
                    className="w-full bg-white border border-slate-400 font-black text-slate-800 text-xs px-2 py-1 focus:outline-none focus:bg-[#FFE600] focus:text-black rounded-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="print-end-date" className="text-[10px] font-black uppercase text-slate-650 tracking-wider">
                    To Date:
                  </Label>
                  <Input
                    id="print-end-date"
                    type="date"
                    value={printEndDate}
                    onChange={(e) => setPrintEndDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleExecutePrint();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setShowDateRangeModal(false);
                      }
                    }}
                    className="w-full bg-white border border-slate-400 font-black text-slate-800 text-xs px-2 py-1 focus:outline-none focus:bg-[#FFE600] focus:text-black rounded-none"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDateRangeModal(false)}
                  className="px-4 py-2 bg-slate-100 border-2 border-white border-r-slate-400 border-b-slate-400 hover:bg-slate-200 text-slate-900 font-black text-xs uppercase shadow-sm active:border-slate-400 active:border-r-white active:border-b-white select-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecutePrint}
                  className="px-5 py-2 bg-[#FFE600] border-2 border-white border-r-slate-900 border-b-slate-900 hover:bg-[#E5C300] text-black font-black text-xs uppercase shadow-sm active:border-slate-800 active:border-r-white active:border-b-white select-none"
                >
                  Print
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <style>{`
          @media print {
            html, body {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
            }
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
              overflow: visible !important;
              height: auto !important;
            }
            /* Completely ignore modal and page wrapper boxes in print to bypass flex, grid, and scroll containers */
            .flex.h-screen, 
            .flex-1.flex.flex-col.min-w-0.h-full.overflow-hidden,
            .absolute.inset-0.bg-slate-900\\/40, 
            .w-\\[98vw\\], 
            .flex-1.overflow-y-auto.p-6.bg-slate-100,
            .max-w-7xl {
              display: contents !important;
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
              overflow: visible !important;
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
            .print-only-container {
              display: block !important;
            }
            .ledger-print-table, .daybook-print-table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 10px !important;
              margin-bottom: 20px !important;
            }
            .ledger-print-table th, .ledger-print-table td,
            .daybook-print-table th, .daybook-print-table td {
              border: 1px solid #000000 !important;
              padding: 4px 6px !important;
              font-family: monospace !important;
              font-size: 12px !important;
            }
            .ledger-print-table th, .daybook-print-table th {
              font-weight: bold !important;
              background-color: transparent !important;
            }
            .ledger-group-block {
              page-break-inside: avoid !important;
              margin-bottom: 25px !important;
            }
          }
          .print-only-container {
            display: none;
          }
        `}</style>
        {showCopiesDialog && renderCopiesSelectorModal()}
        {mounted && typeof window !== "undefined" && printLayoutMode && createPortal(
          renderPrintPortalContent(),
          document.body
        )}
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

interface EditableCellProps {
  value: string;
  onSave: (newVal: string) => void;
  className?: string;
  displayValue?: string;
}

function EditableCell({
  value,
  onSave,
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
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value.toUpperCase())}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`w-full bg-white border border-slate-350 rounded px-1.5 py-0.5 text-xs font-bold focus:outline-none focus:border-slate-800 uppercase ${className}`}
      />
    );
  }

  const showVal = displayValue !== undefined ? displayValue : (value === "0" ? "-" : String(value));

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
