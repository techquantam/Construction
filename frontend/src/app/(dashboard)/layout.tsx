"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    } else if (pathname.includes("/backup")) {
      setActiveMainMenu(4);
      setActiveSubMenu("4.1");
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
  // Sync route and search parameters with AppContext states on first load or changes
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
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
      case "4.1": return "4.1. BACKUP DATABASE";
      default: return "";
    }
  };

  const [focusedColumn, setFocusedColumn] = useState<"main" | "sub">("main");
  const [focusedMainIndex, setFocusedMainIndex] = useState<number>(0);
  const [focusedSubIndex, setFocusedSubIndex] = useState<number>(0);

  const getSubMenuItems = (menuNum: number) => {
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
          { label: "4.1. BACKUP DATABASE", href: "/backup?action=backup", code: "4.1" },
          { label: "4.2. EXIT", href: "exit", code: "exit" },
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
      if (!isDashboard && pathname !== "/challan") {
        if (e.key === "Escape") {
          // If a nested modal (z-[9999] or z-50 overlay) is open, let it handle Escape.
          if (document.querySelector('.z-\\[9999\\]') || document.querySelector('.z-50')) {
            return;
          }
          handleCloseModal();
        }
        return;
      }

      if (focusedColumn === "main") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedMainIndex((prev) => (prev + 1) % 5);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedMainIndex((prev) => (prev - 1 + 5) % 5);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          if (activeMainMenu && activeMainMenu !== 0) {
            setFocusedColumn("sub");
            setFocusedSubIndex(0);
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (focusedMainIndex === 4) {
            handleLogout();
          } else if (focusedMainIndex === 2) {
            setActiveMainMenu(3);
            setActiveSubMenu("3.1");
            router.push("/challan");
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
    if (menuNum === 5) {
      handleLogout();
      return;
    }

    if (menuNum === 3) {
      setActiveMainMenu(3);
      setActiveSubMenu("3.1");
      router.push("/challan");
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
    if (activeMainMenu === 0 || activeMainMenu === null) return null;
    const items = getSubMenuItems(activeMainMenu);
    const headerLabel =
      activeMainMenu === 1 ? "1. MAINTAINANCE" :
        activeMainMenu === 2 ? "2. PRINT" :
          activeMainMenu === 3 ? "3. CHALLAN" :
            activeMainMenu === 4 ? "4. DATA BACKUP" : "";

    return (
      <div className="flex flex-col h-full bg-slate-50 border-r border-slate-300 w-full animate-in fade-in slide-in-from-left-4 duration-200">
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
              { label: "4. DATA BACKUP", menuNum: 4, icon: Database },
            ].map((menu, idx) => {
              const isActive = activeMainMenu === menu.menuNum;
              const isFocused = focusedColumn === "main" && focusedMainIndex === idx;
              return (
                <button
                  key={menu.menuNum}
                  onClick={() => handleMainMenuClick(menu.menuNum)}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-bold transition-all text-left border border-transparent ${isFocused
                    ? "bg-amber-400 text-slate-950 border-slate-950 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
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
                onClick={() => handleMainMenuClick(5)}
                className={`w-full flex items-center justify-between px-4 py-3 font-bold transition-all text-left border border-transparent ${focusedColumn === "main" && focusedMainIndex === 4
                  ? "bg-red-600 text-white border-slate-950 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
                  : "text-red-400 hover:bg-red-950/40 hover:text-red-300"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <LogOut className={`h-5 w-5 ${focusedColumn === "main" && focusedMainIndex === 4 ? "text-white" : "text-red-500"}`} />
                  <span>5. EXIT</span>
                </div>
                <XCircle className={`h-4 w-4 ${focusedColumn === "main" && focusedMainIndex === 4 ? "text-white" : "text-red-500"}`} />
              </button>
            </div>
          </nav>

          {/* Footer info */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 font-mono text-[10px] text-slate-500 text-center shrink-0">
            Logged in as: <span className="text-slate-300 font-semibold">Admin</span>
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
    </div>
  );
}
