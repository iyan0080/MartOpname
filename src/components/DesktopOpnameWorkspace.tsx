import React, { useState, useEffect, useMemo } from 'react';
import {
  Barcode,
  QrCode,
  Camera,
  Search,
  Calculator,
  Plus,
  Minus,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Edit2,
  SlidersHorizontal,
  Info,
  Package,
  Upload,
} from 'lucide-react';
import { InventoryItem, InventoryStats } from '../types/inventory.ts';
import { formatRupiah, formatShortTime } from '../utils/excelUtils.ts';
import { DesktopInventoryRow } from './InventoryRows.tsx';

interface DuplicateAnalysisSummary {
  duplicateSkus: Map<string, InventoryItem[]>;
  duplicateBarcodes: Map<string, InventoryItem[]>;
  duplicateItemIds: Set<string>;
  hasDuplicates: boolean;
  totalDuplicateSkus: number;
  totalDuplicateBarcodes: number;
  totalAffectedItems: number;
}

interface DesktopOpnameWorkspaceProps {
  items: InventoryItem[];
  filteredItems: InventoryItem[];
  visibleItems: InventoryItem[];
  hasMoreVisibleItems: boolean;
  onLoadMore: () => void;
  onShowAll: () => void;
  loadMoreSentinelRef: React.RefObject<HTMLDivElement | null>;
  filteredTotalModal: number;
  stats: InventoryStats | null;
  isLoading: boolean;
  activeUser: string;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchQueryChange: (val: string) => void;
  onBarcodeSearchSubmit: (e: React.FormEvent) => void;
  selectedCategory: string;
  onSelectCategory: (val: string) => void;
  availableCategories: string[];
  categoryCounts: Record<string, number>;
  discrepancyFilter: 'ALL' | 'MATCH' | 'MINUS' | 'PLUS' | 'UNCOUNTED' | 'DUPLICATE';
  onChangeDiscrepancyFilter: (val: 'ALL' | 'MATCH' | 'MINUS' | 'PLUS' | 'UNCOUNTED' | 'DUPLICATE') => void;
  sortBy: 'nama' | 'sku' | 'qty' | 'modal' | 'totalModal' | 'selisih';
  sortOrder: 'asc' | 'desc';
  onChangeSort: (field: 'nama' | 'sku' | 'qty' | 'modal' | 'totalModal' | 'selisih', order: 'asc' | 'desc') => void;
  duplicateAnalysis: DuplicateAnalysisSummary;
  onOpenScanner: () => void;
  onOpenImportExport: () => void;
  onOpenDuplicateModal: () => void;
  onSaveCountingAdjust: (itemId: string, newQuantity: number, notes?: string) => Promise<boolean>;
  onQuickDelta: (itemId: string, delta: number) => void;
  onQuickAdjust: (item: InventoryItem) => void;
  onOpenCalc: (item: InventoryItem) => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
  activeCountingItemId: string | null;
  onSelectCountingItem: (itemId: string | null) => void;
}

function getDefaultIsiPerBox(item: InventoryItem | null): number {
  if (!item) return 24;
  const nameLower = (item.namaBarang || '').toLowerCase();
  if (nameLower.includes('mie') || nameLower.includes('indomie') || nameLower.includes('sedap')) {
    return 40;
  }
  if (nameLower.includes('minyak') || nameLower.includes('bimoli') || nameLower.includes('sanco')) {
    return 12;
  }
  if (nameLower.includes('susu') || nameLower.includes('kental')) {
    return 48;
  }
  return 24;
}

