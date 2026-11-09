import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { InventoryItem, InventoryStats } from '../types/inventory.ts';
import {
  exportInventoryToXLSX,
  downloadExcelTemplate,
  parseExcelFile,
  formatRupiah,
  assignSequentialMissingSKUs,
  SkuInspectionReport,
} from '../utils/excelUtils.ts';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  stats: InventoryStats;
  activeUser: string;
  isAuthorizedIyan: boolean;
  onRequestIyanAuth: () => void;
  onBatchImport: (items: Partial<InventoryItem>[], mode: 'merge' | 'replace') => Promise<boolean>;
  defaultTab?: 'export' | 'import';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  items,
  stats,
  activeUser,
  isAuthorizedIyan,
  onRequestIyanAuth,
  onBatchImport,
  defaultTab = 'import',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(defaultTab);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawParsedItems, setRawParsedItems] = useState<Partial<InventoryItem>[] | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Partial<InventoryItem>[] | null>(null);
  const [skuInspection, setSkuInspection] = useState<SkuInspectionReport | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab || 'import');
      setRawParsedItems(null);
      setParsedPreview(null);
      setSkuInspection(null);
      setParseErrors([]);
      setFileName('');
      setImportError(null);
      setConfirmReplace(false);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const isUserIyan = activeUser === 'IYAN' && isAuthorizedIyan;

  // Analysis of duplicate SKUs & Barcodes in parsedPreview
  const duplicateSkusInImport = useMemo(() => {
    if (!parsedPreview) return new Map<string, number>();
    const counts = new Map<string, number>();
    parsedPreview.forEach((item) => {
      const s = (item.sku || '').trim().toUpperCase();
      if (s) counts.set(s, (counts.get(s) || 0) + 1);
    });
    const dupes = new Map<string, number>();
    counts.forEach((cnt, s) => {
      if (cnt > 1) dupes.set(s, cnt);
    });
    return dupes;
  }, [parsedPreview]);

  const duplicateBarcodesInImport = useMemo(() => {
    if (!parsedPreview) return new Map<string, number>();
    const counts = new Map<string, number>();
    parsedPreview.forEach((item) => {
      const b = (item.barcode || '').trim();
      if (b && b !== '-' && b !== '0') counts.set(b, (counts.get(b) || 0) + 1);
    });
    const dupes = new Map<string, number>();
    counts.forEach((cnt, b) => {
      if (cnt > 1) dupes.set(b, cnt);
    });
    return dupes;
  }, [parsedPreview]);

  const handleFileChange = async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setIsProcessing(true);
    setParseErrors([]);
    setRawParsedItems(null);
    setParsedPreview(null);
    setSkuInspection(null);
    setImportError(null);

    const result = await parseExcelFile(file, items, importMode);
    setIsProcessing(false);

    if (result.success) {
      setRawParsedItems(result.data);
      setParsedPreview(result.data);
      setSkuInspection(result.skuInspection || null);
      setParseErrors(result.errors);
    } else {
      setParseErrors(result.errors);
    }
  };

  const handleModeChange = (newMode: 'merge' | 'replace') => {
    setImportMode(newMode);
    if (rawParsedItems && rawParsedItems.length > 0) {
      const reassigned = assignSequentialMissingSKUs(rawParsedItems, items, newMode);
      setParsedPreview(reassigned.items);
      setSkuInspection(reassigned.report);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedPreview || parsedPreview.length === 0) return;

    if (!isUserIyan) {
      setImportError('Akses Ditolak: Hanya user IYAN yang berhak melakukan import data.');
      return;
    }

    if (importMode === 'replace' && !confirmReplace) {
      setImportError('Mode "Ganti Seluruh Data" akan menghapus seluruh data barang saat ini. Harap beri centang persetujuan di bawah.');
      return;
    }

    setImportError(null);
    setIsProcessing(true);
    const success = await onBatchImport(parsedPreview, importMode);
    setIsProcessing(false);

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Import & Export File XLSX (Excel)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Kelola data stok opname mart dengan spreadsheet Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access Barrier if not IYAN */}
        {!isUserIyan ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Lock className="w-7 h-7" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Akses Terbatas: Khusus Petugas IYAN</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                Hanya user <strong className="text-slate-900 dark:text-white font-bold">IYAN</strong> yang memiliki hak akses
                untuk melakukan <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">Export</strong> dan{' '}
                <strong className="text-blue-700 dark:text-blue-400 font-semibold">Import</strong> data inventaris mart.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <span>Petugas aktif saat ini:</span>
                <strong className="text-slate-900 dark:text-white">{activeUser}</strong>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestIyanAuth();
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 shadow-xs transition-colors"
              >
                <ShieldCheck className="w-4 h-4" /> Masuk Sebagai IYAN (Masukkan Password)
              </button>
            </div>
          </div>
        ) : (
          /* Authorized Content */
          <>
            {/* Authorization Banner */}
            <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-100 dark:border-emerald-800/80 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Otorisasi Valid: Terverifikasi sebagai Petugas <strong className="font-bold">IYAN</strong>
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">Izin Penuh Export & Import</span>
            </div>

            {/* Tab Controls */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 gap-6">
              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'export'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Download className="w-4 h-4" /> Export Laporan ke XLSX
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'import'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Upload className="w-4 h-4" /> Import Data dari XLSX
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {activeTab === 'export' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                    <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider mb-2">
                      Ringkasan Laporan Yang Akan Diexport
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Item SKU</p>
                        <p className="text-base font-bold font-mono text-slate-900 dark:text-white">{stats.totalItems}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Fisik Terhitung</p>
                        <p className="text-base font-bold font-mono text-slate-900 dark:text-white">{stats.totalPhysicalQty} pcs</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Modal Investasi</p>
                        <p className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400 truncate">
                          {formatRupiah(stats.totalModalInvestasi)}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Selisih Stok Fisik</p>
                        <p
                          className={`text-sm font-bold font-mono ${
                            stats.totalSelisihQty === 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : stats.totalSelisihQty < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {stats.totalSelisihQty > 0 ? `+${stats.totalSelisihQty}` : stats.totalSelisihQty} pcs
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 dark:text-white">Format Kolom Template Excel (.xlsx):</p>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">11 Kolom Standar</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span>1. Sku</span>
                      <span>2. Barcode</span>
                      <span>3. nama_produk</span>
                      <span>4. Kategori</span>
                      <span>5. satuan (pcs/box)</span>
                      <span>6. harga_modal</span>
                      <span>7. harga_jual</span>
                      <span>8. stok_awal</span>
                      <span>9. stok_minumum</span>
                      <span>10. status (AKTIF/NONAKTIF/ARSIP)</span>
                      <span>11. catatan</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      File export memuat <strong>Sheet 1: Data Produk (Template)</strong> sesuai format 11 kolom resmi di atas, serta <strong>Sheet 2: Laporan Stok Opname</strong> untuk hasil audit fisik & neraca selisih.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => exportInventoryToXLSX(items, stats)}
                      className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download Laporan Excel (.XLSX)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Template Download Prompt */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-lg text-xs">
                    <div className="flex items-start gap-2 text-blue-900 dark:text-blue-200">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Gunakan Template Resmi 11 Kolom</span>
                        <span className="text-[11px] text-blue-700 dark:text-blue-300">
                          Sku, Barcode, nama_produk, Kategori, satuan (pcs/box), harga_modal, harga_jual, stok_awal, stok_minumum, status, catatan.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={downloadExcelTemplate}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors shrink-0 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Template XLSX
                    </button>
                  </div>

                  {/* Upload Drop Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      dragOver ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <Upload className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Tarik & Lepaskan File Excel (.xlsx / .xls) ke sini
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
                      Mendukung template 11 kolom DR MART atau file Excel barang dari kasir
                    </p>
                    <label className="inline-block px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shadow-xs transition-colors">
                      Pilih File XLSX
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    {fileName && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono font-medium mt-2">File terpilih: {fileName}</p>
                    )}
                  </div>

                  {/* Parse Errors */}
                  {parseErrors.length > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-950 dark:text-amber-100">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Catatan Import:</span>
                      </div>
                      {parseErrors.map((err, i) => (
                        <p key={i} className="text-[11px] pl-5">
                          · {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Parsed Preview Table */}
                  {parsedPreview && parsedPreview.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>{parsedPreview.length} Data Barang Siap Diimport</span>
                        </div>

                        {/* Mode selection */}
                        <div className="flex items-center gap-2 text-xs">
                          <label className="text-slate-600 dark:text-slate-400 font-medium">Metode Import:</label>
                          <select
                            value={importMode}
                            onChange={(e) => handleModeChange(e.target.value as 'merge' | 'replace')}
                            className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
                          >
                            <option value="merge">Gabungkan / Update Barang Sama</option>
                            <option value="replace">Ganti Semua Data (Timpa)</option>
                          </select>
                        </div>
                      </div>

                      {/* Panel Hasil Pemeriksaan SKU Excel Otomatis */}
                      {skuInspection && (
                        <div
                          className={`p-3.5 rounded-xl border text-xs transition-all ${
                            skuInspection.missingSkuCount > 0
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/80'
                              : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-lg shrink-0 ${
                                skuInspection.missingSkuCount > 0
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-emerald-600 text-white shadow-xs'
                              }`}
                            >
                              <Hash className="w-4 h-4" />
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                                  Pemeriksaan SKU Excel Selesai
                                </h4>
                                {skuInspection.missingSkuCount > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                                    {skuInspection.missingSkuCount} SKU Dibuatkan Otomatis
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                                    100% SKU Lengkap
                                  </span>
                                )}
                                {skuInspection.gapFilledCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                    {skuInspection.gapFilledCount} Mengisi Nomor Terlewat
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                                {skuInspection.missingSkuCount > 0 ? (
                                  <>
                                    Ditemukan <strong>{skuInspection.missingSkuCount} barang</strong> belum memiliki SKU. Sistem otomatis membuatkan nomor SKU berurutan
                                    {skuInspection.gapFilledCount > 0 ? (
                                      <> dengan <strong>mengisi celah nomor urut yang terlewatkan</strong> terlebih dahulu.</>
                                    ) : (
                                      <> secara rapi berurutan.</>
                                    )}
                                  </>
                                ) : (
                                  <>Seluruh <strong>{skuInspection.totalItems} barang</strong> pada file Excel ini telah memiliki kode SKU yang lengkap.</>
                                )}
                              </p>

                              {/* Sample list of auto-assigned SKUs */}
                              {skuInspection.generatedSkus.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
                                  <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                                    Nomor SKU Berurutan Yang Dialokasikan:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                    {skuInspection.generatedSkus.slice(0, 16).map((gen, idx) => (
                                      <div
                                        key={idx}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                          gen.isGapFilled
                                            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                                            : 'bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-200'
                                        }`}
                                        title={`${gen.namaBarang} ${gen.isGapFilled ? '(Mengisi nomor terlewatkan)' : '(Nomor urut baru)'}`}
                                      >
                                        <span>{gen.sku}</span>
                                        {gen.isGapFilled && (
                                          <span className="text-[8px] font-sans px-1 py-0.2 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                                            Isi Celah
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {skuInspection.generatedSkus.length > 16 && (
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 self-center">
                                        + {skuInspection.generatedSkus.length - 16} lainnya
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Duplicate Alert Banner */}
                      {(duplicateSkusInImport.size > 0 || duplicateBarcodesInImport.size > 0) && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Peringatan Data Ganda Dalam File Excel:</span>
                          </div>
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 pl-5 space-y-0.5">
                            {duplicateSkusInImport.size > 0 && (
                              <p>• Ditemukan <b>{duplicateSkusInImport.size} SKU</b> yang muncul ganda/berulang dalam file ini.</p>
                            )}
                            {duplicateBarcodesInImport.size > 0 && (
                              <p>• Ditemukan <b>{duplicateBarcodesInImport.size} Barcode</b> yang sama digunakan oleh beberapa barang dalam file ini.</p>
                            )}
                            <p className="text-slate-500 dark:text-slate-400 mt-1">
                              Jika memilih metode &quot;Gabungkan&quot;, baris terakhir dengan SKU/Barcode yang sama akan menimpa data sebelumnya.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Preview Table */}
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto max-h-52">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="px-2.5 py-1.5 font-semibold">Sku</th>
                              <th className="px-2.5 py-1.5 font-semibold">Barcode</th>
                              <th className="px-2.5 py-1.5 font-semibold min-w-[160px]">nama_produk</th>
                              <th className="px-2.5 py-1.5 font-semibold">Kategori</th>
                              <th className="px-2.5 py-1.5 font-semibold">satuan</th>
                              <th className="px-2.5 py-1.5 font-semibold text-right">harga_modal</th>
                              <th className="px-2.5 py-1.5 font-semibold text-right">harga_jual</th>
                              <th className="px-2.5 py-1.5 font-semibold text-right">stok_awal</th>
                              <th className="px-2.5 py-1.5 font-semibold text-right">stok_min</th>
                              <th className="px-2.5 py-1.5 font-semibold text-center">status</th>
                              <th className="px-2.5 py-1.5 font-semibold">catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                            {parsedPreview.slice(0, 10).map((row, idx) => {
                              const isSkuDup = duplicateSkusInImport.has((row.sku || '').trim().toUpperCase());
                              const isBarcodeDup = Boolean(row.barcode && duplicateBarcodesInImport.has(row.barcode.trim()));
                              return (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                  <td className="px-2.5 py-1 font-bold text-slate-800 dark:text-slate-200">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span>{row.sku}</span>
                                      {row.isSkuAutoGenerated && (
                                        <span
                                          className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold ${
                                            row.isGapFilled
                                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                          }`}
                                          title={row.isGapFilled ? 'Mengisi nomor urut yang terlewat' : 'SKU berurutan otomatis'}
                                        >
                                          {row.isGapFilled ? 'Auto (Celah)' : 'Auto SKU'}
                                        </span>
                                      )}
                                      {isSkuDup && (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-sans font-bold">
                                          Ganda
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-1 text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center gap-1">
                                      <span>{row.barcode || '-'}</span>
                                      {isBarcodeDup && (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 font-sans font-bold">
                                          Ganda
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-1 font-sans text-slate-900 dark:text-white font-medium">{row.namaBarang}</td>
                                <td className="px-2.5 py-1 font-sans text-slate-600 dark:text-slate-400">{row.kategori}</td>
                                <td className="px-2.5 py-1 text-slate-700 dark:text-slate-300">{row.satuan || 'pcs'}</td>
                                <td className="px-2.5 py-1 text-right text-slate-800 dark:text-slate-200">
                                  {formatRupiah(row.hargaModal || 0)}
                                </td>
                                <td className="px-2.5 py-1 text-right text-slate-800 dark:text-slate-200">
                                  {formatRupiah(row.hargaJual || 0)}
                                </td>
                                <td className="px-2.5 py-1 text-right font-bold text-slate-900 dark:text-white">
                                  {row.stokAwal !== undefined ? row.stokAwal : row.quantitySystem}
                                </td>
                                <td className="px-2.5 py-1 text-right text-slate-600 dark:text-slate-400">
                                  {row.stokMinimum || 0}
                                </td>
                                <td className="px-2.5 py-1 text-center font-sans">
                                  <span
                                    className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      row.status === 'NONAKTIF'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        : row.status === 'ARSIP'
                                        ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    }`}
                                  >
                                    {row.status || 'AKTIF'}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1 font-sans text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                  {row.keterangan || '-'}
                                </td>
                              </tr>
                            );
                          })}
                          </tbody>
                        </table>
                      </div>
                      {parsedPreview.length > 10 && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-right">
                          Menampilkan 10 dari {parsedPreview.length} barang...
                        </p>
                      )}

                      {importMode === 'replace' && (
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                          <label className="flex items-center gap-2 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={confirmReplace}
                              onChange={(e) => setConfirmReplace(e.target.checked)}
                              className="w-4 h-4 text-red-600 rounded"
                            />
                            <span>Saya mengerti: Mode ini akan menghapus semua data barang saat ini dan menimpanya dengan isi Excel ini.</span>
                          </label>
                        </div>
                      )}

                      {importError && (
                        <div className="p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                          {importError}
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={handleExecuteImport}
                          className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                        >
                          {isProcessing ? 'Menyimpan ke Cloud...' : `Terapkan & Simpan ke Cloud (${parsedPreview.length} Barang)`}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
