"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Package, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export default function MaterialsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    unit: "bags",
    openingStock: "0",
    lowStockAlert: "10",
  });

  const [stockFormData, setStockFormData] = useState({
    siteId: "none",
    date: new Date().toISOString().split("T")[0],
    type: "StockIn", // StockIn, StockOut
    quantity: "",
    description: "",
  });

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const response = await api.get("/sites");
      return response.data.data;
    },
  });

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const response = await api.get("/materials");
      return response.data.data;
    },
  });

  const createMaterialMutation = useMutation({
    mutationFn: async (data: any) => {
      return await api.post("/materials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material added successfully");
      setIsDialogOpen(false);
      setFormData({
        name: "",
        unit: "bags",
        openingStock: "0",
        lowStockAlert: "10",
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to add material");
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data, siteId: data.siteId === "none" ? null : data.siteId };
      return await api.post(`/materials/${selectedMaterial.id}/transactions`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Stock updated successfully");
      setIsStockDialogOpen(false);
      setStockFormData({
        siteId: "none",
        date: new Date().toISOString().split("T")[0],
        type: "StockIn",
        quantity: "",
        description: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update stock");
    },
  });

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    createMaterialMutation.mutate(formData);
  };

  const handleUpdateStock = (e: React.FormEvent) => {
    e.preventDefault();
    updateStockMutation.mutate(stockFormData);
  };

  const openStockDialog = (material: any, type: "StockIn" | "StockOut") => {
    setSelectedMaterial(material);
    setStockFormData(prev => ({ ...prev, type, quantity: "", siteId: "none", description: "" }));
    setIsStockDialogOpen(true);
  };

  const units = ["bags", "pieces", "tons", "kg", "liters", "cubic_feet", "sq_feet"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Material Inventory</h1>
          <p className="text-muted-foreground">Track construction materials and stock levels.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-secondary hover:bg-secondary/90 text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Material
            </Button>
          </DialogTrigger>
          <DialogContent onEscapeKeyDown={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Add New Material</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateMaterial} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Material Name</Label>
                  <Input 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Cement (UltraTech)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit of Measurement</Label>
                  <Select 
                    value={formData.unit} 
                    onValueChange={(val) => setFormData({...formData, unit: val as string})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Opening Stock</Label>
                  <Input 
                    type="number" 
                    required 
                    value={formData.openingStock}
                    onChange={(e) => setFormData({...formData, openingStock: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Low Stock Alert Level</Label>
                  <Input 
                    type="number" 
                    required 
                    value={formData.lowStockAlert}
                    onChange={(e) => setFormData({...formData, lowStockAlert: e.target.value})}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMaterialMutation.isPending}>
                {createMaterialMutation.isPending ? "Saving..." : "Save Material"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Current Stock Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        No materials found. Add materials to manage stock.
                      </TableCell>
                    </TableRow>
                  ) : (
                    materials?.map((material: any) => {
                      const isLowStock = material.currentStock <= material.lowStockAlert;
                      return (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium">{material.name}</TableCell>
                          <TableCell>{material.unit}</TableCell>
                          <TableCell className="font-bold text-lg">
                            {material.currentStock}
                          </TableCell>
                          <TableCell>
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                <AlertTriangle className="h-3 w-3" /> Low Stock
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Healthy
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                                onClick={() => openStockDialog(material, "StockIn")}
                              >
                                <ArrowDown className="mr-1 h-3 w-3" /> In
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                onClick={() => openStockDialog(material, "StockOut")}
                              >
                                <ArrowUp className="mr-1 h-3 w-3" /> Out
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent onEscapeKeyDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {stockFormData.type === "StockIn" ? "Add Stock (Purchase)" : "Issue Stock (Usage)"} - {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStock} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  required 
                  value={stockFormData.date}
                  onChange={(e) => setStockFormData({...stockFormData, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity ({selectedMaterial?.unit})</Label>
                <Input 
                  type="number" 
                  required 
                  min="0.01"
                  step="0.01"
                  value={stockFormData.quantity}
                  onChange={(e) => setStockFormData({...stockFormData, quantity: e.target.value})}
                />
              </div>
            </div>

            {stockFormData.type === "StockOut" && (
              <div className="space-y-2">
                <Label>Issue to Site</Label>
                <Select 
                  value={stockFormData.siteId} 
                  onValueChange={(val) => setStockFormData({...stockFormData, siteId: val as string})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General Usage / None</SelectItem>
                    {sites?.map((site: any) => (
                      <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Remarks / Supplier Name / Bill No</Label>
              <Input 
                value={stockFormData.description}
                onChange={(e) => setStockFormData({...stockFormData, description: e.target.value})}
              />
            </div>

            <Button type="submit" className="w-full" disabled={updateStockMutation.isPending}>
              {updateStockMutation.isPending ? "Processing..." : "Confirm Transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
