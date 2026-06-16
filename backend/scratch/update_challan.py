import os

file_path = r"c:\Users\ADMIN\Desktop\Building\frontend\src\app\(dashboard)\challan\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add handleAddNewRow after handleDeleteRow
handle_delete_row_old = """  const handleDeleteRow = (id: string) => {
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
  };"""

handle_new_row_code = """  const handleAddNewRow = async () => {
    if (directChallan) {
      const newItem = {
        id: `direct-item-${Date.now()}-${Math.random()}`,
        date: directChallan.date,
        type: "BY" as const,
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
  };"""

if handle_delete_row_old in content:
    content = content.replace(handle_delete_row_old, handle_delete_row_old + "\n\n" + handle_new_row_code)
    print("Step 1: Added handleAddNewRow successfully.")
else:
    print("Step 1 Failed: Could not find handleDeleteRow in file.")

# 2. Replace Copy 1 Table Body and Action Toolbar
copy1_old = """                      <tbody className="divide-y divide-slate-300 font-black text-[12px]">
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
                </div>"""

copy1_new = """                      <tbody className="divide-y divide-slate-300 font-black text-[12px]">
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
                    <button
                      type="button"
                      onClick={handleAddNewRow}
                      className="px-4 py-2 bg-blue-750 bg-blue-700 text-white border-2 border-blue-955 font-bold text-xs uppercase hover:bg-blue-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer rounded"
                    >
                      <span>+ Add Row / नया आइटम</span>
                    </button>
                    <button type="button" onClick={handlePrintWithoutRate} className="px-4 py-2 bg-slate-900 text-white border-2 border-slate-955 font-bold text-xs uppercase hover:bg-slate-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer">
                      <Printer className="h-4 w-4" /> <span>[1] PRINT ESTIMATE</span>
                    </button>
                    <button type="button" onClick={handleExportExcel} className="px-4 py-2 bg-emerald-700 text-white border-2 border-emerald-950 font-bold text-xs uppercase hover:bg-emerald-800 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4" /> <span>[F3] EXCEL</span>
                    </button>
                  </div>
                </div>"""

if copy1_old in content:
    content = content.replace(copy1_old, copy1_new)
    print("Step 2: Replaced Copy 1 Table and Toolbar successfully.")
else:
    print("Step 2 Failed: Could not find Copy 1 table code in file.")

# 3. Replace Copy 2 Table Body dynamically by splitting
parts = content.split('<tbody className="divide-y divide-slate-300 font-black text-[12px]">')
if len(parts) == 3:
    sub_parts = parts[2].split('</tbody>', 1)
    copy2_new_rows = """
                        {challanData.items.length > 0 ? (
                          challanData.items.map((item: any, idx: number) => (
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
                              <td className="py-1 px-2 border-r border-slate-300 text-center font-bold text-slate-500 w-20">
                                <EditableCell
                                  value={item.unit}
                                  className="text-center"
                                  onSave={(newVal) => handleSaveRow(item.id, item.material, item.qty, newVal, item.rate, item.rawItem)}
                                />
                              </td>
                              <td className="py-1 px-2 border-r border-slate-300 text-right font-mono text-slate-655 w-20">
                                <EditableCell
                                  value={item.rate}
                                  type="number"
                                  className="text-right font-mono"
                                  onSave={(newVal) => handleSaveRow(item.id, item.material, item.qty, item.unit, parseFloat(newVal) || 0, item.rawItem)}
                                />
                              </td>
                              <td className="py-1 px-2 text-right font-mono text-slate-955 w-28">
                                {item.amount > 0 ? item.amount.toFixed(2) : "-"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-bold uppercase tracking-widest">NO MATERIALS FOUND</td></tr>
                        )}
                      """
    parts[2] = copy2_new_rows + "</tbody>" + sub_parts[1]
    content = '<tbody className="divide-y divide-slate-300 font-black text-[12px]">' .join(parts)
    print("Step 3: Replaced Copy 2 Table successfully.")
else:
    print(f"Step 3 Failed: tbody count was {len(parts)}, expected 3.")

# 4. Remove EDIT CHALLAN SECTION (BOTTOM OF PAGE)
edit_section_old = """        {/* EDIT CHALLAN SECTION (BOTTOM OF PAGE) */}
        {challanData.items.length > 0 && (
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
        )}"""

if edit_section_old in content:
    content = content.replace(edit_section_old, "")
    print("Step 4: Removed bottom edit section successfully.")
else:
    print("Step 4 Failed: Could not find EDIT CHALLAN SECTION (BOTTOM OF PAGE) in file.")

# 5. Split at ChallanRowEditor props and append EditableCell
split_term = "interface ChallanRowEditorProps {"
if split_term in content:
    parts = content.split(split_term)
    first_part = parts[0]
    
    editable_cell_code = """interface EditableCellProps {
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
"""
    new_content = first_part + editable_cell_code
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Step 5: Successfully replaced ChallanRowEditor with EditableCell at bottom of file.")
else:
    print("Step 5 Failed: Could not find interface ChallanRowEditorProps in file.")
