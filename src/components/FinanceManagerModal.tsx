import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Coins,
  CreditCard,
  Plus,
  Trash2,
  Building2,
  Users,
  Save,
  X,
  ShieldAlert,
  ArrowRightLeft,
  CheckCircle2,
  Receipt,
  Scale,
} from 'lucide-react';
import { FinanceRecord, PiutangItem, HutangMitraItem, SaldoSantriItem } from '../types/inventory.ts';
import { formatRupiah } from '../utils/excelUtils.ts';

interface FinanceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  finance: FinanceRecord;
  onSaveFinance: (updated: FinanceRecord) => Promise<void>;
  activeUser: string;
}

export const FinanceManagerModal: React.FC<FinanceManagerModalProps> = ({
  isOpen,
  onClose,
  finance,
  onSaveFinance,
  activeUser,
}) => {
  // Access control strictly for IYAN and HENDRI
  const isAuthorized = activeUser === 'IYAN' || activeUser === 'HENDRI';

  const [activeTab, setActiveTab] = useState<'kas' | 'piutang' | 'hutang' | 'ringkasan'>('kas');

  // Kas state
  const [uangTunai, setUangTunai] = useState<number>(finance.kas?.uangTunai || 0);
  const [saldoBank, setSaldoBank] = useState<number>(finance.kas?.saldoBank || 0);
  const [modalAwal, setModalAwal] = useState<number>(finance.kas?.modalAwal || 0);
  const [catatanKas, setCatatanKas] = useState<string>(finance.kas?.catatanKas || '');

  // Piutang state (Nama marhalah & jumlah hutangnya)
  const [piutangList, setPiutangList] = useState<PiutangItem[]>(finance.piutangList || []);
  const [newMarhalahNama, setNewMarhalahNama] = useState('');
  const [newMarhalahJumlah, setNewMarhalahJumlah] = useState<string>('');
  const [newMarhalahKet, setNewMarhalahKet] = useState('');

  // Hutang Mitra state (Nama mitra & jumlah hutangnya)
  const [hutangMitraList, setHutangMitraList] = useState<HutangMitraItem[]>(finance.hutangMitraList || []);
  const [newMitraNama, setNewMitraNama] = useState('');
  const [newMitraJumlah, setNewMitraJumlah] = useState<string>('');
  const [newMitraKet, setNewMitraKet] = useState('');

  // Saldo Santri state (Nama santri & jumlahnya)
  const [saldoSantriList, setSaldoSantriList] = useState<SaldoSantriItem[]>(finance.saldoSantriList || []);
  const [newSantriNama, setNewSantriNama] = useState('');
  const [newSantriJumlah, setNewSantriJumlah] = useState<string>('');
  const [newSantriKet, setNewSantriKet] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && finance) {
      setUangTunai(Number(finance.kas?.uangTunai) || 0);
      setSaldoBank(Number(finance.kas?.saldoBank) || 0);
      setModalAwal(Number(finance.kas?.modalAwal) || 0);
      setCatatanKas(finance.kas?.catatanKas || '');
      setPiutangList(Array.isArray(finance.piutangList) ? finance.piutangList : []);
      setHutangMitraList(Array.isArray(finance.hutangMitraList) ? finance.hutangMitraList : []);
      setSaldoSantriList(Array.isArray(finance.saldoSantriList) ? finance.saldoSantriList : []);
      setSavedSuccess(false);
    }
  }, [isOpen, finance]);

  if (!isOpen) return null;

  // Render unauthorized barrier if user is neither IYAN nor HENDRI
  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-rose-200 dark:border-rose-900/50 shadow-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Akses Terbatas Keuangan Mart
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Fitur pencatatan <strong className="text-slate-800 dark:text-slate-200">Kas, Hutang, dan Piutang</strong> hanya dapat dilihat dan diisi oleh user <strong className="text-blue-600 dark:text-blue-400">IYAN</strong> dan <strong className="text-emerald-600 dark:text-emerald-400">HENDRI</strong>.
            </p>
            <p className="text-[11px] text-slate-500 mt-2">
              User aktif saat ini: <span className="font-semibold">{activeUser}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  // Live calculations
  const totalKas = uangTunai + saldoBank;
  const totalPiutang = piutangList.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
  const totalHutangMitra = hutangMitraList.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
  const totalSaldoSantri = saldoSantriList.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
  const totalHutang = totalHutangMitra + totalSaldoSantri;
  const saldoBersihKeuangan = totalKas + totalPiutang - totalHutang;

  // Add Piutang Handler
  const handleAddPiutang = (e: React.FormEvent) => {
    e.preventDefault();
    const nama = newMarhalahNama.trim();
    const jml = parseFloat(newMarhalahJumlah.replace(/[^0-9]/g, '')) || 0;
    if (!nama || jml <= 0) return;

    const newItem: PiutangItem = {
      id: `piutang_${Date.now()}`,
      namaMarhalah: nama,
      jumlah: jml,
      keterangan: newMarhalahKet.trim(),
    };

    setPiutangList([newItem, ...piutangList]);
    setNewMarhalahNama('');
    setNewMarhalahJumlah('');
    setNewMarhalahKet('');
  };

  const handleDeletePiutang = (id: string) => {
    setPiutangList(piutangList.filter((item) => item.id !== id));
  };

  // Add Hutang Mitra Handler
  const handleAddHutangMitra = (e: React.FormEvent) => {
    e.preventDefault();
    const nama = newMitraNama.trim();
    const jml = parseFloat(newMitraJumlah.replace(/[^0-9]/g, '')) || 0;
    if (!nama || jml <= 0) return;

    const newItem: HutangMitraItem = {
      id: `hutang_mitra_${Date.now()}`,
      namaMitra: nama,
      jumlah: jml,
      keterangan: newMitraKet.trim(),
    };

    setHutangMitraList([newItem, ...hutangMitraList]);
    setNewMitraNama('');
    setNewMitraJumlah('');
    setNewMitraKet('');
  };

  const handleDeleteHutangMitra = (id: string) => {
    setHutangMitraList(hutangMitraList.filter((item) => item.id !== id));
  };

  // Add Saldo Santri Handler
  const handleAddSaldoSantri = (e: React.FormEvent) => {
    e.preventDefault();
    const nama = newSantriNama.trim();
    const jml = parseFloat(newSantriJumlah.replace(/[^0-9]/g, '')) || 0;
    if (!nama || jml <= 0) return;

    const newItem: SaldoSantriItem = {
      id: `saldo_santri_${Date.now()}`,
      namaSantri: nama,
      jumlah: jml,
      keterangan: newSantriKet.trim(),
    };

    setSaldoSantriList([newItem, ...saldoSantriList]);
    setNewSantriNama('');
    setNewSantriJumlah('');
    setNewSantriKet('');
  };

  const handleDeleteSaldoSantri = (id: string) => {
    setSaldoSantriList(saldoSantriList.filter((item) => item.id !== id));
  };

  // Save to Firebase
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      const updated: FinanceRecord = {
        id: 'current',
        kas: {
          uangTunai,
          saldoBank,
          modalAwal,
          catatanKas: catatanKas.trim(),
        },
        piutangList,
        hutangMitraList,
        saldoSantriList,
        lastUpdatedBy: activeUser,
        updatedAt: new Date().toISOString(),
      };
      await onSaveFinance(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Pencatatan Kas, Hutang & Piutang
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Khusus IYAN & HENDRI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pencatatan arus kas riil, piutang marhalah, hutang mitra supplier & saldo santri
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

        {/* Tab Navigation */}
        <div className="px-5 pt-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('kas')}
            className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'kas'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            KAS & Modal Awal
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {formatRupiah(totalKas)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('piutang')}
            className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'piutang'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Piutang Marhalah
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {piutangList.length} • {formatRupiah(totalPiutang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('hutang')}
            className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'hutang'
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Hutang & Saldo Santri
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
              {formatRupiah(totalHutang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ringkasan')}
            className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'ringkasan'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            Ringkasan Neraca
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: KAS */}
          {activeTab === 'kas' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Total Kas Riil (Tunai + Bank)</span>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatRupiah(totalKas)}
                  </div>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl text-emerald-700 dark:text-emerald-300">
                  <Coins className="w-6 h-6" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Uang Tunai */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-500" /> Uang Tunai (Cash Fisik)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Uang cash yang ada di laci kasir, kotak kas mart, atau brankas.
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min={0}
                      value={uangTunai || ''}
                      onChange={(e) => setUangTunai(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="text-right text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(uangTunai)}
                  </div>
                </div>

                {/* Saldo Bank */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-500" /> Saldo Bank / QRIS
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Saldo yang ada di rekening bank operasional mart atau akun e-wallet/QRIS.
                  </p>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min={0}
                      value={saldoBank || ''}
                      onChange={(e) => setSaldoBank(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="text-right text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {formatRupiah(saldoBank)}
                  </div>
                </div>
              </div>

              {/* Nilai Modal Awal */}
              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40 space-y-2">
                <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" /> Nilai Modal Awal Toko
                </label>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Modal pokok awal yang diserahkan pengelola/pesantren untuk operasional mart. Digunakan sebagai acuan perhitungan pertumbuhan kekayaan/laba akumulasi mart.
                </p>
                <div className="relative max-w-sm">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min={0}
                    value={modalAwal || ''}
                    onChange={(e) => setModalAwal(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  Modal Awal: {formatRupiah(modalAwal)}
                </div>
              </div>

              {/* Catatan Kas */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Kas Mart
                </label>
                <input
                  type="text"
                  value={catatanKas}
                  onChange={(e) => setCatatanKas(e.target.value)}
                  placeholder="Contoh: Termasuk uang kembalian receh Rp 150.000 di kasir 1"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PIUTANG (NAMA MARHALAH DAN JUMLAH HUTANGNYA) */}
          {activeTab === 'piutang' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Total Piutang Marhalah (Hutang ke Mart)</span>
                  <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-0.5">
                    {formatRupiah(totalPiutang)}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {piutangList.length} data marhalah terdaftar
                  </span>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-700 dark:text-blue-300">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>

              {/* Form Tambah Piutang Marhalah */}
              <form onSubmit={handleAddPiutang} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" /> Tambah Catatan Piutang Marhalah
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Nama Marhalah <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Marhalah 1 (Wustho)"
                      value={newMarhalahNama}
                      onChange={(e) => setNewMarhalahNama(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Jumlah Hutang (Rp) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="0"
                      value={newMarhalahJumlah}
                      onChange={(e) => setNewMarhalahJumlah(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Keterangan / Keperluan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Bon snack santri"
                      value={newMarhalahKet}
                      onChange={(e) => setNewMarhalahKet(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambahkan Baris Piutang
                  </button>
                </div>
              </form>

              {/* Daftar Piutang */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Marhalah</th>
                      <th className="py-2.5 px-3 text-right">Jumlah Hutang</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {piutangList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada catatan piutang marhalah. Gunakan form di atas untuk menambahkan.
                        </td>
                      </tr>
                    ) : (
                      piutangList.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-100">
                            {item.namaMarhalah}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            {formatRupiah(item.jumlah)}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">{item.keterangan || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePiutang(item.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {piutangList.length > 0 && (
                    <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={2} className="py-2 px-3 text-slate-700 dark:text-slate-300">Total Piutang Marhalah</td>
                        <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400 font-mono text-sm">
                          {formatRupiah(totalPiutang)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: HUTANG (MITRA & SALDO SANTRI) */}
          {activeTab === 'hutang' && (
            <div className="space-y-6">
              {/* Grand Total Kewajiban */}
              <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-rose-800 dark:text-rose-300">Total Kewajiban Mart (Hutang Mitra + Saldo Santri)</span>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-0.5">
                    {formatRupiah(totalHutang)}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Mitra: {formatRupiah(totalHutangMitra)} • Saldo Santri: {formatRupiah(totalSaldoSantri)}
                  </span>
                </div>
                <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>

              {/* Bagian 1: Hutang Mitra (Nama mitra & jumlah hutangnya) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
                    <Building2 className="w-4 h-4 text-rose-600" />
                    1. Hutang Mitra / Supplier
                  </h4>
                  <span className="text-xs font-bold text-rose-600 font-mono">
                    Subtotal: {formatRupiah(totalHutangMitra)}
                  </span>
                </div>

                {/* Form Tambah Hutang Mitra */}
                <form onSubmit={handleAddHutangMitra} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nama Mitra / Supplier *"
                      value={newMitraNama}
                      onChange={(e) => setNewMitraNama(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="Jumlah Hutang (Rp) *"
                      value={newMitraJumlah}
                      onChange={(e) => setNewMitraJumlah(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Keterangan / Faktur"
                        value={newMitraKet}
                        onChange={(e) => setNewMitraKet(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                </form>

                {/* Tabel Hutang Mitra */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-2 px-3">No</th>
                        <th className="py-2 px-3">Nama Mitra</th>
                        <th className="py-2 px-3 text-right">Jumlah Hutang</th>
                        <th className="py-2 px-3">Keterangan</th>
                        <th className="py-2 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {hutangMitraList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">
                            Tidak ada hutang mitra/supplier.
                          </td>
                        </tr>
                      ) : (
                        hutangMitraList.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-1.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-1.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{item.namaMitra}</td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold text-rose-600">{formatRupiah(item.jumlah)}</td>
                            <td className="py-1.5 px-3 text-slate-500 text-[11px]">{item.keterangan || '-'}</td>
                            <td className="py-1.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteHutangMitra(item.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bagian 2: Saldo Santri (Nama santri & jumlahnya) */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
                    <Users className="w-4 h-4 text-amber-600" />
                    2. Saldo Santri (Titipan / Tabungan)
                  </h4>
                  <span className="text-xs font-bold text-amber-600 font-mono">
                    Subtotal: {formatRupiah(totalSaldoSantri)}
                  </span>
                </div>

                {/* Form Tambah Saldo Santri */}
                <form onSubmit={handleAddSaldoSantri} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nama Santri / Kamar *"
                      value={newSantriNama}
                      onChange={(e) => setNewSantriNama(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="Jumlah Saldo (Rp) *"
                      value={newSantriJumlah}
                      onChange={(e) => setNewSantriJumlah(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Keterangan / Kelas"
                        value={newSantriKet}
                        onChange={(e) => setNewSantriKet(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                      >
                        Tambah
                      </button>
                    </div>
                  </div>
                </form>

                {/* Tabel Saldo Santri */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-2 px-3">No</th>
                        <th className="py-2 px-3">Nama Santri</th>
                        <th className="py-2 px-3 text-right">Jumlah Saldo</th>
                        <th className="py-2 px-3">Keterangan</th>
                        <th className="py-2 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {saldoSantriList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">
                            Tidak ada saldo titipan santri.
                          </td>
                        </tr>
                      ) : (
                        saldoSantriList.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-1.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-1.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{item.namaSantri}</td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold text-amber-600">{formatRupiah(item.jumlah)}</td>
                            <td className="py-1.5 px-3 text-slate-500 text-[11px]">{item.keterangan || '-'}</td>
                            <td className="py-1.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteSaldoSantri(item.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RINGKASAN NERACA */}
          {activeTab === 'ringkasan' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Total Kas (Tunai+Bank)</span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                    {formatRupiah(totalKas)}
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/40">
                  <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">Total Piutang Marhalah</span>
                  <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">
                    {formatRupiah(totalPiutang)}
                  </div>
                </div>

                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40">
                  <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">Total Hutang Mart</span>
                  <div className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1">
                    {formatRupiah(totalHutang)}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total Aset Keuangan Lancar (Kas + Piutang)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatRupiah(totalKas + totalPiutang)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total Kewajiban (Hutang Mitra + Santri)</span>
                  <span className="font-bold text-rose-600">- {formatRupiah(totalHutang)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-800 dark:text-slate-100">Posisi Likuiditas Bersih Keuangan</span>
                  <span className={`font-black font-mono text-base ${saldoBersihKeuangan >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatRupiah(saldoBersihKeuangan)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Data kas, hutang, dan piutang ini secara otomatis terintegrasi ke <strong>Laporan Hasil Opname</strong>, digabungkan dengan total nilai modal stok fisik barang untuk menghitung <strong>Total Nilai Bersih Mart (Net Equity)</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2 text-xs">
            {savedSuccess ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Berhasil disimpan ke Firebase Cloud!
              </span>
            ) : (
              <span className="text-slate-500 text-[11px]">
                Otorisasi aktif: <strong className="text-slate-700 dark:text-slate-300">{activeUser}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan ke Cloud'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
