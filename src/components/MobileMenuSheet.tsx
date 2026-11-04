import React from 'react';
import {
  X,
  Banknote,
  FileSpreadsheet,
  FileText,
  Calendar,
  Layers,
  Plus,
  Calculator,
  Activity,
  Users,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Store,
  Trash2,
} from 'lucide-react';
import { OpnameSession } from '../types/inventory.ts';

interface MobileMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: string;
  session: OpnameSession;
  onOpenFinance: () => void;
  onOpenImportExport: () => void;
  onOpenLaporanHasil: () => void;
  onOpenOpnameDate: () => void;
  onOpenAddItem: () => void;
  onOpenCalculator: () => void;
  onOpenAuditLogs: () => void;
  onOpenUserModal: () => void;
  onOpenDisplayOptions: () => void;
  onResetSession: () => void;
  onClearDemoData?: () => void;
  onSelectTab: (tab: 'opname' | 'laporan' | 'kategori') => void;
  showResetButton: boolean;
}

export const MobileMenuSheet: React.FC<MobileMenuSheetProps> = ({
  isOpen,
  onClose,
  activeUser,
  session,
  onOpenFinance,
  onOpenImportExport,
  onOpenLaporanHasil,
  onOpenOpnameDate,
  onOpenAddItem,
  onOpenCalculator,
  onOpenAuditLogs,
  onOpenUserModal,
  onOpenDisplayOptions,
  onResetSession,
  onClearDemoData,
  onSelectTab,
  showResetButton,
}) => {
  if (!isOpen) return null;

  const isPrivilegedUser = activeUser === 'IYAN' || activeUser === 'HENDRI';
  const isIyan = activeUser === 'IYAN';

  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar on mobile */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Menu & Aksi DR MART
              </h3>
              <p className="text-[11px] text-slate-500">
                Petugas: <strong className="text-slate-800 dark:text-slate-200">{activeUser}</strong> • Tgl: {session.opnameDate || 'Hari ini'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sheet Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* GROUP 1: AKSES KHUSUS KEUANGAN & IMPORT/EXPORT (HIGHLIGHT) */}
          {(isPrivilegedUser || isIyan) && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Akses Otoritas Khusus
              </span>

              {/* Kas, Hutang & Piutang - Khusus IYAN & HENDRI */}
              {isPrivilegedUser && (
                <button
                  type="button"
                  onClick={() => handleAction(onOpenFinance)}
                  className="w-full p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Pencatatan Kas, Hutang & Piutang
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 rounded font-bold">
                          IYAN & HENDRI
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Uang tunai, bank, hutang mitra supplier, saldo santri, piutang marhalah
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                </button>
              )}

              {/* Import / Export Data XLSX - Khusus IYAN */}
              {isIyan && (
                <button
                  type="button"
                  onClick={() => handleAction(onOpenImportExport)}
                  className="w-full p-3 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 border border-sky-200 dark:border-sky-800/80 flex items-center justify-between transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded-xl">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Import / Export Data XLSX
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200 rounded font-bold">
                          Khusus IYAN
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Upload excel inventaris atau unduh data stok & template
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 ml-2" />
                </button>
              )}
            </div>
          )}

          {/* GROUP 2: LAPORAN & SESI OPNAME */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Laporan & Berita Acara
            </span>

            {/* Laporan Hasil Opname Resmi */}
            <button
              type="button"
              onClick={() => handleAction(onOpenLaporanHasil)}
              className="w-full p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/80 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Laporan Hasil Opname Resmi
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Berita acara neraca keuangan mart, rekap fisik, cetak & PDF
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 ml-2" />
            </button>

            {/* Tentukan Tanggal Opname */}
            <button
              type="button"
              onClick={() => handleAction(onOpenOpnameDate)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Tentukan Tanggal & Sesi Opname
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Periode: {session.opnameDate || 'Belum diatur'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Rekap Modal Kategori */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTab('kategori');
              }}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Rekap Modal per Kategori
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Distribusi investasi modal pada tiap kategori produk
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* GROUP 3: OPERASIONAL & PENGATURAN */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Alat & Pengaturan
            </span>

            {/* Tambah Barang Baru */}
            <button
              type="button"
              onClick={() => handleAction(onOpenAddItem)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Tambah Barang Inventaris Baru
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Ganti Petugas / Switch User */}
            <button
              type="button"
              onClick={() => handleAction(onOpenUserModal)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Ganti Petugas / Profil Mart
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Aktif: {activeUser}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Riwayat Scan Real-Time */}
            <button
              type="button"
              onClick={() => handleAction(onOpenAuditLogs)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Aktivitas Scan Real-Time (Log)
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Opsi Tampilan */}
            <button
              type="button"
              onClick={() => handleAction(onOpenDisplayOptions)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Opsi Tampilan Dashboard
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {/* Reset Sesi Opname */}
            {showResetButton && (
              <button
                type="button"
                onClick={() => handleAction(onResetSession)}
                className="w-full p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between transition-colors text-left text-amber-700 dark:text-amber-400"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 rounded-lg">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">
                    Reset Semua Stok Fisik (Sesi Baru)
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
              </button>
            )}

            {/* Hapus Semua Data Demo / Kosongkan Barang */}
            {onClearDemoData && (
              <button
                type="button"
                onClick={() => handleAction(onClearDemoData)}
                className="w-full p-2.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900/50 flex items-center justify-between transition-colors text-left text-red-700 dark:text-red-400"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold block">
                      Hapus Semua Data Demo (0 Barang)
                    </span>
                    <span className="text-[10px] text-red-500/80">
                      Kosongkan seluruh barang untuk persiapan toko riil
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
