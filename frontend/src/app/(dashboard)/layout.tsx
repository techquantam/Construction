"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import {
  Building2,
  Database,
  Printer,
  ChevronRight,
  LogOut,
  User,
  XCircle,
  Menu,
  X,
  FileText,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function SearchParamsSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setActiveMainMenu, setActiveSubMenu } = useApp();

  useEffect(() => {
    // Determine active menu based on path
    if (pathname.includes("/sites")) {
      setActiveMainMenu(1);
      const action = searchParams.get("action");
      if (action === "delete") setActiveSubMenu("1.8");
      else setActiveSubMenu("1.1");
    } else if (pathname.includes("/daybook")) {
      setActiveMainMenu(1);
      const action = searchParams.get("action");
      if (action === "correction") setActiveSubMenu("1.4");
      else if (action === "delete") setActiveSubMenu("1.7");
      else setActiveSubMenu("1.2");
    } else if (pathname.includes("/ledger")) {
      setActiveMainMenu(1);
      const action = searchParams.get("action");
      if (action === "correction") setActiveSubMenu("1.5");
      else if (action === "delete") setActiveSubMenu("1.6");
      else setActiveSubMenu("1.3");
    } else if (pathname.includes("/reports")) {
      setActiveMainMenu(2);
      const type = searchParams.get("type");
      if (type === "ledger") setActiveSubMenu("2.2");
      else if (type === "daybook") setActiveSubMenu("2.3");
      else setActiveSubMenu("2.1");
    } else if (pathname.includes("/challan")) {
      setActiveMainMenu(3);
      setActiveSubMenu("3.1");
    } else if (pathname.includes("/materials")) {
      setActiveMainMenu(4);
      setActiveSubMenu("4.1");
    } else if (pathname.includes("/backup")) {
      setActiveMainMenu(6);
      setActiveSubMenu("5.1");
    }
  }, [pathname, searchParams, setActiveMainMenu, setActiveSubMenu]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    selectedSiteId,
    setSelectedSiteId,
    modifyQuery,
    setModifyQuery,
    activeMainMenu,
    setActiveMainMenu,
    activeSubMenu,
    setActiveSubMenu,
    sites,
    isLoadingSites,
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [compSiteId, setCompSiteId] = useState("");
  const [compName, setCompName] = useState("");
  const [compAddress, setCompAddress] = useState("");
  const [compMobile, setCompMobile] = useState("");

  const siteRef = useRef<HTMLSelectElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const createCompanyMutation = useMutation({
    mutationFn: async (payload: { siteId: string; name: string; address: string; mobile: string }) => {
      const cleanName = payload.name.trim().toUpperCase();
      return await api.post("/ledgers", {
        type: "Company",
        name: cleanName,
        contactPerson: JSON.stringify({
          address: payload.address.trim().toUpperCase() || "N/A",
          mobileNo: payload.mobile.trim() || "N/A",
          customerExtra: "CUSTOMER",
          measurementType: "OTHER",
          plotUnit: "CFT"
        }),
        phone: payload.mobile.trim() || "N/A",
        openingBalance: 0,
        siteId: payload.siteId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      toast.success("Company Ledger Account created successfully!");
      setShowCreateCompanyModal(false);
      // Reset form
      setCompName("");
      setCompAddress("");
      setCompMobile("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to create Company Account");
    }
  });

  useEffect(() => {
    if (showCreateCompanyModal) {
      setCompSiteId(selectedSiteId && selectedSiteId !== "all" ? selectedSiteId : (sites && sites.length > 0 ? sites[0].id : ""));
      setTimeout(() => {
        if (siteRef.current) {
          siteRef.current.focus();
        }
      }, 100);
    }
  }, [showCreateCompanyModal, selectedSiteId, sites]);

  const focusAndSelectField = (ref: React.RefObject<any>) => {
    if (ref.current) {
      ref.current.focus();
      if ('select' in ref.current && typeof ref.current.select === 'function') {
        ref.current.select();
      }
    }
  };

  const handleCreateCompanySubmit = () => {
    if (!compSiteId) {
      toast.error("Please select a construction site");
      return;
    }
    if (!compName.trim()) {
      toast.error("Account name is required");
      nameRef.current?.focus();
      return;
    }
    createCompanyMutation.mutate({
      siteId: compSiteId,
      name: compName,
      address: compAddress,
      mobile: compMobile
    });
  };

  const handleFormKeyDown = (e: React.KeyboardEvent, fieldName: "site" | "name" | "address" | "mobile") => {
    const fields = [siteRef, nameRef, addressRef, mobileRef];
    const currentIndex = ["site", "name", "address", "mobile"].indexOf(fieldName);
    
    if (e.key === "Enter") {
      if (fieldName === "address" && e.shiftKey) {
        return;
      }
      e.preventDefault();
      if (currentIndex === fields.length - 1) {
        handleCreateCompanySubmit();
      } else {
        focusAndSelectField(fields[currentIndex + 1]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (currentIndex === 0) {
        setShowCreateCompanyModal(false);
      } else {
        focusAndSelectField(fields[currentIndex - 1]);
      }
    }
  };

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole"));
  }, []);

  useEffect(() => {
    if (userRole === "PRINTER") {
      setActiveMainMenu(2);
    }
  }, [userRole, setActiveMainMenu]);

  // Sync route and search parameters with AppContext states on first load or changes
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const role = localStorage.getItem("userRole");
    if (role === "PRINTER") {
      const allowedPaths = ["/reports", "/dashboard"];
      const isAllowed = allowedPaths.some(p => pathname === p || pathname.startsWith(p));
      
      let isDaybookQuery = false;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (pathname.startsWith("/reports") && params.get("type") === "daybook") {
          isDaybookQuery = true;
        }
      }

      if ((!isAllowed || isDaybookQuery) && pathname !== "/login") {
        router.push("/dashboard");
      }
    }
  }, [router, pathname]);

  const handleLogout = () => {
    localStorage.clear();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const isDashboard = pathname === "/dashboard" || pathname === "/";

  const handleCloseModal = () => {
    router.push("/dashboard");
  };

  const getActiveSubMenuLabel = () => {
    switch (activeSubMenu) {
      case "1.1": return "1.1. ADD NEW SITE OR COMPANY";
      case "1.2": return "1.2. DAY BOOK ENTRY";
      case "1.3": return "1.3. LEDGER ENTRY";
      case "1.4": return "1.4. DAY BOOK CORRECTION";
      case "1.5": return "1.5. LEDGER CORRECTION";
      case "1.6": return "1.6. DELETE LEDGER";
      case "1.7": return "1.7. DELETE DAY BOOK";
      case "1.8": return "1.8. DELETE SITE";
      case "2.1": return "2.1. PRINT SUMMARY";
      case "2.2": return "2.2. PRINT LEDGER";
      case "2.3": return "2.3. PRINT DAYBOOK";
      case "3.1": return "3.1. PRINT CHALLAN";
      case "4.1": return "4.1. MATERIAL";
      case "5.1": return "5.1. BACKUP DATABASE";
      default: return "";
    }
  };

  const [focusedColumn, setFocusedColumn] = useState<"main" | "sub">("main");
  const [focusedMainIndex, setFocusedMainIndex] = useState<number>(0);
  const [focusedSubIndex, setFocusedSubIndex] = useState<number>(0);

  const getSubMenuItems = (menuNum: number) => {
    if (userRole === "PRINTER" && menuNum !== 2) return [];
    switch (menuNum) {
      case 1:
        return [
          { label: "1.1. ADD NEW SITE OR COMPANY", href: "/sites", code: "1.1" },
          { label: "1.2. DAY BOOK ENTRY", href: "/daybook?action=entry", code: "1.2" },
          { label: "1.3. LEDGER ENTRY", href: "/ledger?action=entry", code: "1.3" },
          { label: "1.4. DAY BOOK CORRECTION", href: "/daybook?action=correction", code: "1.4" },
          { label: "1.5. LEDGER CORRECTION", href: "/ledger?action=correction", code: "1.5" },
          { label: "1.6. DELETE LEDGER", href: "/ledger?action=delete", code: "1.6" },
          { label: "1.7. DELETE DAY BOOK", href: "/daybook?action=delete", code: "1.7" },
          { label: "1.8. DELETE SITE", href: "/sites?action=delete", code: "1.8" },
          { label: "1.9. EXIT", href: "exit", code: "exit" },
        ];
      case 2:
        if (userRole === "PRINTER") {
          return [
            { label: "2.1. PRINT SUMMARY", href: "/reports?type=summary", code: "2.1" },
            { label: "2.2. PRINT LEDGER", href: "/reports?type=ledger", code: "2.2" },
            { label: "2.3. EXIT", href: "exit", code: "exit" },
          ];
        }
        return [
          { label: "2.1. PRINT SUMMARY", href: "/reports?type=summary", code: "2.1" },
          { label: "2.2. PRINT LEDGER", href: "/reports?type=ledger", code: "2.2" },
          { label: "2.3. PRINT DAYBOOK", href: "/reports?type=daybook", code: "2.3" },
          { label: "2.4. EXIT", href: "exit", code: "exit" },
        ];
      case 3:
        return [
          { label: "3.1. PRINT CHALLAN", href: "/challan", code: "3.1" },
          { label: "3.2. EXIT", href: "exit", code: "exit" },
        ];
      case 4:
        return [
          { label: "4.1. MATERIAL", href: "/materials", code: "4.1" },
          { label: "4.2. EXIT", href: "exit", code: "exit" },
        ];
      case 5:
        return [];
      case 6:
        return [
          { label: "5.1. BACKUP DATABASE", href: "/backup?action=backup", code: "5.1" },
          { label: "5.2. EXIT", href: "exit", code: "exit" },
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    if (activeMainMenu && activeMainMenu !== 0) {
      setFocusedColumn("sub");
      setFocusedMainIndex(activeMainMenu - 1);
      setFocusedSubIndex(0);
    } else {
      setFocusedColumn("main");
    }
  }, [activeMainMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCreateCompanyModal) return;

      if (!isDashboard) {
        if (e.key === "Escape") {
          // If a nested modal (z-[9999] or z-50 overlay) is open, let it handle Escape.
          if (document.querySelector('.z-\\[9999\\]') || document.querySelector('.z-50')) {
            return;
          }
          handleCloseModal();
        }
        return;
      }

      // Prevent global menu navigation hotkeys when typing in form inputs
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        activeEl.hasAttribute("contenteditable")
      );
      if (isInputFocused) return;

      if (focusedColumn === "main") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedMainIndex((prev) => (prev + 1) % 7);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedMainIndex((prev) => (prev - 1 + 7) % 7);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          const targetMenuNum = [1, 2, 3, 4, 5, 6][focusedMainIndex];
          if (targetMenuNum === 1 || targetMenuNum === 2) {
            setFocusedColumn("sub");
            setFocusedSubIndex(0);
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (focusedMainIndex === 6) {
            handleLogout();
          } else if (focusedMainIndex === 4) {
            setShowCreateCompanyModal(true);
          } else if (focusedMainIndex === 2) {
            setActiveMainMenu(3);
            setActiveSubMenu("3.1");
            router.push("/challan");
          } else if (focusedMainIndex === 3) {
            setActiveMainMenu(4);
            setActiveSubMenu("4.1");
            router.push("/materials");
          } else if (focusedMainIndex === 5) {
            setActiveMainMenu(6);
            setActiveSubMenu("5.1");
            router.push("/backup?action=backup");
          } else {
            const nextMenu = focusedMainIndex + 1;
            setActiveMainMenu(nextMenu);
            setActiveSubMenu(null);
            setFocusedSubIndex(0);
            setFocusedColumn("sub");
          }
        }
      } else if (focusedColumn === "sub") {
        const items = getSubMenuItems(activeMainMenu || 0);
        if (items.length === 0) return;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedSubIndex((prev) => (prev + 1) % items.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedSubIndex((prev) => (prev - 1 + items.length) % items.length);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusedColumn("main");
        } else if (e.key === "Escape") {
          e.preventDefault();
          handleSubMenuExit();
        } else if (e.key === "Enter") {
          e.preventDefault();
          const targetItem = items[focusedSubIndex];
          if (!targetItem) return;
          if (targetItem.code === "exit") {
            handleSubMenuExit();
          } else {
            setActiveSubMenu(targetItem.code);
            router.push(targetItem.href);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDashboard, focusedColumn, focusedMainIndex, focusedSubIndex, activeMainMenu, router, pathname]);

  const handleSubMenuExit = () => {
    setActiveMainMenu(0);
    setActiveSubMenu(null);
    router.push("/dashboard");
  };

  const handleMainMenuClick = (menuNum: number) => {
    if (menuNum === 7) {
      handleLogout();
      return;
    }

    if (menuNum === 5) {
      setShowCreateCompanyModal(true);
      return;
    }

    if (menuNum === 3) {
      setActiveMainMenu(3);
      setActiveSubMenu("3.1");
      router.push("/challan");
      return;
    }

    if (menuNum === 4) {
      setActiveMainMenu(4);
      setActiveSubMenu("4.1");
      router.push("/materials");
      return;
    }

    if (activeMainMenu === menuNum) {
      setActiveMainMenu(0);
      setActiveSubMenu(null);
    } else {
      setActiveMainMenu(menuNum);
      setActiveSubMenu(null);
      setFocusedSubIndex(0);
    }
    router.push("/dashboard");
  };

  const renderSubMenu = () => {
    if (activeMainMenu === 0 || activeMainMenu === null || activeMainMenu === 5) return null;
    const items = getSubMenuItems(activeMainMenu);

    // Default admin rendering
    const headerLabel =
      activeMainMenu === 1 ? "1. MAINTAINANCE" :
        activeMainMenu === 2 ? "2. PRINT" :
          activeMainMenu === 3 ? "3. CHALLAN" :
            activeMainMenu === 4 ? "4. MATERIAL" :
              activeMainMenu === 6 ? "6. DATA BACKUP" : "";

    return (
      <div className="flex flex-col h-full bg-slate-50 border-r border-slate-300 w-full animate-in fade-in slide-in-from-left-4 duration-200 font-sans">
        <div className="p-4 border-b border-slate-200 bg-slate-100 flex justify-between items-center">
          <span className="font-bold text-xs tracking-wider text-slate-500 uppercase">{headerLabel}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
        <div className="flex-1 p-2 space-y-1 overflow-y-auto font-mono text-sm">
          {items.map((item, idx) => {
            const isExit = item.code === "exit";
            const isHighlighted = focusedColumn === "sub" && focusedSubIndex === idx;

            if (isExit) {
              return (
                <button
                  key={item.code}
                  onClick={handleSubMenuExit}
                  className={`w-full text-left px-3 py-2.5 transition-all font-semibold font-mono text-sm flex justify-between items-center border border-transparent mt-4 ${isHighlighted
                    ? "bg-red-600 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                    : "text-red-600 hover:bg-red-50 hover:text-red-800"
                    }`}
                >
                  <span>{item.label}</span>
                  <XCircle className={`h-4 w-4 ${isHighlighted ? "text-white" : "text-red-500"}`} />
                </button>
              );
            }

            const isActive = activeSubMenu === item.code;
            return (
              <Link key={item.code} href={item.href} className="block">
                <button
                  onClick={() => {
                    setActiveSubMenu(item.code);
                    setFocusedSubIndex(idx);
                  }}
                  className={`w-full text-left px-3 py-2.5 transition-all font-semibold select-none border border-transparent ${isHighlighted
                    ? "bg-amber-400 text-slate-950 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                    : isActive
                      ? "bg-amber-100 text-amber-900 border-amber-300 shadow-[2px_2px_0px_0px_rgba(245,158,11,0.1)]"
                      : "text-slate-700 hover:bg-slate-200 hover:text-slate-950"
                    }`}
                >
                  {item.label}
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-800">
      <Suspense fallback={null}>
        <SearchParamsSync />
      </Suspense>

      {/* COLUMN 1: Main Menu Block */}
      {isDashboard && (
        <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-950">

          {/* App Title / Header */}
          <div className="h-16 flex items-center gap-3 px-6 bg-slate-950 border-b border-slate-800 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-amber-400 flex items-center justify-center text-slate-950 font-bold border border-slate-800 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.15)]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-widest uppercase">CONSTRUCTION ERP</h1>
              <p className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase font-mono">Tally Console v1.0</p>
            </div>
          </div>

          {/* Column 1 Menu Items */}
          <nav className="flex-1 px-3 py-4 space-y-2 font-mono text-sm">
            {[
              { label: "1. MAINTAINANCE", menuNum: 1, icon: Building2 },
              { label: "2. PRINT", menuNum: 2, icon: Printer },
              { label: "3. CHALLAN", menuNum: 3, icon: FileText },
              { label: "4. MATERIAL", menuNum: 4, icon: Package },
              { label: "5. COMPANY ACCOUNT", menuNum: 5, icon: User },
              { label: "6. DATA BACKUP", menuNum: 6, icon: Database },
            ].filter((menu) => {
              if (userRole === "PRINTER") {
                return menu.menuNum === 2;
              }
              return true;
            }).map((menu, idx) => {
              const isActive = activeMainMenu === menu.menuNum;
              const isFocused = focusedColumn === "main" && focusedMainIndex === idx;
              return (
                <button
                  key={menu.menuNum}
                  onClick={() => handleMainMenuClick(menu.menuNum)}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-bold transition-all text-left border border-transparent ${isFocused
                    ? "bg-amber-400 text-slate-950 border-slate-955 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                    : isActive
                      ? "bg-slate-800 text-amber-400 border-amber-400/50 shadow-[4px_4px_0px_0px_rgba(245,158,11,0.2)]"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                >
                  <menu.icon className={`h-5 w-5 ${isFocused ? "text-slate-950" : isActive ? "text-amber-400" : "text-amber-400"}`} />
                  <span>{menu.label}</span>
                </button>
              );
            })}

            {/* EXIT / LOGOUT BUTTON IN MAIN MENU */}
            <div className="pt-8 border-t border-slate-800 mt-4">
              <button
                onClick={() => handleMainMenuClick(7)}
                className={`w-full flex items-center justify-between px-4 py-3 font-bold transition-all text-left border border-transparent ${focusedColumn === "main" && focusedMainIndex === 6
                  ? "bg-red-600 text-white border-slate-955 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                  : "text-red-400 hover:bg-red-950/40 hover:text-red-300"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <LogOut className={`h-5 w-5 ${focusedColumn === "main" && focusedMainIndex === 6 ? "text-white" : "text-red-500"}`} />
                  <span>7. EXIT</span>
                </div>
                <XCircle className={`h-4 w-4 ${focusedColumn === "main" && focusedMainIndex === 6 ? "text-white" : "text-red-500"}`} />
              </button>
            </div>
          </nav>

          {/* Footer info */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 font-mono text-[10px] text-slate-500 text-center shrink-0">
            Logged in as: <span className="text-slate-300 font-semibold">{userRole === "PRINTER" ? "Printer (TESTING)" : "Admin"}</span>
          </div>
        </aside>
      )}

      {/* COLUMN 2: Sub-Menu Block */}
      {isDashboard && activeMainMenu !== 0 && activeMainMenu !== null && (
        <aside className="w-72 shrink-0 h-full flex flex-col bg-slate-50 border-r border-slate-300 z-10 shadow-[2px_0px_10px_0px_rgba(0,0,0,0.02)]">
          {renderSubMenu()}
        </aside>
      )}

      {/* COLUMN 3: Work Space & Header */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* WORKSPACE AREA (Sub-page content loads here) */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-100 relative">
          <div className="max-w-7xl mx-auto h-full">
            {isDashboard ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
                {children}
              </div>
            ) : (
              <>
                {/* 1. Underlying background view (Clean blank white canvas) */}
                <div className="h-full w-full bg-white flex flex-col items-center justify-center font-sans" />

                {/* 2. Overlaid Premium Closeable Modal */}
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      handleCloseModal();
                    }
                  }}
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-30 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
                >
                  <div className="w-[98vw] h-[96vh] max-h-[96vh] bg-white border-2 border-slate-950 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                    {/* Modal Header */}
                    <div className="bg-amber-400 border-b-2 border-slate-950 px-4 py-3 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2 text-slate-900">
                        <Building2 className="h-5 w-5" />
                        <h2 className="text-sm font-black uppercase tracking-widest font-mono">
                          {getActiveSubMenuLabel() || "MAINTENANCE PANE"}
                        </h2>
                      </div>

                      {/* Close Button */}
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider font-mono bg-slate-900 text-white hover:bg-red-600 border border-slate-950 shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-none transition-all active:translate-y-0.5 flex items-center gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>CLOSE</span>
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                      {children}
                    </div>

                  </div>
                </div>
              </>
            )}
          </div>
        </main>

      </div>

      {/* CREATE COMPANY ACCOUNT POPUP DIALOG */}
      <Dialog open={showCreateCompanyModal} onOpenChange={setShowCreateCompanyModal}>
        <DialogContent className="max-w-md bg-white border-2 border-slate-950 rounded shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-0 overflow-hidden font-sans z-[9999]">
          <DialogHeader className="bg-amber-400 border-b-2 border-slate-950 px-4 py-3 shrink-0">
            <DialogTitle className="text-sm font-black uppercase tracking-widest font-mono text-slate-900">
              CREATE COMPANY ACCOUNT
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4 font-mono text-sm">
            
            {/* Site Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-slate-500">
                1. Select Construction Site
              </label>
              <select
                ref={siteRef}
                value={compSiteId}
                onChange={(e) => setCompSiteId(e.target.value)}
                onKeyDown={(e) => handleFormKeyDown(e, "site")}
                className="w-full px-3 py-2 border-2 border-slate-300 focus:border-slate-950 focus:outline-none bg-white font-semibold text-slate-800"
              >
                <option value="">-- SELECT SITE --</option>
                {sites?.map((site: any) => (
                  <option key={site.id} value={site.id}>
                    {site.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-slate-500">
                2. Account Name
              </label>
              <input
                ref={nameRef}
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                onKeyDown={(e) => handleFormKeyDown(e, "name")}
                placeholder="E.G. SHREE BALAJI TRADERS"
                className="w-full px-3 py-2 border-2 border-slate-300 focus:border-slate-950 focus:outline-none uppercase font-semibold text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-slate-500">
                3. Address
              </label>
              <textarea
                ref={addressRef}
                value={compAddress}
                onChange={(e) => setCompAddress(e.target.value)}
                onKeyDown={(e) => handleFormKeyDown(e, "address")}
                rows={2}
                placeholder="E.G. GORAKHPUR, U.P."
                className="w-full px-3 py-2 border-2 border-slate-300 focus:border-slate-950 focus:outline-none uppercase font-semibold text-slate-800 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Mobile Number */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-slate-500">
                4. Mobile Number
              </label>
              <input
                ref={mobileRef}
                type="text"
                value={compMobile}
                onChange={(e) => setCompMobile(e.target.value)}
                onKeyDown={(e) => handleFormKeyDown(e, "mobile")}
                placeholder="E.G. 9876543210"
                className="w-full px-3 py-2 border-2 border-slate-300 focus:border-slate-950 focus:outline-none font-semibold text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={() => setShowCreateCompanyModal(false)}
                className="px-4 py-2 border-2 border-slate-955 font-bold bg-slate-100 hover:bg-slate-200 uppercase"
              >
                [ESC] CANCEL
              </button>
              <button
                type="button"
                onClick={handleCreateCompanySubmit}
                disabled={createCompanyMutation.isPending}
                className="px-4 py-2 border-2 border-slate-955 font-black bg-amber-400 hover:bg-amber-500 uppercase disabled:opacity-50"
              >
                {createCompanyMutation.isPending ? "SAVING..." : "[ENTER] SAVE"}
              </button>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
