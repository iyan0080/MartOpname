import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Package,
  Layers,
  Search,
  Plus,
} from 'lucide-react';
import { InventoryItem } from '../types/inventory.ts';

interface QuantityCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem?: InventoryItem | null;
  items?: InventoryItem[];
  onApplyQuantity: (itemId: string, quantity: number, notes?: string, isiPerDus?: number) => Promise<boolean>;
  onSelectResult?: (quantity: number, isiPerDus?: number) => void;
}

export const QuantityCalculatorModal: React.FC<QuantityCalculatorModalProps> = ({
  isOpen,
  onClose,
  targetItem = null,
  items = [],
  onApplyQuantity,
  onSelectResult,
}) => {
  // Calculation mode: 'standard' (aritmatika & dus) | 'grid' (baris x tumpukan)
  const [calcMode, setCalcMode] = useState<'standard' | 'grid'>('standard');

  // Standard calculator state
  const [displayExp, setDisplayExp] = useState('0');
  const [calcResult, setCalcResult] = useState<number>(0);
  const [calcHistory, setCalcHistory] = useState<string[]>([]);

  // Controlled box multiplier state (Pengisian Isi Per Dus)
  const [boxCount, setBoxCount] = useState<number | ''>(1);
  const [itemsPerBox, setItemsPerBox] = useState<number | ''>('');
  const [savedIsiPerDus, setSavedIsiPerDus] = useState<number | undefined>(undefined);

  // Grid / Shelf counter state (baris x kedalaman/tumpukan + sisa)
  const [gridFacing, setGridFacing] = useState<number | ''>(4);
  const [gridDepth, setGridDepth] = useState<number | ''>(6);
  const [gridExtra, setGridExtra] = useState<number | ''>(0);

  // Target item selection if launched as standalone
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemSearch, setItemSearch] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  useEffect(() => {
    if (targetItem) {
      setSelectedItemId(targetItem.id);
      setDisplayExp(String(targetItem.quantity || '0'));
      setCalcResult(targetItem.quantity || 0);
      if (targetItem.isiPerDus && targetItem.isiPerDus > 0) {
        const cleanIsi = Math.max(1, Math.round(targetItem.isiPerDus));
        setItemsPerBox(cleanIsi);
        setSavedIsiPerDus(cleanIsi);
      } else {
        setItemsPerBox('');
        setSavedIsiPerDus(undefined);
      }
    } else {
      setSelectedItemId('');
      setDisplayExp('0');
      setCalcResult(0);
      setItemsPerBox('');
      setSavedIsiPerDus(undefined);
    }
    setBoxCount(1);
    setCalcMode('standard');
    setSelectionError(null);
  }, [targetItem, isOpen]);

  // Evaluate mathematical expression safely
  const evaluateExpression = (expr: string): number => {
    try {
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
      if (!/^[\d+\-*/().\s]+$/.test(sanitized)) {
        return 0;
      }
      // eslint-disable-next-line no-new-func
      const result = new Function(`'use strict'; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.max(0, Math.round(result));
      }
      return 0;
    } catch {
      return 0;
    }
  };

  // Update calculation whenever expression changes
  useEffect(() => {
    if (displayExp && displayExp !== '0') {
      const res = evaluateExpression(displayExp);
      setCalcResult(res);
    } else {
      setCalcResult(0);
    }
  }, [displayExp]);

  // Recalculate grid only when in grid mode
  useEffect(() => {
    if (calcMode !== 'grid') return;
    const f = typeof gridFacing === 'number' ? gridFacing : 0;
    const d = typeof gridDepth === 'number' ? gridDepth : 0;
    const e = typeof gridExtra === 'number' ? gridExtra : 0;
    const total = f * d + e;
    setCalcResult(Math.max(0, total));
    setDisplayExp(`${f} × ${d} + ${e}`);
  }, [calcMode, gridFacing, gridDepth, gridExtra]);

  if (!isOpen) return null;

  const handleNumClick = (val: string) => {
    setDisplayExp((prev) => {
      if (prev === '0' && val !== '.') {
        return val;
      }
      return prev + val;
    });
  };

  const handleOperatorClick = (op: string) => {
    setDisplayExp((prev) => {
      const lastChar = prev.trim().slice(-1);
      if (['+', '-', '×', '÷'].includes(lastChar)) {
        return prev.slice(0, -1) + op;
      }
      return prev + ' ' + op + ' ';
    });
  };

  const handleClear = () => {
    setDisplayExp('0');
    setCalcResult(0);
  };

  const handleBackspace = () => {
    setDisplayExp((prev) => {
      if (prev.length <= 1 || prev === '0') return '0';
      const trimmed = prev.trim();
      if (['+', '-', '×', '÷'].includes(trimmed.slice(-1))) {
        return trimmed.slice(0, -1).trim();
      }
      return trimmed.slice(0, -1) || '0';
    });
  };

  // Add calculated dus * isiPerDus
  const addPackMultiplier = (packName: string, count: number) => {
    setDisplayExp((prev) => {
      if (prev === '0') {
        return `${count}`;
      }
      return `${prev} + ${count}`;
    });
    setCalcHistory((prev) => [`+ ${count} pcs (${packName})`, ...prev.slice(0, 4)]);
  };

  const handleAddBoxInput = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const d = typeof boxCount === 'number' ? boxCount : 0;
    const isi = typeof itemsPerBox === 'number' ? itemsPerBox : 0;
    if (d > 0 && isi > 0) {
      const cleanIsi = Math.max(1, Math.round(isi));
      addPackMultiplier(`${d} Dus × ${cleanIsi} pcs`, d * cleanIsi);
      setSavedIsiPerDus(cleanIsi);
      setBoxCount(1);
      setItemsPerBox(cleanIsi);
    }
  };

  const boxSubtotal =
    typeof boxCount === 'number' && typeof itemsPerBox === 'number' && boxCount > 0 && itemsPerBox > 0
      ? boxCount * itemsPerBox
      : 0;

  const handleApply = async () => {
    const resolvedIsi =
      typeof itemsPerBox === 'number' && itemsPerBox > 0
        ? Math.max(1, Math.round(itemsPerBox))
        : savedIsiPerDus;

    if (onSelectResult) {
      onSelectResult(calcResult, resolvedIsi);
      onClose();
      return;
    }

    const currentTargetId = targetItem?.id || selectedItemId;
    if (!currentTargetId) {
      setSelectionError('Silakan pilih salah satu barang terlebih dahulu dari kolom pencarian.');
      return;
    }
    setSelectionError(null);

    setIsApplying(true);
    const success = await onApplyQuantity(
      currentTargetId,
      calcResult,
      `Dihitung via kalkulator: ${displayExp} = ${calcResult} pcs`,
      resolvedIsi
    );
    setIsApplying(false);

    if (success) {
      onClose();
    }
  };

  const selectedItemObj = targetItem || items.find((i) => i.id === selectedItemId);

  // Filter items for standalone selection
  const filteredPickItems = items.filter((item) => {
    if (!itemSearch.trim()) return true;
    const q = itemSearch.toLowerCase();
    return (
      item.namaBarang.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.barcode.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {selectionError && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
            <span>{selectionError}</span>
            <button
              type="button"
              onClick={() => setSelectionError(null)}
              className="text-amber-700 dark:text-amber-400 font-bold ml-2 hover:underline"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Standalone Item Picker (only shown when no item is preselected) */}
        {!selectedItemObj && (
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Cari barang yang ingin diterapkan hasilnya (SKU / Nama / Barcode)..."
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md px-2.5 py-1 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {itemSearch && (
              <div className="mt-2 max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800">
                {filteredPickItems.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setDisplayExp(String(item.quantity || '0'));
                      setCalcResult(item.quantity || 0);
                      if (item.isiPerDus && item.isiPerDus > 0) {
                        const cleanIsi = Math.max(1, Math.round(item.isiPerDus));
                        setItemsPerBox(cleanIsi);
                        setSavedIsiPerDus(cleanIsi);
                      } else {
                        setItemsPerBox('');
                        setSavedIsiPerDus(undefined);
                      }
                      setItemSearch('');
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.namaBarang}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                      {item.sku}{item.isiPerDus ? ` · ${item.isiPerDus}/dus` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode Selector & Compact Close Button */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center flex-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCalcMode('standard')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                calcMode === 'standard'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Hitung Aritmatika & Dus
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('grid')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                calcMode === 'grid'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Hitung Baris Rak & Display
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 ml-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            title="Tutup Kalkulator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Main Calculation Screen Display */}
          <div className="bg-slate-900 rounded-xl p-4 text-white font-mono shadow-inner border border-slate-800">
            <div className="text-right text-xs text-slate-400 min-h-[20px] overflow-x-auto whitespace-nowrap">
              {displayExp || '0'}
            </div>
            <div className="text-right text-3xl font-bold tracking-tight text-emerald-400 mt-1 flex items-baseline justify-end gap-2">
              <span>{calcResult}</span>
              <span className="text-sm font-sans font-normal text-slate-400">pcs</span>
            </div>
          </div>

          {calcMode === 'standard' ? (
            <div className="space-y-3.5">
              {/* Pengisian Isi Per Dus (Replaces Preset Kemasan Mart Cepat) */}
              <form
                onSubmit={handleAddBoxInput}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Pengisian Isi Per Dus
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedItemObj?.isiPerDus && selectedItemObj.isiPerDus > 0 && (
                      <span className="text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 px-1.5 py-0.5 rounded">
                        Tersimpan: {selectedItemObj.isiPerDus}/dus
                      </span>
                    )}
                    {boxSubtotal > 0 && (
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        = {boxSubtotal} pcs
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Jumlah Dus
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={boxCount}
                      onChange={(e) =>
                        setBoxCount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))
                      }
                      placeholder="1"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Isi Per Dus
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={itemsPerBox}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1);
                        setItemsPerBox(val);
                        if (typeof val === 'number' && val > 0) {
                          setSavedIsiPerDus(val);
                        }
                      }}
                      placeholder="Misal: 24"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="col-span-4">
                    <button
                      type="submit"
                      disabled={boxSubtotal <= 0}
                      className="w-full py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Calculator Keypad */}
              <div className="grid grid-cols-4 gap-2 font-mono text-sm">
                <button
                  type="button"
                  onClick={handleClear}
                  className="py-2.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg font-bold transition-colors"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('(')}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-colors"
                >
                  (
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick(')')}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-colors"
                >
                  )
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-colors"
                >
                  ⌫
                </button>

                <button
                  type="button"
                  onClick={() => handleNumClick('7')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('8')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('9')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => handleOperatorClick('÷')}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 rounded-lg font-bold transition-colors"
                >
                  ÷
                </button>

                <button
                  type="button"
                  onClick={() => handleNumClick('4')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('5')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('6')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => handleOperatorClick('×')}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 rounded-lg font-bold transition-colors"
                >
                  ×
                </button>

                <button
                  type="button"
                  onClick={() => handleNumClick('1')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('2')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('3')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => handleOperatorClick('-')}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 rounded-lg font-bold transition-colors"
                >
                  -
                </button>

                <button
                  type="button"
                  onClick={() => handleNumClick('0')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('00')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  00
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('.')}
                  className="py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={() => handleOperatorClick('+')}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 rounded-lg font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            /* Grid / Rak Display Counter */
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-lg text-xs text-blue-900 dark:text-blue-200">
                <p className="font-semibold">Formula Hitung Rak Mart:</p>
                <p className="text-[11px] mt-0.5">
                  Total = (Baris ke samping / Facing × Kedalaman/Tumpukan ke belakang) + Sisa Eceran
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Baris ke Samping (Facing)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={gridFacing}
                    onChange={(e) => setGridFacing(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-center text-sm font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kedalaman / Tumpukan
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={gridDepth}
                    onChange={(e) => setGridDepth(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-center text-sm font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sisa Tambahan / Eceran
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={gridExtra}
                    onChange={(e) => setGridExtra(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-center text-sm font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Visual Grid Representation */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Simulasi Susunan Rak:</p>
                <div className="inline-flex flex-wrap gap-1 max-w-xs justify-center p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  {Array.from({ length: Math.min(30, calcResult) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-700 rounded-xs flex items-center justify-center text-[10px] font-mono text-blue-800 dark:text-blue-200 font-bold"
                    >
                      {i + 1}
                    </div>
                  ))}
                  {calcResult > 30 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 self-center font-mono">+ {calcResult - 30} lainnya</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Hasil: <strong className="text-slate-900 dark:text-white text-sm">{calcResult} pcs</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={isApplying}
              onClick={handleApply}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              {isApplying
                ? 'Menerapkan...'
                : onSelectResult
                ? `Pilih ${calcResult} pcs`
                : selectedItemObj
                ? `Terapkan ${calcResult} pcs ke ${selectedItemObj.sku}`
                : `Gunakan Hasil (${calcResult} pcs)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
