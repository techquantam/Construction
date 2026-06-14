"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Trash2, Edit3, Save, X, Search } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function MaterialsPage() {
  const queryClient = useQueryClient();

  // Create Form State (Rate defaults to empty string)
  const [formData, setFormData] = useState({
    name: "",
    unit: "CFT",
    rate: "",
  });

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // Dynamic custom units added in session
  const [customUnits, setCustomUnits] = useState<string[]>([]);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    unit: "",
    rate: "",
  });

  // Refs for keyboard transitions in Create Form
  const nameInputRef = useRef<HTMLInputElement>(null);
  const unitSelectRef = useRef<HTMLSelectElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus Search Box on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Focused row for keyboard navigation in Table
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  // Fetch materials
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const response = await api.get("/materials");
      return response.data.data || [];
    },
  });

  // Create Material Mutation
  const createMaterialMutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/materials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material registered successfully");
      setFormData({
        name: "",
        unit: "CFT",
        rate: "",
      });
      nameInputRef.current?.focus();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to register material");
    },
  });

  // Update Material Mutation
  const updateMaterialMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await api.put(`/materials/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material updated successfully");
      setEditingId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update material");
    },
  });

  // Delete Material Mutation
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
    },
  });

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Material Name is required");
      return;
    }
    createMaterialMutation.mutate({
      name: formData.name.trim().toUpperCase(),
      unit: formData.unit.trim().toUpperCase(),
      rate: formData.rate === "" ? null : parseFloat(formData.rate) || 0,
      openingStock: 0,
      lowStockAlert: 0
    });
  };

  const handleStartEdit = (material: any) => {
    setEditingId(material.id);
    setEditFormData({
      name: material.name,
      unit: material.unit || "CFT",
      rate: material.rate !== null && material.rate !== undefined && material.rate !== 0 ? String(material.rate) : "",
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editFormData.name.trim()) {
      toast.error("Material Name is required");
      return;
    }
    updateMaterialMutation.mutate({
      id,
      data: {
        name: editFormData.name.trim().toUpperCase(),
        unit: editFormData.unit.trim().toUpperCase(),
        rate: editFormData.rate === "" ? null : parseFloat(editFormData.rate) || 0,
      },
    });
  };

  const handleDeleteMaterial = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete material: "${name}"?`)) {
      deleteMaterialMutation.mutate(id);
    }
  };

  // Filtered materials catalog based on search input
  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    if (!searchQuery.trim()) return materials;
    const q = searchQuery.trim().toUpperCase();
    return materials.filter((material: any) => 
      material.name.toUpperCase().includes(q)
    );
  }, [materials, searchQuery]);

  // Reset focus when query changes
  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [searchQuery, materials]);

  // Handle Capture Phase global Arrow keys navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isFormInputFocused = activeEl && (
        activeEl === nameInputRef.current ||
        activeEl === rateInputRef.current ||
        activeEl === unitSelectRef.current ||
        activeEl.tagName === "SELECT" ||
        (activeEl.tagName === "INPUT" && activeEl !== searchInputRef.current)
      );

      if (isFormInputFocused) return;
      if (editingId !== null) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setFocusedRowIndex((prev) => {
          const next = prev + 1;
          const index = next >= filteredMaterials.length ? filteredMaterials.length - 1 : next;
          setTimeout(() => {
            const el = document.getElementById(`table-row-${index}`);
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
            searchInputRef.current?.focus();
            return -1;
          }
          setTimeout(() => {
            const el = document.getElementById(`table-row-${next}`);
            if (el) el.scrollIntoView({ block: "nearest" });
          }, 10);
          return next;
        });
      } else if (e.key === "Enter") {
        if (focusedRowIndex >= 0 && focusedRowIndex < filteredMaterials.length) {
          e.preventDefault();
          e.stopPropagation();
          handleStartEdit(filteredMaterials[focusedRowIndex]);
        }
      } else if (e.key === "Escape") {
        if (focusedRowIndex >= 0) {
          e.preventDefault();
          e.stopPropagation();
          setFocusedRowIndex(-1);
          searchInputRef.current?.focus();
        } else if (activeEl === searchInputRef.current) {
          e.preventDefault();
          e.stopPropagation();
          nameInputRef.current?.focus();
          nameInputRef.current?.select();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [filteredMaterials, focusedRowIndex, editingId]);

  const getDropdownUnits = (currentVal: string) => {
    const defaultUnits = ["CFT", "BAGS", "PCS", "TONS", "KG", "LTR", "SQ.FT", "MTR"];
    const materialUnits = materials.map((m: any) => m.unit?.toUpperCase()).filter(Boolean);
    const combined = Array.from(new Set([...defaultUnits, ...materialUnits, ...customUnits]));
    if (currentVal && !combined.includes(currentVal.toUpperCase())) {
      combined.push(currentVal.toUpperCase());
    }
    return combined.sort((a, b) => a.localeCompare(b));
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>, isEdit: boolean = false) => {
    const val = e.target.value;
    if (val === "ADD_NEW") {
      const newUnit = window.prompt("ENTER NEW MEASUREMENT UNIT / नई मापन इकाई दर्ज करें (e.g. COIL, BUNDLE, NOS):");
      if (newUnit && newUnit.trim()) {
        const cleanUnit = newUnit.trim().toUpperCase();
        setCustomUnits(prev => {
          if (!prev.includes(cleanUnit)) {
            return [...prev, cleanUnit];
          }
          return prev;
        });
        if (isEdit) {
          setEditFormData(prev => ({ ...prev, unit: cleanUnit }));
        } else {
          setFormData(prev => ({ ...prev, unit: cleanUnit }));
        }
      } else {
        // Revert select dropdown DOM value back to current state unit
        e.target.value = isEdit ? editFormData.unit : formData.unit;
      }
    } else {
      if (isEdit) {
        setEditFormData(prev => ({ ...prev, unit: val }));
      } else {
        setFormData(prev => ({ ...prev, unit: val }));
      }
    }
  };

  return (
    <div className="font-mono text-slate-800 space-y-6 select-none">
      {/* Header Info */}
      <div className="bg-[#2B547E] text-white p-4 border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] rounded select-none flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-widest uppercase">MATERIAL REGISTER / सामग्री रजिस्टर</h1>
          <p className="text-[10px] text-slate-200 mt-1 uppercase font-semibold">Maintain default material catalog and auto-fill pricing</p>
        </div>
        <Package className="h-6 w-6 text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Register a Material Form */}
        <div className="lg:col-span-4 bg-[#E5ECF4] border-2 border-slate-800 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 rounded">
          <div className="border-b-2 border-slate-350 pb-2 mb-2 flex items-center gap-2">
            <span className="font-bold text-xs uppercase text-slate-700">1. REGISTER NEW MATERIAL / नया आइटम दर्ज करें</span>
          </div>

          <form onSubmit={handleCreateMaterial} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-slate-655">Material Name / सामग्री का नाम:</Label>
              <Input
                ref={nameInputRef}
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    unitSelectRef.current?.focus();
                  }
                }}
                placeholder="e.g. BALU GANGA / BRICKS"
                className="bg-white border-2 border-slate-800 rounded font-bold text-xs uppercase focus:border-[#2B547E]"
              />
            </div>

            {/* Unit Input - Native select for keyboard compatibility */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-slate-655">Unit / मापन इकाई:</Label>
              <select
                ref={unitSelectRef}
                value={formData.unit}
                onChange={(e) => handleUnitChange(e, false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    rateInputRef.current?.focus();
                    rateInputRef.current?.select();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    nameInputRef.current?.focus();
                    nameInputRef.current?.select();
                  }
                }}
                className="w-full bg-white border-2 border-slate-800 rounded px-2.5 py-1.5 font-bold text-xs uppercase focus:outline-none focus:border-[#2B547E] cursor-pointer font-mono text-slate-800"
              >
                {getDropdownUnits(formData.unit).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="ADD_NEW" className="text-emerald-700 font-extrabold">+ ADD NEW UNIT / नया जोड़ें</option>
              </select>
            </div>

            {/* Rate Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-slate-655">Default Rate / डिफ़ॉल्ट दर:</Label>
              <Input
                ref={rateInputRef}
                type="number"
                step="any"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateMaterial(e);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    unitSelectRef.current?.focus();
                  }
                }}
                placeholder="0.00"
                className="bg-white border-2 border-slate-800 rounded font-bold text-xs font-mono focus:border-[#2B547E]"
              />
            </div>

            {/* Submit Button */}
            <Button
              ref={submitButtonRef}
              type="submit"
              disabled={createMaterialMutation.isPending}
              className="w-full bg-[#2B547E] hover:bg-[#1E3E64] text-white border-2 border-slate-900 font-extrabold text-[11px] uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all py-2 rounded focus:outline-none"
            >
              {createMaterialMutation.isPending ? "REGISTERING..." : "REGISTER MATERIAL"}
            </Button>
          </form>
        </div>

        {/* Right Column - Registered Materials Table */}
        <div className="lg:col-span-8 bg-[#E5ECF4] border-2 border-slate-800 p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 rounded">
          <div className="border-b-2 border-slate-350 pb-2 mb-2 flex items-center justify-between">
            <span className="font-bold text-xs uppercase text-slate-700">2. REGISTERED MATERIALS LIST / पंजीकृत सामग्री सूची</span>
            <span className="text-[10px] bg-slate-300 px-2 py-0.5 border border-slate-400 text-slate-700 font-bold rounded">
              TOTAL: {filteredMaterials.length} / {materials.length} ITEMS
            </span>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 border-2 border-slate-800 bg-white px-3 py-1.5 shadow-inner rounded">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              placeholder="SEARCH MATERIAL BY NAME / सामग्री खोजें..."
              className="w-full text-xs font-bold uppercase focus:outline-none bg-transparent placeholder-slate-400 font-mono text-slate-800"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-8 w-full border border-slate-300" />
              <Skeleton className="h-8 w-full border border-slate-300" />
              <Skeleton className="h-8 w-full border border-slate-300" />
            </div>
          ) : (
            <div className="overflow-x-auto border-2 border-slate-800 bg-white">
              <Table>
                <TableHeader className="bg-slate-100 border-b-2 border-slate-800 font-black text-slate-800 text-[10px] select-none">
                  <TableRow>
                    <TableHead className="w-12 text-center border-r border-slate-300">S.No</TableHead>
                    <TableHead className="border-r border-slate-300">Material Name</TableHead>
                    <TableHead className="w-24 text-center border-r border-slate-300">Unit</TableHead>
                    <TableHead className="w-28 text-right border-r border-slate-300">Default Rate</TableHead>
                    <TableHead className="w-28 text-center no-print">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="font-bold text-xs">
                  {filteredMaterials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400 font-extrabold uppercase">
                        {searchQuery ? "No matching materials found." : "No materials registered yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMaterials.map((material: any, idx: number) => {
                      const isEditing = editingId === material.id;
                      const isFocused = idx === focusedRowIndex;
                      return (
                        <TableRow
                          key={material.id}
                          id={`table-row-${idx}`}
                          onClick={() => setFocusedRowIndex(idx)}
                          className={`transition-colors ${
                            isFocused
                              ? "bg-amber-400 hover:bg-amber-400 text-slate-955 font-black border-l-4 border-l-slate-955"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          {/* S.No */}
                          <td className={`text-center py-2 px-1 border-r border-slate-300 select-none ${isFocused ? "text-slate-950 font-black" : "text-slate-550"}`}>
                            {idx + 1}
                          </td>

                          {/* Material Name */}
                          <td className={`border-r border-slate-300 py-1.5 px-3 uppercase font-black ${isFocused ? "text-slate-950" : "text-slate-900"}`}>
                            {isEditing ? (
                              <input
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value.toUpperCase() })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(material.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                className="w-full h-7 py-0.5 px-2 text-xs font-bold border-2 border-slate-800 rounded uppercase bg-amber-50 focus:outline-none focus:border-[#2B547E]"
                              />
                            ) : (
                              <span>{material.name}</span>
                            )}
                          </td>

                          {/* Unit */}
                          <td className={`text-center border-r border-slate-300 py-1.5 px-2 ${isFocused ? "text-slate-950 font-black" : ""}`}>
                            {isEditing ? (
                              <select
                                value={editFormData.unit}
                                onChange={(e) => handleUnitChange(e, true)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(material.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                className="w-full h-7 py-0.5 px-2 text-xs font-bold border-2 border-slate-800 rounded bg-amber-50 uppercase focus:outline-none focus:border-[#2B547E] cursor-pointer"
                              >
                                {getDropdownUnits(editFormData.unit).map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                                <option value="ADD_NEW" className="text-emerald-700 font-extrabold">+ ADD NEW</option>
                              </select>
                            ) : (
                              <span className={isFocused ? "text-slate-955 font-black" : "text-slate-550"}>{material.unit}</span>
                            )}
                          </td>

                          {/* Default Rate */}
                          <td className={`text-right border-r border-slate-300 py-1.5 px-3 font-mono font-black ${isFocused ? "text-slate-950" : "text-slate-900"}`}>
                            {isEditing ? (
                              <input
                                type="number"
                                step="any"
                                value={editFormData.rate}
                                onChange={(e) => setEditFormData({ ...editFormData, rate: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(material.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                placeholder="0.00"
                                className="w-full h-7 py-0.5 px-2 text-xs font-bold font-mono border-2 border-slate-800 rounded text-right bg-amber-50 focus:outline-none focus:border-[#2B547E]"
                              />
                            ) : (
                              <span>
                                {material.rate !== null && material.rate !== undefined && material.rate !== 0 
                                  ? (material.rate as number).toFixed(2) 
                                  : ""}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="text-center py-1.5 px-2 no-print">
                            {isEditing ? (
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => handleSaveEdit(material.id)}
                                  className="p-1 text-emerald-700 hover:text-white hover:bg-emerald-650 border border-emerald-500 rounded cursor-pointer transition-colors bg-white"
                                  title="Save Changes"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1 text-slate-550 hover:text-white hover:bg-slate-600 border border-slate-400 rounded cursor-pointer transition-colors bg-white"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => handleStartEdit(material)}
                                  className={`p-1 border rounded cursor-pointer transition-colors ${
                                    isFocused
                                      ? "text-slate-955 hover:bg-slate-900 hover:text-white border-slate-950 bg-white/40"
                                      : "text-blue-750 hover:text-white hover:bg-[#2B547E] border-blue-300"
                                  }`}
                                  title="Edit Material"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMaterial(material.id, material.name)}
                                  className={`p-1 border rounded cursor-pointer transition-colors ${
                                    isFocused
                                      ? "text-slate-955 hover:bg-red-650 hover:text-white border-slate-950 bg-white/40"
                                      : "text-red-655 hover:text-white hover:bg-red-650 border-red-200"
                                  }`}
                                  title="Delete Material"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
