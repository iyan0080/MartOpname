import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Copy,
  Barcode as BarcodeIcon,
  Tag,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { InventoryItem } from '../types/inventory.ts';
import { formatRupiah } from '../utils/excelUtils.ts';

interface DuplicateItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateAnalysis: {
    duplicateSkus: Map<string, InventoryItem[]>;
    duplicateBarcodes: Map<string, InventoryItem[]>;
    totalDuplicateSkus: number;
    totalDuplicateBarcodes: number;
    totalAffectedItems: number;
  };
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
}

export const DuplicateItemsModal: React.FC<DuplicateItemsModalProps> = ({
  isOpen,
  onClose,
  duplicateAnalysis,
  onEditItem,
  onDeleteItem,
}) => {
  const [activeTab, setActiveTab] = useState<'sku' | 'barcode'>('sku');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const { duplicateSkus, duplicateBarcodes, totalDuplicateSkus, totalDuplicateBarcodes } = duplicateAnalysis;

  // Filter SKU duplicates by search
  const filteredSkuEntries = Array.from(duplicateSkus.entries()).filter(([sku, items]) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (sku.toLowerCase().includes(q)) return true;
    return items.some((i) => i.namaBarang.toLowerCase().includes(q) || (i.barcode && i.barcode.toLowerCase().includes(q)));
  });

  // Filter Barcode duplicates by search
  const filteredBarcodeEntries = Array.from(duplicateBarcodes.entries()).filter(([barcode, items]) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (barcode.toLowerCase().includes(q)) return true;
    return items.some((i) => i.namaBarang.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Pemeriksaan Data Ganda
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold">
                  {duplicateAnalysis.totalAffectedItems} Barang
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deteksi otomatis SKU dan Barcode yang memiliki entri duplikat pada database toko
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('sku')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'sku'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>SKU Ganda</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'sku' ? 'bg-amber-700/80 text-white' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  {totalDuplicateSkus}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('barcode')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'barcode'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <BarcodeIcon className="w-3.5 h-3.5" />
                <span>Barcode Ganda</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'barcode' ? 'bg-rose-700/80 text-white' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  {totalDuplicateBarcodes}
                </span>
              </button>
            </div>

            {/* Quick search */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SKU, Barcode, atau nama barang..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'sku' ? (
            filteredSkuEntries.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {totalDuplicateSkus === 0 ? 'Semua SKU Unik & Valid' : 'Tidak ada hasil yang cocok'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {totalDuplicateSkus === 0
                    ? 'Tidak ditemukan SKU ganda pada database barang toko Anda.'
                    : 'Coba ubah kata kunci pencarian Anda.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSkuEntries.map(([skuKey, itemList]) => (
                  <div
                    key={skuKey}
                    className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white font-mono">
                          SKU: {skuKey}
                        </span>
                        <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                          Digunakan oleh {itemList.length} barang
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Klik Edit untuk memperbarui SKU salah satu produk
                      </span>
                    </div>

                    <div className="grid grid-cols-1 divide-y divide-amber-200/60 dark:divide-amber-800/40 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      {itemList.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                #{idx + 1}. {item.namaBarang}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {item.kategori}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>Barcode: {item.barcode || '-'}</span>
                              <span>•</span>
                              <span>Stok Fisik: <b className="text-slate-900 dark:text-white">{item.quantity} {item.satuan}</b></span>
                              <span>•</span>
                              <span>Modal: <b>{formatRupiah(item.hargaModal)}</b></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onEditItem(item);
                              }}
                              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" /> Edit SKU
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteItem(item);
                              }}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
                              title="Hapus barang duplikat ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredBarcodeEntries.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {totalDuplicateBarcodes === 0 ? 'Semua Barcode Unik & Valid' : 'Tidak ada hasil yang cocok'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {totalDuplicateBarcodes === 0
                    ? 'Tidak ditemukan barcode ganda pada database barang toko Anda.'
                    : 'Coba ubah kata kunci pencarian Anda.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBarcodeEntries.map(([barcodeKey, itemList]) => (
                  <div
                    key={barcodeKey}
                    className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white font-mono">
                          Barcode: {barcodeKey}
                        </span>
                        <span className="text-xs text-rose-800 dark:text-rose-300 font-medium">
                          Digunakan oleh {itemList.length} barang
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Pastikan barcode unik agar scanner kasir tidak salah input
                      </span>
                    </div>

                    <div className="grid grid-cols-1 divide-y divide-rose-200/60 dark:divide-rose-800/40 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      {itemList.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                #{idx + 1}. {item.namaBarang}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {item.kategori}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>SKU: <b className="text-slate-700 dark:text-slate-300">{item.sku}</b></span>
                              <span>•</span>
                              <span>Stok Fisik: <b className="text-slate-900 dark:text-white">{item.quantity} {item.satuan}</b></span>
                              <span>•</span>
                              <span>Modal: <b>{formatRupiah(item.hargaModal)}</b></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onEditItem(item);
                              }}
                              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" /> Edit Barcode
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteItem(item);
                              }}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
                              title="Hapus barang duplikat ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Tip: Berikan SKU unik untuk tiap jenis produk agar pembukuan stok akurat.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
