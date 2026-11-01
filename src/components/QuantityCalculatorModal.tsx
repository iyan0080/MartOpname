import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator,
  Plus,
  Minus,
  Check,
  RotateCcw,
  Package,
  Layers,
  ArrowRight,
  Search,
  Sparkles,
} from 'lucide-react';
import { InventoryItem } from '../types/inventory.ts';

interface QuantityCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem?: InventoryItem | null;
  items?: InventoryItem[];
  onApplyQuantity: (itemId: string, quantity: number, notes?: string) => Promise<boolean>;
  onSelectResult?: (quantity: number) => void;
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
    } else {
      setSelectedItemId('');
      setDisplayExp('0');
      setCalcResult(0);
    }
  }, [targetItem, isOpen]);

  // Evaluate mathematical expression safely
  const evaluateExpression = (expr: string): number => {
    try {
      // Replace x with * and ÷ with /
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
      // Only allow digits, basic operators, spaces, parentheses, decimals
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

  // Recalculate grid
  useEffect(() => {
    const f = typeof gridFacing === 'number' ? gridFacing : 0;
    const d = typeof gridDepth === 'number' ? gridDepth : 0;
    const e = typeof gridExtra === 'number' ? gridExtra : 0;
    const total = f * d + e;
    setCalcResult(Math.max(0, total));
    setDisplayExp(`${f} × ${d} + ${e}`);
  }, [gridFacing, gridDepth, gridExtra]);

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

  // Quick Pack additions (Mart Presets)
  const addPackMultiplier = (packName: string, count: number) => {
    setDisplayExp((prev) => {
      if (prev === '0') {
        return `${count}`;
      }
      return `${prev} + ${count}`;
    });
    setCalcHistory((prev) => [`+ ${count} pcs (${packName})`, ...prev.slice(0, 4)]);
  };

  const handleApply = async () => {
    if (onSelectResult) {
      onSelectResult(calcResult);
      onClose();
      return;
    }

    const currentTargetId = targetItem?.id || selectedItemId;
    if (!currentTargetId) {
      setSelectionError('Silakan pilih salah satu barang terlebih dahulu dari daftar di atas.');
      return;
    }
    setSelectionError(null);

    setIsApplying(true);
    const targetObj = items.find((i) => i.id === currentTargetId) || targetItem;
    const success = await onApplyQuantity(
      currentTargetId,
      calcResult,
      `Dihitung via kalkulator: ${displayExp} = ${calcResult} pcs`
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Kalkulator Hitung Kuantitas Barang Mart
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hitung jumlah karton, dus, lusin, baris rak, atau pecahan eceran
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {selectionError && (
          <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
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

        {/* Selected Target Item Card */}
        {selectedItemObj ? (
          <div className="px-5 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/60 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold bg-blue-200/70 dark:bg-blue-900 text-blue-900 dark:text-blue-200 px-1.5 py-0.2 rounded">
                  {selectedItemObj.sku}
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{selectedItemObj.namaBarang}</p>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Stok saat ini: <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedItemObj.quantity} pcs</strong> · Sistem:{' '}
                <span className="font-mono">{selectedItemObj.quantitySystem} pcs</span>
              </p>
            </div>
            {!targetItem && (
              <button
                type="button"
                onClick={() => setSelectedItemId('')}
                className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline shrink-0 ml-2"
              >
                Ganti Barang
              </button>
            )}
          </div>
        ) : (
          /* Pick Item if standalone */
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
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
                      setItemSearch('');
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.namaBarang}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0 ml-2">{item.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setCalcMode('standard')}
            className={`py-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
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
            className={`py-2 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              calcMode === 'grid'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Hitung Baris Rak & Display
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
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
            <div className="space-y-4">
              {/* Mart Packaging Presets (Karton, Lusin, Pack) */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Preset Kemasan Mart Cepat:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => addPackMultiplier('1 Dus/Karton 24', 24)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-left transition-colors"
                  >
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">+1 Dus (24)</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">+24 pcs</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => addPackMultiplier('1 Dus 48', 48)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-left transition-colors"
                  >
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">+1 Dus (48)</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">+48 pcs</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => addPackMultiplier('1 Lusin', 12)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-left transition-colors"
                  >
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">+1 Lusin</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">+12 pcs</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => addPackMultiplier('1 Pack 6', 6)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-left transition-colors"
                  >
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">+1 Pack (6)</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">+6 pcs</p>
                  </button>
                </div>
              </div>

              {/* Multiplier Tool (Contoh: 3 Dus x 24 pcs) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Beli Grosir:</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Jumlah dus"
                  id="calc-box-count"
                  className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-center"
                  defaultValue={2}
                />
                <span className="text-slate-500 dark:text-slate-400 font-mono">dus ×</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Isi/dus"
                  id="calc-box-size"
                  className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-center"
                  defaultValue={24}
                />
                <span className="text-slate-500 dark:text-slate-400 font-mono">pcs</span>
                <button
                  type="button"
                  onClick={() => {
                    const count = parseInt((document.getElementById('calc-box-count') as HTMLInputElement)?.value, 10) || 0;
                    const size = parseInt((document.getElementById('calc-box-size') as HTMLInputElement)?.value, 10) || 0;
                    if (count > 0 && size > 0) {
                      addPackMultiplier(`${count} Dus × ${size}`, count * size);
                    }
                  }}
                  className="px-2.5 py-1 bg-slate-800 dark:bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-700 text-white rounded font-medium ml-auto transition-colors"
                >
                  Tambahkan
                </button>
              </div>

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
