import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Store,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  X,
  Activity,
  Calendar,
  FileText,
} from 'lucide-react';

import { InventoryItem, MartUser, ScanAuditLog, InventoryStats, OpnameSession, FinanceRecord } from './types/inventory.ts';
import {
  testFirestoreConnection,
  subscribeToFirestoreItems,
  subscribeToFirestoreLogs,
  subscribeToFirestoreUsers,
  subscribeToOpnameSession,
  saveOpnameSessionToFirestore,
  DEFAULT_OPNAME_SESSION,
  subscribeToFinanceRecord,
  saveFinanceRecordToFirestore,
  DEFAULT_FINANCE_RECORD,
  saveItemToFirestore,
  deleteItemFromFirestore,
  clearAllItemsFromFirestore,
  saveLogToFirestore,
  batchSaveItemsToFirestore,
  replaceAllItemsInFirestore,
  saveUserToFirestore,
  mergeUsersWithDefaults,
} from './lib/firebase.ts';
import { INITIAL_ITEMS, INITIAL_USERS } from './data/seedData.ts';
import { calculateInventoryStats } from './utils/statsUtils.ts';
import { formatRupiah, exportInventoryToXLSX, assignSequentialMissingSKUs } from './utils/excelUtils.ts';
import { playScanSuccessSound, playScanWarningSound } from './utils/soundEffects.ts';
import { findItemsByScan, extractScanCandidates } from './utils/scanUtils.ts';

import { BarcodeScannerModal } from './components/BarcodeScannerModal.tsx';
import { ItemFormModal } from './components/ItemFormModal.tsx';
import { UserManagementModal } from './components/UserManagementModal.tsx';
import { ImportExportModal } from './components/ImportExportModal.tsx';
import { QuickAdjustDialog } from './components/QuickAdjustDialog.tsx';
import { LiveAuditDrawer } from './components/LiveAuditDrawer.tsx';
import { QuantityCalculatorModal } from './components/QuantityCalculatorModal.tsx';
import { PasswordPromptModal } from './components/PasswordPromptModal.tsx';
import { OpnameDateModal } from './components/OpnameDateModal.tsx';
import { FinanceManagerModal } from './components/FinanceManagerModal.tsx';
import { LaporanHasilOpnameModal } from './components/LaporanHasilOpnameModal.tsx';
import { DuplicateItemsModal } from './components/DuplicateItemsModal.tsx';
import { MobileBottomDock } from './components/MobileBottomDock.tsx';
import { MobileMenuSheet } from './components/MobileMenuSheet.tsx';
import { MobileOpnameWorkspace } from './components/MobileOpnameWorkspace.tsx';
import { DesktopDashboardWorkspace } from './components/DesktopDashboardWorkspace.tsx';
import { AccountSelectionLanding } from './components/AccountSelectionLanding.tsx';
import { useTheme } from './utils/useTheme.ts';
import { ThemeToggle } from './components/ThemeToggle.tsx';

