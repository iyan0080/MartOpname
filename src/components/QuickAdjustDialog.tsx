import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, Calculator, Package } from 'lucide-react';
import { InventoryItem } from '../types/inventory.ts';
import { formatRupiah } from '../utils/excelUtils.ts';
import { QuantityCalculatorModal } from './QuantityCalculatorModal.tsx';

interface QuickAdjustDialogProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  activeUser: string;
  onSaveAdjust: (
    itemId: string,
    newQuantity: number,
    notes?: string
  ) => Promise<boolean>;
}

export const QuickAdjustDialog: React.FC<QuickAdjustDialogProps> = ({
  item,
  isOpen,
  onClose,
  activeUser,
  onSaveAdjust,
}) => {
  const [qty, setQty] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setQty(item.quantity);
      setNotes(item.keterangan || '');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const currentSysQty = item.quantitySystem || 0;
  const selisih = qty - currentSysQty;
  const modalPerUnit = item.hargaModal || 0;
  const totalModalBarang = qty * modalPerUnit;
  const selisihModal = selisih * modalPerUnit;

  const handleApply = async () => {
    setIsSubmitting(true);
    const success = await onSaveAdjust(item.id, qty, notes);
    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  const handleIncrement = (amount: number) => {
    setQty((prev) => Math.max(0, prev + amount));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Hitung Stok Opname</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Petugas: <strong className="text-slate-800 dark:text-slate-200">{activeUser}</strong></p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Item Info */}
          <div className="p-5 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">{item.sku}</span>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{item.namaBarang}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                <span>Barcode: {item.barcode || '-'}</span>
                <span>·</span>
                <span>Kategori: {item.kategori}</span>
              </div>
            </div>

            {/* Quick Counter Buttons + Calculator Trigger */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Stok Fisik Terhitung Saat Ini:
                </label>
                <button
                  type="button"
                  onClick={() => setIsCalcModalOpen(true)}
                  className="px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded flex items-center gap-1 transition-colors"
                  title="Buka kalkulator untuk hitung dus, lusin, atau baris rak"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Kalkulator Dus/Rak</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleIncrement(-1)}
                  className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-24 text-center py-2 px-3 text-xl font-mono font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() => handleIncrement(1)}
                  className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => handleIncrement(5)}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-mono"
                >
                  +5
                </button>
                <button
                  type="button"
                  onClick={() => handleIncrement(10)}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-mono"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleIncrement(24)}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-mono"
                >
                  +24 (1 Dus)
                </button>
                <button
                  type="button"
                  onClick={() => setQty(item.quantitySystem)}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md"
                >
                  Samakan Sistem ({item.quantitySystem})
                </button>
              </div>
            </div>

            {/* Modal & Discrepancy Card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Stok Sistem / Buku:</span>
                <span className="font-mono font-semibold">{item.quantitySystem} pcs</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Harga Modal Beli:</span>
                <span className="font-mono font-semibold">{formatRupiah(modalPerUnit)} / pcs</span>
              </div>
              <div className="flex justify-between text-slate-900 dark:text-white font-semibold pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Total Nilai Modal Fisik:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{formatRupiah(totalModalBarang)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-600 dark:text-slate-400">Status Selisih:</span>
                <span
                  className={`font-mono font-bold text-xs ${
                    selisih === 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : selisih < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {selisih === 0
                    ? 'Sesuai Sistem'
                    : `${selisih > 0 ? '+' : ''}${selisih} pcs (${formatRupiah(selisihModal)})`}
                </span>
              </div>
            </div>

            {/* Notes Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan / Kondisi / Lokasi Rak:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Rak Depan B2, Exp 2027, Stok aman"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApply}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Check className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Hitungan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Quantity Calculator */}
      <QuantityCalculatorModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        targetItem={item}
        onApplyQuantity={async (_id, calculatedQty, calcNotes) => {
          setQty(calculatedQty);
          if (calcNotes) {
            setNotes(calcNotes);
          }
          setIsCalcModalOpen(false);
          return true;
        }}
      />
    </>
  );
};
