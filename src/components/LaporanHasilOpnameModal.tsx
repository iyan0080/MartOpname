import React, { useRef } from 'react';
import {
  Printer,
  FileSpreadsheet,
  X,
  Building,
  CheckCircle2,
  Calendar,
  Users,
  AlertTriangle,
  Scale,
  Banknote,
  FileText,
  BadgePercent,
  Receipt,
  Layers,
  Download,
  TrendingDown,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryStats,
  OpnameSession,
  FinanceRecord,
} from '../types/inventory.ts';
import { formatRupiah, exportLaporanHasilOpnameKomprehensif } from '../utils/excelUtils.ts';
import { generateBeritaAcaraPDF } from '../utils/pdfUtils.ts';

interface LaporanHasilOpnameModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  stats: InventoryStats | null;
  session: OpnameSession;
  finance: FinanceRecord;
  activeUser: string;
}

export const LaporanHasilOpnameModal: React.FC<LaporanHasilOpnameModalProps> = ({
  isOpen,
  onClose,
  items,
  stats,
  session,
  finance,
  activeUser,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Financial Calculations
  const uangTunai = Number(finance.kas?.uangTunai) || 0;
  const saldoBank = Number(finance.kas?.saldoBank) || 0;
  const totalKas = uangTunai + saldoBank;
  const modalAwal = Number(finance.kas?.modalAwal) || 0;

  const totalPiutang = (finance.piutangList || []).reduce((sum, p) => sum + (Number(p.jumlah) || 0), 0);
  const totalHutangMitra = (finance.hutangMitraList || []).reduce((sum, h) => sum + (Number(h.jumlah) || 0), 0);
  const totalSaldoSantri = (finance.saldoSantriList || []).reduce((sum, s) => sum + (Number(s.jumlah) || 0), 0);
  const totalKewajiban = totalHutangMitra + totalSaldoSantri;
  const totalPengeluaranOperasional = (finance.pengeluaranOperasionalList || []).reduce(
    (sum, op) => sum + (Number(op.jumlah) || 0),
    0
  );

  const totalAsetFisikBarang = stats?.totalModalInvestasi || 0;
  const totalAsetSistemBarang = stats?.totalModalSystem || 0;
  const selisihModalBarang = stats?.selisihModal || 0;

  // Net Asset calculation
  const totalAsetRiil = totalAsetFisikBarang + totalKas + totalPiutang;
  const nilaiBersihMart = totalAsetRiil - totalKewajiban;
  const pertumbuhanModal = nilaiBersihMart - modalAwal;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export XLSX function
  const handleExportXLSX = () => {
    exportLaporanHasilOpnameKomprehensif(items, stats, session, finance);
  };

  // Download Berita Acara PDF menggunakan jsPDF library
  const handleDownloadPDF = () => {
    generateBeritaAcaraPDF(session, stats, finance, items);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Modal Toolbar (Hidden during print) */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/70 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Laporan Hasil Stok Opname & Audit Mart
              </h3>
              <p className="text-[11px] text-slate-500">
                Periode: {session.opnameDate || 'Belum diatur'} • PIC: {session.picIyan || 'IYAN'} & {session.picHendri || 'HENDRI'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Tombol Cetak Dokumen PDF Resmi */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
              title="Download Berita Acara Resmi Format PDF (A4) untuk Arsip Fisik Toko"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="sm:hidden">PDF</span>
              <span className="hidden sm:inline">Cetak Berita Acara (PDF)</span>
            </button>
            <button
              type="button"
              onClick={handleExportXLSX}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
              title="Download Data Lengkap Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="sm:hidden">Excel</span>
              <span className="hidden sm:inline">Unduh Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
              title="Print Langsung ke Printer Browser"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div ref={printAreaRef} className="p-3.5 sm:p-8 overflow-y-auto space-y-4 sm:space-y-6 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 print:p-0 print:overflow-visible">
          {/* Header Dokumen Laporan Resmi */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Building className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 dark:text-white">
                DR MART - SISTEM AUDIT INVENTARIS TOKO
              </h1>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300">
              BERITA ACARA & LAPORAN HASIL STOK OPNAME
            </h2>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Tanggal Opname: <strong>{session.opnameDate || new Date().toISOString().split('T')[0]}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                Sesi: <strong>{session.title || 'Stok Opname Mart Santri'}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                Tim Auditor Khusus: <strong>{session.picIyan || 'IYAN'} & {session.picHendri || 'HENDRI'}</strong>
              </span>
            </div>
          </div>

          {/* 1. Executive Summary - Posisi Neraca & Kekayaan Bersih Mart */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600" />
              1. Posisi Neraca & Kekayaan Bersih Mart (Net Equity)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Card 1: Nilai Barang Fisik */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Aset Stok Fisik Barang</span>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {formatRupiah(totalAsetFisikBarang)}
                </div>
                <span className="text-[10px] text-slate-400">
                  {stats?.totalPhysicalQty || 0} unit dari {stats?.totalItems || items.length} SKU
                </span>
              </div>

              {/* Card 2: Kas Riil */}
              <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Total Kas (Tunai+Bank)</span>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formatRupiah(totalKas)}
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Tunai: {formatRupiah(uangTunai)} | Bank: {formatRupiah(saldoBank)}
                </span>
              </div>

              {/* Card 3: Piutang Marhalah */}
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40">
                <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">Total Piutang Marhalah</span>
                <div className="text-lg font-black text-blue-700 dark:text-blue-400 mt-0.5">
                  {formatRupiah(totalPiutang)}
                </div>
                <span className="text-[10px] text-blue-600 dark:text-blue-400">
                  {(finance.piutangList || []).length} entitas marhalah
                </span>
              </div>

              {/* Card 4: Total Kewajiban */}
              <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/40">
                <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">Total Kewajiban / Hutang</span>
                <div className="text-lg font-black text-rose-700 dark:text-rose-400 mt-0.5">
                  {formatRupiah(totalKewajiban)}
                </div>
                <span className="text-[10px] text-rose-600 dark:text-rose-400">
                  Mitra: {formatRupiah(totalHutangMitra)} | Santri: {formatRupiah(totalSaldoSantri)}
                </span>
              </div>

              {/* Card 5: Pengeluaran Operasional */}
              <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40">
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Beban Operasional Toko</span>
                <div className="text-lg font-black text-amber-700 dark:text-amber-400 mt-0.5">
                  {formatRupiah(totalPengeluaranOperasional)}
                </div>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  {(finance.pengeluaranOperasionalList || []).length} pengeluaran tercatat
                </span>
              </div>
            </div>

            {/* Neraca Besar */}
            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-medium">TOTAL ASET RIIL MART</span>
                  <div className="text-xl font-black text-blue-400 mt-0.5">
                    {formatRupiah(totalAsetRiil)}
                  </div>
                  <span className="text-[10px] text-slate-400">Stok Fisik + Kas Riil + Piutang Marhalah</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-medium">TOTAL KEWAJIBAN (HUTANG)</span>
                  <div className="text-xl font-black text-rose-400 mt-0.5">
                    {formatRupiah(totalKewajiban)}
                  </div>
                  <span className="text-[10px] text-slate-400">Hutang Mitra Supplier + Saldo Santri</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-medium">NILAI BERSIH MART (NET EQUITY)</span>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    {formatRupiah(nilaiBersihMart)}
                  </div>
                  <span className="text-[10px] text-slate-400">Kekayaan Bersih Toko Mart Saat Ini</span>
                </div>
              </div>

              {/* Status Pertumbuhan Modal Awal & Pengeluaran Operasional */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Modal Awal Toko:</span>
                  <strong className="text-white font-mono">{formatRupiah(modalAwal)}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Beban Operasional:</span>
                  <strong className="text-amber-400 font-mono">{formatRupiah(totalPengeluaranOperasional)}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Surplus / Pertumbuhan Modal:</span>
                  <span
                    className={`font-black font-mono px-2 py-0.5 rounded text-xs ${
                      pertumbuhanModal >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {pertumbuhanModal >= 0 ? '+' : ''}{formatRupiah(pertumbuhanModal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Audit Inventaris Stok Fisik vs Sistem */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              2. Ringkasan Audit Stok Fisik vs Sistem
            </h3>

            {/* Mobile View: Clean Vertical Cards (sm:hidden, no horizontal scroll) */}
            <div className="sm:hidden space-y-2.5">
              {/* Card 1: Kuantitas Barang */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100">Total Kuantitas Fisik</span>
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                    {stats?.totalPhysicalQty || 0} pcs
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Sistem: {stats?.totalSystemQty || 0} pcs</span>
                  <span className={`font-mono font-bold ${(stats?.totalSelisihQty || 0) < 0 ? 'text-rose-600' : (stats?.totalSelisihQty || 0) > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    Selisih: {(stats?.totalSelisihQty || 0) > 0 ? '+' : ''}{stats?.totalSelisihQty || 0}
                  </span>
                </div>
              </div>

              {/* Card 2: Nilai Modal Investasi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100">Total Nilai Modal Fisik</span>
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                    {formatRupiah(totalAsetFisikBarang)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Sistem: {formatRupiah(totalAsetSistemBarang)}</span>
                  <span className={`font-mono font-bold ${selisihModalBarang < 0 ? 'text-rose-600' : selisihModalBarang > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {selisihModalBarang > 0 ? '+' : ''}{formatRupiah(selisihModalBarang)}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop View: Full Table (hidden sm:block) */}
            <div className="hidden sm:block border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Indikator Opname</th>
                    <th className="py-2.5 px-3 text-right">Data Fisik</th>
                    <th className="py-2.5 px-3 text-right">Data Sistem (Buku)</th>
                    <th className="py-2.5 px-3 text-right">Selisih</th>
                    <th className="py-2.5 px-3">Status Evaluasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  <tr>
                    <td className="py-2 px-3 font-semibold">Total Kuantitas Barang (Pcs)</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {stats?.totalPhysicalQty || 0}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      {stats?.totalSystemQty || 0}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${(stats?.totalSelisihQty || 0) < 0 ? 'text-rose-600' : (stats?.totalSelisihQty || 0) > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {(stats?.totalSelisihQty || 0) > 0 ? '+' : ''}{stats?.totalSelisihQty || 0}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-500">
                      {(stats?.totalSelisihQty || 0) === 0 ? 'Sempurna Seimbang' : (stats?.totalSelisihQty || 0) < 0 ? 'Kuantitas fisik kurang dari sistem' : 'Kuantitas fisik berlebih'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold">Total Nilai Modal Investasi (Rp)</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatRupiah(totalAsetFisikBarang)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      {formatRupiah(totalAsetSistemBarang)}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${selisihModalBarang < 0 ? 'text-rose-600' : selisihModalBarang > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {selisihModalBarang > 0 ? '+' : ''}{formatRupiah(selisihModalBarang)}
                    </td>
                    <td className="py-2 px-3 text-[11px]">
                      {selisihModalBarang < 0 ? (
                        <span className="text-rose-600 font-semibold">Defisit Nilai Barang Modal</span>
                      ) : selisihModalBarang > 0 ? (
                        <span className="text-emerald-600 font-semibold">Surplus Nilai Barang Modal</span>
                      ) : (
                        <span className="text-slate-500">Sesuai Buku 100%</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Rekap Kategori */}
            {stats && stats.categorySummary && stats.categorySummary.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Rekapitulasi Fisik Berdasarkan Kategori:
                </span>
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {stats.categorySummary.map((cat) => (
                    <div key={cat.kategori} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{cat.kategori}</div>
                      <div className="text-[11px] text-slate-500">{cat.totalQty} unit • {cat.itemCount} SKU</div>
                      <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                        {formatRupiah(cat.totalModal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Rincian Keuangan Kas, Hutang, dan Piutang */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              3. Rincian Keuangan (Kas, Hutang Mitra, Saldo Santri & Piutang Marhalah)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kolom Kiri: Piutang Marhalah */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    A. Daftar Piutang (Hutang Marhalah ke Mart)
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-600">{formatRupiah(totalPiutang)}</span>
                </div>
                <table className="w-full text-[11px] text-left">
                  <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-1">Nama Marhalah</th>
                      <th className="py-1 text-right">Jumlah (Rp)</th>
                      <th className="py-1 pl-2">Ket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(finance.piutangList || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-slate-400">Tidak ada piutang marhalah</td>
                      </tr>
                    ) : (
                      finance.piutangList.map((p) => (
                        <tr key={p.id}>
                          <td className="py-1 font-medium">{p.namaMarhalah}</td>
                          <td className="py-1 text-right font-mono font-semibold text-blue-600">{formatRupiah(p.jumlah)}</td>
                          <td className="py-1 pl-2 text-slate-500 truncate max-w-[100px]">{p.keterangan || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Kolom Kanan: Hutang Mitra & Saldo Santri */}
              <div className="space-y-3">
                {/* Hutang Mitra */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      B. Hutang Mitra / Supplier
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-600">{formatRupiah(totalHutangMitra)}</span>
                  </div>
                  <table className="w-full text-[11px] text-left">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(finance.hutangMitraList || []).length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-2 text-center text-slate-400">Tidak ada hutang mitra</td>
                        </tr>
                      ) : (
                        finance.hutangMitraList.map((h) => (
                          <tr key={h.id}>
                            <td className="py-1 font-medium">{h.namaMitra}</td>
                            <td className="py-1 text-right font-mono font-semibold text-rose-600">{formatRupiah(h.jumlah)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Saldo Santri */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      C. Saldo Tabungan / Titipan Santri
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-600">{formatRupiah(totalSaldoSantri)}</span>
                  </div>
                  <table className="w-full text-[11px] text-left">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(finance.saldoSantriList || []).length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-2 text-center text-slate-400">Tidak ada saldo santri</td>
                        </tr>
                      ) : (
                        finance.saldoSantriList.map((s) => (
                          <tr key={s.id}>
                            <td className="py-1 font-medium">{s.namaSantri}</td>
                            <td className="py-1 text-right font-mono font-semibold text-amber-600">{formatRupiah(s.jumlah)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Rincian Pengeluaran Operasional DR MART */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                4. Rincian Pengeluaran Operasional DR MART
              </h3>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                Total: {formatRupiah(totalPengeluaranOperasional)}
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/40">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-3">No</th>
                    <th className="py-2 px-3">Tanggal</th>
                    <th className="py-2 px-3">Kategori</th>
                    <th className="py-2 px-3">Uraian Belanja</th>
                    <th className="py-2 px-3 text-center">Metode</th>
                    <th className="py-2 px-3 text-right">Nominal (Rp)</th>
                    <th className="py-2 px-3">No. Nota / PJ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(finance.pengeluaranOperasionalList || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 text-xs">
                        Belum ada catatan pengeluaran operasional toko yang dibukukan.
                      </td>
                    </tr>
                  ) : (
                    (finance.pengeluaranOperasionalList || []).map((op, idx) => (
                      <tr key={op.id}>
                        <td className="py-1.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{op.tanggal}</td>
                        <td className="py-1.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                            {op.kategori}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-medium text-slate-800 dark:text-slate-100">{op.namaPengeluaran}</td>
                        <td className="py-1.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${op.metodeBayar === 'tunai' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'}`}>
                            {op.metodeBayar === 'tunai' ? 'Tunai Laci' : 'Bank'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {formatRupiah(op.jumlah)}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 text-[11px]">
                          {op.keterangan || '-'} {op.pj ? `(${op.pj})` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(finance.pengeluaranOperasionalList || []).length > 0 && (
                  <tfoot className="bg-slate-100/80 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <tr>
                      <td colSpan={5} className="py-2 px-3 text-slate-700 dark:text-slate-300">Total Pengeluaran Operasional</td>
                      <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400 font-mono text-xs">
                        {formatRupiah(totalPengeluaranOperasional)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Lembar Tanda Tangan & Pengesahan Berita Acara */}
          <div className="pt-6 border-t-2 border-slate-300 dark:border-slate-700 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 italic text-center">
              Demikian Berita Acara Hasil Stok Opname dan Audit Keuangan Mart ini disusun dan diverifikasi dengan sebenar-benarnya berdasarkan hasil pemeriksaan fisik barang, saldo kas riil, piutang marhalah, dan catatan kewajiban hutang.
            </p>

            <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs">
              <div>
                <p className="text-slate-500 mb-16">Pemeriksa I (Auditor Stok),</p>
                <div className="border-b border-slate-800 dark:border-slate-200 mx-4"></div>
                <p className="font-bold text-slate-900 dark:text-slate-100 mt-1.5 uppercase">
                  ( {session.picIyan || 'IYAN'} )
                </p>
                <p className="text-[10px] text-slate-500">Staf Mart & Auditor</p>
              </div>

              <div>
                <p className="text-slate-500 mb-16">Pemeriksa II (Keuangan & Kas),</p>
                <div className="border-b border-slate-800 dark:border-slate-200 mx-4"></div>
                <p className="font-bold text-slate-900 dark:text-slate-100 mt-1.5 uppercase">
                  ( {session.picHendri || 'HENDRI'} )
                </p>
                <p className="text-[10px] text-slate-500">Staf Keuangan Mart</p>
              </div>

              <div>
                <p className="text-slate-500 mb-16">Mengetahui & Menyetujui,</p>
                <div className="border-b border-slate-800 dark:border-slate-200 mx-4"></div>
                <p className="font-bold text-slate-900 dark:text-slate-100 mt-1.5 uppercase">
                  ( Pengelola Pondok / Mart )
                </p>
                <p className="text-[10px] text-slate-500">Pimpinan Pesantren</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