export default function App() {
  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<MartUser[]>(INITIAL_USERS);
  const [logs, setLogs] = useState<ScanAuditLog[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  // Real-time Cloud Save status tracker
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const syncTimeoutRef = useRef<any>(null);

  // Derived inventory statistics (eliminates nested setStats calls inside setItems updaters)
  const stats = useMemo<InventoryStats | null>(() => {
    if (isLoading && items.length === 0) return null;
    return calculateInventoryStats(items);
  }, [items, isLoading]);

  // Responsive viewport matcher so only active Mobile Cards OR Desktop Table mounts in DOM
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const markCloudSaving = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setCloudSyncStatus('saving');
  }, []);

  const markCloudSynced = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setCloudSyncStatus('synced');
    }, 350);
  }, []);

  // Theme mode: system (default, follows device settings), light, or dark (can be changed manually)
  const { themeMode, isDark, setThemeMode } = useTheme();

  // Entry gate: start on Account Selection Landing Page before entering Mobile / PC workspace
  const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState<boolean>(false);

  // Active current user session (persisted in localStorage as last-used hint)
  const [activeUser, setActiveUser] = useState<string>(() => {
    return localStorage.getItem('mart_active_user') || 'IYAN';
  });

  // IYAN Authentication Token (Strictly for Export/Import authorization)
  const [iyanToken, setIyanToken] = useState<string | null>(() => {
    return sessionStorage.getItem('mart_iyan_token') || null;
  });
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);
  const [passwordPromptPurpose, setPasswordPromptPurpose] = useState<
    'switch_to_iyan' | 'open_import_export' | 'export_rekap'
  >('switch_to_iyan');

  // Sound effects toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Search & Filter state - Default ke mode scan barcode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'barcode' | 'all'>('barcode');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'MATCH' | 'MINUS' | 'PLUS' | 'UNCOUNTED' | 'DUPLICATE'>('ALL');
  const [sortBy, setSortBy] = useState<'nama' | 'sku' | 'qty' | 'modal' | 'totalModal' | 'selisih'>('totalModal');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeViewTab, setActiveViewTab] = useState<'opname' | 'laporan' | 'kategori'>('opname');
  const [activeCountingItemId, setActiveCountingItemId] = useState<string | null>(null);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [importExportDefaultTab, setImportExportDefaultTab] = useState<'export' | 'import'>('import');
  const [quickAdjustItem, setQuickAdjustItem] = useState<InventoryItem | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [isGlobalCalcOpen, setIsGlobalCalcOpen] = useState(false);
  const [calcTargetItem, setCalcTargetItem] = useState<InventoryItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InventoryItem | null>(null);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [isClearDemoModalOpen, setIsClearDemoModalOpen] = useState(false);

  // Opname Session state (Tanggal pelaksanaan opname & tim pemeriksa)
  const [session, setSession] = useState<OpnameSession>(DEFAULT_OPNAME_SESSION);
  const [isOpnameDateModalOpen, setIsOpnameDateModalOpen] = useState(false);

  // Finance Record state (Kas, Hutang Mitra, Saldo Santri, Piutang Marhalah - Khusus IYAN & HENDRI)
  const [finance, setFinance] = useState<FinanceRecord>(DEFAULT_FINANCE_RECORD);
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);

  // Laporan Hasil Opname Modal
  const [isLaporanHasilOpnameOpen, setIsLaporanHasilOpnameOpen] = useState(false);

  // Mobile Bottom Sheet Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Opsi Tampilan (Visibility preferences, persisted in localStorage)
  const [showResetButton, setShowResetButton] = useState<boolean>(() => {
    const saved = localStorage.getItem('mart_show_reset_button');
    return saved !== null ? saved === 'true' : true;
  });

  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false);

  const toggleResetButton = () => {
    setShowResetButton((prev) => {
      const next = !prev;
      localStorage.setItem('mart_show_reset_button', String(next));
      return next;
    });
  };

  // Toast notification for real-time alerts
  const [liveToast, setLiveToast] = useState<{ message: string; type: 'info' | 'success' | 'alert' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'alert' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setLiveToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 3500);
  }, []);

  // Internal navigation stack to guarantee phone back button always steps back through previously opened tabs
  const visitedTabsStackRef = useRef<Array<'opname' | 'laporan' | 'kategori'>>(['opname']);
  const activeViewTabRef = useRef(activeViewTab);
  activeViewTabRef.current = activeViewTab;

  // Track if any modal, sheet, dialog, or drawer is currently open
  const isAnyModalActive = Boolean(
    isMobileMenuOpen ||
    isScannerOpen ||
    isItemFormOpen ||
    isDuplicateModalOpen ||
    isFinanceModalOpen ||
    isLaporanHasilOpnameOpen ||
    isImportExportOpen ||
    isGlobalCalcOpen ||
    isUserModalOpen ||
    isOpnameDateModalOpen ||
    isAuditDrawerOpen ||
    quickAdjustItem ||
    isPasswordPromptOpen ||
    isResetConfirmModalOpen ||
    isClearDemoModalOpen ||
    deleteConfirmItem ||
    isDisplayMenuOpen
  );

  const isAnyModalActiveRef = useRef(isAnyModalActive);
  isAnyModalActiveRef.current = isAnyModalActive;

  const isPoppingStateRef = useRef(false);
  const prevModalStateRef = useRef(false);
  const pendingHistoryBackRef = useRef(0);
  const modalHistoryPushedRef = useRef(false);

  // Handle tab switching with browser history push so hardware/browser back button returns to previous tab
  const handleSelectViewTab = useCallback((tab: 'opname' | 'laporan' | 'kategori') => {
    if (tab === activeViewTabRef.current) return;
    visitedTabsStackRef.current.push(tab);
    if (modalHistoryPushedRef.current && window.history.state?.type === 'modal') {
      // Replace transient modal entry cleanly if switching tabs directly from a modal menu
      modalHistoryPushedRef.current = false;
      window.history.replaceState({ type: 'tab', tab }, '');
    } else {
      window.history.pushState({ type: 'tab', tab }, '');
    }
    setActiveViewTab(tab);
  }, []);

  const closeAllActiveModals = useCallback(() => {
    setIsMobileMenuOpen(false);
    setIsScannerOpen(false);
    setIsItemFormOpen(false);
    setIsDuplicateModalOpen(false);
    setIsFinanceModalOpen(false);
    setIsLaporanHasilOpnameOpen(false);
    setIsImportExportOpen(false);
    setIsGlobalCalcOpen(false);
    setIsUserModalOpen(false);
    setIsOpnameDateModalOpen(false);
    setIsAuditDrawerOpen(false);
    setQuickAdjustItem(null);
    setIsPasswordPromptOpen(false);
    setIsResetConfirmModalOpen(false);
    setIsClearDemoModalOpen(false);
    setDeleteConfirmItem(null);
    setIsDisplayMenuOpen(false);
  }, []);

  // Sync modal open/close with browser history so back button closes modal first
  useEffect(() => {
    if (isAnyModalActive && !prevModalStateRef.current) {
      window.history.pushState({ type: 'modal', tab: activeViewTabRef.current }, '');
      modalHistoryPushedRef.current = true;
    } else if (!isAnyModalActive && prevModalStateRef.current) {
      if (!isPoppingStateRef.current && modalHistoryPushedRef.current && window.history.state?.type === 'modal') {
        modalHistoryPushedRef.current = false;
        pendingHistoryBackRef.current += 1;
        window.history.back();
      } else {
        modalHistoryPushedRef.current = false;
      }
    }
    prevModalStateRef.current = isAnyModalActive;
    isPoppingStateRef.current = false;
  }, [isAnyModalActive]);

  // Handle phone navigation back button (hardware back, swipe gesture, or browser back)
  useEffect(() => {
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState({ type: 'tab', tab: activeViewTabRef.current }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      // Ignore popstate events triggered by our own programmatic window.history.back() cleanup
      if (pendingHistoryBackRef.current > 0) {
        pendingHistoryBackRef.current -= 1;
        return;
      }

      isPoppingStateRef.current = true;
      modalHistoryPushedRef.current = false;

      // 1. If any modal is open, phone back button closes the open modal and stays on current page
      if (isAnyModalActiveRef.current) {
        closeAllActiveModals();
        return;
      }

      // 2. If no modal was open, restore the previously opened tab/page
      const prevTab = e.state?.tab;
      if (prevTab && (prevTab === 'opname' || prevTab === 'laporan' || prevTab === 'kategori')) {
        if (visitedTabsStackRef.current.length > 1) {
          visitedTabsStackRef.current.pop();
        }
        setActiveViewTab(prevTab);
      } else {
        // Fallback using visited tabs stack
        if (visitedTabsStackRef.current.length > 1) {
          visitedTabsStackRef.current.pop();
          const lastTab = visitedTabsStackRef.current[visitedTabsStackRef.current.length - 1] || 'opname';
          setActiveViewTab(lastTab);
        } else {
          setActiveViewTab('opname');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeAllActiveModals]);

  // Sync active user change to localStorage with password verification for IYAN
  const handleSelectActiveUser = (name: string) => {
    if (name === 'IYAN') {
      if (iyanToken) {
        setActiveUser('IYAN');
        localStorage.setItem('mart_active_user', 'IYAN');
        const wasInside = hasEnteredWorkspace;
        setHasEnteredWorkspace(true);
        setIsUserModalOpen(false);
        showToast(
          wasInside ? 'Beralih ke akun IYAN (Otorisasi Aktif)' : 'Masuk sebagai akun IYAN (Otorisasi Aktif)',
          'success'
        );
      } else {
        setPasswordPromptPurpose('switch_to_iyan');
        setIsPasswordPromptOpen(true);
      }
      return;
    }

    const wasInside = hasEnteredWorkspace;
    setActiveUser(name);
    localStorage.setItem('mart_active_user', name);
    setHasEnteredWorkspace(true);
    setIsUserModalOpen(false);
    showToast(wasInside ? `Beralih ke petugas: ${name}` : `Masuk sebagai petugas: ${name}`, 'success');
  };

  // Return to Account Selection Landing Page
  const handleBackToAccountLanding = useCallback(() => {
    closeAllActiveModals();
    setHasEnteredWorkspace(false);
  }, [closeAllActiveModals]);

  // Callback on successful IYAN password verification
  const handleIyanAuthSuccess = (token: string) => {
    setIyanToken(token);
    sessionStorage.setItem('mart_iyan_token', token);
    setActiveUser('IYAN');
    localStorage.setItem('mart_active_user', 'IYAN');
    setHasEnteredWorkspace(true);
    setIsUserModalOpen(false);
    setIsPasswordPromptOpen(false);
    showToast('Login IYAN berhasil. Otorisasi Import/Export XLSX aktif.', 'success');

    if (passwordPromptPurpose === 'open_import_export') {
      setIsImportExportOpen(true);
    } else if (passwordPromptPurpose === 'export_rekap') {
      exportInventoryToXLSX(items, stats || undefined);
      showToast('File Excel (.xlsx) data stok opname berhasil didownload!', 'success');
    }
  };

  // Open Import/Export XLSX modal - Strictly for user IYAN with password verification
  const handleOpenImportExport = (tab: 'import' | 'export' = 'import') => {
    if (activeUser !== 'IYAN') {
      showToast('Fitur Import/Export XLSX hanya dapat diakses oleh user IYAN.', 'alert');
      return;
    }
    setImportExportDefaultTab(tab);
    if (iyanToken) {
      setIsImportExportOpen(true);
    } else {
      setPasswordPromptPurpose('open_import_export');
      setIsPasswordPromptOpen(true);
    }
  };

  // Direct Export Data to XLSX Excel file (Only for user IYAN)
  const handleOpenExportXlsx = () => {
    if (activeUser !== 'IYAN') {
      showToast('Fitur Export XLSX hanya dapat diakses oleh user IYAN.', 'alert');
      return;
    }
    if (iyanToken) {
      exportInventoryToXLSX(items, stats || undefined);
      showToast('File Excel (.xlsx) data stok opname berhasil didownload!', 'success');
    } else {
      setPasswordPromptPurpose('export_rekap');
      setIsPasswordPromptOpen(true);
    }
  };

  // Coalescing ref for rapid +1 / -1 clicks per item so bursts never lose increments or race with Firestore echoes
  const pendingDeltaMapRef = useRef<
    Map<
      string,
      {
        initialQty: number;
        latestItem: InventoryItem;
        user: string;
        timer: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  // Initialize direct real-time Firebase Cloud Firestore connection (mounted once)
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsCloudConnected(connected);
    });

    // Real-time listener for Items from Firebase Cloud Firestore
    const unsubscribeItems = subscribeToFirestoreItems(
      (cloudItems) => {
        if (pendingDeltaMapRef.current.size > 0) {
          setItems(
            cloudItems.map((ci) => pendingDeltaMapRef.current.get(ci.id)?.latestItem ?? ci)
          );
        } else {
          setItems(cloudItems);
        }
        setIsLoading(false);
        setIsCloudConnected(true);
      },
      (err) => {
        console.warn('Firestore items subscription error:', err);
        setIsLoading(false);
      }
    );

    // Real-time listener for Audit Logs from Firebase Cloud Firestore
    const unsubscribeLogs = subscribeToFirestoreLogs((cloudLogs) => {
      setLogs(cloudLogs);
    });

    // Real-time listener for Users from Firebase Cloud Firestore
    // Always merge with the 5 core accounts (IYAN, HENDRI, AZYMA, RAIHAN, NURI) and seed any missing ones
    let hasSeededMissingDefaults = false;
    const unsubscribeUsers = subscribeToFirestoreUsers(
      (cloudUsers) => {
        const mergedUsers = mergeUsersWithDefaults(cloudUsers, INITIAL_USERS);
        setUsers(mergedUsers);

        if (!hasSeededMissingDefaults) {
          hasSeededMissingDefaults = true;
          const existingNames = new Set(
            cloudUsers.map((u) => (u?.name || '').trim().toUpperCase()).filter(Boolean)
          );
          const missingDefaults = INITIAL_USERS.filter(
            (def) => !existingNames.has(def.name.trim().toUpperCase())
          );
          if (missingDefaults.length > 0) {
            Promise.all(missingDefaults.map((defUser) => saveUserToFirestore(defUser))).catch((err) => {
              console.warn('Auto-seed default team accounts failed:', err);
            });
          }
        }
      },
      () => {
        setUsers((prev) => mergeUsersWithDefaults(prev, INITIAL_USERS));
      }
    );

    // Real-time listener for Opname Session (Tanggal opname & periode)
    const unsubscribeSession = subscribeToOpnameSession(
      (cloudSession) => {
        setSession(cloudSession);
      },
      (err) => {
        console.warn('Firestore opname session error:', err);
      }
    );

    // Real-time listener for Finance Record (Kas, Hutang Mitra, Saldo Santri, Piutang Marhalah)
    const unsubscribeFinance = subscribeToFinanceRecord(
      (cloudFinance) => {
        setFinance(cloudFinance);
      },
      (err) => {
        console.warn('Firestore finance record error:', err);
      }
    );

    return () => {
      unsubscribeItems();
      unsubscribeLogs();
      unsubscribeUsers();
      unsubscribeSession();
      unsubscribeFinance();
    };
  }, []);

  // Optional SSE presence fallback (only for local Node dev server; separated so user switching does not re-subscribe Firestore)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/events?user=${encodeURIComponent(activeUser)}`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'USER_STATUS' && payload.data.activeCount) {
            setActiveUsersCount(payload.data.activeCount);
          }
        } catch {
          // ignore
        }
      };
      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    } catch {
      // ignore
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [activeUser]);

  // Handler for saving Opname Session (Tanggal Opname)
  const handleSaveOpnameSession = async (updated: OpnameSession) => {
    try {
      markCloudSaving();
      await saveOpnameSessionToFirestore(updated);
      setSession(updated);
      markCloudSynced();
      showToast(`Tanggal opname otomatis tersimpan di Cloud: ${updated.opnameDate}`, 'success');
    } catch (err) {
      console.error(err);
      setCloudSyncStatus('error');
      showToast('Gagal menyimpan tanggal opname ke Firebase Cloud', 'alert');
    }
  };

  // Handler for saving Finance Record (Kas, Hutang, Piutang) with auto-save support
  const handleSaveFinanceRecord = async (updated: FinanceRecord, silent = false) => {
    try {
      markCloudSaving();
      await saveFinanceRecordToFirestore(updated);
      setFinance(updated);
      markCloudSynced();
      if (!silent) {
        showToast('Catatan Keuangan otomatis tersimpan ke Firebase Cloud!', 'success');
      }
    } catch (err) {
      console.error(err);
      setCloudSyncStatus('error');
      showToast('Gagal menyimpan data keuangan ke Firebase Cloud', 'alert');
      throw err;
    }
  };

  // Hardware Barcode Scanner Gun Keypress Listener (USB / Bluetooth HID)
  // Physical barcode scanners type characters in quick bursts (<50ms) followed by 'Enter'
  useEffect(() => {
    if (!hasEnteredWorkspace) return;

    let keyBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const currentTime = Date.now();
      const char = e.key;

      if (currentTime - lastKeyTime > 150) {
        keyBuffer = '';
      }
      lastKeyTime = currentTime;

      if (char === 'Enter') {
        if (keyBuffer.length >= 3) {
          e.preventDefault();
          const scannedCode = keyBuffer.trim();
          keyBuffer = '';
          handleHardwareScan(scannedCode);
        }
        keyBuffer = '';
      } else if (char.length === 1) {
        keyBuffer += char;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeUser, soundEnabled, items, hasEnteredWorkspace]);

  // Process hardware barcode / QR code scanner hit directly against Firebase Cloud Firestore
  const handleHardwareScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const matchingItems = findItemsByScan(items, trimmed);
    const item = matchingItems[0];

    if (item) {
      if (matchingItems.length > 1) {
        showToast(
          `⚠️ Perhatian: Kode "${trimmed}" ganda (${matchingItems.length} barang berbeda). Stok dicatat ke: ${item.namaBarang}`,
          'alert'
        );
      }
      const prevQty = item.quantity || 0;
      const newQty = prevQty + 1;
      const now = new Date().toISOString();
      const updatedItem: InventoryItem = {
        ...item,
        quantity: newQty,
        lastUpdatedBy: activeUser,
        updatedAt: now,
      };

      // 1. Instant Optimistic UI Update (0ms response)
      setItems((prevItems) => prevItems.map((i) => (i.id === item.id ? updatedItem : i)));
      setActiveCountingItemId(item.id);
      if (soundEnabled) playScanSuccessSound();
      if (matchingItems.length === 1) {
        showToast(`[Hardware Scanner] +1 ${item.namaBarang} (Total: ${newQty} pcs)`, 'success');
      }

      const log: ScanAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId: item.id,
        sku: item.sku,
        namaBarang: item.namaBarang,
        barcode: item.barcode,
        user: activeUser,
        action: 'SCAN_INCREMENT',
        previousQty: prevQty,
        newQty,
        delta: 1,
        notes: item.keterangan,
        timestamp: now,
      };

      try {
        markCloudSaving();
        await saveItemToFirestore(updatedItem);
        await saveLogToFirestore(log);
        markCloudSynced();
      } catch (err) {
        console.error('Scan save error:', err);
        setCloudSyncStatus('error');
      }
    } else {
      if (soundEnabled) playScanWarningSound();
      showToast(`[Hardware Scanner] Kode "${trimmed}" belum terdaftar!`, 'alert');
      const candidates = extractScanCandidates(trimmed);
      setPrefilledBarcode(candidates[0] || trimmed);
      setEditingItem(null);
      setIsItemFormOpen(true);
    }
  };

  // Handle Camera Barcode & QR Code Scan Result (supports Calculator mode and Increment mode)
  const handleCameraScanResult = async (
    barcode: string,
    mode: 'calculator' | 'increment'
  ): Promise<{ success: boolean; item?: InventoryItem; notFound?: boolean }> => {
    const code = barcode.trim();
    if (!code) return { success: false };

    const matching = findItemsByScan(items, code);
    const local = matching[0];

    if (matching.length > 1) {
      showToast(`⚠️ Perhatian: Kode terdeteksi ganda (${matching.length} barang berbeda)!`, 'alert');
    }

    if (mode === 'calculator') {
      if (local) {
        setActiveCountingItemId(local.id);
        return { success: true, item: local };
      }
      return { success: false, notFound: true };
    }

    if (local) {
      const prevQty = local.quantity || 0;
      const newQty = prevQty + 1;
      const now = new Date().toISOString();
      const updatedItem: InventoryItem = {
        ...local,
        quantity: newQty,
        lastUpdatedBy: activeUser,
        updatedAt: now,
      };

      // 1. Instant Optimistic UI Update (0ms response)
      setItems((prevItems) => prevItems.map((i) => (i.id === local.id ? updatedItem : i)));
      setActiveCountingItemId(local.id);
      if (soundEnabled) playScanSuccessSound();
      showToast(`+1 ${local.namaBarang} (Total: ${newQty} pcs)`, 'success');

      const log: ScanAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId: local.id,
        sku: local.sku,
        namaBarang: local.namaBarang,
        barcode: local.barcode,
        user: activeUser,
        action: 'SCAN_INCREMENT',
        previousQty: prevQty,
        newQty,
        delta: 1,
        notes: local.keterangan,
        timestamp: now,
      };
      try {
        markCloudSaving();
        await saveItemToFirestore(updatedItem);
        await saveLogToFirestore(log);
        markCloudSynced();
        return { success: true, item: updatedItem };
      } catch {
        setCloudSyncStatus('error');
        return { success: false };
      }
    } else {
      return { success: false, notFound: true };
    }
  };

  // Submit handler for Barcode & QR Code Search: opens calculator for item or registers new
  const handleBarcodeSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    const matching = findItemsByScan(items, query);
    const found = matching.length > 0 ? matching[0] : items.find(
      (i) => (i.barcode && i.barcode.toLowerCase() === query.toLowerCase()) || i.sku.toLowerCase() === query.toLowerCase()
    );

    if (found) {
      setActiveCountingItemId(found.id);
      if (soundEnabled) playScanSuccessSound();
      if (isDesktopViewport) {
        setCalcTargetItem(found);
        setIsGlobalCalcOpen(true);
        showToast(`[Kalkulator] ${found.namaBarang} siap dihitung.`, 'info');
      } else {
        showToast(`[Aktif] ${found.namaBarang} dimuat di Kalkulator Box.`, 'success');
      }
      setSearchQuery('');
    } else {
      if (soundEnabled) playScanWarningSound();
      showToast(`Kode "${query}" belum terdaftar. Tambahkan sebagai barang baru?`, 'alert');
      const candidates = extractScanCandidates(query);
      setPrefilledBarcode(candidates[0] || query);
      setEditingItem(null);
      setIsItemFormOpen(true);
    }
  };

  // Quick adjust quantity via table buttons (+1 / -1) with 0ms optimistic update & burst coalescing to Firebase Cloud
  const activeUserRef = useRef(activeUser);
  activeUserRef.current = activeUser;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const handleQuickDelta = useCallback((itemId: string, delta: number) => {
    const user = activeUserRef.current;
    const now = new Date().toISOString();

    if (soundEnabledRef.current) {
      playScanSuccessSound();
    }

    setItems((prevItems) => {
      let updatedItem: InventoryItem | null = null;
      let prevQty = 0;

      const nextItems = prevItems.map((i) => {
        if (i.id !== itemId) return i;
        prevQty = i.quantity || 0;
        const newQty = Math.max(0, prevQty + delta);
        updatedItem = {
          ...i,
          quantity: newQty,
          lastUpdatedBy: user,
          updatedAt: now,
        };
        return updatedItem;
      });

      if (!updatedItem) return prevItems;

      const existingPending = pendingDeltaMapRef.current.get(itemId);
      if (existingPending) {
        clearTimeout(existingPending.timer);
      }

      const initialQty = existingPending ? existingPending.initialQty : prevQty;
      const finalItem = updatedItem as InventoryItem;

      const timer = setTimeout(async () => {
        const entry = pendingDeltaMapRef.current.get(itemId);
        pendingDeltaMapRef.current.delete(itemId);
        if (!entry) return;

        const netDelta = entry.latestItem.quantity - entry.initialQty;
        const log: ScanAuditLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: entry.latestItem.id,
          sku: entry.latestItem.sku,
          namaBarang: entry.latestItem.namaBarang,
          barcode: entry.latestItem.barcode,
          user: entry.user,
          action: netDelta > 0 ? 'SCAN_INCREMENT' : 'SET_QUANTITY',
          previousQty: entry.initialQty,
          newQty: entry.latestItem.quantity,
          delta: netDelta,
          notes: entry.latestItem.keterangan,
          timestamp: entry.latestItem.updatedAt,
        };

        try {
          markCloudSaving();
          await Promise.all([
            saveItemToFirestore(entry.latestItem),
            saveLogToFirestore(log),
          ]);
          markCloudSynced();
        } catch (err) {
          console.error('Quick delta error:', err);
          setCloudSyncStatus('error');
        }
      }, 160);

      pendingDeltaMapRef.current.set(itemId, {
        initialQty,
        latestItem: finalItem,
        user,
        timer,
      });

      return nextItems;
    });
  }, [markCloudSaving, markCloudSynced]);

  // Save new or edited item directly to Firebase Cloud
  const handleSaveItem = async (itemData: Partial<InventoryItem>): Promise<boolean> => {
    try {
      const isEdit = Boolean(itemData.id);
      const now = new Date().toISOString();

      if (isEdit && itemData.id) {
        const existing = items.find((i) => i.id === itemData.id);
        const prevQty = existing?.quantity || 0;
        const newQty = itemData.quantity !== undefined ? Number(itemData.quantity) : prevQty;
        const updatedItem: InventoryItem = {
          id: itemData.id,
          sku: (itemData.sku || existing?.sku || '').trim().toUpperCase(),
          namaBarang: (itemData.namaBarang || existing?.namaBarang || '').trim(),
          barcode: (itemData.barcode !== undefined ? itemData.barcode : existing?.barcode || '').trim(),
          kategori: itemData.kategori || existing?.kategori || 'Umum',
          satuan: itemData.satuan || existing?.satuan || 'pcs',
          quantity: newQty,
          quantitySystem: itemData.quantitySystem !== undefined ? Number(itemData.quantitySystem) : (existing?.quantitySystem || 0),
          stokAwal: itemData.stokAwal !== undefined ? Number(itemData.stokAwal) : (existing?.stokAwal ?? existing?.quantitySystem ?? 0),
          stokMinimum: itemData.stokMinimum !== undefined ? Number(itemData.stokMinimum) : (existing?.stokMinimum ?? 5),
          hargaModal: itemData.hargaModal !== undefined ? Number(itemData.hargaModal) : (existing?.hargaModal || 0),
          hargaJual: itemData.hargaJual !== undefined ? Number(itemData.hargaJual) : (existing?.hargaJual || 0),
          status: itemData.status || existing?.status || 'AKTIF',
          keterangan: itemData.keterangan !== undefined ? itemData.keterangan : (existing?.keterangan || ''),
          lastUpdatedBy: activeUser,
          updatedAt: now,
        };

        // Instant Optimistic Update
        setItems((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));

        const log: ScanAuditLog = {
          id: `log-${Date.now()}`,
          itemId: updatedItem.id,
          sku: updatedItem.sku,
          namaBarang: updatedItem.namaBarang,
          barcode: updatedItem.barcode,
          user: activeUser,
          action: 'UPDATE_ITEM',
          previousQty: prevQty,
          newQty,
          delta: newQty - prevQty,
          notes: updatedItem.keterangan || 'Update detail barang',
          timestamp: now,
        };

        markCloudSaving();
        await saveItemToFirestore(updatedItem);
        await saveLogToFirestore(log);
        markCloudSynced();
        showToast(`Barang ${updatedItem.namaBarang} berhasil diperbarui di Cloud.`, 'success');
        return true;
      } else {
        const cleanSku = (itemData.sku || `SKU-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
        const newItem: InventoryItem = {
          id: `item-${Date.now()}`,
          sku: cleanSku,
          namaBarang: (itemData.namaBarang || 'Barang Baru').trim(),
          barcode: (itemData.barcode || '').trim(),
          kategori: itemData.kategori || 'Umum',
          satuan: itemData.satuan || 'pcs',
          quantity: Math.max(0, Number(itemData.quantity) || 0),
          quantitySystem: Math.max(0, Number(itemData.quantitySystem) || 0),
          stokAwal: itemData.stokAwal !== undefined ? Math.max(0, Number(itemData.stokAwal)) : Math.max(0, Number(itemData.quantitySystem) || 0),
          stokMinimum: itemData.stokMinimum !== undefined ? Math.max(0, Number(itemData.stokMinimum)) : 5,
          hargaModal: Math.max(0, Number(itemData.hargaModal) || 0),
          hargaJual: Math.max(0, Number(itemData.hargaJual) || 0),
          status: itemData.status || 'AKTIF',
          keterangan: itemData.keterangan || 'Barang Baru Ditambahkan',
          lastUpdatedBy: activeUser,
          updatedAt: now,
        };

        // Instant Optimistic Update
        setItems((prev) => [newItem, ...prev]);

        const log: ScanAuditLog = {
          id: `log-${Date.now()}`,
          itemId: newItem.id,
          sku: newItem.sku,
          namaBarang: newItem.namaBarang,
          barcode: newItem.barcode,
          user: activeUser,
          action: 'ADD_ITEM',
          previousQty: 0,
          newQty: newItem.quantity,
          delta: newItem.quantity,
          notes: 'Penambahan barang baru',
          timestamp: now,
        };

        markCloudSaving();
        await saveItemToFirestore(newItem);
        await saveLogToFirestore(log);
        markCloudSynced();
        showToast(`Barang baru ${newItem.namaBarang} berhasil ditambahkan ke Cloud.`, 'success');
        return true;
      }
    } catch (err) {
      console.error('Error saving item:', err);
      setCloudSyncStatus('error');
      showToast('Gagal menyimpan barang ke Firebase Cloud.', 'alert');
      return false;
    }
  };

  // Delete item with in-app confirmation directly in Firebase Cloud
  const handleDeleteItem = (item: InventoryItem) => {
    setDeleteConfirmItem(item);
  };

  const executeDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    const item = deleteConfirmItem;
    setDeleteConfirmItem(null);

    // Instant Optimistic Update
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      markCloudSaving();
      await deleteItemFromFirestore(item.id);
      const log: ScanAuditLog = {
        id: `log-${Date.now()}`,
        itemId: item.id,
        sku: item.sku,
        namaBarang: item.namaBarang,
        barcode: item.barcode,
        user: activeUser,
        action: 'DELETE_ITEM',
        previousQty: item.quantity,
        newQty: 0,
        delta: -item.quantity,
        notes: `Barang dihapus oleh ${activeUser}`,
        timestamp: new Date().toISOString(),
      };
      await saveLogToFirestore(log);
      markCloudSynced();
      showToast(`Barang ${item.namaBarang} telah dihapus dari Cloud.`, 'alert');
    } catch (err) {
      console.error('Error deleting item:', err);
      setCloudSyncStatus('error');
    }
  };

  // Save Quick Adjust dialog directly to Firebase Cloud
  const handleSaveQuickAdjust = async (itemId: string, newQuantity: number, notes?: string): Promise<boolean> => {
    try {
      const target = items.find((i) => i.id === itemId);
      if (!target) return false;

      const prevQty = target.quantity || 0;
      const updatedItem: InventoryItem = {
        ...target,
        quantity: Math.max(0, newQuantity),
        lastUpdatedBy: activeUser,
        updatedAt: new Date().toISOString(),
        keterangan: notes || target.keterangan,
      };

      // Instant Optimistic Update
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      if (soundEnabled) playScanSuccessSound();

      const log: ScanAuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId: target.id,
        sku: target.sku,
        namaBarang: target.namaBarang,
        barcode: target.barcode,
        user: activeUser,
        action: 'SET_QUANTITY',
        previousQty: prevQty,
        newQty: Math.max(0, newQuantity),
        delta: Math.max(0, newQuantity) - prevQty,
        notes: notes || target.keterangan,
        timestamp: updatedItem.updatedAt,
      };

      markCloudSaving();
      await saveItemToFirestore(updatedItem);
      await saveLogToFirestore(log);
      markCloudSynced();
      showToast(`Stok fisik ${target.namaBarang} diset ke ${newQuantity} pcs.`, 'success');
      return true;
    } catch (err) {
      console.error('Error quick adjust:', err);
      setCloudSyncStatus('error');
      return false;
    }
  };

  // Add new user directly to Firebase Cloud
  const handleAddUser = async (name: string, role: string, color?: string): Promise<boolean> => {
    try {
      const cleanName = name.trim().toUpperCase();
      if (!cleanName || users.some((u) => u.name.trim().toUpperCase() === cleanName)) {
        return false;
      }
      const palette = ['#0284c7', '#059669', '#7c3aed', '#ea580c', '#db2777', '#ca8a04', '#0d9488', '#4f46e5'];
      const assignedColor = color || palette[users.length % palette.length];
      const newUser: MartUser = {
        id: `usr-${Date.now()}`,
        name: cleanName,
        role: role.trim() || 'Petugas Opname',
        color: assignedColor,
        createdAt: new Date().toISOString(),
      };
      markCloudSaving();
      await saveUserToFirestore(newUser);
      markCloudSynced();
      showToast(`Petugas baru "${cleanName}" berhasil didaftarkan di Cloud.`, 'success');
      handleSelectActiveUser(cleanName);
      return true;
    } catch {
      setCloudSyncStatus('error');
      return false;
    }
  };

  // Batch import XLSX directly to Firebase Cloud (Strictly restricted to user IYAN with valid authentication)
  const handleBatchImport = async (importItems: Partial<InventoryItem>[], mode: 'merge' | 'replace'): Promise<boolean> => {
    if (activeUser !== 'IYAN') {
      showToast('Akses Ditolak: Hanya user IYAN yang berhak melakukan import data.', 'alert');
      return false;
    }

    try {
      markCloudSaving();
      let importedCount = 0;
      let updatedCount = 0;
      const now = new Date().toISOString();

      // Pemeriksaan SKU: pastikan seluruh barang memiliki SKU berurutan dan mengisi celah nomor terlewat
      const { items: normalizedBatch, report: skuReport } = assignSequentialMissingSKUs(
        importItems,
        items,
        mode
      );

      if (mode === 'replace') {
        const fullItems: InventoryItem[] = normalizedBatch.map((raw, idx) => ({
          id: raw.id || `item-imp-${Date.now()}-${idx}`,
          sku: String(raw.sku).trim().toUpperCase(),
          namaBarang: String(raw.namaBarang || 'Barang Tanpa Nama').trim(),
          barcode: String(raw.barcode || '').trim(),
          kategori: String(raw.kategori || 'Umum').trim(),
          satuan: String(raw.satuan || 'pcs').trim(),
          quantity: Math.max(0, Number(raw.quantity !== undefined ? raw.quantity : raw.stokAwal) || 0),
          quantitySystem: Math.max(0, Number(raw.quantitySystem !== undefined ? raw.quantitySystem : (raw.stokAwal !== undefined ? raw.stokAwal : raw.quantity)) || 0),
          stokAwal: Math.max(0, Number(raw.stokAwal !== undefined ? raw.stokAwal : raw.quantitySystem) || 0),
          stokMinimum: Math.max(0, Number(raw.stokMinimum !== undefined ? raw.stokMinimum : 5)),
          hargaModal: Math.max(0, Number(raw.hargaModal) || 0),
          hargaJual: Math.max(0, Number(raw.hargaJual) || 0),
          status: raw.status || 'AKTIF',
          keterangan: String(raw.keterangan || 'Import XLSX').trim(),
          isSkuAutoGenerated: raw.isSkuAutoGenerated,
          isGapFilled: raw.isGapFilled,
          lastUpdatedBy: 'IYAN',
          updatedAt: now,
        }));
        await replaceAllItemsInFirestore(fullItems);
        importedCount = fullItems.length;
      } else {
        const updatedList: InventoryItem[] = [...items];
        normalizedBatch.forEach((raw, idx) => {
          const rawSku = String(raw.sku || '').trim().toUpperCase();
          const rawBarcode = String(raw.barcode || '').trim();

          const existingIndex = updatedList.findIndex(
            (i) => (rawSku && i.sku.toUpperCase() === rawSku) || (rawBarcode && i.barcode === rawBarcode)
          );

          if (existingIndex >= 0) {
            const existing = updatedList[existingIndex];
            updatedList[existingIndex] = {
              ...existing,
              namaBarang: raw.namaBarang ? String(raw.namaBarang).trim() : existing.namaBarang,
              kategori: raw.kategori ? String(raw.kategori).trim() : existing.kategori,
              satuan: raw.satuan ? String(raw.satuan).trim() : (existing.satuan || 'pcs'),
              quantity: raw.quantity !== undefined ? Math.max(0, Number(raw.quantity)) : existing.quantity,
              quantitySystem: raw.quantitySystem !== undefined ? Math.max(0, Number(raw.quantitySystem)) : (raw.stokAwal !== undefined ? Math.max(0, Number(raw.stokAwal)) : existing.quantitySystem),
              stokAwal: raw.stokAwal !== undefined ? Math.max(0, Number(raw.stokAwal)) : (existing.stokAwal ?? existing.quantitySystem),
              stokMinimum: raw.stokMinimum !== undefined ? Math.max(0, Number(raw.stokMinimum)) : (existing.stokMinimum ?? 5),
              hargaModal: raw.hargaModal !== undefined ? Math.max(0, Number(raw.hargaModal)) : existing.hargaModal,
              hargaJual: raw.hargaJual !== undefined ? Math.max(0, Number(raw.hargaJual)) : (existing.hargaJual || 0),
              status: raw.status || existing.status || 'AKTIF',
              keterangan: raw.keterangan !== undefined ? String(raw.keterangan) : existing.keterangan,
              isSkuAutoGenerated: raw.isSkuAutoGenerated !== undefined ? raw.isSkuAutoGenerated : existing.isSkuAutoGenerated,
              isGapFilled: raw.isGapFilled !== undefined ? raw.isGapFilled : existing.isGapFilled,
              lastUpdatedBy: 'IYAN',
              updatedAt: now,
            };
            updatedCount++;
          } else {
            updatedList.push({
              id: `item-imp-${Date.now()}-${idx}`,
              sku: rawSku,
              namaBarang: String(raw.namaBarang || 'Barang Baru').trim(),
              barcode: rawBarcode || `BAR-${Date.now().toString().slice(-6)}-${idx}`,
              kategori: String(raw.kategori || 'Umum').trim(),
              satuan: String(raw.satuan || 'pcs').trim(),
              quantity: Math.max(0, Number(raw.quantity !== undefined ? raw.quantity : raw.stokAwal) || 0),
              quantitySystem: Math.max(0, Number(raw.quantitySystem !== undefined ? raw.quantitySystem : (raw.stokAwal !== undefined ? raw.stokAwal : raw.quantity)) || 0),
              stokAwal: Math.max(0, Number(raw.stokAwal !== undefined ? raw.stokAwal : raw.quantitySystem) || 0),
              stokMinimum: Math.max(0, Number(raw.stokMinimum !== undefined ? raw.stokMinimum : 5)),
              hargaModal: Math.max(0, Number(raw.hargaModal) || 0),
              hargaJual: Math.max(0, Number(raw.hargaJual) || 0),
              status: raw.status || 'AKTIF',
              keterangan: String(raw.keterangan || 'Import XLSX').trim(),
              isSkuAutoGenerated: raw.isSkuAutoGenerated,
              isGapFilled: raw.isGapFilled,
              lastUpdatedBy: 'IYAN',
              updatedAt: now,
            });
            importedCount++;
          }
        });
        await batchSaveItemsToFirestore(updatedList);
      }

      const log: ScanAuditLog = {
        id: `log-${Date.now()}`,
        itemId: 'batch-import',
        sku: 'BATCH',
        namaBarang: `Import XLSX (${importedCount} baru, ${updatedCount} diperbarui)`,
        barcode: '-',
        user: 'IYAN',
        action: 'IMPORT_XLSX',
        previousQty: 0,
        newQty: mode === 'replace' ? importedCount : items.length + importedCount,
        delta: importedCount,
        notes: `Mode: ${mode}${skuReport.missingSkuCount > 0 ? ` | ${skuReport.missingSkuCount} SKU dibuatkan otomatis (${skuReport.gapFilledCount} isi nomor terlewat)` : ''}`,
        timestamp: now,
      };
      await saveLogToFirestore(log);
      markCloudSynced();

      let toastDetail = `Import XLSX tersimpan di Cloud: ${importedCount} baru, ${updatedCount} diperbarui.`;
      if (skuReport.missingSkuCount > 0) {
        toastDetail += ` Dibuatkan ${skuReport.missingSkuCount} SKU berurutan otomatis${skuReport.gapFilledCount > 0 ? ` (${skuReport.gapFilledCount} mengisi nomor terlewat)` : ''}.`;
      }
      showToast(toastDetail, 'success');
      return true;
    } catch (err) {
      console.error('Error batch import:', err);
      setCloudSyncStatus('error');
      showToast('Gagal memproses import data ke Firebase Cloud.', 'alert');
      return false;
    }
  };

  // Reset all counts for a new session directly in Firebase Cloud
  const handleResetSession = () => {
    setIsResetConfirmModalOpen(true);
  };

  const executeResetSession = async () => {
    setIsResetConfirmModalOpen(false);
    try {
      markCloudSaving();
      const now = new Date().toISOString();
      const resetItems: InventoryItem[] = items.map((i) => ({
        ...i,
        quantity: 0,
        lastUpdatedBy: activeUser,
        updatedAt: now,
      }));
      await batchSaveItemsToFirestore(resetItems);
      const resetLog: ScanAuditLog = {
        id: `log-${Date.now()}`,
        itemId: 'all',
        sku: 'RESET',
        namaBarang: 'Reset Semua Stok Fisik Menjadi 0 untuk Sesi Opname Baru',
        barcode: '-',
        user: activeUser,
        action: 'SET_QUANTITY',
        previousQty: 0,
        newQty: 0,
        delta: 0,
        notes: 'Reset sesi stok opname baru',
        timestamp: now,
      };
      await saveLogToFirestore(resetLog);
      markCloudSynced();
      showToast('Semua stok fisik telah di-reset ke 0 di Firebase Cloud.', 'alert');
    } catch (err) {
      console.error('Reset error:', err);
      setCloudSyncStatus('error');
      showToast('Gagal mereset sesi opname di Firebase Cloud.', 'alert');
    }
  };

  // Wipe all demo items from Firestore permanently
  const executeClearAllDemoData = async () => {
    setIsClearDemoModalOpen(false);
    const prevCount = items.length;
    try {
      setIsLoading(true);
      markCloudSaving();
      await clearAllItemsFromFirestore();
      setItems([]);
      const log: ScanAuditLog = {
        id: `log-${Date.now()}`,
        itemId: 'all',
        sku: 'WIPE_DEMO',
        namaBarang: 'Pembersihan Total Data Demo Toko',
        barcode: '-',
        user: activeUser,
        action: 'DELETE_ITEM',
        previousQty: prevCount,
        newQty: 0,
        delta: -prevCount,
        notes: `Semua data demo (${prevCount} item) dihapus permanen oleh ${activeUser}`,
        timestamp: new Date().toISOString(),
      };
      await saveLogToFirestore(log);
      markCloudSynced();
      showToast('Semua data demo berhasil dihapus dari Firebase Cloud. Database siap diisi barang riil mart.', 'success');
    } catch (err) {
      console.error('Clear all error:', err);
      setCloudSyncStatus('error');
      showToast('Gagal menghapus data demo di Firebase Cloud.', 'alert');
    } finally {
      setIsLoading(false);
    }
  };

  // Analysis of duplicate SKUs and Barcodes across all items
  const duplicateAnalysis = useMemo(() => {
    const skuMap = new Map<string, InventoryItem[]>();
    const barcodeMap = new Map<string, InventoryItem[]>();

    items.forEach((item) => {
      const s = (item.sku || '').trim().toUpperCase();
      if (s) {
        const list = skuMap.get(s) || [];
        list.push(item);
        skuMap.set(s, list);
      }

      const b = (item.barcode || '').trim();
      if (b && b !== '-' && b !== '0') {
        const list = barcodeMap.get(b) || [];
        list.push(item);
        barcodeMap.set(b, list);
      }
    });

    const duplicateSkus = new Map<string, InventoryItem[]>();
    skuMap.forEach((itemList, s) => {
      if (itemList.length > 1) {
        duplicateSkus.set(s, itemList);
      }
    });

    const duplicateBarcodes = new Map<string, InventoryItem[]>();
    barcodeMap.forEach((itemList, b) => {
      if (itemList.length > 1) {
        duplicateBarcodes.set(b, itemList);
      }
    });

    const duplicateItemIds = new Set<string>();
    duplicateSkus.forEach((list) => list.forEach((i) => duplicateItemIds.add(i.id)));
    duplicateBarcodes.forEach((list) => list.forEach((i) => duplicateItemIds.add(i.id)));

    return {
      duplicateSkus,
      duplicateBarcodes,
      duplicateItemIds,
      hasDuplicates: duplicateItemIds.size > 0,
      totalDuplicateSkus: duplicateSkus.size,
      totalDuplicateBarcodes: duplicateBarcodes.size,
      totalAffectedItems: duplicateItemIds.size,
    };
  }, [items]);

  // Defer search query so typing and button clicks stay instant on large inventories
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search filter (Default Barcode Scanner search prioritized)
        if (deferredSearchQuery.trim()) {
          const q = deferredSearchQuery.toLowerCase().trim();
          if (searchMode === 'barcode') {
            const matchBarcode = item.barcode.toLowerCase().includes(q);
            const matchSku = item.sku.toLowerCase().includes(q);
            if (!matchBarcode && !matchSku) {
              if (!item.namaBarang.toLowerCase().includes(q)) return false;
            }
          } else {
            const matchSku = item.sku.toLowerCase().includes(q);
            const matchName = item.namaBarang.toLowerCase().includes(q);
            const matchBarcode = item.barcode.toLowerCase().includes(q);
            const matchNotes = (item.keterangan || '').toLowerCase().includes(q);
            if (!matchSku && !matchName && !matchBarcode && !matchNotes) return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'ALL' && (item.kategori || '').trim() !== selectedCategory) {
          return false;
        }

        // Discrepancy & Duplicate filter
        const diff = (item.quantity || 0) - (item.quantitySystem || 0);
        if (discrepancyFilter === 'MATCH' && diff !== 0) return false;
        if (discrepancyFilter === 'MINUS' && diff >= 0) return false;
        if (discrepancyFilter === 'PLUS' && diff <= 0) return false;
        if (discrepancyFilter === 'UNCOUNTED' && (item.quantity || 0) > 0) return false;
        if (discrepancyFilter === 'DUPLICATE' && !duplicateAnalysis.duplicateItemIds.has(item.id)) return false;

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'nama') {
          comp = a.namaBarang.localeCompare(b.namaBarang);
        } else if (sortBy === 'sku') {
          comp = a.sku.localeCompare(b.sku);
        } else if (sortBy === 'qty') {
          comp = a.quantity - b.quantity;
        } else if (sortBy === 'modal') {
          comp = a.hargaModal - b.hargaModal;
        } else if (sortBy === 'totalModal') {
          comp = a.quantity * a.hargaModal - b.quantity * b.hargaModal;
        } else if (sortBy === 'selisih') {
          comp = (a.quantity - a.quantitySystem) - (b.quantity - b.quantitySystem);
        }
        return sortOrder === 'desc' ? -comp : comp;
      });
  }, [items, deferredSearchQuery, searchMode, selectedCategory, discrepancyFilter, sortBy, sortOrder, duplicateAnalysis]);

  // Progressive chunking so rendering 1,000+ rows stays <10ms on clicks, filters, and tab switches
  const [visibleLimit, setVisibleLimit] = useState(120);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleLimit(120);
  }, [deferredSearchQuery, searchMode, selectedCategory, discrepancyFilter, sortBy, sortOrder]);

  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, visibleLimit);
  }, [filteredItems, visibleLimit]);

  const hasMoreVisibleItems = visibleLimit < filteredItems.length;

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMoreVisibleItems) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleLimit((prev) => prev + 120);
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreVisibleItems, isDesktopViewport, activeViewTab]);

  // Memoized total modal for footer summary (avoids inline reduce on unrelated state updates)
  const filteredTotalModal = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + (curr.quantity || 0) * (curr.hargaModal || 0), 0);
  }, [filteredItems]);

  // Stable row action callbacks for React.memo InventoryRows
  const handleRowOpenCalc = useCallback((item: InventoryItem) => {
    setCalcTargetItem(item);
    setIsGlobalCalcOpen(true);
  }, []);

  const handleRowEdit = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setIsItemFormOpen(true);
  }, []);

  const handleRowQuickAdjust = useCallback((item: InventoryItem) => {
    setQuickAdjustItem(item);
  }, []);

  const handleRowDelete = useCallback((item: InventoryItem) => {
    setDeleteConfirmItem(item);
  }, []);

  const handleRowOpenDuplicate = useCallback(() => {
    setIsDuplicateModalOpen(true);
  }, []);

  // Unique categories list dynamically derived from imported items
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const cat = (i.kategori || '').trim();
      if (cat) {
        set.add(cat);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [items]);

  // Item counts per category for the filter dropdown
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => {
      const cat = (i.kategori || '').trim() || 'Umum';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [items]);

  // Auto-reset category filter if the active category is no longer in imported items
  useEffect(() => {
    if (selectedCategory !== 'ALL' && availableCategories.length > 0 && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory('ALL');
    }
  }, [availableCategories, selectedCategory]);

  // Current active user object
  const currentUserObj = users.find((u) => u.name === activeUser) || users[0];

  return (
    <div
      className={`${
        hasEnteredWorkspace ? 'min-h-screen md:h-screen md:overflow-hidden' : 'min-h-screen overflow-y-auto'
      } bg-[#faf8ff] dark:bg-slate-950 text-[#131b2e] dark:text-slate-100 flex flex-col font-sans transition-colors duration-150`}
    >
      {/* Real-time floating toast (positioned above mobile bottom dock & non-blocking wrapper) */}
      {liveToast && (
        <div className="fixed bottom-24 md:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 flex justify-end pointer-events-none">
          <div
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-xl border text-xs font-medium flex items-center gap-2.5 transition-all max-w-sm ${
              liveToast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : liveToast.type === 'alert'
                ? 'bg-amber-900 text-white border-amber-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                liveToast.type === 'success'
                  ? 'bg-emerald-400'
                  : liveToast.type === 'alert'
                  ? 'bg-amber-400'
                  : 'bg-blue-400'
              }`}
            />
            <span className="flex-1">{liveToast.message}</span>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="p-1 -mr-1 text-slate-400 hover:text-white transition-colors"
              aria-label="Tutup notifikasi"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {!hasEnteredWorkspace ? (
        <AccountSelectionLanding
          users={users}
          lastSelectedUser={activeUser}
          iyanUnlocked={Boolean(iyanToken)}
          session={session}
          totalItemsCount={items.length}
          countedItemsCount={stats?.countedItemsCount || 0}
          isLoadingData={isLoading}
          isCloudConnected={isCloudConnected}
          themeMode={themeMode}
          isDark={isDark}
          onThemeChange={setThemeMode}
          onSelectAccount={handleSelectActiveUser}
          onAddUser={handleAddUser}
        />
      ) : isDesktopViewport ? (
        /* PC & TABLET (>=768px): Material-3 Web Dashboard Shell (Collapsible Sidebar + Fit-to-Screen Main Viewport) */
        <DesktopDashboardWorkspace
          items={items}
          filteredItems={filteredItems}
          visibleItems={visibleItems}
          hasMoreVisibleItems={hasMoreVisibleItems}
          onLoadMore={() => setVisibleLimit((prev) => prev + 120)}
          onShowAll={() => setVisibleLimit(filteredItems.length)}
          loadMoreSentinelRef={loadMoreSentinelRef}
          filteredTotalModal={filteredTotalModal}
          stats={stats}
          isLoading={isLoading}
          session={session}
          activeUser={activeUser}
          currentUserObj={currentUserObj}
          activeUsersCount={activeUsersCount}
          isCloudConnected={isCloudConnected}
          cloudSyncStatus={cloudSyncStatus}
          logs={logs}
          themeMode={themeMode}
          isDark={isDark}
          onThemeChange={setThemeMode}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          activeViewTab={activeViewTab}
          onSelectViewTab={handleSelectViewTab}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onBarcodeSearchSubmit={handleBarcodeSearchSubmit}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          availableCategories={availableCategories}
          categoryCounts={categoryCounts}
          discrepancyFilter={discrepancyFilter}
          onChangeDiscrepancyFilter={setDiscrepancyFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onChangeSort={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
          }}
          duplicateAnalysis={duplicateAnalysis}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenAddItem={() => {
            setEditingItem(null);
            setPrefilledBarcode('');
            setIsItemFormOpen(true);
          }}
          onOpenCalculator={() => {
            setCalcTargetItem(null);
            setIsGlobalCalcOpen(true);
          }}
          onOpenOpnameDate={() => setIsOpnameDateModalOpen(true)}
          onOpenFinance={() => setIsFinanceModalOpen(true)}
          onOpenImportExport={(tab) => handleOpenImportExport(tab || 'import')}
          onOpenExportXlsx={() => handleOpenImportExport('export')}
          onOpenLaporanHasil={() => setIsLaporanHasilOpnameOpen(true)}
          onOpenAuditLogs={() => setIsAuditDrawerOpen(true)}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onOpenDisplayOptions={() => setIsDisplayMenuOpen(true)}
          onOpenDuplicateModal={() => setIsDuplicateModalOpen(true)}
          showResetButton={showResetButton}
          onResetSession={handleResetSession}
          onQuickDelta={handleQuickDelta}
          onQuickAdjust={handleRowQuickAdjust}
          onOpenCalcItem={handleRowOpenCalc}
          onEditItem={handleRowEdit}
          onDeleteItem={handleRowDelete}
        />
      ) : (
        /* MOBILE (<768px): Material-3 Mobile Shell */
        <>
          <header className="shrink-0 sticky top-0 z-40 pt-safe bg-[#faf8ff]/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(19,27,46,0.05)] border-b border-[#c3c6d7]/30 dark:border-slate-800 transition-colors">
            <div className="h-16 px-3.5 flex items-center justify-between gap-2.5">
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Store className="w-4 h-4 text-[#004ac6] dark:text-blue-400 shrink-0" />
                  <span className="text-sm font-bold text-[#131b2e] dark:text-white truncate">
                    DR MART
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#eaedff] dark:bg-slate-800 text-[10px] font-mono font-semibold text-[#434655] dark:text-slate-300 truncate max-w-[110px]">
                    {session.opnameDate}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-medium text-[#434655] dark:text-slate-400 truncate">
                    {activeUser} ({currentUserObj?.role || 'Petugas Opname'})
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      cloudSyncStatus === 'saving'
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                        : cloudSyncStatus === 'error'
                        ? 'bg-[#ffdad6] dark:bg-rose-950/70 text-[#ba1a1a] dark:text-rose-300'
                        : 'bg-[#eaedff] dark:bg-slate-800 text-[#006243] dark:text-emerald-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        cloudSyncStatus === 'saving'
                          ? 'bg-amber-500 animate-ping'
                          : cloudSyncStatus === 'error'
                          ? 'bg-[#ba1a1a]'
                          : isCloudConnected
                          ? 'bg-[#006243] dark:bg-emerald-400 animate-pulse'
                          : 'bg-slate-400'
                      }`}
                    />
                    {cloudSyncStatus === 'saving'
                      ? 'Menyimpan...'
                      : cloudSyncStatus === 'error'
                      ? 'Offline'
                      : 'Online'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <ThemeToggle
                  themeMode={themeMode}
                  isDark={isDark}
                  onThemeChange={setThemeMode}
                />
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Suara Scanner Aktif' : 'Suara Scanner Dimatikan'}
                  className="w-8 h-8 rounded-lg bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#434655] dark:text-slate-200 active:scale-95 transition-transform"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-[#004ac6] dark:text-blue-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[#737686] dark:text-slate-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAuditDrawerOpen(true)}
                  className="w-8 h-8 rounded-lg bg-[#eaedff] dark:bg-slate-800 flex items-center justify-center text-[#434655] dark:text-slate-200 relative active:scale-95 transition-transform"
                  title="Lihat Aktivitas Scan Real-Time"
                >
                  <Activity className="w-4 h-4" />
                  {logs.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#004ac6] dark:bg-blue-400 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(true)}
                  className="w-8 h-8 rounded-full bg-[#004ac6] hover:bg-[#003ea8] dark:bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold shadow-xs active:scale-95 transition-transform"
                  title="Ganti Petugas Opname"
                >
                  {activeUser.slice(0, 2)}
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-2.5 pt-2 pb-28 flex flex-col">
            {activeViewTab !== 'opname' && (
              <div className="shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-800 p-3 shadow-2xs mb-2.5 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h1 className="text-base font-bold tracking-tight text-[#131b2e] dark:text-white leading-tight">
                      Dashboard Stok Opname
                    </h1>
                    <p className="text-[11px] text-[#434655] dark:text-slate-400 mt-0.5 truncate">
                      Semua perubahan fisik tersimpan otomatis di Cloud
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setPrefilledBarcode('');
                      setIsItemFormOpen(true);
                    }}
                    className="shrink-0 py-2 px-3 text-xs font-bold text-white bg-[#004ac6] hover:bg-[#003ea8] active:scale-95 rounded-lg flex items-center gap-1 shadow-xs transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>
            )}

            {activeViewTab === 'kategori' ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-800 p-3 shadow-2xs flex-1 flex flex-col transition-colors">
                <div className="pb-3 border-b border-[#eaedff] dark:border-slate-800">
                  <h2 className="text-sm font-bold text-[#131b2e] dark:text-white">Rekapitulasi Modal per Kategori</h2>
                  <p className="text-xs text-[#434655] dark:text-slate-400">
                    Distribusi total nilai modal barang yang diinvestasikan pada tiap kategori
                  </p>
                </div>

                <div className="space-y-2.5 pt-3">
                  {stats?.categorySummary.map((cat) => {
                    const pct =
                      stats.totalModalInvestasi > 0
                        ? ((cat.totalModal / stats.totalModalInvestasi) * 100).toFixed(1)
                        : '0';
                    return (
                      <div
                        key={cat.kategori}
                        className="p-3 bg-[#f2f3ff] dark:bg-slate-800/60 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-700/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-[#131b2e] dark:text-white">{cat.kategori}</h4>
                          <span className="text-xs font-mono font-bold text-[#006243] dark:text-emerald-400">
                            {formatRupiah(cat.totalModal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#434655] dark:text-slate-400 pt-1 border-t border-[#c3c6d7]/30 dark:border-slate-700/60">
                          <span>{cat.itemCount} SKU • {cat.totalQty} unit</span>
                          <span className="font-semibold text-[#131b2e] dark:text-slate-300">{pct}% dari modal</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-3 bg-[#eaedff] dark:bg-slate-800 rounded-xl border border-[#c3c6d7]/60 dark:border-slate-700 flex items-center justify-between font-bold text-xs">
                    <span>TOTAL SEMUA</span>
                    <span className="font-mono text-[#006243] dark:text-emerald-300">
                      {formatRupiah(stats?.totalModalInvestasi || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : activeViewTab === 'laporan' ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-800 p-3 shadow-2xs flex-1 flex flex-col transition-colors">
                <div className="flex flex-col gap-2.5 pb-3 border-b border-[#eaedff] dark:border-slate-800">
                  <div>
                    <h2 className="text-sm font-bold text-[#131b2e] dark:text-white">Laporan Selisih Stok &amp; Audit Modal</h2>
                    <p className="text-xs text-[#434655] dark:text-slate-400">
                      Daftar barang dengan perbedaan antara stok fisik hasil opname vs stok sistem mart
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLaporanHasilOpnameOpen(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Laporan Hasil Opname Resmi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDiscrepancyFilter((prev) => (prev === 'MINUS' ? 'ALL' : 'MINUS'))}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        discrepancyFilter === 'MINUS'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      }`}
                    >
                      Selisih Minus
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscrepancyFilter((prev) => (prev === 'PLUS' ? 'ALL' : 'PLUS'))}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        discrepancyFilter === 'PLUS'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      Selisih Lebih
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 pt-3">
                  {filteredItems.filter((item) => item.quantity - item.quantitySystem !== 0).length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#434655] dark:text-slate-400 bg-[#f2f3ff] dark:bg-slate-800/40 rounded-xl">
                      Semua stok fisik dan stok sistem cocok sempurna (100% seimbang).
                    </div>
                  ) : (
                    filteredItems
                      .filter((item) => item.quantity - item.quantitySystem !== 0)
                      .map((item) => {
                        const diff = item.quantity - item.quantitySystem;
                        const diffModal = diff * item.hargaModal;
                        return (
                          <div
                            key={item.id}
                            className="p-3 bg-[#f2f3ff] dark:bg-slate-800/60 rounded-xl border border-[#c3c6d7]/40 dark:border-slate-700/80 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-[10px] text-[#003ea8] dark:text-blue-300 bg-[#dbe1ff] dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                                    {item.sku}
                                  </span>
                                  <span className="text-[10px] text-[#434655] dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                    {item.kategori}
                                  </span>
                                </div>
                                <h4 className="font-bold text-xs text-[#131b2e] dark:text-white mt-1 leading-snug">
                                  {item.namaBarang}
                                </h4>
                              </div>
                              <span
                                className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  diff < 0
                                    ? 'bg-[#ffdad6] text-[#ba1a1a] dark:bg-red-950 dark:text-red-300'
                                    : 'bg-[#dbe1ff] text-[#003ea8] dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff} {item.satuan || 'pcs'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-[#c3c6d7]/30 dark:border-slate-700/60">
                              <div>
                                <span className="text-[#737686] dark:text-slate-400 block text-[10px]">Fisik vs Sistem</span>
                                <span className="font-mono font-semibold text-[#131b2e] dark:text-slate-200">
                                  {item.quantity} / {item.quantitySystem} {item.satuan || 'pcs'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[#737686] dark:text-slate-400 block text-[10px]">Selisih Modal</span>
                                <span
                                  className={`font-mono font-bold ${
                                    diffModal < 0 ? 'text-[#ba1a1a] dark:text-red-400' : 'text-[#004ac6] dark:text-blue-400'
                                  }`}
                                >
                                  {diffModal > 0 ? '+' : ''}
                                  {formatRupiah(diffModal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            ) : (
              <MobileOpnameWorkspace
                items={items}
                filteredItems={filteredItems}
                visibleItems={visibleItems}
                hasMoreVisibleItems={hasMoreVisibleItems}
                onLoadMore={() => setVisibleLimit((prev) => prev + 120)}
                onShowAll={() => setVisibleLimit(filteredItems.length)}
                stats={stats}
                isLoading={isLoading}
                activeUser={activeUser}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onBarcodeSearchSubmit={handleBarcodeSearchSubmit}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                availableCategories={availableCategories}
                categoryCounts={categoryCounts}
                discrepancyFilter={discrepancyFilter}
                onChangeDiscrepancyFilter={setDiscrepancyFilter}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onChangeSort={(field, order) => {
                  setSortBy(field);
                  setSortOrder(order);
                }}
                duplicateAnalysis={duplicateAnalysis}
                onOpenScanner={() => setIsScannerOpen(true)}
                onOpenAddItem={() => {
                  setEditingItem(null);
                  setPrefilledBarcode('');
                  setIsItemFormOpen(true);
                }}
                onOpenImportExport={() => handleOpenImportExport('import')}
                onOpenDuplicateModal={() => setIsDuplicateModalOpen(true)}
                onSelectTab={handleSelectViewTab}
                onSaveCountingAdjust={handleSaveQuickAdjust}
                onQuickDelta={handleQuickDelta}
                onQuickAdjust={handleRowQuickAdjust}
                onOpenCalc={handleRowOpenCalc}
                onEditItem={handleRowEdit}
                onDeleteItem={handleRowDelete}
                activeCountingItemId={activeCountingItemId}
                onSelectCountingItem={setActiveCountingItemId}
              />
            )}
          </main>
        </>
      )}

      {/* MODALS */}
      {/* 1. Barcode Camera Scanner with Quantity Calculator */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={items}
        onScanResult={handleCameraScanResult}
        onApplyCalculatedQty={async (itemId, calculatedQty, notes) => {
          return await handleSaveQuickAdjust(itemId, calculatedQty, notes);
        }}
        onOpenManualAdd={(code) => {
          setPrefilledBarcode(code);
          setEditingItem(null);
          setIsItemFormOpen(true);
        }}
        onOpenFullCalculator={(item) => {
          setCalcTargetItem(item);
          setIsGlobalCalcOpen(true);
        }}
      />

      {/* 2. Add / Edit Item Modal */}
      <ItemFormModal
        isOpen={isItemFormOpen}
        onClose={() => {
          setIsItemFormOpen(false);
          setEditingItem(null);
          setPrefilledBarcode('');
        }}
        onSave={handleSaveItem}
        initialData={editingItem}
        prefilledBarcode={prefilledBarcode}
        activeUser={activeUser}
        availableCategories={availableCategories}
        allItems={items}
      />

      {/* 2.1 Duplicate Items (SKU & Barcode) Inspection Modal */}
      <DuplicateItemsModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        duplicateAnalysis={duplicateAnalysis}
        onEditItem={(item) => {
          setEditingItem(item);
          setIsItemFormOpen(true);
        }}
        onDeleteItem={(item) => {
          setDeleteConfirmItem(item);
        }}
      />

      {/* 3. User Management Modal */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        users={users}
        activeUser={activeUser}
        onSelectActiveUser={handleSelectActiveUser}
        onAddUser={handleAddUser}
        onBackToLanding={handleBackToAccountLanding}
      />

      {/* 4. XLSX Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        items={items}
        stats={
          stats || {
            totalItems: items.length,
            totalPhysicalQty: 0,
            totalSystemQty: 0,
            totalSelisihQty: 0,
            totalModalInvestasi: 0,
            totalModalSystem: 0,
            selisihModal: 0,
            countedItemsCount: 0,
            uncountedItemsCount: 0,
            matchCount: 0,
            minusCount: 0,
            plusCount: 0,
            categorySummary: [],
          }
        }
        activeUser={activeUser}
        isAuthorizedIyan={activeUser === 'IYAN' && Boolean(iyanToken)}
        onRequestIyanAuth={() => {
          setPasswordPromptPurpose('open_import_export');
          setIsPasswordPromptOpen(true);
        }}
        onBatchImport={handleBatchImport}
        defaultTab={importExportDefaultTab}
      />

      {/* 4.1 Password Prompt Modal for IYAN Security */}
      <PasswordPromptModal
        isOpen={isPasswordPromptOpen}
        onClose={() => setIsPasswordPromptOpen(false)}
        onSuccess={handleIyanAuthSuccess}
        title="Otorisasi Petugas IYAN"
        description="Fitur Export dan Import data hanya diizinkan untuk user IYAN. Masukkan password untuk mengautentikasi."
      />

      {/* 5. Quick Count Adjust Dialog */}
      <QuickAdjustDialog
        isOpen={Boolean(quickAdjustItem)}
        onClose={() => setQuickAdjustItem(null)}
        item={quickAdjustItem}
        activeUser={activeUser}
        onSaveAdjust={handleSaveQuickAdjust}
      />

      {/* 6. Live Audit History Drawer */}
      <LiveAuditDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        logs={logs}
        activeUsersCount={activeUsersCount}
      />

      {/* 7. Quantity Calculator Modal */}
      <QuantityCalculatorModal
        isOpen={isGlobalCalcOpen}
        onClose={() => {
          setIsGlobalCalcOpen(false);
          setCalcTargetItem(null);
        }}
        targetItem={calcTargetItem}
        items={items}
        onApplyQuantity={async (itemId, calculatedQty, notes) => {
          const success = await handleSaveQuickAdjust(itemId, calculatedQty, notes);
          if (success) {
            setIsGlobalCalcOpen(false);
            setCalcTargetItem(null);
          }
          return success;
        }}
      />

      {/* 8. In-App Confirmation Dialog for Delete Item */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Barang Inventaris?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Apakah Anda yakin ingin menghapus barang{' '}
              <strong className="text-slate-900 dark:text-white">{deleteConfirmItem.namaBarang}</strong>{' '}
              (SKU: {deleteConfirmItem.sku}) dari sistem inventaris?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteItem}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. In-App Confirmation Dialog for Reset Session */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl p-5 shadow-2xl border border-red-200 dark:border-red-900/60 space-y-3">
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Reset Sesi Stok Opname
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Semua hitungan stok fisik barang saat ini akan di-reset menjadi <strong>0 pcs</strong> untuk memulai periode audit fisik baru.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Data SKU, nama barang, barcode, dan stok sistem mart akan tetap aman tersimpan.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeResetSession}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs"
              >
                Reset Semua Stok Fisik
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9.1 In-App Confirmation Dialog for Wipe All Demo Data */}
      {isClearDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl p-5 shadow-2xl border border-red-300 dark:border-red-900/80 space-y-3">
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Hapus Seluruh Data Demo?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tindakan ini akan <strong>menghapus permanen seluruh data barang demo ({items.length} item)</strong> dari Firebase Cloud Firestore.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Katalog barang toko mart Anda akan menjadi 0 item, bersih dan siap untuk Anda isi dengan data barang riil atau import dari file Excel (.xlsx).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearDemoModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeClearAllDemoData}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs"
              >
                Ya, Hapus Semua Data Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Opname Date & Session Info Modal */}
      <OpnameDateModal
        isOpen={isOpnameDateModalOpen}
        onClose={() => setIsOpnameDateModalOpen(false)}
        session={session}
        onSaveSession={handleSaveOpnameSession}
        activeUser={activeUser}
      />

      {/* 11. Pencatatan KAS, HUTANG & PIUTANG Modal (Khusus IYAN & HENDRI) */}
      <FinanceManagerModal
        isOpen={isFinanceModalOpen}
        onClose={() => setIsFinanceModalOpen(false)}
        finance={finance}
        onSaveFinance={handleSaveFinanceRecord}
        activeUser={activeUser}
      />

      {/* 12. Laporan Hasil Opname Komprehensif Modal */}
      <LaporanHasilOpnameModal
        isOpen={isLaporanHasilOpnameOpen}
        onClose={() => setIsLaporanHasilOpnameOpen(false)}
        items={items}
        stats={stats}
        session={session}
        finance={finance}
        activeUser={activeUser}
      />

      {/* 12.1 Display Options & Settings Modal (Works on Mobile, Tablet & PC) */}
      {isDisplayMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsDisplayMenuOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Pengaturan &amp; Opsi Tampilan
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kelola periode opname &amp; opsi tampilan layar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDisplayMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsDisplayMenuOpen(false);
                  setIsOpnameDateModalOpen(true);
                }}
                className="w-full p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-100/70 dark:hover:bg-blue-950/50 flex items-center justify-between gap-3 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                      Tanggal &amp; Periode Opname
                    </span>
                    <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300">
                      Sesi aktif: {session.opnameDate}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">Ubah</span>
              </button>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors select-none">
                <input
                  type="checkbox"
                  checked={showResetButton}
                  onChange={toggleResetButton}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                />
                <div className="flex-1 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Tombol Reset Sesi Opname
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Tampilkan tombol merah untuk mereset seluruh hitungan fisik ke 0 saat sesi audit baru
                  </span>
                </div>
              </label>
            </div>

            {/* Tombol Khusus Hapus Seluruh Data Demo */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsDisplayMenuOpen(false);
                  setIsClearDemoModalOpen(true);
                }}
                className="w-full py-2 px-3 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua Data Demo (0 Barang)</span>
              </button>
            </div>

            {/* Footer Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsDisplayMenuOpen(false)}
                className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
              >
                Selesai &amp; Simpan Pilihan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 13. Mobile Bottom Dock Navigation (Thumb-friendly Bar at bottom of screen) */}
      {hasEnteredWorkspace && !isDesktopViewport && (
        <MobileBottomDock
          activeTab={activeViewTab}
          onSelectTab={handleSelectViewTab}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenCalculator={() => {
            setCalcTargetItem(null);
            setIsGlobalCalcOpen(true);
          }}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          activeUser={activeUser}
        />
      )}

      {/* 14. Mobile Full Actions Menu Bottom Sheet */}
      {hasEnteredWorkspace && !isDesktopViewport && (
        <MobileMenuSheet
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          activeUser={activeUser}
          session={session}
          onOpenFinance={() => setIsFinanceModalOpen(true)}
          onOpenImportExport={() => handleOpenImportExport('import')}
          onOpenLaporanHasil={() => setIsLaporanHasilOpnameOpen(true)}
          onOpenOpnameDate={() => setIsOpnameDateModalOpen(true)}
          onOpenAddItem={() => {
            setEditingItem(null);
            setPrefilledBarcode('');
            setIsItemFormOpen(true);
          }}
          onOpenCalculator={() => {
            setCalcTargetItem(null);
            setIsGlobalCalcOpen(true);
          }}
          onOpenAuditLogs={() => setIsAuditDrawerOpen(true)}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onOpenDisplayOptions={() => setIsDisplayMenuOpen(true)}
          onResetSession={handleResetSession}
          onClearDemoData={() => setIsClearDemoModalOpen(true)}
          onSelectTab={handleSelectViewTab}
          showResetButton={showResetButton}
          onOpenDuplicateModal={() => setIsDuplicateModalOpen(true)}
          duplicateCount={duplicateAnalysis.totalAffectedItems}
        />
      )}
    </div>
  );
}
