import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, RefreshCw } from 'lucide-react';

interface HpPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: React.ReactNode;
}

export default function HpPrintPreviewModal({ isOpen, onClose, content }: HpPrintPreviewModalProps) {
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [scale, setScale] = useState<number>(100);
  const [isPrinting, setIsPrinting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleReset = () => {
    setPosition('top');
    setOrientation('vertical');
    setScale(100);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
        onClose();
      }, 100);
    }, 500);
  };

  if (!isOpen || !mounted) return null;

  const PrintNode = () => (
    <div style={{
      width: orientation === 'vertical' ? '148.5mm' : '210mm',
      height: orientation === 'vertical' ? '210mm' : '148.5mm',
      transform: `scale(${scale / 100}) ${orientation === 'vertical' ? 'rotate(-90deg)' : ''}`,
      transformOrigin: 'center center',
      padding: '8mm',
      boxSizing: 'border-box'
    }} className="flex items-center justify-center">
      <div className="w-full h-full bg-white border-2 border-black p-[18px] rounded box-border relative overflow-hidden print:border-black print:bg-white text-black print-only-layout-hp">
        {content}
      </div>
    </div>
  );

  return createPortal(
    <>
      {/* MODAL UI */}
      {!isPrinting && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-[1000px] max-w-[95vw] h-[85vh] flex overflow-hidden">
            
            {/* CONTROLS */}
            <div className="w-[320px] bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-8 overflow-y-auto">
              <div>
                <h2 className="text-2xl font-black text-slate-800 mb-1">Print Designer</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">HP / Half A4 Layout</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">1. Print Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPosition('top')} className={`py-2.5 text-xs font-bold rounded border-2 transition-colors ${position === 'top' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>Top Half</button>
                  <button onClick={() => setPosition('bottom')} className={`py-2.5 text-xs font-bold rounded border-2 transition-colors ${position === 'bottom' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>Bottom Half</button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">2. Content Orientation</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setOrientation('vertical')} className={`py-2.5 text-xs font-bold rounded border-2 transition-colors ${orientation === 'vertical' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>Vertical</button>
                  <button onClick={() => setOrientation('horizontal')} className={`py-2.5 text-xs font-bold rounded border-2 transition-colors ${orientation === 'horizontal' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>Horizontal</button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">3. Scale</label>
                  <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{scale}%</span>
                </div>
                <input type="range" min="50" max="150" value={scale} onChange={e => setScale(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>

              <div className="mt-auto space-y-3 pt-6 border-t border-slate-200">
                <button onClick={handleReset} className="w-full py-2.5 bg-slate-200 text-slate-700 font-bold text-sm rounded hover:bg-slate-300 transition-colors flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Reset Settings
                </button>
                <button onClick={handlePrint} className="w-full py-3 bg-blue-600 text-white font-black text-sm rounded hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg active:translate-y-0.5">
                  <Printer className="w-4 h-4" /> PRINT NOW
                </button>
                <button onClick={onClose} className="w-full py-2 text-slate-500 font-bold text-xs hover:text-slate-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>

            {/* PREVIEW */}
            <div className="flex-1 bg-slate-200 flex items-center justify-center p-8 overflow-hidden relative shadow-inner">
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
              
              {/* A4 Sheet scaled to fit screen */}
              <div className="relative bg-white shadow-2xl transition-all duration-300" style={{ width: '210mm', height: '297mm', transform: 'scale(0.52)', transformOrigin: 'center' }}>
                <div className="absolute inset-0 flex flex-col">
                  <div className="h-[50%] relative flex items-center justify-center overflow-hidden border-b-2 border-dashed border-slate-300">
                    {position === 'top' && <PrintNode />}
                  </div>
                  <div className="h-[50%] relative flex items-center justify-center overflow-hidden">
                    {position === 'bottom' && <PrintNode />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTUAL PRINT DOM */}
      {isPrinting && (
        <div id="hp-print-portal-root-wrapper">
          <style>{`
            @media print {
              body > :not(#hp-print-portal-root-wrapper) { display: none !important; }
              @page { size: 210mm 297mm portrait !important; margin: 0 !important; }
              html, body { width: 210mm !important; height: 297mm !important; background: white !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
              .print-only-layout-hp { display: block !important; }
              .daybook-print-wrapper, .ledger-print-wrapper, .summary-print-wrapper { background: transparent !important; }
              table { background: transparent !important; }
              th { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: #f1f5f9 !important; }
              .no-print { display: none !important; }
            }
          `}</style>
          <div className="bg-white relative" style={{ width: '210mm', height: '297mm', boxSizing: 'border-box' }}>
            <div className="absolute top-0 left-0 w-full h-[50%] flex items-center justify-center overflow-hidden">
              {position === 'top' && <PrintNode />}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-[50%] flex items-center justify-center overflow-hidden">
              {position === 'bottom' && <PrintNode />}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
