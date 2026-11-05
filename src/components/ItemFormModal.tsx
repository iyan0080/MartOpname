import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, Calculator, Plus, ListFilter } from 'lucide-react';
import { InventoryItem } from '../types/inventory.ts';
import { formatRupiah } from '../utils/excelUtils.ts';
import { QuantityCalculatorModal } from './QuantityCalculatorModal.tsx';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: Partial<InventoryItem>) => Promise<boolean>;
  initialData?: InventoryItem | null;
  prefilledBarcode?: string;
  activeUser: string;
  availableCategories?: string[];
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  prefilledBarcode,
  activeUser,
  availableCategories = [],
}) => {
  const [sku, setSku] = useState('');
  const [namaBarang, setNamaBarang] = useState('');
  const [barcode, setBarcode] = useState('');
  const [kategori, setKategori] = useState('Umum');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [satuan, setSatuan] = useState('pcs');
  const [quantity, setQuantity] = useState<number | ''>(0);
  const [quantitySystem, setQuantitySystem] = useState<number | ''>(0);
  const [hargaModal, setHargaModal] = useState<number | ''>(0);
  const [hargaJual, setHargaJual] = useState<number | ''>(0);
  const [stokMinimum, setStokMinimum] = useState<number | ''>(5);
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF' | 'ARSIP'>('AKTIF');
  const [keterangan, setKeterangan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);

  // Compute dynamic category options combining imported categories and current item's category
  const categoryOptions = useMemo(() => {
    const list = new Set<string>();
    (availableCategories || []).forEach((c) => {
      const trimmed = (c || '').trim();
      if (trimmed) list.add(trimmed);
    });
    if (initialData?.kategori && initialData.kategori.trim()) {
      list.add(initialData.kategori.trim());
    }
    const arr = Array.from(list).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (arr.length === 0) {
      arr.push('Umum');
    }
    return arr;
  }, [availableCategories, initialData]);

  useEffect(() => {
    if (initialData) {
      setSku(initialData.sku || '');
      setNamaBarang(initialData.namaBarang || '');
      setBarcode(initialData.barcode || '');
      const existingCat = (initialData.kategori || '').trim() || (availableCategories[0] || 'Umum');
      setKategori(existingCat);
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setSatuan(initialData.satuan || 'pcs');
      setQuantity(initialData.quantity !== undefined ? initialData.quantity : 0);
      setQuantitySystem(initialData.quantitySystem !== undefined ? initialData.quantitySystem : 0);
      setHargaModal(initialData.hargaModal !== undefined ? initialData.hargaModal : 0);
      setHargaJual(initialData.hargaJual !== undefined ? initialData.hargaJual : 0);
      setStokMinimum(initialData.stokMinimum !== undefined ? initialData.stokMinimum : 5);
      setStatus(initialData.status || 'AKTIF');
      setKeterangan(initialData.keterangan || '');
    } else {
      setSku('');
      setNamaBarang('');
      setBarcode(prefilledBarcode || '');
      const defaultCat = availableCategories[0] || 'Umum';
      setKategori(defaultCat);
      setIsCustomCategory(false);
      setCustomCategoryName('');
      setSatuan('pcs');
      setQuantity(1);
      setQuantitySystem(1);
      setHargaModal(0);
      setHargaJual(0);
      setStokMinimum(5);
      setStatus('AKTIF');
      setKeterangan('');
    }
    setError(null);
  }, [initialData, prefilledBarcode, isOpen, availableCategories]);

  if (!isOpen) return null;

  const numQty = typeof quantity === 'number' ? quantity : 0;
  const numModal = typeof hargaModal === 'number' ? hargaModal : 0;
  const numJual = typeof hargaJual === 'number' ? hargaJual : 0;
  const numSysQty = typeof quantitySystem === 'number' ? quantitySystem : 0;
  const numMinStok = typeof stokMinimum === 'number' ? stokMinimum : 0;
  const totalModalItem = numQty * numModal;
  const selisihQty = numQty - numSysQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      setError('SKU wajib diisi (contoh: SKU-001, SMB-001).');
      return;
    }
    if (!namaBarang.trim()) {
      setError('nama_produk wajib diisi.');
      return;
    }

    const finalCategory = isCustomCategory
      ? customCategoryName.trim() || 'Umum'
      : kategori.trim() || 'Umum';

    setIsSubmitting(true);
    setError(null);

    const success = await onSave({
      id: initialData?.id,
      sku: sku.trim().toUpperCase(),
      namaBarang: namaBarang.trim(),
      barcode: barcode.trim(),
      kategori: finalCategory,
      satuan: satuan.trim() || 'pcs',
      quantity: Math.max(0, numQty),
      quantitySystem: Math.max(0, numSysQty),
      stokAwal: Math.max(0, numSysQty),
      stokMinimum: Math.max(0, numMinStok),
      hargaModal: Math.max(0, numModal),
      hargaJual: Math.max(0, numJual),
      status,
      keterangan: keterangan.trim(),
      lastUpdatedBy: activeUser,
    });

    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {initialData ? 'Edit Data Barang Mart' : 'Tambah Barang Mart Baru'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {initialData ? `Perbarui data untuk SKU: ${initialData.sku}` : 'Masukkan data barang dan kalkulasi modal'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* SKU */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SKU / Kode Barang <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="Contoh: SMB-005"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono font-semibold"
                  required
                />
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Barcode (EAN-13 / UPC)
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Contoh: 8992388123456"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Nama Barang */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Barang <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={namaBarang}
                onChange={(e) => setNamaBarang(e.target.value)}
                placeholder="Contoh: Minyak Goreng Bimoli 2 Liter"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            {/* Kategori & Satuan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  {!isCustomCategory ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(true);
                        setCustomCategoryName('');
                      }}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Kategori Baru
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(false)}
                      className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-0.5"
                    >
                      <ListFilter className="w-3 h-3" /> Pilih Daftar
                    </button>
                  )}
                </div>

                {!isCustomCategory ? (
                  <select
                    value={kategori}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCustomCategory(true);
                        setCustomCategoryName('');
                      } else {
                        setKategori(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__NEW__">+ Tambah Kategori Baru...</option>
                  </select>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="Ketik nama kategori baru..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-blue-500 dark:border-blue-500 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-medium"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Kategori ini otomatis muncul di filter & laporan opname
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Satuan (pcs / box / pack)
                </label>
                <div className="flex gap-2">
                  <select
                    value={satuan === 'pcs' || satuan === 'box' || satuan === 'pack' || satuan === 'dus' || satuan === 'botol' ? satuan : 'lainnya'}
                    onChange={(e) => {
                      if (e.target.value !== 'lainnya') setSatuan(e.target.value);
                    }}
                    className="w-32 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="pcs">pcs</option>
                    <option value="box">box / dus</option>
                    <option value="pack">pack</option>
                    <option value="botol">botol</option>
                    <option value="lainnya">Lainnya...</option>
                  </select>
                  <input
                    type="text"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value.toLowerCase())}
                    placeholder="satuan"
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Harga Modal & Harga Jual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Harga Modal per Unit (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={hargaModal}
                  onChange={(e) => setHargaModal(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">{formatRupiah(numModal)}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Harga Jual per Unit (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={hargaJual}
                  onChange={(e) => setHargaJual(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">{formatRupiah(numJual)}</p>
              </div>
            </div>

            {/* Stok Fisik & Stok Awal (Sistem) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quantity Fisik with Calculator Action */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Stok Fisik Opname ({satuan})
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCalcOpen(true)}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <Calculator className="w-3 h-3" /> Hitung Dus/Rak
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCalcOpen(true)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                    title="Buka kalkulator kuantitas"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quantity Sistem (stok_awal) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stok Awal / Buku Sistem ({satuan})
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantitySystem}
                  onChange={(e) => setQuantitySystem(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Stok Minimum & Status Produk */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stok Minimum Peringatan (stok_minumum)
                </label>
                <input
                  type="number"
                  min="0"
                  value={stokMinimum}
                  onChange={(e) => setStokMinimum(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="5"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Batas peringatan restock barang saat stok menipis</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status Produk
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF' | 'ARSIP')}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="AKTIF">AKTIF (Dijual di Mart)</option>
                  <option value="NONAKTIF">NONAKTIF (Sementara Habis/Ditutup)</option>
                  <option value="ARSIP">ARSIP (Tidak Dijual Lagi)</option>
                </select>
              </div>
            </div>

            {/* Real-time Calculation Summary Box */}
            <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-600 dark:text-slate-400">Total Nilai Modal Fisik (Qty × Harga Modal):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{formatRupiah(totalModalItem)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Selisih Stok (Fisik - Sistem):</span>
                <span
                  className={`font-mono font-semibold ${
                    selisihQty === 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : selisihQty < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {selisihQty > 0 ? `+${selisihQty}` : selisihQty} pcs (
                  {formatRupiah(selisihQty * numModal)})
                </span>
              </div>
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-2 shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Barang'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Quantity Calculator for Form */}
      <QuantityCalculatorModal
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
        targetItem={
          initialData || {
            id: 'draft',
            sku: sku || 'BARU',
            namaBarang: namaBarang || 'Barang Baru',
            barcode,
            kategori,
            quantity: numQty,
            quantitySystem: numSysQty,
            hargaModal: numModal,
            keterangan,
            lastUpdatedBy: activeUser,
            updatedAt: '',
          }
        }
        onSelectResult={(res) => {
          setQuantity(res);
          setIsCalcOpen(false);
        }}
        onApplyQuantity={async (_id, resQty) => {
          setQuantity(resQty);
          setIsCalcOpen(false);
          return true;
        }}
      />
    </>
  );
};
