import React, { useState, useMemo } from 'react';
import {
  Store,
  Lock,
  Unlock,
  ArrowRight,
  UserPlus,
  Search,
  Calendar,
  Package,
  Cloud,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import { MartUser, OpnameSession } from '../types/inventory.ts';
import { ThemeMode } from '../utils/useTheme.ts';
import { ThemeToggle } from './ThemeToggle.tsx';

interface AccountSelectionLandingProps {
  users: MartUser[];
  lastSelectedUser: string;
  iyanUnlocked: boolean;
  session: OpnameSession;
  totalItemsCount: number;
  countedItemsCount: number;
  isLoadingData: boolean;
  isCloudConnected: boolean;
  themeMode: ThemeMode;
  isDark: boolean;
  onThemeChange: (mode: ThemeMode) => void;
  onSelectAccount: (userName: string) => void;
  onAddUser: (name: string, role: string, color?: string) => Promise<boolean>;
}

const AVATAR_COLORS = [
  '#004ac6',
  '#059669',
  '#7c3aed',
  '#ea580c',
  '#db2777',
  '#0d9488',
  '#4f46e5',
  '#ca8a04',
];

const ROLE_OPTIONS = [
  'Petugas Opname',
  'Checker Gudang',
  'Staff Display Rak',
  'Kasir & Inventory',
  'Supervisor Toko',
  'Admin Stok',
];

export const AccountSelectionLanding: React.FC<AccountSelectionLandingProps> = ({
  users,
  lastSelectedUser,
  iyanUnlocked,
  session,
  totalItemsCount,
  countedItemsCount,
  isLoadingData,
  isCloudConnected,
  themeMode,
  isDark,
  onThemeChange,
  onSelectAccount,
  onAddUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Petugas Opname');
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const handleCreateAndEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim().toUpperCase();
    if (!cleanName) {
      setFormError('Nama petugas wajib diisi.');
      return;
    }
    if (cleanName.length < 2) {
      setFormError('Nama petugas minimal 2 karakter.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    const created = await onAddUser(cleanName, newRole, newColor);
    setIsSubmitting(false);

    if (created) {
      setNewName('');
      setNewRole('Petugas Opname');
      setIsAddOpen(false);
    } else {
      setFormError('Nama petugas sudah terdaftar atau gagal menyimpan ke Cloud.');
    }
  };

  const progressPct =
    totalItemsCount > 0 ? Math.min(100, Math.round((countedItemsCount / totalItemsCount) * 100)) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] dark:bg-slate-950 text-[#131b2e] dark:text-slate-100 transition-colors duration-150">
      {/* Clean Top Bar (3-zone restraint: Brand mark — Context info — Theme toggle) */}
      <header className="shrink-0 h-14 px-4 sm:px-6 lg:px-10 border-b border-[#c3c6d7]/35 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-4 pt-safe">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#004ac6] dark:bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-[#131b2e] dark:text-white whitespace-nowrap shrink-0">
            DR MART
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#434655] dark:text-slate-400 whitespace-nowrap">
          <span>Sistem Stok Opname &amp; Audit Inventaris</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{session.opnameDate}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle themeMode={themeMode} isDark={isDark} onThemeChange={onThemeChange} />
        </div>
      </header>

      {/* Main Centered Landing Stage */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* Left Column: Clear Context, Session Info & Role Summary */}
          <section className="lg:col-span-5 flex flex-col gap-5">
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[#004ac6] dark:text-blue-400 tracking-wide">
                Portal Akses Tim Opname
              </p>
              <h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] dark:text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Pilih Akun Petugas untuk Memulai Opname
              </h1>
              <p className="text-[13px] sm:text-sm text-[#434655] dark:text-slate-300 leading-relaxed">
                Setiap pemindaian barcode, kode QR, hitungan fisik dus/eceran, dan log audit dicatat langsung atas nama akun yang Anda pilih ke Firebase Cloud.
              </p>
            </div>

            {/* Real-Time Session Overview Card (Flat 1px hairline border, tabular figures) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#c3c6d7]/50 dark:border-slate-800 divide-y divide-[#eaedff] dark:divide-slate-800">
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-[#434655] dark:text-slate-400">
                  <Calendar className="w-4 h-4 text-[#004ac6] dark:text-blue-400 shrink-0" />
                  <span>Periode Sesi</span>
                </div>
                <div className="text-right min-w-0">
                  <span className="text-xs font-bold text-[#131b2e] dark:text-white font-mono block truncate">
                    {session.opnameDate}
                  </span>
                  <span className="text-[11px] text-[#434655] dark:text-slate-400 block truncate max-w-[180px]">
                    {session.title}
                  </span>
                </div>
              </div>

              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-[#434655] dark:text-slate-400">
                  <Package className="w-4 h-4 text-[#004ac6] dark:text-blue-400 shrink-0" />
                  <span>Katalog Barang Cloud</span>
                </div>
                <div className="text-right font-mono tabular-nums">
                  {isLoadingData ? (
                    <span className="text-xs text-[#737686] dark:text-slate-500">Memuat data...</span>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-[#131b2e] dark:text-white block">
                        {totalItemsCount.toLocaleString('id-ID')} SKU
                      </span>
                      <span className="text-[11px] text-[#434655] dark:text-slate-400 block">
                        {countedItemsCount.toLocaleString('id-ID')} terhitung ({progressPct}%)
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-[#434655] dark:text-slate-400">
                  <Cloud className="w-4 h-4 text-[#006243] dark:text-emerald-400 shrink-0" />
                  <span>Sinkronisasi Database</span>
                </div>
                <span className="text-xs font-semibold text-[#006243] dark:text-emerald-400">
                  {isCloudConnected ? 'Firebase Cloud Aktif' : 'Menghubungkan...'}
                </span>
              </div>
            </div>

            {/* Hak Akses Singkat */}
            <div className="hidden lg:block space-y-2 pt-1 text-xs text-[#434655] dark:text-slate-400">
              <p className="font-semibold text-[#131b2e] dark:text-slate-200">
                Ketentuan Hak Akses Akun:
              </p>
              <div className="space-y-1.5 leading-relaxed">
                <p>
                  <strong className="text-[#131b2e] dark:text-white">IYAN</strong> — Akses penuh, Export &amp; Import XLSX, serta Keuangan (dilindungi kata sandi).
                </p>
                <p>
                  <strong className="text-[#131b2e] dark:text-white">HENDRI</strong> — Stok opname fisik, audit laporan, dan pencatatan Keuangan &amp; Operasional.
                </p>
                <p>
                  <strong className="text-[#131b2e] dark:text-white">Petugas Lainnya</strong> — Pencarian barang, scan kamera Barcode/QR, dan hitung fisik stok.
                </p>
              </div>
            </div>
          </section>

          {/* Right Column: Interactive Account Selector Grid */}
          <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-[#c3c6d7]/50 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
            {/* Toolbar: Header + Search + Add Staff Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#131b2e] dark:text-white">
                  Daftar Akun Petugas ({users.length})
                </h2>
                <p className="text-xs text-[#434655] dark:text-slate-400 mt-0.5">
                  Ketuk salah satu akun untuk langsung masuk ke dashboard opname
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddOpen((prev) => !prev);
                  setFormError(null);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#f2f3ff] dark:bg-slate-800 hover:bg-[#e2e7ff] dark:hover:bg-slate-700 text-[#004ac6] dark:text-blue-400 transition-colors whitespace-nowrap shrink-0"
              >
                {isAddOpen ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Tutup Form</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Petugas Baru</span>
                  </>
                )}
              </button>
            </div>

            {/* Inline Registration Panel (when toggled) */}
            {isAddOpen && (
              <form
                onSubmit={handleCreateAndEnter}
                className="p-4 rounded-xl bg-[#f2f3ff] dark:bg-slate-800/70 border border-[#c3c6d7]/50 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#131b2e] dark:text-white">
                    Daftarkan Petugas Opname Baru
                  </h3>
                  <span className="text-[11px] text-[#434655] dark:text-slate-400">
                    Tersimpan otomatis ke Cloud
                  </span>
                </div>

                {formError && (
                  <p className="text-xs text-[#ba1a1a] dark:text-red-300 bg-[#ffdad6]/70 dark:bg-red-950/60 px-3 py-2 rounded-lg">
                    {formError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#434655] dark:text-slate-300 mb-1">
                      Nama Petugas
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value.toUpperCase())}
                      placeholder="Contoh: BUDI"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#c3c6d7]/70 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-white font-bold uppercase focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#434655] dark:text-slate-300 mb-1">
                      Jabatan / Peran
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-[#c3c6d7]/70 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
                    >
                      {ROLE_OPTIONS.map((roleOpt) => (
                        <option key={roleOpt} value={roleOpt}>
                          {roleOpt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#434655] dark:text-slate-300">
                      Warna Avatar:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {AVATAR_COLORS.map((colorHex) => (
                        <button
                          key={colorHex}
                          type="button"
                          onClick={() => setNewColor(colorHex)}
                          aria-label={`Pilih warna ${colorHex}`}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newColor === colorHex
                              ? 'ring-2 ring-offset-2 ring-[#004ac6] dark:ring-blue-400 scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: colorHex }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !newName.trim()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#004ac6] hover:bg-[#003ea8] disabled:opacity-50 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Masuk'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Quick Search if many staff members */}
            {users.length > 4 && (
              <div className="relative">
                <Search className="w-4 h-4 text-[#737686] dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama atau jabatan petugas..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-[#f2f3ff] dark:bg-slate-800 border border-[#c3c6d7]/40 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-white placeholder:text-[#737686] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737686] hover:text-[#131b2e] dark:hover:text-white text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Account Cards Grid */}
            {filteredUsers.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#434655] dark:text-slate-400">
                Tidak ada petugas yang cocok dengan pencarian &ldquo;{searchTerm}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredUsers.map((user) => {
                  const isIyan = user.name === 'IYAN';
                  const isHendri = user.name === 'HENDRI';
                  const isLastUsed = lastSelectedUser === user.name;
                  const roleLabel = isIyan
                    ? 'Leader Opname · Akses Penuh'
                    : isHendri
                    ? `${user.role || 'Staff Gudang'} · Keuangan`
                    : user.role || 'Petugas Opname';

                  return (
                    <button
                      key={user.id || user.name}
                      type="button"
                      onClick={() => onSelectAccount(user.name)}
                      className={`group w-full p-3.5 rounded-xl border text-left transition-all duration-150 active:scale-[0.98] flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004ac6] ${
                        isLastUsed
                          ? 'bg-[#f2f3ff]/80 dark:bg-blue-950/25 border-[#004ac6]/50 dark:border-blue-500/60 hover:border-[#004ac6] dark:hover:border-blue-400'
                          : 'bg-white dark:bg-slate-800/60 border-[#c3c6d7]/55 dark:border-slate-700/80 hover:border-[#004ac6] dark:hover:border-blue-500 hover:bg-[#f2f3ff]/50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-2xs"
                          style={{ backgroundColor: user.color || '#004ac6' }}
                        >
                          {user.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-bold text-[#131b2e] dark:text-white truncate">
                              {user.name}
                            </span>
                            {isIyan && (
                              <ShieldCheck
                                className="w-3.5 h-3.5 text-[#004ac6] dark:text-blue-400 shrink-0"
                                aria-label="Akun Admin Terproteksi"
                              />
                            )}
                          </div>
                          <p className="text-[11px] text-[#434655] dark:text-slate-400 truncate mt-0.5">
                            {roleLabel}
                          </p>
                          {isLastUsed && (
                            <p className="text-[10px] font-semibold text-[#004ac6] dark:text-blue-400 mt-0.5">
                              Terakhir digunakan
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[#434655] dark:text-slate-300 group-hover:text-[#004ac6] dark:group-hover:text-blue-400 transition-colors">
                        {isIyan ? (
                          iyanUnlocked ? (
                            <Unlock className="w-4 h-4 text-[#006243] dark:text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          )
                        ) : (
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="shrink-0 py-3 px-4 sm:px-6 lg:px-10 border-t border-[#c3c6d7]/25 dark:border-slate-800/80 text-center sm:flex sm:items-center sm:justify-between text-[11px] text-[#737686] dark:text-slate-500">
        <span>DR MART · Sistem Stok Opname &amp; Audit Inventaris Toko</span>
        <span className="hidden sm:inline font-mono">
          {users.length} Akun Terdaftar · Sinkronisasi Multi-User Aktif
        </span>
      </footer>
    </div>
  );
};