export const DesktopOpnameWorkspace: React.FC<DesktopOpnameWorkspaceProps> = ({
  items,
  filteredItems,
  visibleItems,
  hasMoreVisibleItems,
  onLoadMore,
  onShowAll,
  loadMoreSentinelRef,
  filteredTotalModal,
  stats,
  isLoading,
  activeUser,
  searchQuery,
  searchInputRef,
  onSearchQueryChange,
  onBarcodeSearchSubmit,
  selectedCategory,
  onSelectCategory,
  availableCategories,
  categoryCounts,
  discrepancyFilter,
  onChangeDiscrepancyFilter,
  sortBy,
  sortOrder,
  onChangeSort,
  duplicateAnalysis,
  onOpenScanner,
  onOpenImportExport,
  onOpenDuplicateModal,
  onSaveCountingAdjust,
  onQuickDelta,
  onQuickAdjust,
  onOpenCalc,
  onEditItem,
  onDeleteItem,
  activeCountingItemId,
  onSelectCountingItem,
}) => {
  // Active item shown in the Left Dossier & Physical Box Calculator
  const activeItem = useMemo(() => {
    if (items.length === 0) return null;
    if (activeCountingItemId) {
      const explicit = items.find((i) => i.id === activeCountingItemId);
      if (explicit) return explicit;
    }
    const firstUncounted = filteredItems.find((i) => (i.quantity || 0) === 0);
    if (firstUncounted) return firstUncounted;
    if (filteredItems.length > 0) return filteredItems[0];
    return items[0];
  }, [items, filteredItems, activeCountingItemId]);

  const [jmlBox, setJmlBox] = useState<number>(0);
  const [isiPerBox, setIsiPerBox] = useState<number>(24);
  const [ecerLepas, setEcerLepas] = useState<number>(0);
  const [isSavingActive, setIsSavingActive] = useState(false);

  // Sync box & loose pcs when activeItem changes
  useEffect(() => {
    if (activeItem) {
      setJmlBox(0);
      setIsiPerBox(getDefaultIsiPerBox(activeItem));
      setEcerLepas(Math.max(0, activeItem.quantity || 0));
    } else {
      setJmlBox(0);
      setIsiPerBox(24);
      setEcerLepas(0);
    }
  }, [activeItem?.id]);

  // Keep loose eceran synced if user tapped +1 / -1 directly on the active item's row
  useEffect(() => {
    if (activeItem && jmlBox === 0) {
      setEcerLepas(Math.max(0, activeItem.quantity || 0));
    }
  }, [activeItem?.quantity]);

  const safeBox = Math.max(0, jmlBox);
  const safeIsi = Math.max(1, isiPerBox);
  const safeEcer = Math.max(0, ecerLepas);
  const totalCalculated = safeBox * safeIsi + safeEcer;
  const activeSystemQty = activeItem?.quantitySystem || 0;
  const activeDiff = totalCalculated - activeSystemQty;
  const activeSatuan = activeItem?.satuan || 'pcs';

  const handleSaveAndNext = async () => {
    if (!activeItem || isSavingActive) return;
    setIsSavingActive(true);
    const note =
      safeBox > 0
        ? `Hitung Box & Eceran: (${safeBox} × ${safeIsi}) + ${safeEcer} = ${totalCalculated} ${activeSatuan}`
        : `Hitung Fisik Station: ${totalCalculated} ${activeSatuan}`;

    const ok = await onSaveCountingAdjust(activeItem.id, totalCalculated, note);
    setIsSavingActive(false);

    if (ok) {
      const pool = filteredItems.length > 0 ? filteredItems : items;
      const currentIdx = pool.findIndex((i) => i.id === activeItem.id);
      if (pool.length > 1) {
        const nextItem = pool[(currentIdx + 1) % pool.length];
        if (nextItem) {
          onSelectCountingItem(nextItem.id);
        }
      }
    }
  };

  const selectItemIntoStation = (item: InventoryItem) => {
    onSelectCountingItem(item.id);
    setJmlBox(0);
    setIsiPerBox(getDefaultIsiPerBox(item));
    setEcerLepas(Math.max(0, item.quantity || 0));
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:overflow-hidden">
      {/* LEFT COLUMN: Active Counting Dossier & Touch Box/Unit Calculator (5 Cols on Landscape Tablet/PC) */}
      <div className="lg:col-span-5 flex flex-col gap-2.5 lg:min-h-0 lg:overflow-y-auto pr-0.5">
        {/* 1. Touch-Ready Barcode & QR Universal Search */}
        <div className="shrink-0 bg-white dark:bg-slate-900 p-3 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-800 shadow-xs">
          <form onSubmit={onBarcodeSearchSubmit} className="relative flex items-center">
            <div className="absolute left-3 flex items-center gap-1 pointer-events-none">
              <Barcode className="w-4 h-4 text-[#004ac6] dark:text-blue-400" />
              <QrCode className="w-3.5 h-3.5 text-[#006398] dark:text-sky-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Scan barcode / QR Code atau ketik SKU / Nama Produk..."
              className="w-full pl-14 pr-36 py-2.5 bg-[#f2f3ff] dark:bg-slate-800 rounded-lg font-mono text-xs text-[#131b2e] dark:text-slate-100 placeholder:text-[#737686] dark:placeholder:text-slate-500 border border-[#c3c6d7]/40 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004ac6] dark:focus:ring-blue-500 transition-all"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  className="w-7 h-7 rounded-md text-[#737686] hover:text-[#131b2e] dark:hover:text-white flex items-center justify-center text-sm font-bold"
                  title="Bersihkan pencarian"
                >
                  ×
                </button>
              )}
              <button
                type="submit"
                className="h-8 px-2.5 bg-[#004ac6] hover:bg-[#003ea8] dark:bg-blue-600 dark:hover:bg-blue-700 active:scale-95 text-white rounded-md flex items-center gap-1 text-[11px] font-bold transition-all"
                title="Cari / Muat SKU"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
              <button
                type="button"
                onClick={onOpenScanner}
                className="h-8 px-2.5 bg-[#eaedff] dark:bg-slate-700 hover:bg-[#dae2fd] dark:hover:bg-slate-600 active:scale-95 text-[#131b2e] dark:text-white rounded-md flex items-center gap-1 text-[11px] font-bold transition-all"
                title="Nyalakan Kamera Scanner Barcode & QR"
              >
                <Camera className="w-3.5 h-3.5 text-[#004ac6] dark:text-blue-400" />
                <span className="hidden xl:inline">Kamera</span>
              </button>
            </div>
          </form>

          <div className="mt-2 flex items-center justify-between px-0.5 text-[10px] font-mono">
            <div className="flex items-center gap-1.5 text-[#434655] dark:text-slate-400">
              <span className="inline-block w-2 h-2 rounded-full bg-[#007d57] dark:bg-emerald-400 animate-pulse" />
              <span>Scanner Ready · Buffer Aktif</span>
            </div>
            <span className="text-[#737686] dark:text-slate-500">Tekan F2 atau Scan Handheld</span>
          </div>
        </div>

        {/* 2. Active Product Dossier Card */}
        <div className="shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-800 shadow-xs overflow-hidden">
          {!activeItem ? (
            <div className="p-6 text-center text-xs text-[#434655] dark:text-slate-400 space-y-2">
              <Package className="w-7 h-7 mx-auto text-[#737686] dark:text-slate-500" />
              <p className="font-semibold text-[#131b2e] dark:text-white">
                {isLoading ? 'Memuat katalog inventaris...' : 'Belum ada barang dipilih'}
              </p>
              <p>Scan barcode, cari SKU, atau pilih salah satu barang pada tabel di sebelah kanan.</p>
            </div>
          ) : (
            <>
              {/* Header Banner */}
              <div className="bg-[#e2e7ff] dark:bg-slate-800/90 px-3.5 py-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-[#004ac6] dark:bg-blue-600 text-white font-mono text-[11px] font-bold shrink-0">
                    {activeItem.sku}
                  </span>
                  <span className="font-mono text-[11px] text-[#434655] dark:text-slate-300 truncate">
                    Barcode: {activeItem.barcode || '-'}
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase bg-[#dae2fd] dark:bg-slate-700 px-2 py-0.5 rounded text-[#004ac6] dark:text-blue-300 shrink-0">
                  {activeItem.kategori || 'Umum'}
                </span>
              </div>

              {/* Dossier Details */}
              <div className="p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-[#131b2e] dark:text-white leading-snug">
                      {activeItem.namaBarang}
                    </h2>
                    <div className="flex items-center gap-2 text-[11px] text-[#434655] dark:text-slate-400 mt-1 flex-wrap font-mono">
                      <span>Modal: <strong className="text-[#131b2e] dark:text-slate-200">{formatRupiah(activeItem.hargaModal)}</strong></span>
                      {activeItem.hargaJual ? (
                        <>
                          <span>·</span>
                          <span>Jual: <strong className="text-[#006243] dark:text-emerald-400">{formatRupiah(activeItem.hargaJual)}</strong></span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Stok Sistem ERP Callout */}
                  <div className="bg-[#f2f3ff] dark:bg-slate-800 px-3 py-1.5 rounded-lg text-right shrink-0">
                    <span className="text-[10px] font-semibold text-[#434655] dark:text-slate-400 uppercase block">
                      Stok Sistem
                    </span>
                    <span className="font-mono font-extrabold text-base text-[#131b2e] dark:text-white tabular-nums">
                      {activeSystemQty}{' '}
                      <span className="text-[10px] font-normal text-[#737686] dark:text-slate-400 uppercase">
                        {activeSatuan}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Ledger Note & Quick Item Shortcuts */}
                <div className="bg-[#f2f3ff]/80 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-[11px] text-[#434655] dark:text-slate-400">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Info className="w-3.5 h-3.5 text-[#006398] dark:text-sky-400 shrink-0" />
                    <span className="truncate">
                      {activeItem.keterangan ? `${activeItem.keterangan} · ` : ''}
                      Update: {activeItem.lastUpdatedBy || '-'} ({formatShortTime(activeItem.updatedAt)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditItem(activeItem)}
                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 hover:bg-[#eaedff] dark:hover:bg-slate-600 text-[#004ac6] dark:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                      title="Edit Detail Barang"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenCalc(activeItem)}
                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 hover:bg-[#eaedff] dark:hover:bg-slate-600 text-[#434655] dark:text-slate-200 font-semibold flex items-center gap-1 transition-colors"
                      title="Buka Modal Kalkulator Lengkap"
                    >
                      <Calculator className="w-3 h-3" />
                      <span>Modal</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 3. Touch Calculator: Box Dus & Eceran Rak */}
        <div className="shrink-0 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-800 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-[#004ac6] dark:text-blue-400" />
              <h3 className="text-xs font-bold text-[#131b2e] dark:text-white">
                Kalkulator Fisik: Box Dus &amp; Eceran Rak
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-[#737686] dark:text-slate-400 uppercase">
              Pengisian Isi Per Dus
            </span>
          </div>

          {activeItem ? (
            <>
              {/* 3 Ergonomic Stepper Columns (No preset kemasan chips) */}
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Dus / Karton */}
                <div className="bg-[#f2f3ff] dark:bg-slate-800/80 p-2 rounded-xl flex flex-col gap-1.5">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-[#131b2e] dark:text-slate-200 uppercase block">
                      1. Dus / Box
                    </span>
                    <span className="text-[10px] text-[#737686] dark:text-slate-400 block">Box Utuh</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setJmlBox((v) => Math.max(0, v - 1))}
                      className="w-8 h-10 bg-[#dae2fd] dark:bg-slate-700 hover:bg-[#d2d9f4] dark:hover:bg-slate-600 active:scale-90 text-[#131b2e] dark:text-white rounded-lg flex items-center justify-center transition-transform shrink-0"
                      aria-label="Kurangi jumlah dus"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={jmlBox}
                      onChange={(e) => setJmlBox(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full min-w-0 text-center bg-white dark:bg-slate-900 py-2 rounded-lg font-mono font-extrabold text-sm text-[#131b2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#004ac6] tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setJmlBox((v) => v + 1)}
                      className="w-8 h-10 bg-[#dae2fd] dark:bg-slate-700 hover:bg-[#d2d9f4] dark:hover:bg-slate-600 active:scale-90 text-[#004ac6] dark:text-blue-400 rounded-lg flex items-center justify-center transition-transform shrink-0"
                      aria-label="Tambah jumlah dus"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Isi per Box */}
                <div className="bg-[#f2f3ff] dark:bg-slate-800/80 p-2 rounded-xl flex flex-col gap-1.5">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-[#131b2e] dark:text-slate-200 uppercase block">
                      2. Isi / Box
                    </span>
                    <span className="text-[10px] text-[#737686] dark:text-slate-400 block">Pcs per Dus</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setIsiPerBox((v) => Math.max(1, v - 1))}
                      className="w-8 h-10 bg-[#dae2fd] dark:bg-slate-700 hover:bg-[#d2d9f4] dark:hover:bg-slate-600 active:scale-90 text-[#131b2e] dark:text-white rounded-lg flex items-center justify-center transition-transform shrink-0"
                      aria-label="Kurangi isi per box"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={isiPerBox}
                      onChange={(e) => setIsiPerBox(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full min-w-0 text-center bg-white dark:bg-slate-900 py-2 rounded-lg font-mono font-extrabold text-sm text-[#131b2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#004ac6] tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setIsiPerBox((v) => v + 1)}
                      className="w-8 h-10 bg-[#dae2fd] dark:bg-slate-700 hover:bg-[#d2d9f4] dark:hover:bg-slate-600 active:scale-90 text-[#004ac6] dark:text-blue-400 rounded-lg flex items-center justify-center transition-transform shrink-0"
                      aria-label="Tambah isi per box"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 3. Ecer Lepas */}
                <div className="bg-[#f2f3ff] dark:bg-slate-800/80 p-2 rounded-xl flex flex-col gap-1.5">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-[#131b2e] dark:text-slate-200 uppercase block">
                      3. Ecer Lepas
                    </span>
                    <span className="text-[10px] text-[#737686] dark:text-slate-400 block">Pcs Display</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => setEcerLepas((v) => Math.max(0, v - 1))}
                      className="w-8 h-10 bg-[#dae2fd] dark:bg-slate-700 hover:bg-[#d2d9f4] dark:hover:bg-slate-600 active:scale-90 text-[#131b2e] dark:text-white rounded-lg flex items-center justify-center transition-transform shrink-0"
                      aria-label="Kurangi eceran"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={ecerLepas}
                      onChange={(e) => setEcerLepas(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full min-w-0 text-center bg-white dark:bg-slate-900 py-2 rounded-lg font-mono font-extrabold text-sm text-[#131b2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#004ac6] tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setEcerLepas((v) => v + 1)}
                      className="w-8 h-10 bg-[#dae2fd] dark:bg-slate-700 hover:bg-[#d2d9f4] dark:hover:bg-slate-600 active:scale-90 text-[#004ac6] dark:text-blue-400 rounded-lg flex items-center justify-center transition-transform shrink-0"
                      aria-label="Tambah eceran"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Formula Result & Variance Preview */}
              <div className="flex items-center justify-between gap-2 bg-[#eaedff] dark:bg-slate-800 px-3 py-2 rounded-lg">
                <div className="text-xs">
                  <span className="font-mono text-[#434655] dark:text-slate-400">
                    ({safeBox} × {safeIsi}) + {safeEcer} ={' '}
                  </span>
                  <span className="font-mono font-extrabold text-sm text-[#004ac6] dark:text-blue-400 tabular-nums">
                    {totalCalculated} {activeSatuan}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                    activeDiff === 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-[#006243] dark:text-emerald-300'
                      : activeDiff < 0
                      ? 'bg-[#ffdad6] dark:bg-rose-950/70 text-[#ba1a1a] dark:text-rose-300'
                      : 'bg-[#dbe1ff] dark:bg-blue-950/70 text-[#003ea8] dark:text-blue-300'
                  }`}
                >
                  {activeDiff === 0
                    ? 'Cocok Sistem ✓'
                    : activeDiff < 0
                    ? `Defisit: ${activeDiff} ${activeSatuan}`
                    : `Surplus: +${activeDiff} ${activeSatuan}`}
                </span>
              </div>

              {/* Save & Next CTA */}
              <button
                type="button"
                disabled={isSavingActive}
                onClick={handleSaveAndNext}
                className="w-full h-10 bg-[#004ac6] hover:bg-[#003ea8] dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all"
              >
                {isSavingActive ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan &amp; Lanjut Item Berikutnya</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="py-4 text-center text-xs text-[#737686] dark:text-slate-400">
              Tambahkan atau import data barang terlebih dahulu untuk menggunakan kalkulator station.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Full Filterable Inventory Table & Duplicate Alert (7 Cols on Landscape Tablet/PC) */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-800 shadow-xs flex flex-col min-h-[420px] lg:min-h-0 lg:h-full overflow-hidden">
        {/* Filter & Duplicate Warning Header */}
        <div className="shrink-0 p-3 border-b border-[#eaedff] dark:border-slate-800 bg-[#f2f3ff]/60 dark:bg-slate-800/50 flex flex-col gap-2">
          {duplicateAnalysis.hasDuplicates && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200 truncate">
                  Data Ganda: {duplicateAnalysis.totalDuplicateSkus} SKU, {duplicateAnalysis.totalDuplicateBarcodes} Barcode ({duplicateAnalysis.totalAffectedItems} item)
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onChangeDiscrepancyFilter(discrepancyFilter === 'DUPLICATE' ? 'ALL' : 'DUPLICATE')
                  }
                  className={`px-2 py-1 text-[11px] font-semibold rounded border transition-colors ${
                    discrepancyFilter === 'DUPLICATE'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  }`}
                >
                  {discrepancyFilter === 'DUPLICATE' ? 'Semua' : 'Filter Ganda'}
                </button>
                <button
                  type="button"
                  onClick={onOpenDuplicateModal}
                  className="px-2 py-1 text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded flex items-center gap-1 transition-colors"
                >
                  <span>Rincian</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <select
                value={selectedCategory}
                onChange={(e) => onSelectCategory(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-[#c3c6d7]/60 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004ac6] font-medium"
              >
                <option value="ALL">Semua Kategori ({items.length})</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c} ({categoryCounts[c] || 0})
                  </option>
                ))}
              </select>

              <select
                value={discrepancyFilter}
                onChange={(e) => onChangeDiscrepancyFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-[#c3c6d7]/60 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              >
                <option value="ALL">Semua Status Selisih</option>
                {duplicateAnalysis.hasDuplicates && (
                  <option value="DUPLICATE">
                    ⚠️ SKU / Barcode Ganda ({duplicateAnalysis.totalAffectedItems})
                  </option>
                )}
                <option value="MATCH">Cocok ({stats?.matchCount || 0})</option>
                <option value="MINUS">Minus ({stats?.minusCount || 0})</option>
                <option value="PLUS">Lebih ({stats?.plusCount || 0})</option>
                <option value="UNCOUNTED">Belum Dihitung ({stats?.uncountedItemsCount || 0})</option>
              </select>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  onChangeSort(field as any, order as any);
                }}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-[#c3c6d7]/60 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
              >
                <option value="totalModal-desc">Total Modal Terbesar</option>
                <option value="totalModal-asc">Total Modal Terkecil</option>
                <option value="nama-asc">Nama A-Z</option>
                <option value="sku-asc">SKU A-Z</option>
                <option value="qty-desc">Stok Fisik Terbanyak</option>
                <option value="selisih-asc">Selisih Terbesar (Minus)</option>
              </select>
            </div>

            {(selectedCategory !== 'ALL' || discrepancyFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('ALL');
                  onChangeDiscrepancyFilter('ALL');
                  onSearchQueryChange('');
                }}
                className="text-[11px] font-bold text-[#004ac6] dark:text-blue-400 hover:underline px-1.5"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Inventory Table */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 z-10 bg-[#eaedff]/95 dark:bg-slate-800/95 backdrop-blur-xs text-[#131b2e] dark:text-slate-200 font-semibold border-b border-[#c3c6d7]/50 dark:border-slate-700 shadow-2xs">
              <tr>
                <th className="px-3.5 py-2.5">SKU &amp; BARCODE</th>
                <th className="px-3.5 py-2.5 min-w-[180px]">NAMA BARANG</th>
                <th className="px-3.5 py-2.5">KATEGORI</th>
                <th className="px-3.5 py-2.5 text-center">STOK FISIK</th>
                <th className="px-3.5 py-2.5 text-right">SISTEM</th>
                <th className="px-3.5 py-2.5 text-right">SELISIH</th>
                <th className="px-3.5 py-2.5 text-right">HARGA MODAL</th>
                <th className="px-3.5 py-2.5 text-right">TOTAL MODAL</th>
                <th className="px-3.5 py-2.5">PETUGAS</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#eaedff] dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#737686] dark:text-slate-500">
                    Memuat data inventaris stok opname...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#434655] dark:text-slate-400">
                    <div className="space-y-3">
                      <p>Tidak ada barang yang cocok dengan filter atau pencarian.</p>
                      {activeUser === 'IYAN' && (
                        <button
                          type="button"
                          onClick={onOpenImportExport}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#006243] dark:text-emerald-300 bg-[#85f8c4]/30 dark:bg-emerald-950/60 hover:bg-[#85f8c4]/50 border border-[#006243]/30 rounded-lg transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Import Data dari File XLSX</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <DesktopInventoryRow
                    key={item.id}
                    item={item}
                    isSelected={activeItem?.id === item.id}
                    isDuplicateSku={duplicateAnalysis.duplicateSkus.has((item.sku || '').trim().toUpperCase())}
                    isDuplicateBarcode={Boolean(item.barcode && duplicateAnalysis.duplicateBarcodes.has(item.barcode.trim()))}
                    onSelectRow={selectItemIntoStation}
                    onQuickDelta={onQuickDelta}
                    onQuickAdjust={onQuickAdjust}
                    onOpenCalc={onOpenCalc}
                    onEditItem={onEditItem}
                    onDeleteItem={onDeleteItem}
                    onOpenDuplicate={onOpenDuplicateModal}
                  />
                ))
              )}
            </tbody>
          </table>

          {hasMoreVisibleItems && (
            <div
              ref={loadMoreSentinelRef}
              className="p-3 flex items-center justify-center gap-2 border-t border-[#eaedff] dark:border-slate-800 bg-[#f2f3ff]/70 dark:bg-slate-800/40"
            >
              <button
                type="button"
                onClick={onLoadMore}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#003ea8] dark:text-blue-300 bg-[#dbe1ff] dark:bg-blue-950/60 hover:bg-[#b4c5ff]/50 border border-[#004ac6]/20 rounded-lg active:scale-95 transition-transform"
              >
                Muat +120 Barang Lainnya ({filteredItems.length - visibleItems.length} tersisa)
              </button>
              <button
                type="button"
                onClick={onShowAll}
                className="px-3 py-1.5 text-xs font-medium text-[#434655] dark:text-slate-300 bg-white dark:bg-slate-800 border border-[#c3c6d7]/60 dark:border-slate-700 rounded-lg active:scale-95 transition-transform"
              >
                Tampilkan Semua ({filteredItems.length})
              </button>
            </div>
          )}
        </div>

        {/* Sticky Footer Summary */}
        <div className="shrink-0 px-3 py-2 bg-[#f2f3ff] dark:bg-slate-800/90 border-t border-[#c3c6d7]/40 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-[#434655] dark:text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan <strong className="text-[#131b2e] dark:text-white">{visibleItems.length}</strong>
              {hasMoreVisibleItems ? ` dari ${filteredItems.length}` : ''} barang ({items.length} total)
            </span>
            <span>·</span>
            <span>
              Petugas: <strong className="text-[#131b2e] dark:text-slate-100">{activeUser}</strong>
            </span>
          </div>
          <div className="font-mono">
            <span>
              Total Modal Filter:{' '}
              <strong className="text-[#006243] dark:text-emerald-400">
                {formatRupiah(filteredTotalModal)}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
