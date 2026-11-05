import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Users,
  Activity,
  Layers,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  Volume2,
  VolumeX,
  Store,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Calculator,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Camera,
  X,
  Cloud,
  FileSpreadsheet,
  Calendar,
  Banknote,
  FileText,
  Scale,
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
} from './lib/firebase.ts';
import { INITIAL_ITEMS, INITIAL_USERS } from './data/seedData.ts';
import { calculateInventoryStats } from './utils/statsUtils.ts';
import { formatRupiah, exportInventoryToXLSX } from './utils/excelUtils.ts';
import { playScanSuccessSound, playScanWarningSound } from './utils/soundEffects.ts';

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
import { MobileBottomDock } from './components/MobileBottomDock.tsx';
import { MobileMenuSheet } from './components/MobileMenuSheet.tsx';
import { FinancialTrendChart } from './components/FinancialTrendChart.tsx';
import { useTheme } from './utils/useTheme.ts';
import { ThemeToggle } from './components/ThemeToggle.tsx';

export default function App() {
  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<MartUser[]>(INITIAL_USERS);
  const [logs, setLogs] = useState<ScanAuditLog[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);

  // Theme mode: system (default, follows device settings), light, or dark (can be changed manually)
  const { themeMode, isDark, setThemeMode } = useTheme();

  // Active current user session (persisted in localStorage)
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
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'ALL' | 'MATCH' | 'MINUS' | 'PLUS' | 'UNCOUNTED'>('ALL');
  const [sortBy, setSortBy] = useState<'nama' | 'sku' | 'qty' | 'modal' | 'totalModal' | 'selisih'>('totalModal');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeViewTab, setActiveViewTab] = useState<'opname' | 'laporan' | 'kategori'>('opname');

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
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
  const displayMenuRef = useRef<HTMLDivElement>(null);

  const toggleResetButton = () => {
    setShowResetButton((prev) => {
      const next = !prev;
      localStorage.setItem('mart_show_reset_button', String(next));
      return next;
    });
  };

  // Close display menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (displayMenuRef.current && !displayMenuRef.current.contains(e.target as Node)) {
        setIsDisplayMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toast notification for real-time alerts
  const [liveToast, setLiveToast] = useState<{ message: string; type: 'info' | 'success' | 'alert' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'alert' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setLiveToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 4500);
  };

  // Internal navigation stack to guarantee phone back button always steps back through previously opened tabs
  const visitedTabsStackRef = useRef<Array<'opname' | 'laporan' | 'kategori'>>(['opname']);

  // Handle tab switching with browser history push so hardware/browser back button returns to previous tab
  const handleSelectViewTab = (tab: 'opname' | 'laporan' | 'kategori') => {
    if (tab === activeViewTab) return;
    visitedTabsStackRef.current.push(tab);
    window.history.pushState({ type: 'tab', tab }, '');
    setActiveViewTab(tab);
  };

  // Track if any modal, sheet, dialog, or drawer is currently open
  const isAnyModalActive = Boolean(
    isMobileMenuOpen ||
    isScannerOpen ||
    isItemFormOpen ||
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

  const closeAllActiveModals = () => {
    setIsMobileMenuOpen(false);
    setIsScannerOpen(false);
    setIsItemFormOpen(false);
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
  };

  // Sync modal open/close with browser history so back button closes modal first
  useEffect(() => {
    if (isAnyModalActive && !prevModalStateRef.current) {
      window.history.pushState({ type: 'modal', tab: activeViewTab }, '');
    } else if (!isAnyModalActive && prevModalStateRef.current) {
      if (!isPoppingStateRef.current && window.history.state?.type === 'modal') {
        window.history.back();
      }
    }
    prevModalStateRef.current = isAnyModalActive;
    isPoppingStateRef.current = false;
  }, [isAnyModalActive, activeViewTab]);

  // Handle phone navigation back button (hardware back, swipe gesture, or browser back)
  useEffect(() => {
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState({ type: 'tab', tab: activeViewTab }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      isPoppingStateRef.current = true;

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
          visitedTabsStackRef.current.pop(); // pop current
          const lastTab = visitedTabsStackRef.current[visitedTabsStackRef.current.length - 1] || 'opname';
          setActiveViewTab(lastTab);
        } else {
          setActiveViewTab('opname');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeViewTab]);

  // Sync active user change to localStorage with password verification for IYAN
  const handleSelectActiveUser = (name: string) => {
    if (name === 'IYAN') {
      if (iyanToken) {
        setActiveUser('IYAN');
        localStorage.setItem('mart_active_user', 'IYAN');
        showToast('Beralih ke akun IYAN (Otorisasi Aktif)', 'info');
      } else {
        setPasswordPromptPurpose('switch_to_iyan');
        setIsPasswordPromptOpen(true);
      }
      return;
    }

    setActiveUser(name);
    localStorage.setItem('mart_active_user', name);
    showToast(`Beralih ke petugas: ${name}`, 'info');
  };

  // Callback on successful IYAN password verification
  const handleIyanAuthSuccess = (token: string) => {
    setIyanToken(token);
    sessionStorage.setItem('mart_iyan_token', token);
    setActiveUser('IYAN');
    localStorage.setItem('mart_active_user', 'IYAN');
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

  // Initialize direct real-time Firebase Cloud Firestore connection
  // Back end: Firebase Cloud Firestore | Front end: GitHub Pages
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsCloudConnected(connected);
    });

    // Real-time listener for Items from Firebase Cloud Firestore (Clean, zero dummy items)
    const unsubscribeItems = subscribeToFirestoreItems(
      (cloudItems) => {
        setItems(cloudItems);
        setStats(calculateInventoryStats(cloudItems));
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
    const unsubscribeUsers = subscribeToFirestoreUsers((cloudUsers) => {
      if (cloudUsers && cloudUsers.length > 0) {
        setUsers(cloudUsers);
      }
    });

    // Real-time listener for Opname Session (Tanggal opname & periode)
    const unsubscribeSession = subscribeToOpnameSession((cloudSession) => {
      setSession(cloudSession);
    });

    // Real-time listener for Finance Record (Kas, Hutang Mitra, Saldo Santri, Piutang Marhalah)
    const unsubscribeFinance = subscribeToFinanceRecord((cloudFinance) => {
      setFinance(cloudFinance);
    });

    // Optional SSE fallback (only for local Node dev server, safely handled if 404 on GitHub Pages)
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
      unsubscribeItems();
      unsubscribeLogs();
      unsubscribeUsers();
      unsubscribeSession();
      unsubscribeFinance();
      if (eventSource) eventSource.close();
    };
  }, [activeUser]);

  // Handler for saving Opname Session (Tanggal Opname)
  const handleSaveOpnameSession = async (updated: OpnameSession) => {
    try {
      await saveOpnameSessionToFirestore(updated);
      setSession(updated);
      showToast(`Tanggal opname berhasil disimpan: ${updated.opnameDate}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan tanggal opname ke Firebase Cloud', 'alert');
    }
  };

  // Handler for saving Finance Record (Kas, Hutang, Piutang)
  const handleSaveFinanceRecord = async (updated: FinanceRecord) => {
    try {
      await saveFinanceRecordToFirestore(updated);
      setFinance(updated);
      showToast('Catatan Kas, Hutang, dan Piutang berhasil disimpan ke Firebase Cloud!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan data keuangan ke Firebase Cloud', 'alert');
    }
  };

  // Hardware Barcode Scanner Gun Keypress Listener (USB / Bluetooth HID)
  // Physical barcode scanners type characters in quick bursts (<50ms) followed by 'Enter'
  useEffect(() => {
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
  }, [activeUser, soundEnabled, items]);

  // Process hardware barcode scanner hit directly against Firebase Cloud Firestore
  const handleHardwareScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const item = items.find(
      (i) => (i.barcode && i.barcode.toLowerCase() === trimmed.toLowerCase()) || i.sku.toLowerCase() === trimmed.toLowerCase()
    );

    if (item) {
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
      setItems((prevItems) => {
        const next = prevItems.map((i) => (i.id === item.id ? updatedItem : i));
        setStats(calculateInventoryStats(next));
        return next;
      });
      if (soundEnabled) playScanSuccessSound();
      showToast(`[Hardware Scanner] +1 ${item.namaBarang} (Total: ${newQty} pcs)`, 'success');

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
        await saveItemToFirestore(updatedItem);
        await saveLogToFirestore(log);
      } catch (err) {
        console.error('Scan save error:', err);
      }
    } else {
      if (soundEnabled) playScanWarningSound();
      showToast(`[Hardware Scanner] Barcode "${trimmed}" belum terdaftar!`, 'alert');
      setPrefilledBarcode(trimmed);
      setEditingItem(null);
      setIsItemFormOpen(true);
    }
  };

  // Handle Camera Barcode Scan Result (supports Calculator mode and Increment mode)
  const handleCameraScanResult = async (
    barcode: string,
    mode: 'calculator' | 'increment'
  ): Promise<{ success: boolean; item?: InventoryItem; notFound?: boolean }> => {
    const code = barcode.trim();
    if (!code) return { success: false };

    const local = items.find(
      (i) => (i.barcode && i.barcode.toLowerCase() === code.toLowerCase()) || i.sku.toLowerCase() === code.toLowerCase()
    );

    if (mode === 'calculator') {
      if (local) {
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
      setItems((prevItems) => {
        const next = prevItems.map((i) => (i.id === local.id ? updatedItem : i));
        setStats(calculateInventoryStats(next));
        return next;
      });
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
        await saveItemToFirestore(updatedItem);
        await saveLogToFirestore(log);
        return { success: true, item: updatedItem };
      } catch {
        return { success: false };
      }
    } else {
      return { success: false, notFound: true };
    }
  };

  // Submit handler for Barcode Search: opens calculator for item or registers new
  const handleBarcodeSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    const found = items.find(
      (i) => i.barcode === query || i.sku.toLowerCase() === query.toLowerCase()
    );

    if (found) {
      setCalcTargetItem(found);
      setIsGlobalCalcOpen(true);
      if (soundEnabled) playScanSuccessSound();
      showToast(`[Kalkulator] ${found.namaBarang} siap dihitung.`, 'info');
      setSearchQuery('');
    } else {
      if (soundEnabled) playScanWarningSound();
      showToast(`Barcode "${query}" belum terdaftar. Tambahkan sebagai barang baru?`, 'alert');
      setPrefilledBarcode(query);
      setEditingItem(null);
      setIsItemFormOpen(true);
    }
  };

  // Quick adjust quantity via table buttons (+1 / -1) directly to Firebase Cloud
  const handleQuickDelta = async (item: InventoryItem, delta: number) => {
    const prevQty = item.quantity || 0;
    const newQty = Math.max(0, prevQty + delta);
    const now = new Date().toISOString();
    const updatedItem: InventoryItem = {
      ...item,
      quantity: newQty,
      lastUpdatedBy: activeUser,
      updatedAt: now,
    };

    // 1. INSTANT OPTIMISTIC UPDATE (0ms touch latency)
    setItems((prevItems) => {
      const next = prevItems.map((i) => (i.id === item.id ? updatedItem : i));
      setStats(calculateInventoryStats(next));
      return next;
    });
    if (soundEnabled) playScanSuccessSound();

    const log: ScanAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      itemId: item.id,
      sku: item.sku,
      namaBarang: item.namaBarang,
      barcode: item.barcode,
      user: activeUser,
      action: delta > 0 ? 'SCAN_INCREMENT' : 'SET_QUANTITY',
      previousQty: prevQty,
      newQty,
      delta: newQty - prevQty,
      notes: item.keterangan,
      timestamp: now,
    };
    try {
      await saveItemToFirestore(updatedItem);
      await saveLogToFirestore(log);
    } catch (err) {
      console.error('Quick delta error:', err);
    }
  };

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
        setItems((prev) => {
          const next = prev.map((i) => (i.id === updatedItem.id ? updatedItem : i));
          setStats(calculateInventoryStats(next));
          return next;
        });

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

        await saveItemToFirestore(updatedItem);
        await saveLogToFirestore(log);
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
        setItems((prev) => {
          const next = [newItem, ...prev];
          setStats(calculateInventoryStats(next));
          return next;
        });

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

        await saveItemToFirestore(newItem);
        await saveLogToFirestore(log);
        showToast(`Barang baru ${newItem.namaBarang} berhasil ditambahkan ke Cloud.`, 'success');
        return true;
      }
    } catch (err) {
      console.error('Error saving item:', err);
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
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      setStats(calculateInventoryStats(next));
      return next;
    });

    try {
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
      showToast(`Barang ${item.namaBarang} telah dihapus dari Cloud.`, 'alert');
    } catch (err) {
      console.error('Error deleting item:', err);
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
      setItems((prev) => {
        const next = prev.map((i) => (i.id === itemId ? updatedItem : i));
        setStats(calculateInventoryStats(next));
        return next;
      });
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

      await saveItemToFirestore(updatedItem);
      await saveLogToFirestore(log);
      showToast(`Stok fisik ${target.namaBarang} diset ke ${newQuantity} pcs.`, 'success');
      return true;
    } catch (err) {
      console.error('Error quick adjust:', err);
      return false;
    }
  };

  // Add new user directly to Firebase Cloud
  const handleAddUser = async (name: string, role: string, color?: string): Promise<boolean> => {
    try {
      const cleanName = name.trim().toUpperCase();
      const palette = ['#0284c7', '#059669', '#7c3aed', '#ea580c', '#db2777', '#ca8a04', '#0d9488', '#4f46e5'];
      const assignedColor = color || palette[users.length % palette.length];
      const newUser: MartUser = {
        id: `usr-${Date.now()}`,
        name: cleanName,
        role: role.trim() || 'Petugas Opname',
        color: assignedColor,
        createdAt: new Date().toISOString(),
      };
      await saveUserToFirestore(newUser);
      showToast(`Petugas baru "${cleanName}" berhasil didaftarkan di Cloud.`, 'success');
      handleSelectActiveUser(cleanName);
      return true;
    } catch {
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
      let importedCount = 0;
      let updatedCount = 0;
      const now = new Date().toISOString();

      if (mode === 'replace') {
        const fullItems: InventoryItem[] = importItems.map((raw, idx) => ({
          id: raw.id || `item-imp-${Date.now()}-${idx}`,
          sku: String(raw.sku || `SKU-${idx + 1}`).trim().toUpperCase(),
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
          lastUpdatedBy: 'IYAN',
          updatedAt: now,
        }));
        await replaceAllItemsInFirestore(fullItems);
        importedCount = fullItems.length;
      } else {
        const updatedList: InventoryItem[] = [...items];
        importItems.forEach((raw, idx) => {
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
              lastUpdatedBy: 'IYAN',
              updatedAt: now,
            };
            updatedCount++;
          } else if (rawSku || raw.namaBarang) {
            updatedList.push({
              id: `item-imp-${Date.now()}-${idx}`,
              sku: rawSku || `SKU-${Date.now().toString().slice(-4)}-${idx}`,
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
        notes: `Mode: ${mode}`,
        timestamp: now,
      };
      await saveLogToFirestore(log);

      showToast(
        `Import XLSX tersimpan di Firebase Cloud: ${importedCount} baru, ${updatedCount} diperbarui.`,
        'success'
      );
      return true;
    } catch (err) {
      console.error('Error batch import:', err);
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
      showToast('Semua stok fisik telah di-reset ke 0 di Firebase Cloud.', 'alert');
    } catch (err) {
      console.error('Reset error:', err);
      showToast('Gagal mereset sesi opname di Firebase Cloud.', 'alert');
    }
  };

  // Wipe all demo items from Firestore permanently
  const executeClearAllDemoData = async () => {
    setIsClearDemoModalOpen(false);
    try {
      setIsLoading(true);
      await clearAllItemsFromFirestore();
      setItems([]);
      setStats(calculateInventoryStats([]));
      const log: ScanAuditLog = {
        id: `log-${Date.now()}`,
        itemId: 'all',
        sku: 'WIPE_DEMO',
        namaBarang: 'Pembersihan Total Data Demo Toko',
        barcode: '-',
        user: activeUser,
        action: 'DELETE_ITEM',
        previousQty: items.length,
        newQty: 0,
        delta: -items.length,
        notes: `Semua data demo (${items.length} item) dihapus permanen oleh ${activeUser}`,
        timestamp: new Date().toISOString(),
      };
      await saveLogToFirestore(log);
      showToast('Semua data demo berhasil dihapus dari Firebase Cloud. Database siap diisi barang riil mart.', 'success');
    } catch (err) {
      console.error('Clear all error:', err);
      showToast('Gagal menghapus data demo di Firebase Cloud.', 'alert');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search filter (Default Barcode Scanner search prioritized)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
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

        // Discrepancy filter
        const diff = (item.quantity || 0) - (item.quantitySystem || 0);
        if (discrepancyFilter === 'MATCH' && diff !== 0) return false;
        if (discrepancyFilter === 'MINUS' && diff >= 0) return false;
        if (discrepancyFilter === 'PLUS' && diff <= 0) return false;
        if (discrepancyFilter === 'UNCOUNTED' && (item.quantity || 0) > 0) return false;

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
  }, [items, searchQuery, searchMode, selectedCategory, discrepancyFilter, sortBy, sortOrder]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Real-time floating toast */}
      {liveToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl border text-xs font-medium flex items-center gap-2.5 transition-all max-w-sm ${
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
            onClick={() => setLiveToast(null)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* TOP BAR CONTRACT: Zone 1 (Wordmark) - Zone 2 (Nav links) - Zone 3 (Primary Action) */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4 overflow-hidden">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Store className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                  DR MART
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold font-mono ${
                    isCloudConnected
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                  title={isCloudConnected ? "Database tersimpan aman di Firebase Cloud Firestore" : "Menghubungkan ke Firebase Cloud..."}
                >
                  <Cloud className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden xs:inline">Cloud DB</span>
                </span>

                {/* Tanggal Opname Dilaksanakan Badge */}
                <button
                  type="button"
                  onClick={() => setIsOpnameDateModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                  title="Klik untuk menentukan atau mengubah tanggal pelaksanaan opname"
                >
                  <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>Tgl: {session.opnameDate || 'Pilih'}</span>
                </button>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Multi-User Live</span>
                <span>·</span>
                <span>{activeUsersCount} Online</span>
              </div>
            </div>
          </div>

          {/* Zone 2: Clean 1-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => handleSelectViewTab('opname')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap py-1 ${
                activeViewTab === 'opname' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-bold' : ''
              }`}
            >
              Stok Opname Fisik
            </button>
            <button
              onClick={() => handleSelectViewTab('laporan')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap py-1 ${
                activeViewTab === 'laporan' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-bold' : ''
              }`}
            >
              Laporan Modal Investasi
            </button>
            <button
              onClick={() => handleSelectViewTab('kategori')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap py-1 ${
                activeViewTab === 'kategori' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-bold' : ''
              }`}
            >
              Rekap Kategori
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action + Quick Controls */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* Theme Toggle (System / Light / Dark) */}
            <ThemeToggle
              themeMode={themeMode}
              isDark={isDark}
              onThemeChange={setThemeMode}
            />

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Suara Scanner Aktif' : 'Suara Scanner Dimatikan'}
              className={`p-1.5 sm:p-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Live Audit Log Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsAuditDrawerOpen(true)}
              className="p-1.5 sm:p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 relative transition-colors"
              title="Lihat Aktivitas Scan Real-Time"
            >
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700 dark:text-slate-200" />
              {logs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 sm:w-2.5 h-2 sm:h-2.5 bg-blue-600 rounded-full" />
              )}
            </button>

            {/* User Switcher Dropdown */}
            <button
              type="button"
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-white text-[10px] sm:text-[11px] font-bold"
                style={{ backgroundColor: currentUserObj?.color || '#0284c7' }}
              >
                {activeUser.slice(0, 2)}
              </div>
              <span className="hidden xs:inline text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[60px] truncate">{activeUser}</span>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
            </button>

            {/* PRIMARY CTA: Buka Scan Barcode (Hanya desktop/tablet) */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="hidden sm:flex px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg items-center gap-1.5 shadow-xs whitespace-nowrap transition-colors"
            >
              <Barcode className="w-4 h-4" />
              <span>Scan Barcode</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 lg:px-8 pt-2 sm:pt-4 pb-28 md:pb-8 space-y-3 sm:space-y-6 overflow-x-hidden">

        {/* HERO SECTION / FINANCIAL METRICS DASHBOARD */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Dashboard Stok Opname
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit fisik barang toko mart secara serentak bersama tim kasir & gudang
              </p>
            </div>

            {/* ACTION BAR: Clean & uncluttered in Mobile, Full in Desktop */}
            {/* 1. Mobile Action Bar (sm:hidden) - Menu Lengkap dihapus karena sudah ada di Bottom Dock */}
            <div className="flex sm:hidden items-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setPrefilledBarcode('');
                  setIsItemFormOpen(true);
                }}
                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-transform"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Barang</span>
              </button>
            </div>

            {/* 2. Desktop Full Horizontal Action Bar (hidden sm:flex) */}
            <div className="hidden sm:flex items-center flex-wrap gap-1.5 sm:gap-2">
              {/* Tambah Barang */}
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setPrefilledBarcode('');
                  setIsItemFormOpen(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Barang</span>
              </button>

              {/* Kalkulator */}
              <button
                type="button"
                onClick={() => {
                  setCalcTargetItem(null);
                  setIsGlobalCalcOpen(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Buka kalkulator kuantitas (dus/lusin/rak)"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Kalkulator</span>
              </button>

              {/* Fitur Tentukan Tanggal Opname */}
              <button
                type="button"
                onClick={() => setIsOpnameDateModalOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Tentukan Tanggal & Periode Pelaksanaan Opname"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Tgl Opname</span>
              </button>

              {/* Fitur Pencatatan KAS, HUTANG & PIUTANG - HANYA DAPAT DILIHAT DAN DI ISI OLEH USER IYAN DAN HENDRI */}
              {(activeUser === 'IYAN' || activeUser === 'HENDRI') && (
                <button
                  type="button"
                  onClick={() => setIsFinanceModalOpen(true)}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Pencatatan Kas, Hutang Mitra & Saldo Santri, serta Piutang Marhalah (Khusus IYAN & HENDRI)"
                >
                  <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Kas & Hutang-Piutang</span>
                </button>
              )}

              {/* Fitur LAPORAN HASIL OPNAME (Neraca Keuangan, Fisik & Pengesahan) */}
              <button
                type="button"
                onClick={() => setIsLaporanHasilOpnameOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800/80 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Buka Laporan Hasil Opname Resmi, Neraca Keuangan Mart & Berita Acara"
              >
                <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Hasil Opname</span>
              </button>

              {/* Fitur IMPORT/EXPORT DATA XLSX - HANYA TAMPIL UNTUK USER IYAN */}
              {activeUser === 'IYAN' && (
                <button
                  type="button"
                  onClick={() => handleOpenImportExport('import')}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/80 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Import & Export Data Stok Opname XLSX (Khusus Petugas IYAN)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Import/Export Data XLSX</span>
                </button>
              )}

              {/* Opsi Tampilan Button */}
              <button
                type="button"
                onClick={() => setIsDisplayMenuOpen(true)}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Opsi tampilan bagian dashboard"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Opsi</span>
              </button>

              {/* Pop Up Menu OPSI - Centered Modal di Tengah Layar */}
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
                            Opsi Tampilan Dashboard
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Sesuaikan bagian tampilan yang aktif di layar
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
                        Selesai & Simpan Pilihan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Sesi Opname Button (Bersih tanpa tombol ganda) */}
              {showResetButton && (
                <button
                  type="button"
                  onClick={handleResetSession}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/60 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Reset fisik ke 0 untuk opname baru"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset Sesi Opname</span>
                  <span className="sm:hidden">Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* VIEW TABS / SECTION SWITCH */}
        {activeViewTab === 'kategori' ? (
          /* REKAP MODAL PER KATEGORI VIEW */
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Rekapitulasi Modal per Kategori</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Distribusi total nilai modal barang yang diinvestasikan pada tiap kategori
                </p>
              </div>
              {activeUser === 'IYAN' && (
                <button
                  type="button"
                  onClick={() => handleOpenImportExport('export')}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg flex items-center gap-1.5"
                  title="Download Excel Rekap - Khusus Petugas IYAN"
                >
                  <Download className="w-3.5 h-3.5" /> Download Excel Rekap
                </button>
              )}
            </div>

            {/* Mobile View: Clean Category Cards (sm:hidden, no horizontal scroll) */}
            <div className="sm:hidden space-y-2.5">
              {stats?.categorySummary.map((cat) => {
                const pct = stats.totalModalInvestasi > 0
                  ? ((cat.totalModal / stats.totalModalInvestasi) * 100).toFixed(1)
                  : '0';
                return (
                  <div
                    key={cat.kategori}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{cat.kategori}</h4>
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {formatRupiah(cat.totalModal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>{cat.itemCount} SKU • {cat.totalQty} unit</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{pct}% dari modal</span>
                    </div>
                  </div>
                );
              })}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-between font-bold text-xs">
                <span>TOTAL SEMUA</span>
                <span className="font-mono text-emerald-800 dark:text-emerald-300">
                  {formatRupiah(stats?.totalModalInvestasi || 0)}
                </span>
              </div>
            </div>

            {/* Desktop View: Full Table (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 font-semibold text-right">Jumlah SKU</th>
                    <th className="px-4 py-3 font-semibold text-right">Total Stok Fisik</th>
                    <th className="px-4 py-3 font-semibold text-right">Total Modal Diinvestasikan</th>
                    <th className="px-4 py-3 font-semibold text-right">% Dari Total Modal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {stats?.categorySummary.map((cat) => {
                    const pct = stats.totalModalInvestasi > 0
                      ? ((cat.totalModal / stats.totalModalInvestasi) * 100).toFixed(1)
                      : '0';
                    return (
                      <tr key={cat.kategori} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-sans font-semibold text-slate-900 dark:text-white">{cat.kategori}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">{cat.itemCount} item</td>
                        <td className="px-4 py-2.5 text-right text-slate-900 dark:text-white font-bold">{cat.totalQty} pcs</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                          {formatRupiah(cat.totalModal)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-400">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
                  <tr>
                    <td className="px-4 py-3 font-sans">TOTAL SEMUA</td>
                    <td className="px-4 py-3 text-right">{stats?.totalItems || 0} item</td>
                    <td className="px-4 py-3 text-right">{stats?.totalPhysicalQty || 0} pcs</td>
                    <td className="px-4 py-3 text-right text-emerald-800 dark:text-emerald-300">
                      {formatRupiah(stats?.totalModalInvestasi || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : activeViewTab === 'laporan' ? (
          /* TAB LAPORAN: 1. VISUALISASI GRAFIK TREN MODAL (RECHARTS) + 2. TABEL SELISIH AUDIT */
          <div className="space-y-4 sm:space-y-6">
            {/* Visualisasi Grafik Tren Nilai Modal Harian / Mingguan */}
            <FinancialTrendChart
              items={items}
              logs={logs}
              stats={stats}
              finance={finance}
              session={session}
              isDark={isDark}
            />

            {/* Tabel Selisih Stok & Audit Modal */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Laporan Selisih Stok & Audit Modal</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Daftar barang dengan perbedaan antara stok fisik hasil opname vs stok sistem mart
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLaporanHasilOpnameOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                    title="Buka Berita Acara & Laporan Hasil Opname Lengkap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Laporan Hasil Opname Resmi</span>
                  </button>

                  {(activeUser === 'IYAN' || activeUser === 'HENDRI') && (
                    <button
                      type="button"
                      onClick={() => setIsFinanceModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg flex items-center gap-1.5 transition-colors"
                      title="Pencatatan Kas, Hutang & Piutang (Khusus IYAN & HENDRI)"
                    >
                      <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Kas & Hutang-Piutang</span>
                    </button>
                  )}

                  {activeUser === 'IYAN' && (
                    <button
                      type="button"
                      onClick={() => handleOpenImportExport('export')}
                      className="px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/80 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="Export Laporan Audit ke File Excel (.xlsx) - Khusus Petugas IYAN"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export XLSX</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDiscrepancyFilter('MINUS')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      discrepancyFilter === 'MINUS' ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60'
                    }`}
                  >
                    Selisih Minus
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscrepancyFilter('PLUS')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      discrepancyFilter === 'PLUS' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                    }`}
                  >
                    Selisih Lebih
                  </button>
                </div>
              </div>

              {/* Mobile View: Clean Vertical Discrepancy Cards (sm:hidden, no horizontal scroll) */}
              <div className="sm:hidden space-y-2.5">
                {filteredItems.filter((item) => (item.quantity - item.quantitySystem) !== 0).length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    Semua stok fisik dan stok sistem cocok sempurna (100% seimbang).
                  </div>
                ) : (
                  filteredItems
                    .filter((item) => (item.quantity - item.quantitySystem) !== 0)
                    .map((item) => {
                      const diff = item.quantity - item.quantitySystem;
                      const diffModal = diff * item.hargaModal;
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                                  {item.sku}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  {item.kategori}
                                </span>
                              </div>
                              <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1 leading-snug">
                                {item.namaBarang}
                              </h4>
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                diff < 0
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff} {item.satuan || 'pcs'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Fisik vs Sistem</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {item.quantity} / {item.quantitySystem} {item.satuan || 'pcs'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Selisih Modal</span>
                              <span
                                className={`font-mono font-bold ${
                                  diffModal < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                                }`}
                              >
                                {diffModal > 0 ? `+` : ''}{formatRupiah(diffModal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Desktop View: Full Table (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">SKU / Nama Barang</th>
                      <th className="px-4 py-3 font-semibold">Kategori</th>
                      <th className="px-4 py-3 font-semibold text-right">Fisik</th>
                      <th className="px-4 py-3 font-semibold text-right">Sistem</th>
                      <th className="px-4 py-3 font-semibold text-right">Selisih Fisik</th>
                      <th className="px-4 py-3 font-semibold text-right">Harga Modal</th>
                      <th className="px-4 py-3 font-semibold text-right">Selisih Modal (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {filteredItems
                      .filter((item) => (item.quantity - item.quantitySystem) !== 0)
                      .map((item) => {
                        const diff = item.quantity - item.quantitySystem;
                        const diffModal = diff * item.hargaModal;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-2.5">
                              <span className="font-bold text-slate-800 dark:text-slate-100">{item.sku}</span>
                              <p className="font-sans text-slate-900 dark:text-slate-200 font-medium">{item.namaBarang}</p>
                            </td>
                            <td className="px-4 py-2.5 font-sans text-slate-600 dark:text-slate-400">{item.kategori}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white">{item.quantity} {item.satuan || 'pcs'}</td>
                            <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400">{item.quantitySystem} {item.satuan || 'pcs'}</td>
                            <td
                              className={`px-4 py-2.5 text-right font-bold ${
                                diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff} {item.satuan || 'pcs'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">{formatRupiah(item.hargaModal)}</td>
                            <td
                              className={`px-4 py-2.5 text-right font-bold ${
                                diffModal < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {diffModal > 0 ? `+` : ''}
                              {formatRupiah(diffModal)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* MAIN STOK OPNAME TABLE & SEARCH/FILTER */
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {/* Search, Filter & Quick Options Bar */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex flex-col gap-2.5">
              {/* Universal Search Bar with Camera Scan Trigger */}
              <div className="flex gap-2">
                <form onSubmit={handleBarcodeSearchSubmit} className="relative flex-1">
                  <div className="absolute left-3 top-2.5 flex items-center gap-1.5 pointer-events-none">
                    <Barcode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Scan barcode, ketik SKU atau nama barang..."
                    className="w-full pl-10 pr-20 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono shadow-2xs"
                  />
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="px-1.5 py-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs"
                      >
                        ×
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1 shadow-2xs transition-colors"
                      title="Buka Kamera Barcode Scanner"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Scan</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Filters (Grid 2 kolom di mobile, 1 baris di desktop) */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                {/* Category Select */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="ALL">Semua Kategori ({items.length})</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c} ({categoryCounts[c] || 0})
                    </option>
                  ))}
                </select>

                {/* Status Discrepancy Select */}
                <select
                  value={discrepancyFilter}
                  onChange={(e) => setDiscrepancyFilter(e.target.value as any)}
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Status Selisih</option>
                  <option value="MATCH">Cocok ({stats?.matchCount || 0})</option>
                  <option value="MINUS">Minus ({stats?.minusCount || 0})</option>
                  <option value="PLUS">Lebih ({stats?.plusCount || 0})</option>
                  <option value="UNCOUNTED">Belum Dihitung ({stats?.uncountedItemsCount || 0})</option>
                </select>

                {/* Sort Order Select */}
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="col-span-2 sm:col-auto sm:w-auto px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="totalModal-desc">Total Modal Terbesar</option>
                  <option value="totalModal-asc">Total Modal Terkecil</option>
                  <option value="nama-asc">Nama A-Z</option>
                  <option value="sku-asc">SKU A-Z</option>
                  <option value="qty-desc">Stok Fisik Terbanyak</option>
                  <option value="selisih-asc">Selisih Terbesar (Minus)</option>
                </select>

                <button
                  type="button"
                  onClick={() => showToast('Data tersinkronisasi otomatis secara realtime dengan Firebase Cloud', 'info')}
                  className="hidden sm:inline-flex p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors ml-auto"
                  title="Sinkronisasi Realtime"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1. Mobile Touch-Friendly Card List (md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  Memuat data inventaris stok opname...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3">
                  <p>Tidak ada barang yang cocok dengan filter atau pencarian.</p>
                  {activeUser === 'IYAN' && (
                    <button
                      type="button"
                      onClick={() => handleOpenImportExport('import')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-2xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Data dari File XLSX</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const qty = item.quantity || 0;
                  const sysQty = item.quantitySystem || 0;
                  const diff = qty - sysQty;

                  return (
                    <div key={item.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Top Row: SKU, Kategori & Selisih Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                              {item.sku}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {item.kategori}
                            </span>
                            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {item.satuan || 'pcs'}
                            </span>
                            {item.status && item.status !== 'AKTIF' && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  item.status === 'NONAKTIF'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {item.status}
                              </span>
                            )}
                            {item.stokMinimum !== undefined && qty <= item.stokMinimum && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded">
                                Min: {item.stokMinimum}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1 leading-snug">
                            {item.namaBarang}
                          </h4>
                          {item.barcode && (
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                              Barcode: {item.barcode}
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 text-right">
                          <span
                            className={`inline-block text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              diff === 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : diff < 0
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {diff === 0 ? '✓ Cocok' : diff < 0 ? `${diff} ${item.satuan || 'pcs'}` : `+${diff} ${item.satuan || 'pcs'}`}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: System Qty & Big Touch Stepper Counter */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="text-xs">
                          <div className="text-slate-500 dark:text-slate-400">
                            Sistem: <strong className="font-mono text-slate-800 dark:text-slate-200">{sysQty} {item.satuan || 'pcs'}</strong>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Modal: {formatRupiah(item.hargaModal)}
                            {item.hargaJual ? ` • Jual: ${formatRupiah(item.hargaJual)}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Ergonomic Mobile Thumb Stepper */}
                          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleQuickDelta(item, -1)}
                              className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-90 text-slate-800 dark:text-white flex items-center justify-center font-black text-lg shadow-xs transition-transform"
                              title="Kurangi 1 unit fisik"
                            >
                              -
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCalcTargetItem(item);
                                setIsGlobalCalcOpen(true);
                              }}
                              className="px-3.5 py-1.5 font-mono font-black text-base text-blue-600 dark:text-blue-400 flex items-center gap-1 active:scale-95 transition-transform"
                              title="Ketuk angka untuk buka kalkulator kuantitas (dus/lusin)"
                            >
                              <Calculator className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{qty}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickDelta(item, 1)}
                              className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-90 text-white flex items-center justify-center font-black text-lg shadow-xs transition-transform"
                              title="Tambah 1 unit fisik"
                            >
                              +
                            </button>
                          </div>

                          {/* Item Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsItemFormOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md"
                            title="Edit Barang"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 2. Desktop Full Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3.5 py-2.5">SKU & BARCODE</th>
                    <th className="px-3.5 py-2.5 min-w-[200px]">NAMA BARANG</th>
                    <th className="px-3.5 py-2.5">KATEGORI</th>
                    <th className="px-3.5 py-2.5 text-center">STOK FISIK (OPNAME)</th>
                    <th className="px-3.5 py-2.5 text-right">STOK SISTEM</th>
                    <th className="px-3.5 py-2.5 text-right">SELISIH</th>
                    <th className="px-3.5 py-2.5 text-right">HARGA MODAL</th>
                    <th className="px-3.5 py-2.5 text-right">TOTAL MODAL</th>
                    <th className="px-3.5 py-2.5">PETUGAS</th>
                    <th className="px-3.5 py-2.5 text-center">AKSI</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        Memuat data inventaris stok opname...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="space-y-3">
                          <p>Tidak ada barang yang cocok dengan filter atau pencarian.</p>
                          {activeUser === 'IYAN' && (
                            <button
                              type="button"
                              onClick={() => handleOpenImportExport('import')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-2xs transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Import Data dari File XLSX</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const qty = item.quantity || 0;
                      const sysQty = item.quantitySystem || 0;
                      const diff = qty - sysQty;
                      const totalModal = qty * (item.hargaModal || 0);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                        >
                          {/* SKU & Barcode */}
                          <td className="px-3.5 py-2 font-mono">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.sku}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {item.barcode || '-'}
                            </span>
                          </td>

                          {/* Nama Barang & Satuan / Status */}
                          <td className="px-3.5 py-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-slate-900 dark:text-white leading-tight">
                                {item.namaBarang}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                {item.satuan || 'pcs'}
                              </span>
                              {item.status && item.status !== 'AKTIF' && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    item.status === 'NONAKTIF'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              )}
                              {item.stokMinimum !== undefined && qty <= item.stokMinimum && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded" title={`Batas minimum: ${item.stokMinimum}`}>
                                  Restock (≤{item.stokMinimum})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Kategori */}
                          <td className="px-3.5 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {item.kategori}
                          </td>

                          {/* Quantity Fisik with Quick Adjustment & Calculator */}
                          <td className="px-3.5 py-2 text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => handleQuickDelta(item, -1)}
                                className="w-6 h-6 rounded bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shadow-2xs transition-colors"
                                title={`Kurangi 1 ${item.satuan || 'pcs'}`}
                              >
                                -
                              </button>

                              <button
                                type="button"
                                onClick={() => setQuickAdjustItem(item)}
                                className="px-2 py-0.5 font-mono font-bold text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Klik untuk edit cepat"
                              >
                                {qty} <span className="text-[10px] font-normal text-slate-400">{item.satuan || 'pcs'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickDelta(item, 1)}
                                className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs transition-colors"
                                title={`Tambah 1 ${item.satuan || 'pcs'} (+1)`}
                              >
                                +
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCalcTargetItem(item);
                                  setIsGlobalCalcOpen(true);
                                }}
                                className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center text-xs transition-colors"
                                title="Hitung kuantitas dus / rak dengan kalkulator"
                              >
                                <Calculator className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Quantity Sistem (stok_awal) */}
                          <td className="px-3.5 py-2 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {sysQty} {item.satuan || 'pcs'}
                          </td>

                          {/* Selisih */}
                          <td className="px-3.5 py-2 text-right font-mono font-bold whitespace-nowrap">
                            {diff === 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400">0</span>
                            ) : diff < 0 ? (
                              <span className="text-red-600 dark:text-red-400">{diff} {item.satuan || 'pcs'}</span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400">+{diff} {item.satuan || 'pcs'}</span>
                            )}
                          </td>

                          {/* Harga Modal & Jual */}
                          <td className="px-3.5 py-2 text-right font-mono whitespace-nowrap">
                            <span className="text-slate-800 dark:text-slate-200 block">{formatRupiah(item.hargaModal)}</span>
                            {item.hargaJual ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">Jual: {formatRupiah(item.hargaJual)}</span>
                            ) : null}
                          </td>

                          {/* Total Modal */}
                          <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatRupiah(totalModal)}
                          </td>

                          {/* Petugas & Timestamp */}
                          <td className="px-3.5 py-2 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] block">
                              {item.lastUpdatedBy || '-'}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              {item.updatedAt
                                ? new Date(item.updatedAt).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </span>
                          </td>

                          {/* Aksi (Edit, Hapus) */}
                          <td className="px-3.5 py-2 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsItemFormOpen(true);
                                }}
                                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                                title="Edit Detail Barang"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                                title="Hapus Barang"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
              <div className="flex items-center gap-2">
                <span>
                  Menampilkan <strong>{filteredItems.length}</strong> dari <strong>{items.length}</strong> barang
                </span>
                <span>·</span>
                <span>
                  Petugas Aktif: <strong className="text-slate-900 dark:text-slate-100">{activeUser}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span>
                  Total Modal Filter: <strong className="text-emerald-700 dark:text-emerald-400">{formatRupiah(filteredItems.reduce((acc, curr) => acc + curr.quantity * curr.hargaModal, 0))}</strong>
                </span>
                {activeUser === 'IYAN' && (
                  <>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => handleOpenImportExport('export')}
                      className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 font-semibold font-sans transition-colors cursor-pointer"
                      title="Download / Export Data Tabel ke File Excel XLSX"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export XLSX</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <p>© 2026 DR MART. Sistem Audit Stok & Modal Toko Mart Multi-User.</p>
          <div className="flex items-center gap-4">
            <span className="font-mono">
              Hardware Scanner: <strong className="text-emerald-700 dark:text-emerald-400">Aktif (Auto-Detect USB/BT)</strong>
            </span>
            <span>·</span>
            <span>Kamera Barcode: Siap</span>
          </div>
        </div>
      </footer>

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
      />

      {/* 3. User Management Modal */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        users={users}
        activeUser={activeUser}
        onSelectActiveUser={handleSelectActiveUser}
        onAddUser={handleAddUser}
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

      {/* 13. Mobile Bottom Dock Navigation (Thumb-friendly Bar at bottom of screen) */}
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

      {/* 14. Mobile Full Actions Menu Bottom Sheet */}
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
      />
    </div>
  );
}
