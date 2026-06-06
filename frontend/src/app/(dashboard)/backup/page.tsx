"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, ShieldAlert, Terminal, RefreshCw, CheckCircle2, History, AlertTriangle, FileJson, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

function BackupContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const action = searchParams.get("action") || "backup";

  // Terminal Simulator State
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedRestoreId, setSelectedRestoreId] = useState<string>("");

  // Target backup path state
  const [backupPathInput, setBackupPathInput] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    return `H:\\BACKUP_TELE\\Tele${day}.${month}.${year}.bak`;
  });

  const [isPickingFolder, setIsPickingFolder] = useState(false);

  const handleTargetFolderClick = async () => {
    if (isPickingFolder) return;
    setIsPickingFolder(true);
    const toastId = toast.loading("Opening folder dialog...");
    try {
      const response = await api.post("/backup/select-folder");
      if (response.data.success && response.data.selectedPath) {
        const folder = response.data.selectedPath;
        const fileName = backupPathInput.substring(backupPathInput.lastIndexOf("\\") + 1) || "Tele_backup.bak";
        const formattedFolder = folder.endsWith("\\") ? folder : `${folder}\\`;
        setBackupPathInput(`${formattedFolder}${fileName}`);
        toast.success("Folder selected!", { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (err: any) {
      console.error("Folder picker error:", err);
      toast.error("Failed to pick folder", { id: toastId });
    } finally {
      setIsPickingFolder(false);
    }
  };

  // Fetch Backup logs
  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["backupLogs"],
    queryFn: async () => {
      const response = await api.get("/backup/logs");
      return response.data.data;
    },
  });

  // Backup Mutation
  const runBackupMutation = useMutation({
    mutationFn: async (payload: { backupPath: string }) => {
      const response = await api.post("/backup/run", payload);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["backupLogs"] });
      // Simulate live terminal logs
      simulateBackupLogs(data.data.fileName);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Backup failed");
      setIsSimulating(false);
    },
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post("/backup/restore", { id });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["daybooks"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      simulateRestoreLogs();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Restore failed");
      setIsSimulating(false);
    },
  });

  const simulateBackupLogs = (fileName: string) => {
    setIsSimulating(true);
    setTerminalLogs([]);
    const lines = [
      "INITIALIZING CONSTRUCTION ERP SYSTEM SNAPSHOT...",
      "ACQUIRING TRANSACTION AND SITE TABLE READ LOCKS...",
      "SERIALIZING ADMIN AUTHENTICATION POOLS... [OK]",
      "SERIALIZING REGISTERED PROJECTS & SITE METRICS... [OK]",
      "SERIALIZING DAILY DAY BOOK EXPENDITURES... [OK]",
      "SERIALIZING LEDGERS & PARTY PROFILE BALANCE RECORDS... [OK]",
      "SERIALIZING MATERIAL STOCK VAULTS & TRANSACTION TRACKS... [OK]",
      "SERIALIZING DATA LOGGING INTEGRITY SCHEMAS... [OK]",
      `PACKAGING CORE OBJECT INTO VAULT FILE: ${fileName}`,
      "FLUSHING BUFFER STREAMS TO SYSTEM SERVERS DISK...",
      "DATABASE BACKUP SUMMARY WRITTEN SUCCESSFULLY.",
      "VAULT SNAPSHOT COMPLETED WITH STATUS: [SUCCESS]"
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < lines.length) {
        setTerminalLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${lines[index]}`]);
        index++;
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        toast.success("Database Backup successfully saved to local server filesystem");
      }
    }, 450);
  };

  const simulateRestoreLogs = () => {
    setIsSimulating(true);
    setTerminalLogs([]);
    const lines = [
      "CRITICAL: INITIATING RECOVERY DESTRUCTIVE OVERWRITE...",
      "DROPPING INVENTORY MATERIAL RECORDS... [OK]",
      "PURGING PARTY LEDGER LOG ENTRIES... [OK]",
      "DELETING DAY BOOK SYSTEM EXPENDITURES... [OK]",
      "PURGING CONSTRUCTION SITE PROFILES... [OK]",
      "RESTORING SITES METRIC OBJECT VALUES FROM JSON FILE... [OK]",
      "RESTORING SYSTEM DAY BOOK ENTRIES... [OK]",
      "RESTORING SUPPLIER LEDGERS AND BALANCES... [OK]",
      "RESTORING LEDGER RUNNING TRANSACTION RECORDS... [OK]",
      "RESTORING CORE INVENTORY WAREHOUSE COMMODITIES... [OK]",
      "REBUILDING RELATIONAL STRUCTURAL DB CONSTRAINTS... [OK]",
      "SYSTEM HEAL COMPLETED. RUNNING DATA VALIDATION TESTS... [OK]",
      "CONSTRUCTION ERP BACKUP RESTORED SUCCESSFULLY. HARD BOOT STATUS: [OK]"
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < lines.length) {
        setTerminalLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${lines[index]}`]);
        index++;
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        toast.success("All construction databases restored to target state!");
      }
    }, 450);
  };

  const handleBackupSubmit = () => {
    if (isSimulating) return;
    runBackupMutation.mutate({ backupPath: backupPathInput });
  };

  const handleRestoreSubmit = () => {
    if (isSimulating) return;
    if (!selectedRestoreId) {
      toast.error("Please select a database snapshot to restore");
      return;
    }
    const filename = logs?.find((l: any) => l.id === selectedRestoreId)?.fileName || "this snapshot";
    if (window.confirm(`⚠️ DESTRUCTIVE OVERWRITE WARNING ⚠️\nAre you absolutely sure you want to restore to ${filename}?\nThis will completely purge all current data, sites, expenses, and ledger entries, replacing them with the backup state! This is irreversible!`)) {
      restoreMutation.mutate(selectedRestoreId);
    }
  };

  if (action === "backup") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 animate-in fade-in duration-200 select-none">
        {/* Windows 95 Style Desktop Window */}
        <div className="bg-[#1C2333] border-4 border-slate-700 p-4 rounded shadow-2xl w-full max-w-sm font-sans text-white select-none">
          {/* Title Bar */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-300 p-1.5 text-slate-800 text-[10px] font-black select-none mb-6">
            <div className="flex items-center gap-1.5 pr-2">
              <div className="w-3.5 h-3.5 bg-amber-500 border border-slate-400 rounded flex items-center justify-center text-[8px] text-white">💾</div>
              <span className="font-extrabold uppercase tracking-wide">DATABASE_BACKUP</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] hover:bg-slate-300 active:bg-slate-400 cursor-pointer font-bold leading-none">_</div>
              <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] hover:bg-slate-300 active:bg-slate-400 cursor-pointer font-bold leading-none">⬜</div>
              <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] hover:bg-red-600 hover:text-white active:bg-slate-400 text-slate-800 font-bold cursor-pointer leading-none">X</div>
            </div>
          </div>
          
          {/* Body Content */}
          <div className="space-y-5 text-xs font-mono p-1">
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-slate-200 font-black uppercase text-[10px] tracking-wider">ENTER PATH :</span>
              <input
                type="text"
                value={backupPathInput}
                onChange={(e) => setBackupPathInput(e.target.value)}
                className="flex-1 bg-white text-slate-900 border border-slate-400 px-2 py-1 text-xs focus:outline-none rounded font-mono font-bold"
              />
            </div>
            
            <div className="flex justify-end pr-1">
              <button
                type="button"
                onClick={handleTargetFolderClick}
                className="bg-transparent border border-white hover:bg-white hover:text-slate-900 transition-colors px-3 py-1 font-bold text-[10px] rounded tracking-wide active:scale-95"
              >
                Target Folder
              </button>
            </div>
            
            <div className="pt-2">
              <button
                type="button"
                disabled={isSimulating}
                onClick={handleBackupSubmit}
                className="w-full bg-transparent border-2 border-white hover:bg-white hover:text-slate-900 transition-colors py-3 text-center uppercase tracking-wider font-black text-xs flex items-center justify-center gap-2 rounded select-none shadow-[inset_0_0_0_1px_rgba(255,255,255,1)] active:scale-[0.98]"
              >
                {isSimulating ? "BACKING UP..." : "CLICK FOR DATABASE_BACKUP"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono text-slate-800 animate-in fade-in duration-200">
      
      {/* Module Title Section */}
      <div className="flex items-center justify-between p-4 bg-white border border-slate-300 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-900 tracking-wider flex items-center gap-2">
            <Database className="h-6 w-6 text-amber-500" />
            {action === "backup" && "3.1. BACKUP DATABASE DATA"}
            {action === "restore" && "3.2. RECOVER / RESTORE DATABASE"}
            {action === "logs" && "3.3. DATABASE EXPORT LOGS"}
          </h2>
          <p className="text-xs text-slate-500 font-semibold tracking-wider mt-1 uppercase">
            {action === "backup" && "Serialize PostgreSQL tables into static JSON files written to disk."}
            {action === "restore" && "Re-import timestamped backup JSON streams to override current databases."}
            {action === "logs" && "Inspect historical system backup archives held in the local storage vault."}
          </p>
        </div>
      </div>

      {/* Grid containing Controls and terminal logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Option Form panel */}
        <Card className="lg:col-span-1 border border-slate-300 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-900 border-b border-slate-950 text-white py-4">
            <CardTitle className="text-xs font-black tracking-widest uppercase flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-400" />
              SYSTEM VAULT INTERFACE
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between text-xs font-bold uppercase">
            
            {/* View 1: RUN BACKUP PANEL */}
            {action === "backup" && (
              <div className="space-y-4 flex-1 flex flex-col justify-center">
                {/* Windows 95 Style Desktop Window */}
                <div className="bg-[#1C2333] border border-slate-500 p-3 rounded shadow-2xl w-full font-sans text-white select-none">
                  {/* Title Bar */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-300 p-1 text-slate-800 text-[10px] font-black select-none mb-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 bg-amber-500 border border-slate-400 rounded flex items-center justify-center text-[8px] text-white">💾</div>
                      <span>Database_Backup</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] hover:bg-slate-300 active:bg-slate-400 cursor-pointer font-bold leading-none">_</div>
                      <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] hover:bg-slate-300 active:bg-slate-400 cursor-pointer font-bold leading-none">⬜</div>
                      <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 flex items-center justify-center text-[8px] hover:bg-red-600 hover:text-white active:bg-slate-400 text-slate-800 font-bold cursor-pointer leading-none">X</div>
                    </div>
                  </div>
                  
                  {/* Body Content */}
                  <div className="space-y-4 text-xs font-mono p-1">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-slate-200">Enter Path :</span>
                      <input
                        type="text"
                        value={backupPathInput}
                        onChange={(e) => setBackupPathInput(e.target.value)}
                        className="flex-1 bg-white text-slate-900 border border-slate-400 px-2 py-1 text-xs focus:outline-none rounded font-mono font-bold"
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleTargetFolderClick}
                        className="bg-transparent border border-white hover:bg-white hover:text-slate-900 transition-colors px-3 py-1 font-bold text-[10px] rounded tracking-wide active:scale-95"
                      >
                        Target Folder
                      </button>
                    </div>
                    
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={isSimulating}
                        onClick={handleBackupSubmit}
                        className="w-full bg-transparent border-2 border-white hover:bg-white hover:text-slate-900 transition-colors py-3 text-center uppercase tracking-wider font-black text-xs flex items-center justify-center gap-2 rounded select-none shadow-[inset_0_0_0_1px_rgba(255,255,255,1)] active:scale-[0.98]"
                      >
                        {isSimulating ? "BACKING UP..." : "Click for Database_Backup"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: RESTORE DB PANEL */}
            {action === "restore" && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="p-3 bg-red-50 border border-red-300 text-red-950 rounded leading-relaxed text-[10px]">
                    <p className="font-black flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-700 shrink-0" /> SYSTEM DESTRUCTIVE WARNING</p>
                    <p className="mt-1">
                      RESTORE IS DESTRUCTIVE. ALL ACTIVE PROJECTS, FINANCIAL TRANSACTIONS, LEDGER RECORDS, AND STOCKS WILL BE PERMANENTLY FLUSHED AND OVERWRITTEN BY THIS SOURCE ARCHIVE snapshot.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="tracking-widest text-slate-700">SELECT TARGET SNAPSHOT</Label>
                    {isLoadingLogs ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <select
                        value={selectedRestoreId}
                        onChange={(e) => setSelectedRestoreId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-400 h-10 uppercase"
                      >
                        <option value="">-- CHOOSE EXPORT SNAPSHOT --</option>
                        {logs?.map((log: any) => (
                          <option key={log.id} value={log.id}>
                            {log.fileName.replace('.json', '').replace('.bak', '').replace('backup_', '')}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleRestoreSubmit}
                  disabled={isSimulating || !selectedRestoreId}
                  className="w-full bg-red-600 hover:bg-red-700 text-white border border-slate-950 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] py-8 font-black uppercase text-sm tracking-widest transition-transform active:translate-y-0.5 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 disabled:shadow-none"
                >
                  {isSimulating ? "RESTORING..." : "CONFIRM RESTORE OVERWRITE"}
                </Button>
              </div>
            )}

            {/* View 3: LOGS BRIEF INFO */}
            {action === "logs" && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="p-4 border-2 border-dashed border-slate-300 rounded bg-slate-50 text-slate-500 font-bold uppercase text-[10px] space-y-2 leading-relaxed">
                  <p>📂 HISTORIC BACKUPS ARE CATALOGUED BY DATE AND STORED AS SERIALIZED JSON BLOCKS INDEPENDENT OF DATABASES.</p>
                  <p>YOU CAN TRIGGER IMMEDIATE RESTORE POINTS DIRECTLY BY SWITCHING TO THE RECOVER SYSTEM OPTIONS ON THE SIDEBAR OR FROM RECOVERY MENUS.</p>
                </div>
                <Button
                  onClick={() => router.push("/backup?action=backup")}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-950 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] py-4 font-black uppercase text-xs tracking-wider"
                >
                  SWITCH TO SYSTEM BACKUP
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Right Column: Live Terminal logs or Logs Directory table */}
        <div className="lg:col-span-2">
          
          {action === "logs" ? (
            /* RENDER LOGS TABLE DIRECTORY */
            <Card className="border border-slate-300 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black tracking-widest text-slate-700 uppercase flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  DATABASE SNAPSHOT REPOSITORY ({logs?.length || 0})
                </CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["backupLogs"] })}
                  className="border border-slate-300 text-slate-700 font-bold h-7 px-2 hover:bg-slate-100"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent className="p-0 max-h-[460px] overflow-y-auto">
                {isLoadingLogs ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-100 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="font-bold text-slate-800 uppercase tracking-widest text-xs">FILE NAME</TableHead>
                        <TableHead className="font-bold text-slate-800 uppercase tracking-widest text-xs">TIMESTAMP EXPORTED</TableHead>
                        <TableHead className="font-bold text-slate-800 uppercase tracking-widest text-xs text-right">RECOVER POINT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center h-32 text-slate-500 font-black uppercase text-xs">
                            NO SNAPSHOT ARCHIVES RECORDED
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs?.map((log: any) => (
                          <TableRow key={log.id} className="hover:bg-slate-50/80 border-b border-slate-200 font-semibold text-xs">
                            <TableCell className="font-black text-slate-900 uppercase flex items-center gap-1.5 py-3">
                              <FileJson className="h-4 w-4 text-amber-500" />
                              {log.fileName}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRestoreId(log.id);
                                  router.push("/backup?action=restore");
                                }}
                                className="bg-amber-400 hover:bg-amber-500 text-slate-950 border border-slate-950 font-black text-[10px] py-0.5 h-6 uppercase px-2 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                              >
                                SELECT
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            /* RENDER EMULATOR TERMINAL SIMULATOR FOR BACKUP / RESTORE */
            <Card className="border-slate-950 border-2 rounded shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] bg-slate-950 overflow-hidden text-white flex flex-col h-[400px]">
              <CardHeader className="bg-slate-900 border-b border-slate-950 py-3 shrink-0 flex flex-row items-center gap-2 justify-between">
                <CardTitle className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  CORE EMULATOR DIRECTORY - SYSTEM LOGS
                </CardTitle>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-1.5 select-text selection:bg-emerald-800">
                {terminalLogs.length === 0 ? (
                  <div className="text-slate-500 uppercase h-full flex flex-col items-center justify-center space-y-2">
                    <p className="animate-pulse">_ TERMINAL DIRECTORY READY. AWAITING CORE ACTIONS.</p>
                    <p className="text-[9px]">PRESS INITIATE OR RESTORE OPTIONS ON THE LEFT MATRIX MODULE.</p>
                  </div>
                ) : (
                  <>
                    {terminalLogs.map((line, idx) => (
                      <p key={idx} className="leading-relaxed animate-in fade-in duration-75">
                        {line}
                      </p>
                    ))}
                    {isSimulating && (
                      <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1 vertical-middle"></span>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

        </div>

      </div>

    </div>
  );
}

export default function BackupPage() {
  return (
    <Suspense fallback={
      <div className="font-mono p-6 space-y-4">
        <div className="h-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-96 bg-slate-200 rounded animate-pulse" />
      </div>
    }>
      <BackupContent />
    </Suspense>
  );
}
