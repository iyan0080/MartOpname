import React, { useState, useEffect } from 'react';
import {
  Store,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Plus,
  Activity,
  Volume2,
  VolumeX,
  LayoutDashboard,
  ClipboardCheck,
  Package2,
  GitCompareArrows,
  ScanBarcode,
  Calculator,
  Settings,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Upload,
  Calendar,
  Banknote,
  FileSpreadsheet,
  FileText,
  Cloud,
  RotateCcw,
  Barcode,
  QrCode,
  Camera,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryStats,
  MartUser,
  OpnameSession,
  ScanAuditLog,
} from '../types/inventory.ts';
import { formatRupiah } from '../utils/excelUtils.ts';
import { DesktopInventoryRow } from './InventoryRows.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { ThemeMode } from '../utils/useTheme.ts';

export type DesktopModule = 'dashboard' | 'opname' | 'kategori' | 'laporan';

interface DuplicateAnalysisSummary {
  duplicateSkus: Map<string, InventoryItem[]>;
  duplicateBarcodes: Map<string, InventoryItem[]>;
  duplicateItemIds: Set<string>;
  hasDuplicates: boolean;
  totalDuplicateSkus: number;
  totalDuplicateBarcodes: number;
  totalAffectedItems: number;
}

interface DesktopDashboardWorkspaceProps {
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
  session: OpnameSession;
  activeUser: string;
  currentUserObj: MartUser | undefined;
  activeUsersCount: number;
  isCloudConnected: boolean;
  cloudSyncStatus: 'synced' | 'saving' | 'error';
  logs: ScanAuditLog[];
  themeMode: ThemeMode;
  isDark: boolean;
  onThemeChange: (mode: ThemeMode) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  activeViewTab: 'opname' | 'laporan' | 'kategori';
  onSelectViewTab: (tab: 'opname' | 'laporan' | 'kategori') => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onBarcodeSearchSubmit: (e: React.FormEvent) => void;
  selectedCategory: string;
  onSelectCategory: (val: string) => void;
  availableCategories: string[];
  categoryCounts: Record<string, number>;
  discrepancyFilter: 'ALL' | 'MATCH' | 'MINUS' | 'PLUS' | 'UNCOUNTED' | 'DUPLICATE';
  onChangeDiscrepancyFilter: (
    val: 'ALL' | 'MATCH' | 'MINUS' | 'PLUS' | 'UNCOUNTED' | 'DUPLICATE'
  ) => void;
  sortBy: 'nama' | 'sku' | 'qty' | 'modal' | 'totalModal' | 'selisih';
  sortOrder: 'asc' | 'desc';
  onChangeSort: (
    field: 'nama' | 'sku' | 'qty' | 'modal' | 'totalModal' | 'selisih',
    order: 'asc' | 'desc'
  ) => void;
  duplicateAnalysis: DuplicateAnalysisSummary;
  onOpenScanner: () => void;
  onOpenAddItem: () => void;
  onOpenCalculator: () => void;
  onOpenOpnameDate: () => void;
  onOpenFinance: () => void;
  onOpenImportExport: (tab?: 'import' | 'export') => void;
  onOpenExportXlsx: () => void;
  onOpenLaporanHasil: () => void;
  onOpenAuditLogs: () => void;
  onOpenUserModal: () => void;
  onOpenDisplayOptions: () => void;
  onOpenDuplicateModal: () => void;
  showResetButton: boolean;
  onResetSession: () => void;
  onQuickDelta: (itemId: string, delta: number) => void;
  onQuickAdjust: (item: InventoryItem) => void;
  onOpenCalcItem: (item: InventoryItem) => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
}

