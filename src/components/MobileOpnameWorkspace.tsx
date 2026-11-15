import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  QrCode,
  Search,
  Camera,
  PieChart,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Plus,
  Minus,
  CheckCircle2,
  Calculator,
  Upload,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Package,
  RefreshCw,
} from 'lucide-react';
import { InventoryItem, InventoryStats } from '../types/inventory.ts';
import { formatRupiah, formatCompactRupiah } from '../utils/excelUtils.ts';
import { MobileInventoryCard } from './InventoryRows.tsx';

interface DuplicateAnalysisSummary {
  duplicateSkus: Map<string, InventoryItem[]>;
  duplicateBarcodes: Map<string, InventoryItem[]>;
  duplicateItemIds: Set<string>;
  hasDuplicates: boolean;
  totalDuplicateSkus: number;
  totalDuplicateBarcodes: number;
  totalAffectedItems: number;
}

interface MobileOpnameWorkspaceProps {
  items: InventoryItem[];
  filteredItems: InventoryItem[];
  visibleItems: InventoryItem[];
  hasMoreVisibleItems: boolean;
  onLoadMore: () => void;
  onShowAll: () => void;
  stats: InventoryStats | null;
  isLoading: boolean;
  activeUser: string;
  searchQuery: string;
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
  onOpenAddItem: () => void;
  onOpenImportExport: () => void;
  onOpenDuplicateModal: () => void;
  onSelectTab: (tab: 'opname' | 'laporan' | 'kategori') => void;
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

export const MobileOpnameWorkspace: React.FC<MobileOpnameWorkspaceProps> = ({
  items,
  filteredItems,
  visibleItems,
  hasMoreVisibleItems,
  onLoadMore,
  onShowAll,
  stats,
  isLoading,
  activeUser,
  searchQuery,
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
  onOpenAddItem,
  onOpenImportExport,
  onOpenDuplicateModal,
  onSelectTab,
  onSaveCountingAdjust,
  onQuickDelta,
  onQuickAdjust,
  onOpenCalc,
  onEditItem,
  onDeleteItem,
  activeCountingItemId,
  onSelectCountingItem,
}) => {
  const countingCardRef = useRef<HTMLElement | null>(null);

  // Pick active counting item (explicitly selected -> first triage item -> first filtered item -> first item)
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

  // Triage list: items with discrepancy between quantity and quantitySystem
  const triageItems = useMemo(() => {
    return items
      .filter((i) => (i.quantity || 0) !== (i.quantitySystem || 0))
      .sort((a, b) => {
        const lossA = Math.abs(((a.quantity || 0) - (a.quantitySystem || 0)) * (a.hargaModal || 0));
        const lossB = Math.abs(((b.quantity || 0) - (b.quantitySystem || 0)) * (b.hargaModal || 0));
        return lossB - lossA;
      });
  }, [items]);

  const [showAllTriage, setShowAllTriage] = useState(false);

  // Active counting calculator state (Jml Box, Isi/Box, Ecer Lepas — NO preset chips)
  const [jmlBox, setJmlBox] = useState<number>(0);
  const [isiPerBox, setIsiPerBox] = useState<number>(24);
  const [ecerLepas, setEcerLepas] = useState<number>(0);
  const [isSavingActive, setIsSavingActive] = useState(false);

  // Sync box/ecer inputs when activeItem changes
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

  // Keep loose eceran synced if user tapped +1 / -1 directly on a mobile card
  useEffect(() => {
    if (activeItem && jmlBox === 0) {
      setEcerLepas(Math.max(0, activeItem.quantity || 0));
    }
  }, [activeItem?.quantity]);

  // KPI derived values
  const totalItemsCount = stats?.totalItems ?? items.length;
  const countedItemsCount = stats?.countedItemsCount ?? 0;
  const progressPct = totalItemsCount > 0 ? Math.min(100, (countedItemsCount / totalItemsCount) * 100) : 0;
  const minusCount = stats?.minusCount ?? 0;
  const plusCount = stats?.plusCount ?? 0;
  const discrepancyCount = minusCount + plusCount;
  const selisihModal = stats?.selisihModal ?? 0;

  // Live formula calculation
  const safeBox = Math.max(0, jmlBox);
  const safeIsi = Math.max(1, isiPerBox);
  const safeEcer = Math.max(0, ecerLepas);
  const totalCalculated = safeBox * safeIsi + safeEcer;
  const activeSystemQty = activeItem?.quantitySystem || 0;
  const activeDiff = totalCalculated - activeSystemQty;
  const activeSatuan = activeItem?.satuan || 'pcs';

  const handleFocusCountingCard = (item: InventoryItem) => {
    onSelectCountingItem(item.id);
    setJmlBox(0);
    setIsiPerBox(getDefaultIsiPerBox(item));
    setEcerLepas(Math.max(0, item.quantity || 0));
    if (countingCardRef.current) {
      countingCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSaveAndNext = async () => {
    if (!activeItem || isSavingActive) return;
    setIsSavingActive(true);
    const note =
      safeBox > 0
        ? `Hitung Box & Eceran: (${safeBox} × ${safeIsi}) + ${safeEcer} = ${totalCalculated} ${activeSatuan}`
        : `Hitung Fisik Mobile: ${totalCalculated} ${activeSatuan}`;

    const ok = await onSaveCountingAdjust(activeItem.id, totalCalculated, note);
    setIsSavingActive(false);

    if (ok) {
      // Advance to the next item in filteredItems or items
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

  const displayedTriage = showAllTriage ? triageItems : triageItems.slice(0, 4);

  return (
    <div className="flex flex-col w-full space-y-3 pb-4">
      {/* 1. KPI Compact Card Grid */}
      <section className="grid grid-cols-3 gap-1.5 pt-1">
        {/* Card 1: Progres SKU */}
        <button
          type="button"
          onClick={() => onChangeDiscrepancyFilter(discrepancyFilter === 'UNCOUNTED' ? 'ALL' : 'UNCOUNTED')}
          className={`text-left bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-sm border transition-all active:scale-95 flex flex-col justify-between ${
            discrepancyFilter === 'UNCOUNTED'
              ? 'border-[#004ac6] ring-2 ring-[#004ac6]/20 dark:border-blue-500'
              : 'border-[#c3c6d7]/30 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[#434655] dark:text-slate-400">
            <span className="text-[10px] font-semibold tracking-wide">Progres SKU</span>
            <PieChart className="w-3.5 h-3.5 text-[#004ac6] dark:text-blue-400 shrink-0" />
          </div>
          <div className="mt-1">
            <div className="font-mono font-extrabold text-[15px] leading-tight text-[#004ac6] dark:text-blue-400 tabular-nums">
              {progressPct.toFixed(1)}%
            </div>
            <div className="text-[10px] font-semibold text-[#434655] dark:text-slate-400 font-mono tabular-nums truncate">
              {countedItemsCount.toLocaleString('id-ID')} / {totalItemsCount.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="w-full bg-[#eaedff] dark:bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-[#004ac6] dark:bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </button>

        {/* Card 2: Selisih SKU */}
        <button
          type="button"
          onClick={() => onChangeDiscrepancyFilter(discrepancyFilter === 'MINUS' ? 'ALL' : 'MINUS')}
          className={`text-left bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-sm border transition-all active:scale-95 flex flex-col justify-between ${
            discrepancyFilter === 'MINUS'
              ? 'border-[#ba1a1a] ring-2 ring-[#ba1a1a]/20 dark:border-rose-500'
              : 'border-[#c3c6d7]/30 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[#434655] dark:text-slate-400">
            <span className="text-[10px] font-semibold tracking-wide">Selisih SKU</span>
            <AlertTriangle
              className={`w-3.5 h-3.5 shrink-0 ${
                discrepancyCount > 0 ? 'text-[#ba1a1a] dark:text-rose-400' : 'text-[#006243] dark:text-emerald-400'
              }`}
            />
          </div>
          <div className="mt-1">
            <div
              className={`font-mono font-extrabold text-[15px] leading-tight tabular-nums ${
                discrepancyCount > 0 ? 'text-[#ba1a1a] dark:text-rose-400' : 'text-[#006243] dark:text-emerald-400'
              }`}
            >
              {discrepancyCount.toLocaleString('id-ID')}
            </div>
            <div className="text-[10px] font-semibold text-[#434655] dark:text-slate-400 truncate">
              {minusCount} Min · {plusCount} Lebih
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                discrepancyCount > 0 ? 'bg-[#ba1a1a] dark:bg-rose-400' : 'bg-[#006243] dark:bg-emerald-400'
              }`}
            />
            <span
              className={`text-[10px] font-bold truncate ${
                discrepancyCount > 0 ? 'text-[#ba1a1a] dark:text-rose-400' : 'text-[#006243] dark:text-emerald-400'
              }`}
            >
              {discrepancyCount > 0 ? 'Butuh Audit' : 'Cocok Semua'}
            </span>
          </div>
        </button>

        {/* Card 3: Estimasi Nilai */}
        <button
          type="button"
          onClick={() => onSelectTab('laporan')}
          className="text-left bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-sm border border-[#c3c6d7]/30 dark:border-slate-800 active:scale-95 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[#434655] dark:text-slate-400">
            <span className="text-[10px] font-semibold tracking-wide">Estimasi Nilai</span>
            {selisihModal > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-[#004ac6] dark:text-blue-400 shrink-0" />
            ) : selisihModal < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-[#ba1a1a] dark:text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#006243] dark:text-emerald-400 shrink-0" />
            )}
          </div>
          <div className="mt-1">
            <div
              className={`font-mono font-bold text-[13px] leading-tight tabular-nums truncate ${
                selisihModal < 0
                  ? 'text-[#ba1a1a] dark:text-rose-400'
                  : selisihModal > 0
                  ? 'text-[#004ac6] dark:text-blue-400'
                  : 'text-[#006243] dark:text-emerald-400'
              }`}
            >
              {formatCompactRupiah(selisihModal)}
            </div>
            <div className="text-[10px] font-medium text-[#434655] dark:text-slate-400 truncate font-mono">
              {formatRupiah(Math.abs(selisihModal))}
            </div>
          </div>
          <div className="text-[10px] font-semibold text-[#434655] dark:text-slate-400 mt-1.5 truncate">
            {selisihModal < 0 ? 'Floor Loss' : selisihModal > 0 ? 'Surplus Stok' : 'Seimbang'}
          </div>
        </button>
      </section>

      {/* 2. Universal Barcode Quick-Trigger, Search Input & Compact Filter Controls */}
      <section className="bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-sm border border-[#c3c6d7]/30 dark:border-slate-800 space-y-2">
        <form
          onSubmit={onBarcodeSearchSubmit}
          className="flex items-center gap-1.5 bg-[#f2f3ff] dark:bg-slate-800 px-2.5 py-1.5 rounded-lg"
        >
          <QrCode className="w-5 h-5 text-[#004ac6] dark:text-blue-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Pindai barcode / QR atau ketik SKU..."
            className="w-full min-w-0 bg-transparent font-mono text-xs text-[#131b2e] dark:text-white placeholder:text-[#737686] dark:placeholder:text-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="w-6 h-6 rounded flex items-center justify-center text-[#737686] hover:text-[#131b2e] dark:text-slate-400 dark:hover:text-white text-sm shrink-0"
              aria-label="Hapus pencarian"
            >
              ×
            </button>
          )}
          <button
            type="submit"
            className="bg-[#004ac6] hover:bg-[#003ea8] dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Cari</span>
          </button>
          <button
            type="button"
            onClick={onOpenScanner}
            className="w-8 h-8 rounded-md bg-[#eaedff] dark:bg-slate-700 flex items-center justify-center text-[#434655] dark:text-slate-200 hover:text-[#004ac6] dark:hover:text-blue-400 active:scale-95 transition-transform shrink-0"
            title="Buka Kamera Scan Barcode & QR Code"
          >
            <Camera className="w-4 h-4" />
          </button>
        </form>

        {/* Compact Filter Bar & Add Item CTA */}
        <div className="grid grid-cols-12 gap-1.5 items-center">
          <select
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="col-span-5 px-2 py-1.5 text-[11px] font-medium bg-[#f2f3ff] dark:bg-slate-800 border border-[#c3c6d7]/50 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#004ac6]"
          >
            <option value="ALL">Kategori ({items.length})</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c} ({categoryCounts[c] || 0})
              </option>
            ))}
          </select>

          <select
            value={discrepancyFilter}
            onChange={(e) => onChangeDiscrepancyFilter(e.target.value as any)}
            className="col-span-4 px-2 py-1.5 text-[11px] font-medium bg-[#f2f3ff] dark:bg-slate-800 border border-[#c3c6d7]/50 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#004ac6]"
          >
            <option value="ALL">Semua Status</option>
            {duplicateAnalysis.hasDuplicates && (
              <option value="DUPLICATE">Ganda ({duplicateAnalysis.totalAffectedItems})</option>
            )}
            <option value="MATCH">Cocok ({stats?.matchCount || 0})</option>
            <option value="MINUS">Minus ({minusCount})</option>
            <option value="PLUS">Lebih ({plusCount})</option>
            <option value="UNCOUNTED">Belum ({stats?.uncountedItemsCount || 0})</option>
          </select>

          <button
            type="button"
            onClick={onOpenAddItem}
            className="col-span-3 py-1.5 px-2 text-[11px] font-bold text-[#003ea8] dark:text-blue-300 bg-[#dbe1ff] dark:bg-blue-950/70 hover:bg-[#c8d3ff] dark:hover:bg-blue-900 rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-transform"
            title="Tambah Barang Baru"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Barang</span>
          </button>
        </div>

        {/* Sort selector + Duplicate Banner */}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-[#434655] dark:text-slate-400">Urutkan:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              onChangeSort(field as any, order as any);
            }}
            className="flex-1 px-2 py-1 text-[11px] bg-[#f2f3ff] dark:bg-slate-800 border border-[#c3c6d7]/40 dark:border-slate-700 rounded-md text-[#131b2e] dark:text-slate-200"
          >
            <option value="totalModal-desc">Total Modal Terbesar</option>
            <option value="totalModal-asc">Total Modal Terkecil</option>
            <option value="nama-asc">Nama A-Z</option>
            <option value="sku-asc">SKU A-Z</option>
            <option value="qty-desc">Stok Fisik Terbanyak</option>
            <option value="selisih-asc">Selisih Minus Terbesar</option>
          </select>
        </div>

        {duplicateAnalysis.hasDuplicates && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800 rounded-lg flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{duplicateAnalysis.totalAffectedItems} Barang Duplikat</span>
              </p>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 truncate">
                {duplicateAnalysis.totalDuplicateSkus} SKU ganda · {duplicateAnalysis.totalDuplicateBarcodes} Barcode ganda
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDuplicateModal}
              className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md shrink-0 flex items-center gap-1 active:scale-95 transition-transform"
            >
              <span>Periksa</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </section>

      {/* 3. Active Counting Card: Kalkulator Box & Eceran (Live Hero Card) */}
      <section
        ref={countingCardRef}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-3 space-y-3 border border-[#c3c6d7]/50 dark:border-slate-800"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-[#131b2e] dark:text-white">
              Kalkulator Box &amp; Eceran
            </h2>
          </div>
          {activeItem && (
            <button
              type="button"
              onClick={() => onOpenCalc(activeItem)}
              className="text-[11px] font-bold text-[#004ac6] dark:text-blue-400 bg-[#eaedff] dark:bg-slate-800 px-2 py-1 rounded-md flex items-center gap-1 active:scale-95 transition-transform"
              title="Buka kalkulator lengkap (baris rak & aritmatika)"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Mode Rak</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-[#434655] dark:text-slate-400">
            Memuat data inventaris dari Cloud...
          </div>
        ) : !activeItem ? (
          <div className="p-4 bg-[#f2f3ff] dark:bg-slate-800/70 rounded-lg text-center space-y-2.5">
            <Package className="w-8 h-8 mx-auto text-[#004ac6] dark:text-blue-400" />
            <div>
              <p className="text-xs font-bold text-[#131b2e] dark:text-white">
                Katalog Barang Masih Kosong
              </p>
              <p className="text-[11px] text-[#434655] dark:text-slate-400 mt-0.5">
                Tambahkan barang baru atau import daftar stok toko dari file Excel (.xlsx).
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={onOpenAddItem}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#004ac6] hover:bg-[#003ea8] rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Barang</span>
              </button>
              {activeUser === 'IYAN' && (
                <button
                  type="button"
                  onClick={onOpenImportExport}
                  className="px-3.5 py-2 text-xs font-bold text-[#003ea8] dark:text-blue-300 bg-[#dbe1ff] dark:bg-blue-950 rounded-lg flex items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import XLSX</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Product Metadata Box */}
            <div className="flex items-center justify-between gap-2 bg-[#f2f3ff] dark:bg-slate-800/80 p-2.5 rounded-lg">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-[#dbe1ff] dark:bg-blue-950 text-[#003ea8] dark:text-blue-300 font-mono text-[10px] font-bold">
                    {activeItem.sku}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#eaedff] dark:bg-slate-700 text-[#434655] dark:text-slate-300 text-[10px] font-semibold truncate max-w-[140px]">
                    {activeItem.kategori || 'Umum'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#131b2e] dark:text-white mt-1 leading-snug line-clamp-2">
                  {activeItem.namaBarang}
                </h3>
                <p className="text-[11px] text-[#434655] dark:text-slate-400 mt-0.5 truncate font-mono">
                  {activeItem.barcode ? `Barcode: ${activeItem.barcode}` : 'Tanpa barcode'} · Terhitung: {activeItem.quantity} {activeSatuan}
                </p>
              </div>
              <div className="bg-[#dae2fd] dark:bg-slate-700 px-2.5 py-1.5 rounded-lg text-center shrink-0 min-w-[70px]">
                <span className="text-[9px] font-bold text-[#434655] dark:text-slate-300 block uppercase tracking-wide">
                  Stok Sistem
                </span>
                <span className="font-mono font-extrabold text-base text-[#131b2e] dark:text-white tabular-nums block leading-tight">
                  {activeSystemQty}
                </span>
                <span className="text-[10px] text-[#434655] dark:text-slate-300">{activeSatuan}</span>
              </div>
            </div>

            {/* 3-Column Ergonomic Calculation Grid (NO Preset Pack Chips) */}
            <div className="grid grid-cols-3 gap-2 select-none">
              {/* Column 1: Jml Box */}
              <div className="bg-[#f2f3ff] dark:bg-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
                <div className="text-center mb-1.5">
                  <span className="text-[11px] font-bold text-[#434655] dark:text-slate-200 block">
                    Jml Box
                  </span>
                  <span className="text-[10px] text-[#737686] dark:text-slate-400 block">Dus/Karton</span>
                </div>
                <div className="flex items-center justify-between gap-1 bg-white dark:bg-slate-900 rounded-md p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setJmlBox((v) => Math.max(0, v - 1))}
                    className="w-7 h-9 rounded bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] dark:hover:bg-slate-700 flex items-center justify-center text-[#131b2e] dark:text-white active:scale-90 transition-transform shrink-0"
                    aria-label="Kurangi jumlah box"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={jmlBox}
                    onChange={(e) => setJmlBox(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full min-w-0 text-center bg-transparent font-mono font-extrabold text-sm text-[#131b2e] dark:text-white focus:outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setJmlBox((v) => v + 1)}
                    className="w-7 h-9 rounded bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] dark:hover:bg-slate-700 flex items-center justify-center text-[#004ac6] dark:text-blue-400 active:scale-90 transition-transform shrink-0"
                    aria-label="Tambah jumlah box"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Column 2: Isi/Box */}
              <div className="bg-[#f2f3ff] dark:bg-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
                <div className="text-center mb-1.5">
                  <span className="text-[11px] font-bold text-[#434655] dark:text-slate-200 block">
                    Isi/Box
                  </span>
                  <span className="text-[10px] text-[#737686] dark:text-slate-400 block">Pcs/Dus</span>
                </div>
                <div className="flex items-center justify-between gap-1 bg-white dark:bg-slate-900 rounded-md p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setIsiPerBox((v) => Math.max(1, v - 1))}
                    className="w-7 h-9 rounded bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] dark:hover:bg-slate-700 flex items-center justify-center text-[#131b2e] dark:text-white active:scale-90 transition-transform shrink-0"
                    aria-label="Kurangi isi per box"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={isiPerBox}
                    onChange={(e) => setIsiPerBox(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full min-w-0 text-center bg-transparent font-mono font-extrabold text-sm text-[#131b2e] dark:text-white focus:outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setIsiPerBox((v) => v + 1)}
                    className="w-7 h-9 rounded bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] dark:hover:bg-slate-700 flex items-center justify-center text-[#004ac6] dark:text-blue-400 active:scale-90 transition-transform shrink-0"
                    aria-label="Tambah isi per box"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Column 3: Ecer Lepas */}
              <div className="bg-[#f2f3ff] dark:bg-slate-800/80 p-2 rounded-lg flex flex-col justify-between">
                <div className="text-center mb-1.5">
                  <span className="text-[11px] font-bold text-[#434655] dark:text-slate-200 block">
                    Ecer Lepas
                  </span>
                  <span className="text-[10px] text-[#737686] dark:text-slate-400 block">Pcs Display</span>
                </div>
                <div className="flex items-center justify-between gap-1 bg-white dark:bg-slate-900 rounded-md p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setEcerLepas((v) => Math.max(0, v - 1))}
                    className="w-7 h-9 rounded bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] dark:hover:bg-slate-700 flex items-center justify-center text-[#131b2e] dark:text-white active:scale-90 transition-transform shrink-0"
                    aria-label="Kurangi eceran"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={ecerLepas}
                    onChange={(e) => setEcerLepas(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full min-w-0 text-center bg-transparent font-mono font-extrabold text-sm text-[#131b2e] dark:text-white focus:outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setEcerLepas((v) => v + 1)}
                    className="w-7 h-9 rounded bg-[#eaedff] dark:bg-slate-800 hover:bg-[#dae2fd] dark:hover:bg-slate-700 flex items-center justify-center text-[#004ac6] dark:text-blue-400 active:scale-90 transition-transform shrink-0"
                    aria-label="Tambah eceran"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Live Formula Preview Strip */}
            <div className="flex items-center justify-between gap-2 bg-[#eaedff] dark:bg-slate-800 p-2.5 rounded-lg">
              <div className="min-w-0">
                <div className="text-[11px] font-mono text-[#434655] dark:text-slate-400">
                  Formula:{' '}
                  <span className="font-bold text-[#131b2e] dark:text-white">
                    ({safeBox} × {safeIsi}) + {safeEcer}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#131b2e] dark:text-white mt-0.5">
                  Total Fisik:{' '}
                  <span className="font-mono font-extrabold text-[#004ac6] dark:text-blue-400 text-sm tabular-nums">
                    {totalCalculated} {activeSatuan}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-md font-mono text-[11px] font-bold ${
                    activeDiff < 0
                      ? 'bg-[#ffdad6] dark:bg-rose-950/70 text-[#ba1a1a] dark:text-rose-300'
                      : activeDiff > 0
                      ? 'bg-[#dbe1ff] dark:bg-blue-950/70 text-[#003ea8] dark:text-blue-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/70 text-[#006243] dark:text-emerald-300'
                  }`}
                >
                  {activeDiff === 0
                    ? 'Cocok Sistem ✓'
                    : activeDiff < 0
                    ? `Defisit: ${activeDiff} ${activeSatuan}`
                    : `Surplus: +${activeDiff} ${activeSatuan}`}
                </span>
              </div>
            </div>

            {/* Primary Save & Next Action CTA */}
            <button
              type="button"
              disabled={isSavingActive}
              onClick={handleSaveAndNext}
              className="w-full h-11 bg-[#004ac6] hover:bg-[#003ea8] dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all"
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
        )}
      </section>

      {/* 4. Perlu Dicek Segera (Triage) */}
      {triageItems.length > 0 && (
        <section className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-bold text-[#131b2e] dark:text-white">
              Perlu Dicek Segera (Triage)
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#ffdad6] dark:bg-rose-950/70 text-[#ba1a1a] dark:text-rose-300 font-mono text-[10px] font-bold">
              {triageItems.length} Item Selisih
            </span>
          </div>

          <div className="space-y-2">
            {displayedTriage.map((item) => {
              const diff = (item.quantity || 0) - (item.quantitySystem || 0);
              const satuan = item.satuan || 'pcs';
              const isSelected = activeItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-slate-900 p-2.5 rounded-xl shadow-sm border flex items-center justify-between gap-2 transition-colors ${
                    isSelected
                      ? 'border-[#004ac6] dark:border-blue-500 ring-1 ring-[#004ac6]/20'
                      : 'border-[#c3c6d7]/30 dark:border-slate-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-[#eaedff] dark:bg-slate-800 text-[#434655] dark:text-slate-300 font-mono text-[10px] font-bold">
                        {item.sku}
                      </span>
                      <span className="text-[10px] font-medium text-[#737686] dark:text-slate-400 truncate max-w-[120px]">
                        {item.kategori}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-[#131b2e] dark:text-white truncate mt-1">
                      {item.namaBarang}
                    </h4>
                    <p className="text-[11px] font-mono text-[#434655] dark:text-slate-400 mt-0.5">
                      Sistem: {item.quantitySystem || 0} • Fisik: {item.quantity || 0} {satuan}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                        diff < 0
                          ? 'bg-[#ffdad6] dark:bg-rose-950/70 text-[#ba1a1a] dark:text-rose-300'
                          : 'bg-[#dbe1ff] dark:bg-blue-950/70 text-[#003ea8] dark:text-blue-300'
                      }`}
                    >
                      {diff > 0 ? `+${diff}` : diff} {satuan}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFocusCountingCard(item)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#dbe1ff] dark:bg-blue-950 hover:bg-[#b4c5ff] dark:hover:bg-blue-900 text-[#003ea8] dark:text-blue-300 text-[11px] font-bold active:scale-95 transition-transform"
                    >
                      Cek Ulang
                    </button>
                  </div>
                </div>
              );
            })}

            {triageItems.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllTriage((prev) => !prev)}
                className="w-full py-2 text-[11px] font-bold text-[#004ac6] dark:text-blue-400 bg-[#f2f3ff] dark:bg-slate-800/80 hover:bg-[#eaedff] dark:hover:bg-slate-800 rounded-lg flex items-center justify-center gap-1 active:scale-98 transition-transform"
              >
                {showAllTriage ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Ringkas Daftar Triage</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Lihat Semua Triage ({triageItems.length - 4} lainnya)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      )}

      {/* 5. Daftar Lengkap Barang (Filterable & Quick Stepper) */}
      <section className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-bold text-[#131b2e] dark:text-white">
            Daftar Barang Inventaris ({filteredItems.length})
          </h2>
          {(selectedCategory !== 'ALL' || discrepancyFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                onSelectCategory('ALL');
                onChangeDiscrepancyFilter('ALL');
                onSearchQueryChange('');
              }}
              className="text-[11px] font-bold text-[#004ac6] dark:text-blue-400 hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-[#c3c6d7]/30 dark:border-slate-800 divide-y divide-[#eaedff] dark:divide-slate-800 overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-[#434655] dark:text-slate-400 space-y-2">
              <p>Tidak ada barang yang cocok dengan filter atau pencarian saat ini.</p>
              {activeUser === 'IYAN' && items.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenImportExport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#003ea8] dark:text-blue-300 bg-[#dbe1ff] dark:bg-blue-950 rounded-lg"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import File XLSX</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {visibleItems.map((item) => (
                <MobileInventoryCard
                  key={item.id}
                  item={item}
                  isDuplicateSku={duplicateAnalysis.duplicateSkus.has((item.sku || '').trim().toUpperCase())}
                  isDuplicateBarcode={Boolean(item.barcode && duplicateAnalysis.duplicateBarcodes.has(item.barcode.trim()))}
                  onQuickDelta={onQuickDelta}
                  onQuickAdjust={onQuickAdjust}
                  onOpenCalc={(target) => {
                    handleFocusCountingCard(target);
                  }}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                  onOpenDuplicate={onOpenDuplicateModal}
                />
              ))}
              {hasMoreVisibleItems && (
                <div className="p-3 flex items-center justify-center gap-2 bg-[#f2f3ff] dark:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    className="px-3.5 py-2 text-xs font-bold text-[#003ea8] dark:text-blue-300 bg-[#dbe1ff] dark:bg-blue-950/60 rounded-lg active:scale-95 transition-transform"
                  >
                    Muat +120 ({filteredItems.length - visibleItems.length} tersisa)
                  </button>
                  <button
                    type="button"
                    onClick={onShowAll}
                    className="px-3 py-2 text-xs font-medium text-[#434655] dark:text-slate-300 bg-white dark:bg-slate-800 border border-[#c3c6d7]/50 dark:border-slate-700 rounded-lg active:scale-95 transition-transform"
                  >
                    Tampilkan Semua
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};