export const DesktopDashboardWorkspace: React.FC<DesktopDashboardWorkspaceProps> = ({
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
  session,
  activeUser,
  currentUserObj,
  activeUsersCount,
  isCloudConnected,
  cloudSyncStatus,
  logs,
  themeMode,
  isDark,
  onThemeChange,
  soundEnabled,
  onToggleSound,
  activeViewTab,
  onSelectViewTab,
  searchInputRef,
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
  onOpenCalculator,
  onOpenOpnameDate,
  onOpenFinance,
  onOpenImportExport,
  onOpenExportXlsx,
  onOpenLaporanHasil,
  onOpenAuditLogs,
  onOpenUserModal,
  onOpenDisplayOptions,
  onOpenDuplicateModal,
  showResetButton,
  onResetSession,
  onQuickDelta,
  onQuickAdjust,
  onOpenCalcItem,
  onEditItem,
  onDeleteItem,
}) => {
  // Default sidebar open on >=1024px PC screens, collapsible on Tablet (768px-1023px)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  // Distinguish 'dashboard' (Overview + Banner + Table) from focused 'opname' (Full table) while keeping activeViewTab synced
  const [isOverviewMode, setIsOverviewMode] = useState<boolean>(true);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const currentModule: DesktopModule =
    activeViewTab === 'kategori'
      ? 'kategori'
      : activeViewTab === 'laporan'
      ? 'laporan'
      : isOverviewMode
      ? 'dashboard'
      : 'opname';

  const selectModule = (mod: DesktopModule) => {
    if (mod === 'dashboard') {
      setIsOverviewMode(true);
      onSelectViewTab('opname');
    } else if (mod === 'opname') {
      setIsOverviewMode(false);
      onSelectViewTab('opname');
    } else if (mod === 'kategori') {
      onSelectViewTab('kategori');
    } else if (mod === 'laporan') {
      onSelectViewTab('laporan');
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Live KPI math
  const totalItemsCount = stats?.totalItems ?? items.length;
  const countedItemsCount = stats?.countedItemsCount ?? 0;
  const progressPct = totalItemsCount > 0 ? Math.min(100, (countedItemsCount / totalItemsCount) * 100) : 0;
  const minusCount = stats?.minusCount ?? 0;
  const plusCount = stats?.plusCount ?? 0;
  const matchCount = stats?.matchCount ?? 0;
  const uncountedCount = stats?.uncountedItemsCount ?? 0;
  const discrepancyCount = minusCount + plusCount;
  const selisihModal = stats?.selisihModal ?? 0;
  const totalModalSystem = stats?.totalModalSystem ?? 0;
  const totalModalInvestasi = stats?.totalModalInvestasi ?? 0;
  const variancePct =
    totalModalSystem > 0 ? ((selisihModal / totalModalSystem) * 100).toFixed(2) : '0.00';

  const isPrivilegedFinance = activeUser === 'IYAN' || activeUser === 'HENDRI';
  const isIyan = activeUser === 'IYAN';

  const discrepancyItems = filteredItems.filter((item) => item.quantity - item.quantitySystem !== 0);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#faf8ff] dark:bg-slate-950 text-[#131b2e] dark:text-slate-100 transition-colors duration-150">
      {/* FIXED-HEIGHT TOP BAR (56px / h-14) */}
      <header className="h-14 shrink-0 bg-white dark:bg-slate-900 z-40 shadow-[0_1px_8px_rgba(19,27,46,0.05)] border-b border-[#c3c6d7]/30 dark:border-slate-800 px-3 lg:px-5 flex items-center justify-between gap-3">
        {/* Left: Sidebar Toggle + Brand Lockup */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label="Toggle Navigation Sidebar"
            title={isSidebarOpen ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
            className="p-1.5 text-[#434655] dark:text-slate-300 hover:text-[#131b2e] dark:hover:text-white hover:bg-[#e2e7ff] dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <PanelLeftOpen className="w-5 h-5" />
            )}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004ac6] dark:bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-[#004ac6] dark:text-blue-400 leading-none tracking-tight whitespace-nowrap">
                DR MART
              </span>
              <span className="text-[10px] font-semibold text-[#434655] dark:text-slate-400 leading-none mt-1 whitespace-nowrap">
                Retail Audit &amp; Inventory
              </span>
            </div>
          </div>
        </div>

        {/* Center: Store/Date Context Selector + Live Cloud Sync Pill */}
        <div className="flex items-center gap-2.5 flex-1 max-w-2xl min-w-0">
          <button
            type="button"
            onClick={onOpenOpnameDate}
            className="flex items-center gap-2 px-2.5 py-1 bg-[#f2f3ff] dark:bg-slate-800 hover:bg-[#e2e7ff] dark:hover:bg-slate-700 rounded-lg text-[#131b2e] dark:text-slate-100 transition-colors min-w-0"
            title="Klik untuk ubah tanggal & sesi opname"
          >
            <Store className="w-4 h-4 text-[#006398] dark:text-sky-400 shrink-0" />
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[10px] font-semibold text-[#434655] dark:text-slate-400 leading-tight">
                Periode Sesi Opname
              </span>
              <span className="text-xs font-semibold text-[#131b2e] dark:text-white leading-tight truncate">
                DR MART <span className="font-mono text-[#006398] dark:text-sky-400 font-normal">({session.opnameDate})</span>
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#434655] dark:text-slate-400 shrink-0 ml-0.5" />
          </button>

          <div
            className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-2xs shrink-0 ${
              cloudSyncStatus === 'saving'
                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300'
                : cloudSyncStatus === 'error'
                ? 'bg-[#ffdad6] dark:bg-rose-950/70 text-[#ba1a1a] dark:text-rose-300'
                : 'bg-[#85f8c4] dark:bg-emerald-950/80 text-[#002114] dark:text-emerald-300'
            }`}
            title="Semua perubahan stok otomatis tersimpan ke Firebase Cloud Firestore"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                cloudSyncStatus === 'saving'
                  ? 'bg-amber-600 animate-ping'
                  : cloudSyncStatus === 'error'
                  ? 'bg-[#ba1a1a]'
                  : isCloudConnected
                  ? 'bg-[#006243] dark:bg-emerald-400 animate-pulse'
                  : 'bg-slate-400'
              }`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
              {cloudSyncStatus === 'saving'
                ? 'Menyimpan ke Cloud...'
                : cloudSyncStatus === 'error'
                ? 'Sync Terputus'
                : `Cloud Aktif · ${activeUsersCount} Online`}
            </span>
          </div>
        </div>

        {/* Right: Primary CTA + Utilities + User Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2563eb] hover:bg-[#004ac6] text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang</span>
          </button>

          <ThemeToggle themeMode={themeMode} isDark={isDark} onThemeChange={onThemeChange} />

          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Suara Scanner Aktif' : 'Suara Scanner Dimatikan'}
            className="p-2 rounded-lg text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#004ac6] dark:text-blue-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#737686] dark:text-slate-500" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAuditLogs}
            aria-label="Aktivitas Scan Real-Time"
            title="Lihat Aktivitas Scan Real-Time"
            className="p-2 text-[#434655] dark:text-slate-300 hover:text-[#131b2e] dark:hover:text-white hover:bg-[#e2e7ff] dark:hover:bg-slate-800 rounded-full relative transition-colors"
          >
            <Activity className="w-4 h-4" />
            {logs.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ba1a1a] text-white font-mono text-[10px] leading-tight flex items-center justify-center font-bold">
                {logs.length > 99 ? '99+' : logs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenUserModal}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-[#f2f3ff] dark:hover:bg-slate-800 transition-colors"
            title="Ganti Petugas Opname"
          >
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-[#131b2e] dark:text-white leading-tight">
                {activeUser}
              </span>
              <span className="text-[10px] text-[#434655] dark:text-slate-400 leading-tight max-w-[120px] truncate">
                {currentUserObj?.role || 'Petugas Opname'}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#004ac6] dark:bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-xs shrink-0">
              {activeUser.slice(0, 2)}
            </div>
          </button>
        </div>
      </header>

      {/* BODY SHELL: Collapsible Left Sidebar + Main Workspace */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Tablet Backdrop when sidebar is open */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 top-14 bg-black/30 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* LEFT SIDEBAR NAVIGATION */}
        {isSidebarOpen && (
          <aside className="fixed lg:static left-0 top-14 bottom-0 w-64 shrink-0 bg-white dark:bg-slate-900 shadow-[1px_0_8px_rgba(19,27,46,0.04)] border-r border-[#c3c6d7]/30 dark:border-slate-800 z-30 flex flex-col justify-between py-3 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <div className="px-4 py-1.5">
                <p className="text-[10px] font-bold text-[#737686] dark:text-slate-500 uppercase tracking-wider">
                  Modul Operasional
                </p>
              </div>

              <nav className="flex flex-col gap-1 px-2.5">
                <button
                  type="button"
                  onClick={() => selectModule('dashboard')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all text-left whitespace-nowrap ${
                    currentModule === 'dashboard'
                      ? 'bg-[#2563eb] text-white font-bold shadow-sm'
                      : 'text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectModule('opname')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all text-left whitespace-nowrap ${
                    currentModule === 'opname'
                      ? 'bg-[#2563eb] text-white font-bold shadow-sm'
                      : 'text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span>Sesi Stock Opname</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectModule('kategori')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all text-left whitespace-nowrap ${
                    currentModule === 'kategori'
                      ? 'bg-[#2563eb] text-white font-bold shadow-sm'
                      : 'text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium'
                  }`}
                >
                  <Package2 className="w-4 h-4 shrink-0" />
                  <span>Rekap Modal &amp; Kategori</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectModule('laporan')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all text-left whitespace-nowrap ${
                    currentModule === 'laporan'
                      ? 'bg-[#2563eb] text-white font-bold shadow-sm'
                      : 'text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium'
                  }`}
                >
                  <GitCompareArrows className="w-4 h-4 shrink-0" />
                  <span>Laporan Selisih (Audit)</span>
                </button>

                <div className="my-1.5 border-t border-[#c3c6d7]/30 dark:border-slate-800" />
                <p className="px-2 py-1 text-[10px] font-bold text-[#737686] dark:text-slate-500 uppercase tracking-wider">
                  Alat &amp; Otoritas
                </p>

                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium transition-all text-left whitespace-nowrap"
                >
                  <ScanBarcode className="w-4 h-4 shrink-0 text-[#004ac6] dark:text-blue-400" />
                  <span>Scanner Barcode &amp; QR</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenCalculator}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium transition-all text-left whitespace-nowrap"
                >
                  <Calculator className="w-4 h-4 shrink-0 text-[#004ac6] dark:text-blue-400" />
                  <span>Kalkulator Box &amp; Eceran</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenLaporanHasil}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium transition-all text-left whitespace-nowrap"
                >
                  <FileText className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                  <span>Berita Acara &amp; PDF</span>
                </button>

                {isPrivilegedFinance && (
                  <button
                    type="button"
                    onClick={onOpenFinance}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#006243] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 font-semibold transition-all text-left whitespace-nowrap"
                  >
                    <Banknote className="w-4 h-4 shrink-0" />
                    <span>Keuangan &amp; Operasional</span>
                  </button>
                )}

                {isIyan && (
                  <button
                    type="button"
                    onClick={() => onOpenImportExport('import')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#006398] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 font-semibold transition-all text-left whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    <span>Import / Export XLSX</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenDisplayOptions}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#434655] dark:text-slate-300 hover:bg-[#e2e7ff] dark:hover:bg-slate-800 hover:text-[#131b2e] dark:hover:text-white font-medium transition-all text-left whitespace-nowrap"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Pengaturan &amp; Opsi</span>
                </button>
              </nav>
            </div>

            {/* Bottom Progress Card in Sidebar */}
            <div className="px-3 pt-3 flex flex-col gap-2">
              <div className="p-3 bg-[#f2f3ff] dark:bg-slate-800/80 rounded-xl border border-[#c3c6d7]/30 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-[#434655] dark:text-slate-300 tracking-wide">
                    Progres Opname
                  </span>
                  <span className="font-mono text-xs font-bold text-[#004ac6] dark:text-blue-400">
                    {progressPct.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#dae2fd] dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#004ac6] dark:bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#434655] dark:text-slate-400 mt-1.5 font-mono tabular-nums">
                  {countedItemsCount.toLocaleString('id-ID')} / {totalItemsCount.toLocaleString('id-ID')} SKU Terhitung
                </p>
              </div>

              <div className="px-1 flex items-center justify-between text-[#737686] dark:text-slate-500 text-[10px] font-mono">
                <span className="flex items-center gap-1">
                  <Cloud className="w-3 h-3 text-[#006243] dark:text-emerald-400" />
                  Auto-Save Cloud
                </span>
                <span>{activeUsersCount} Online</span>
              </div>
            </div>
          </aside>
        )}

        {/* MAIN CONTENT VIEWPORT */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto px-4 lg:px-5 py-4 gap-3.5 bg-[#faf8ff] dark:bg-slate-950">
          {currentModule === 'kategori' ? (
            /* REKAP MODAL PER KATEGORI */
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-[#c3c6d7]/30 dark:border-slate-800 p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e2e7ff] dark:border-slate-800">
                <div>
                  <h1 className="text-base font-bold text-[#131b2e] dark:text-white">
                    Rekapitulasi Modal per Kategori
                  </h1>
                  <p className="text-xs text-[#434655] dark:text-slate-400">
                    Klik salah satu kategori untuk langsung memfilter barang di sesi stock opname
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectModule('opname')}
                  className="px-3 py-1.5 rounded-lg bg-[#f2f3ff] dark:bg-slate-800 hover:bg-[#e2e7ff] dark:hover:bg-slate-700 text-[#004ac6] dark:text-blue-400 text-xs font-semibold transition-colors"
                >
                  Kembali ke Opname
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative mt-2">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 z-10 bg-[#f2f3ff] dark:bg-slate-800 text-[#434655] dark:text-slate-300 border-b border-[#e2e7ff] dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Kategori</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Jumlah SKU</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Total Stok Fisik</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Total Modal Diinvestasikan</th>
                      <th className="px-4 py-2.5 font-semibold text-right">% Dari Total Modal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaedff] dark:divide-slate-800 font-mono">
                    {stats?.categorySummary.map((cat) => {
                      const pct =
                        stats.totalModalInvestasi > 0
                          ? ((cat.totalModal / stats.totalModalInvestasi) * 100).toFixed(1)
                          : '0';
                      return (
                        <tr
                          key={cat.kategori}
                          onClick={() => {
                            onSelectCategory(cat.kategori);
                            selectModule('opname');
                          }}
                          className="hover:bg-[#f2f3ff] dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 font-sans font-semibold text-[#131b2e] dark:text-white">
                            {cat.kategori}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[#434655] dark:text-slate-300">
                            {cat.itemCount} item
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-[#131b2e] dark:text-white">
                            {cat.totalQty} pcs
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-[#006243] dark:text-emerald-400">
                            {formatRupiah(cat.totalModal)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[#434655] dark:text-slate-400">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-[#eaedff] dark:bg-slate-800 font-mono font-bold text-[#131b2e] dark:text-white border-t border-[#c3c6d7]/50 dark:border-slate-700">
                    <tr>
                      <td className="px-4 py-2.5 font-sans">TOTAL SEMUA</td>
                      <td className="px-4 py-2.5 text-right">{stats?.totalItems || 0} item</td>
                      <td className="px-4 py-2.5 text-right">{stats?.totalPhysicalQty || 0} pcs</td>
                      <td className="px-4 py-2.5 text-right text-[#006243] dark:text-emerald-300">
                        {formatRupiah(stats?.totalModalInvestasi || 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : currentModule === 'laporan' ? (
            /* LAPORAN SELISIH & AUDIT MODAL */
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-[#c3c6d7]/30 dark:border-slate-800 p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e2e7ff] dark:border-slate-800">
                <div>
                  <h1 className="text-base font-bold text-[#131b2e] dark:text-white">
                    Laporan Selisih Stok &amp; Audit Modal
                  </h1>
                  <p className="text-xs text-[#434655] dark:text-slate-400">
                    Daftar barang dengan perbedaan antara stok fisik hasil opname vs stok sistem mart
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenLaporanHasil}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#007d57] hover:bg-[#006243] rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Laporan Hasil Opname Resmi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDiscrepancyFilter(discrepancyFilter === 'MINUS' ? 'ALL' : 'MINUS')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      discrepancyFilter === 'MINUS'
                        ? 'bg-[#ba1a1a] text-white'
                        : 'bg-[#ffdad6] dark:bg-red-950/50 text-[#ba1a1a] dark:text-red-300 hover:opacity-90'
                    }`}
                  >
                    Kurang ({minusCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeDiscrepancyFilter(discrepancyFilter === 'PLUS' ? 'ALL' : 'PLUS')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      discrepancyFilter === 'PLUS'
                        ? 'bg-[#004ac6] text-white'
                        : 'bg-[#cce5ff] dark:bg-blue-950/50 text-[#001d31] dark:text-blue-300 hover:opacity-90'
                    }`}
                  >
                    Lebih ({plusCount})
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative mt-2">
                {discrepancyItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#434655] dark:text-slate-400">
                    Tidak ada barang selisih pada filter saat ini. Semua stok fisik dan sistem seimbang!
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 z-10 bg-[#f2f3ff] dark:bg-slate-800 text-[#434655] dark:text-slate-200 border-b border-[#e2e7ff] dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">SKU / Nama Barang</th>
                        <th className="px-4 py-2.5 font-semibold">Kategori</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Fisik</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Sistem</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Selisih Fisik</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Harga Modal</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Selisih Modal (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eaedff] dark:divide-slate-800 font-mono">
                      {discrepancyItems.map((item) => {
                        const diff = item.quantity - item.quantitySystem;
                        const diffModal = diff * item.hargaModal;
                        return (
                          <tr key={item.id} className="hover:bg-[#f2f3ff]/70 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-2.5">
                              <span className="font-bold text-[#004ac6] dark:text-blue-400">{item.sku}</span>
                              <p className="font-sans text-[#131b2e] dark:text-slate-200 font-medium">
                                {item.namaBarang}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 font-sans text-[#434655] dark:text-slate-400">
                              {item.kategori}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-[#131b2e] dark:text-white">
                              {item.quantity} {item.satuan || 'pcs'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[#737686] dark:text-slate-400">
                              {item.quantitySystem} {item.satuan || 'pcs'}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-bold ${
                                diff < 0
                                  ? 'text-[#ba1a1a] dark:text-red-400'
                                  : 'text-[#004ac6] dark:text-blue-400'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff} {item.satuan || 'pcs'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[#434655] dark:text-slate-300">
                              {formatRupiah(item.hargaModal)}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-bold ${
                                diffModal < 0
                                  ? 'text-[#ba1a1a] dark:text-red-400'
                                  : 'text-[#004ac6] dark:text-blue-400'
                              }`}
                            >
                              {diffModal > 0 ? '+' : ''}
                              {formatRupiah(diffModal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            /* DASHBOARD OVERVIEW OR FOCUSED SESI OPNAME */
            <>
              {isOverviewMode && (
                <>
                  {/* 1. Header Sederhana & Ramah */}
                  <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-[#c3c6d7]/25 dark:border-slate-800">
                    <div className="flex flex-col gap-0.5">
                      <h1 className="text-base font-bold text-[#131b2e] dark:text-white leading-snug">
                        Ringkasan Stock Opname
                      </h1>
                      <p className="text-xs text-[#434655] dark:text-slate-400">
                        DR MART · Tanggal Opname: {session.opnameDate} · Petugas: <strong className="text-[#131b2e] dark:text-slate-200">{activeUser}</strong>
                      </p>
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      {showResetButton && (
                        <button
                          type="button"
                          onClick={onResetSession}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ffdad6]/70 dark:bg-red-950/40 hover:bg-[#ffdad6] dark:hover:bg-red-900/50 text-[#ba1a1a] dark:text-red-300 rounded-lg text-xs font-semibold transition-all active:scale-95"
                          title="Reset stok fisik ke 0 untuk opname baru"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Sesi</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={isIyan ? onOpenExportXlsx : onOpenLaporanHasil}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#f2f3ff] dark:bg-slate-800 hover:bg-[#e2e7ff] dark:hover:bg-slate-700 text-[#131b2e] dark:text-white rounded-lg text-xs font-semibold transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-[#737686] dark:text-slate-400" />
                        <span>{isIyan ? 'Ekspor Laporan XLSX' : 'Ekspor Laporan Resmi'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. 3 Ringkasan Utama (Metrik Bersih & Lega) */}
                  <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Kartu 1: Progress SO */}
                    <button
                      type="button"
                      onClick={() =>
                        onChangeDiscrepancyFilter(
                          discrepancyFilter === 'UNCOUNTED' ? 'ALL' : 'UNCOUNTED'
                        )
                      }
                      className={`text-left bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border transition-all flex flex-col justify-between ${
                        discrepancyFilter === 'UNCOUNTED'
                          ? 'border-[#004ac6] ring-2 ring-[#004ac6]/20 dark:border-blue-500'
                          : 'border-[#c3c6d7]/25 dark:border-slate-800 hover:border-[#004ac6]/40'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-medium text-[#434655] dark:text-slate-400">
                          Progres Hitung
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="font-mono text-[26px] font-bold text-[#004ac6] dark:text-blue-400 leading-tight tabular-nums">
                            {progressPct.toFixed(1)}%
                          </span>
                          <span className="text-xs text-[#434655] dark:text-slate-400">selesai</span>
                        </div>
                      </div>
                      <div className="mt-3 w-full">
                        <div className="w-full h-2 bg-[#e2e7ff] dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#004ac6] dark:bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#434655] dark:text-slate-400 mt-2 font-mono tabular-nums">
                          {countedItemsCount.toLocaleString('id-ID')} dari{' '}
                          {totalItemsCount.toLocaleString('id-ID')} SKU terhitung
                        </p>
                      </div>
                    </button>

                    {/* Kartu 2: Item Perlu Dicek */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-[#c3c6d7]/25 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-medium text-[#434655] dark:text-slate-400">
                          Item Perlu Dicek
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="font-mono text-[26px] font-bold text-[#ba1a1a] dark:text-red-400 leading-tight tabular-nums">
                            {discrepancyCount}
                          </span>
                          <span className="text-xs font-semibold text-[#ba1a1a] dark:text-red-400">
                            SKU selisih
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            onChangeDiscrepancyFilter(
                              discrepancyFilter === 'MINUS' ? 'ALL' : 'MINUS'
                            )
                          }
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold transition-all ${
                            discrepancyFilter === 'MINUS'
                              ? 'bg-[#ba1a1a] text-white'
                              : 'bg-[#ffdad6] dark:bg-red-950/60 text-[#ba1a1a] dark:text-red-300 hover:opacity-85'
                          }`}
                        >
                          {minusCount} Kurang
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeDiscrepancyFilter(
                              discrepancyFilter === 'PLUS' ? 'ALL' : 'PLUS'
                            )
                          }
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold transition-all ${
                            discrepancyFilter === 'PLUS'
                              ? 'bg-[#004ac6] text-white'
                              : 'bg-[#cce5ff] dark:bg-blue-950/60 text-[#001d31] dark:text-blue-300 hover:opacity-85'
                          }`}
                        >
                          {plusCount} Lebih
                        </button>
                      </div>
                    </div>

                    {/* Kartu 3: Total Nilai Selisih & Investasi */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-[#c3c6d7]/25 dark:border-slate-800 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-medium text-[#434655] dark:text-slate-400">
                          Estimasi Nilai Selisih
                        </span>
                        <div
                          className={`mt-1.5 font-mono text-[22px] lg:text-[24px] font-bold leading-tight tabular-nums ${
                            selisihModal < 0
                              ? 'text-[#ba1a1a] dark:text-red-400'
                              : selisihModal > 0
                              ? 'text-[#004ac6] dark:text-blue-400'
                              : 'text-[#006243] dark:text-emerald-400'
                          }`}
                        >
                          {selisihModal > 0 ? '+' : selisihModal < 0 ? '-' : ''}
                          {formatRupiah(Math.abs(selisihModal))}
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] text-[#434655] dark:text-slate-400">
                          Modal fisik:{' '}
                          <strong className="font-mono text-[#131b2e] dark:text-slate-200">
                            {formatRupiah(totalModalInvestasi)}
                          </strong>{' '}
                          <span
                            className={`font-mono font-bold ${
                              selisihModal < 0
                                ? 'text-[#ba1a1a] dark:text-red-400'
                                : 'text-[#006243] dark:text-emerald-400'
                            }`}
                          >
                            ({Number(variancePct) > 0 ? `+${variancePct}` : variancePct}%)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Banner Aksi Sesi Aktif Bersih & Fokus */}
                  <div className="shrink-0 bg-[#2563eb] dark:bg-blue-700 text-white p-4 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#85f8c4] animate-pulse" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#bdffdc]">
                          Sesi Aktif Berjalan · Auto-Save Cloud
                        </span>
                      </div>
                      <h2 className="text-[15px] font-bold text-white leading-snug">
                        Audit Fisik &amp; Inventaris Mart ({totalItemsCount.toLocaleString('id-ID')} SKU Terdaftar)
                      </h2>
                      <p className="text-[11px] text-[#eeefff]">
                        {activeUsersCount} Petugas aktif saat ini · Mendukung Scan Barcode, QR Code &amp; Hardware Scanner
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-[#f2f3ff] text-[#004ac6] text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0"
                    >
                      <ScanBarcode className="w-4 h-4" />
                      <span>Lanjut Scan Barcode &amp; QR</span>
                    </button>
                  </div>
                </>
              )}

              {/* 4. Tabel Produk Super Sederhana, Lega & Jelas */}
              <div
                className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-[#c3c6d7]/25 dark:border-slate-800 flex flex-col overflow-hidden ${
                  isOverviewMode ? 'h-[480px] min-h-[380px] shrink-0' : 'flex-1 min-h-0'
                }`}
              >
                {/* Toolbar */}
                <div className="shrink-0 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#e2e7ff] dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-[#131b2e] dark:text-white">
                      {isOverviewMode
                        ? 'Daftar Produk & Verifikasi Fisik'
                        : 'Sesi Stock Opname Fisik (Mode Fokus Penuh)'}
                    </h3>
                    <p className="text-[11px] text-[#434655] dark:text-slate-400 mt-0.5">
                      Scan barcode/QR, ketik SKU, atau gunakan tombol +/- dan kalkulator dus per item.
                    </p>
                  </div>

                  {/* Quick Search & Primary Verifikasi Action */}
                  <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={onBarcodeSearchSubmit} className="relative flex-1 min-w-[260px] sm:w-80">
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                        <Barcode className="w-3.5 h-3.5 text-[#004ac6] dark:text-blue-400" />
                        <QrCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                        placeholder="Scan Barcode / QR, SKU, atau nama produk..."
                        className="w-full pl-12 pr-20 py-2 bg-[#f2f3ff] dark:bg-slate-800 border border-[#c3c6d7]/40 dark:border-slate-700 text-xs rounded-lg text-[#131b2e] dark:text-white placeholder:text-[#737686] dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-[#004ac6] font-mono transition-colors"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => onSearchQueryChange('')}
                            className="px-1.5 py-0.5 text-[#737686] hover:text-[#131b2e] dark:hover:text-white text-xs"
                            aria-label="Hapus pencarian"
                          >
                            ×
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onOpenScanner}
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-[#004ac6] hover:bg-[#003ea8] rounded-md flex items-center gap-1 transition-colors"
                          title="Buka Kamera Scan Barcode & QR Code"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Scan</span>
                        </button>
                      </div>
                    </form>

                    <button
                      type="button"
                      onClick={onOpenLaporanHasil}
                      className="px-3.5 py-2 bg-[#007d57] hover:bg-[#006243] text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-95 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Laporan Hasil Resmi</span>
                    </button>
                  </div>
                </div>

                {/* Duplicate Alert Banner (when duplicates exist) */}
                {duplicateAnalysis.hasDuplicates && (
                  <div className="shrink-0 mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 flex-wrap">
                          <span>Peringatan Data Ganda:</span>
                          {duplicateAnalysis.totalDuplicateSkus > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono">
                              {duplicateAnalysis.totalDuplicateSkus} SKU Ganda
                            </span>
                          )}
                          {duplicateAnalysis.totalDuplicateBarcodes > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-800 dark:text-rose-300 font-mono">
                              {duplicateAnalysis.totalDuplicateBarcodes} Barcode Ganda
                            </span>
                          )}
                          <span className="text-[#434655] dark:text-slate-400 font-normal">
                            ({duplicateAnalysis.totalAffectedItems} barang terdampak)
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeDiscrepancyFilter(
                            discrepancyFilter === 'DUPLICATE' ? 'ALL' : 'DUPLICATE'
                          )
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          discrepancyFilter === 'DUPLICATE'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        }`}
                      >
                        {discrepancyFilter === 'DUPLICATE' ? 'Tampilkan Semua' : 'Filter Barang Ganda'}
                      </button>
                      <button
                        type="button"
                        onClick={onOpenDuplicateModal}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <span>Lihat Rincian</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter Tab Ringkas + Selectors */}
                <div className="shrink-0 px-4 py-2.5 bg-[#f2f3ff] dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2 border-b border-[#c3c6d7]/30 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => onChangeDiscrepancyFilter('ALL')}
                      className={`px-3 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                        discrepancyFilter === 'ALL'
                          ? 'bg-white dark:bg-slate-900 text-[#004ac6] dark:text-blue-400 font-bold shadow-xs'
                          : 'text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-white font-medium'
                      }`}
                    >
                      Semua ({items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeDiscrepancyFilter('MINUS')}
                      className={`px-3 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                        discrepancyFilter === 'MINUS'
                          ? 'bg-white dark:bg-slate-900 text-[#ba1a1a] dark:text-red-400 font-bold shadow-xs'
                          : 'text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-white font-medium'
                      }`}
                    >
                      Kurang ({minusCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeDiscrepancyFilter('PLUS')}
                      className={`px-3 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                        discrepancyFilter === 'PLUS'
                          ? 'bg-white dark:bg-slate-900 text-[#004ac6] dark:text-blue-400 font-bold shadow-xs'
                          : 'text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-white font-medium'
                      }`}
                    >
                      Lebih ({plusCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeDiscrepancyFilter('MATCH')}
                      className={`px-3 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                        discrepancyFilter === 'MATCH'
                          ? 'bg-white dark:bg-slate-900 text-[#006243] dark:text-emerald-400 font-bold shadow-xs'
                          : 'text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-white font-medium'
                      }`}
                    >
                      Cocok ({matchCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeDiscrepancyFilter('UNCOUNTED')}
                      className={`px-3 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                        discrepancyFilter === 'UNCOUNTED'
                          ? 'bg-white dark:bg-slate-900 text-[#131b2e] dark:text-white font-bold shadow-xs'
                          : 'text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-white font-medium'
                      }`}
                    >
                      Belum Hitung ({uncountedCount})
                    </button>
                  </div>

                  {/* Category & Sort Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={selectedCategory}
                      onChange={(e) => onSelectCategory(e.target.value)}
                      className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-[#c3c6d7]/50 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004ac6] font-medium"
                    >
                      <option value="ALL">Semua Kategori ({items.length})</option>
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c} ({categoryCounts[c] || 0})
                        </option>
                      ))}
                    </select>

                    <select
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-');
                        onChangeSort(field as any, order as any);
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-900 border border-[#c3c6d7]/50 dark:border-slate-700 rounded-lg text-[#131b2e] dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#004ac6]"
                    >
                      <option value="totalModal-desc">Total Modal Terbesar</option>
                      <option value="totalModal-asc">Total Modal Terkecil</option>
                      <option value="nama-asc">Nama A-Z</option>
                      <option value="sku-asc">SKU A-Z</option>
                      <option value="qty-desc">Stok Fisik Terbanyak</option>
                      <option value="selisih-asc">Selisih Terbesar (Minus)</option>
                    </select>
                  </div>
                </div>

                {/* Data Table */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs text-[#434655] dark:text-slate-200 text-[10px] uppercase tracking-wider font-semibold border-b border-[#e2e7ff] dark:border-slate-700">
                      <tr>
                        <th className="px-3.5 py-3">SKU &amp; Barcode</th>
                        <th className="px-3.5 py-3 min-w-[200px]">Nama Barang</th>
                        <th className="px-3.5 py-3">Kategori</th>
                        <th className="px-3.5 py-3 text-center">Stok Fisik (Opname)</th>
                        <th className="px-3.5 py-3 text-right">Stok Sistem</th>
                        <th className="px-3.5 py-3 text-right">Selisih</th>
                        <th className="px-3.5 py-3 text-right">Harga Modal</th>
                        <th className="px-3.5 py-3 text-right">Total Modal</th>
                        <th className="px-3.5 py-3">Petugas</th>
                        <th className="px-3.5 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#eaedff] dark:divide-slate-800">
                      {isLoading ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-[#737686] dark:text-slate-500">
                            Memuat data inventaris stok opname dari Cloud...
                          </td>
                        </tr>
                      ) : filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-[#434655] dark:text-slate-400">
                            <div className="space-y-3">
                              <p>Tidak ada barang yang cocok dengan filter atau pencarian.</p>
                              {isIyan && (
                                <button
                                  type="button"
                                  onClick={() => onOpenImportExport('import')}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#006243] dark:text-emerald-300 bg-[#85f8c4]/40 dark:bg-emerald-950/60 hover:bg-[#85f8c4]/60 border border-[#006243]/20 dark:border-emerald-800 rounded-lg transition-colors"
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
                            isDuplicateSku={duplicateAnalysis.duplicateSkus.has(
                              (item.sku || '').trim().toUpperCase()
                            )}
                            isDuplicateBarcode={Boolean(
                              item.barcode &&
                                duplicateAnalysis.duplicateBarcodes.has(item.barcode.trim())
                            )}
                            onQuickDelta={onQuickDelta}
                            onQuickAdjust={onQuickAdjust}
                            onOpenCalc={onOpenCalcItem}
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
                      className="p-3 flex items-center justify-center gap-2 border-t border-[#eaedff] dark:border-slate-800 bg-[#f2f3ff]/60 dark:bg-slate-800/40"
                    >
                      <button
                        type="button"
                        onClick={onLoadMore}
                        className="px-3.5 py-1.5 text-xs font-semibold text-[#003ea8] dark:text-blue-300 bg-[#dbe1ff] dark:bg-blue-950/60 hover:bg-[#b4c5ff] dark:hover:bg-blue-900 rounded-lg active:scale-95 transition-transform"
                      >
                        Muat +120 Barang Lainnya ({filteredItems.length - visibleItems.length} tersisa)
                      </button>
                      <button
                        type="button"
                        onClick={onShowAll}
                        className="px-3 py-1.5 text-xs font-medium text-[#434655] dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-[#eaedff] dark:hover:bg-slate-700 border border-[#c3c6d7]/50 dark:border-slate-700 rounded-lg active:scale-95 transition-transform"
                      >
                        Tampilkan Semua ({filteredItems.length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Sticky Table Footer Summary */}
                <div className="shrink-0 px-4 py-2.5 bg-[#f2f3ff] dark:bg-slate-800/90 border-t border-[#c3c6d7]/30 dark:border-slate-800 flex items-center justify-between text-xs text-[#434655] dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>
                      Menampilkan <strong className="text-[#131b2e] dark:text-white">{visibleItems.length}</strong>
                      {hasMoreVisibleItems ? ` dari ${filteredItems.length}` : ''} barang ({items.length} total)
                    </span>
                    <span>·</span>
                    <span>
                      Petugas: <strong className="text-[#131b2e] dark:text-white">{activeUser}</strong>
                    </span>
                  </div>
                  <div className="font-mono">
                    Total Modal Filter:{' '}
                    <strong className="text-[#006243] dark:text-emerald-400">
                      {formatRupiah(filteredTotalModal)}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
