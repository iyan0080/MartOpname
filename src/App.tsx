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
} from 'lucide-react';

import { InventoryItem, MartUser, ScanAuditLog, InventoryStats } from './types/inventory.ts';
import { testFirestoreConnection } from './lib/firebase.ts';
import { INITIAL_USERS } from './data/seedData.ts';
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

  // Opsi Tampilan (Visibility preferences, persisted in localStorage)
  const [showStatsSummary, setShowStatsSummary] = useState<boolean>(() => {
    const saved = localStorage.getItem('mart_show_stats_summary');
    return saved !== null ? saved === 'true' : true;
  });

  const [showResetButton, setShowResetButton] = useState<boolean>(() => {
    const saved = localStorage.getItem('mart_show_reset_button');
    return saved !== null ? saved === 'true' : true;
  });

  const [isDisplayMenuOpen, setIsDisplayMenuOpen] = useState(false);
  const displayMenuRef = useRef<HTMLDivElement>(null);

  const toggleStatsSummary = () => {
    setShowStatsSummary((prev) => {
      const next = !prev;
      localStorage.setItem('mart_show_stats_summary', String(next));
      return next;
    });
  };

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
    showToast('Login IYAN berhasil. Otorisasi Export & Import diaktifkan.', 'success');

    if (passwordPromptPurpose === 'open_import_export') {
      setIsImportExportOpen(true);
    } else if (passwordPromptPurpose === 'export_rekap') {
      exportInventoryToXLSX(items, stats || undefined);
    }
  };

  // Open Export/Import with IYAN authorization gate
  const handleOpenUploadXlsx = (tab: 'import' | 'export' = 'import') => {
    setImportExportDefaultTab(tab);
    if (activeUser === 'IYAN' && iyanToken) {
      setIsImportExportOpen(true);
    } else {
      setPasswordPromptPurpose('open_import_export');
      setIsPasswordPromptOpen(true);
    }
  };

  const handleOpenImportExport = () => {
    handleOpenUploadXlsx('import');
  };

  // Fetch initial data
  const fetchInventoryData = async () => {
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.users && data.users.length > 0) {
          setUsers(data.users);
        }
        setLogs(data.logs || []);
        setStats(data.stats || null);
        if (data.activeUsersCount) {
          setActiveUsersCount(data.activeUsersCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize data and real-time SSE connection
  useEffect(() => {
    fetchInventoryData();
    testFirestoreConnection().then((connected) => {
      setIsCloudConnected(connected);
    });

    // Setup Server-Sent Events (SSE) for concurrent multi-user sync
    const eventSource = new EventSource(`/api/events?user=${encodeURIComponent(activeUser)}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'ITEM_UPDATED') {
          const { item, log, stats: newStats, user: updateAuthor } = payload.data;
          setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
          if (log) setLogs((prev) => [log, ...prev.slice(0, 49)]);
          if (newStats) setStats(newStats);

          if (updateAuthor !== activeUser) {
            showToast(`${updateAuthor} memperbarui: ${item.namaBarang} (${item.quantity} pcs)`, 'info');
          }
        } else if (payload.type === 'ITEM_ADDED') {
          const { item, log, stats: newStats, user: updateAuthor } = payload.data;
          setItems((prev) => [...prev, item]);
          if (log) setLogs((prev) => [log, ...prev.slice(0, 49)]);
          if (newStats) setStats(newStats);
          if (updateAuthor !== activeUser) {
            showToast(`${updateAuthor} menambahkan barang baru: ${item.namaBarang}`, 'info');
          }
        } else if (payload.type === 'ITEM_DELETED') {
          const { itemId, log, stats: newStats, user: updateAuthor } = payload.data;
          setItems((prev) => prev.filter((i) => i.id !== itemId));
          if (log) setLogs((prev) => [log, ...prev.slice(0, 49)]);
          if (newStats) setStats(newStats);
          if (updateAuthor !== activeUser) {
            showToast(`${updateAuthor} menghapus barang dari inventaris`, 'alert');
          }
        } else if (payload.type === 'USER_ADDED') {
          if (payload.data.users) setUsers(payload.data.users);
        } else if (payload.type === 'USER_STATUS') {
          if (payload.data.activeCount) setActiveUsersCount(payload.data.activeCount);
        } else if (payload.type === 'BATCH_IMPORTED' || payload.type === 'COUNTS_RESET') {
          fetchInventoryData();
          showToast('Data inventaris telah disinkronkan kembali dari server.', 'success');
        }
      } catch (err) {
        console.error('Error handling SSE payload:', err);
      }
    };

    eventSource.onerror = () => {
      // Automatic browser reconnect handled by EventSource
    };

    return () => {
      eventSource.close();
    };
  }, [activeUser]);

  // Hardware Barcode Scanner Gun Keypress Listener (USB / Bluetooth HID)
  // Physical barcode scanners type characters in quick bursts (<50ms) followed by 'Enter'
  useEffect(() => {
    let keyBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const currentTime = Date.now();
      const char = e.key;

      if (currentTime - lastKeyTime > 150) {
        keyBuffer = ''; // Reset buffer if delay too long
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
  }, [activeUser, soundEnabled]);

  // Process hardware barcode scanner hit
  const handleHardwareScan = async (code: string) => {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: code,
          sku: code,
          quantityChange: 1,
          mode: 'increment',
          user: activeUser,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playScanSuccessSound();
        showToast(`[Hardware Scanner] +1 ${data.item.namaBarang} (Total: ${data.item.quantity} pcs)`, 'success');
      } else {
        if (soundEnabled) playScanWarningSound();
        showToast(`[Hardware Scanner] Barcode "${code}" belum terdaftar!`, 'alert');
        setPrefilledBarcode(code);
        setEditingItem(null);
        setIsItemFormOpen(true);
      }
    } catch (err) {
      console.error('Scan error:', err);
    }
  };

  // Handle Camera Barcode Scan Result (supports Calculator mode and Increment mode)
  const handleCameraScanResult = async (
    barcode: string,
    mode: 'calculator' | 'increment'
  ): Promise<{ success: boolean; item?: InventoryItem; notFound?: boolean }> => {
    try {
      const code = barcode.trim();
      if (!code) return { success: false };

      if (mode === 'calculator') {
        // Mode Kalkulator: Look up item without modifying quantity
        const local = items.find(
          (i) => i.barcode === code || i.sku.toLowerCase() === code.toLowerCase()
        );
        if (local) {
          return { success: true, item: local };
        }

        const res = await fetch(`/api/items/lookup?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (res.ok && data.success && data.item) {
          return { success: true, item: data.item };
        }
        return { success: false, notFound: true };
      }

      // Mode Satuan: Single increment +1
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: code,
          sku: code,
          quantityChange: 1,
          mode: 'increment',
          user: activeUser,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`+1 ${data.item.namaBarang} (Total: ${data.item.quantity} pcs)`, 'success');
        return { success: true, item: data.item };
      } else {
        return { success: false, notFound: true };
      }
    } catch {
      return { success: false };
    }
  };

  // Submit handler for Barcode Search: opens calculator for item or registers new
  const handleBarcodeSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Search exact match by barcode or SKU
    const found = items.find(
      (i) => i.barcode === query || i.sku.toLowerCase() === query.toLowerCase()
    );

    if (found) {
      // Open the quantity calculator for this scanned/entered item!
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

  // Quick adjust quantity via table buttons (+1 / -1)
  const handleQuickDelta = async (item: InventoryItem, delta: number) => {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: item.barcode,
          sku: item.sku,
          quantityChange: delta,
          mode: 'increment',
          user: activeUser,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playScanSuccessSound();
      }
    } catch (err) {
      console.error('Quick delta error:', err);
    }
  };

  // Save new or edited item
  const handleSaveItem = async (itemData: Partial<InventoryItem>): Promise<boolean> => {
    try {
      const isEdit = Boolean(itemData.id);
      const url = isEdit ? `/api/items/${itemData.id}` : '/api/items';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...itemData, user: activeUser }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          isEdit ? `Barang ${itemData.namaBarang} diperbarui.` : `Barang baru ${itemData.namaBarang} ditambahkan.`,
          'success'
        );
        return true;
      } else {
        showToast(data.error || 'Gagal menyimpan barang.', 'alert');
        return false;
      }
    } catch (err) {
      console.error('Error saving item:', err);
      return false;
    }
  };

  // Delete item with in-app confirmation
  const handleDeleteItem = (item: InventoryItem) => {
    setDeleteConfirmItem(item);
  };

  const executeDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    const item = deleteConfirmItem;
    setDeleteConfirmItem(null);

    try {
      const res = await fetch(`/api/items/${item.id}?user=${encodeURIComponent(activeUser)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`Barang ${item.namaBarang} telah dihapus.`, 'alert');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  // Save Quick Adjust dialog
  const handleSaveQuickAdjust = async (itemId: string, newQuantity: number, notes?: string): Promise<boolean> => {
    try {
      const target = items.find((i) => i.id === itemId);
      if (!target) return false;

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: target.barcode,
          sku: target.sku,
          quantityChange: newQuantity,
          mode: 'set',
          user: activeUser,
          notes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playScanSuccessSound();
        showToast(`Stok fisik ${target.namaBarang} diset ke ${newQuantity} pcs.`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error quick adjust:', err);
      return false;
    }
  };

  // Add new user
  const handleAddUser = async (name: string, role: string, color?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, color }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Petugas baru "${name}" berhasil didaftarkan.`, 'success');
        handleSelectActiveUser(name);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Batch import XLSX (Strictly restricted to user IYAN with valid authentication)
  const handleBatchImport = async (importItems: Partial<InventoryItem>[], mode: 'merge' | 'replace'): Promise<boolean> => {
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-iyan-token': iyanToken || '',
        },
        body: JSON.stringify({ items: importItems, mode, user: 'IYAN', token: iyanToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          `Import selesai: ${data.importedCount} barang baru, ${data.updatedCount} barang diperbarui.`,
          'success'
        );
        fetchInventoryData();
        return true;
      }
      showToast(data.error || 'Gagal memproses import. Akses khusus untuk user IYAN.', 'alert');
      return false;
    } catch {
      showToast('Terjadi kesalahan saat import data.', 'alert');
      return false;
    }
  };

  // Reset all counts for a new session with in-app modal confirmation
  const handleResetSession = () => {
    setIsResetConfirmModalOpen(true);
  };

  const executeResetSession = async () => {
    setIsResetConfirmModalOpen(false);
    try {
      const res = await fetch('/api/reset-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: activeUser }),
      });
      if (res.ok) {
        showToast('Semua stok fisik telah di-reset ke 0 untuk sesi baru.', 'alert');
        fetchInventoryData();
      }
    } catch (err) {
      console.error('Reset error:', err);
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
        if (selectedCategory !== 'ALL' && item.kategori !== selectedCategory) {
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

  // Unique categories list
  const availableCategories = useMemo(() => {
    const set = new Set(items.map((i) => i.kategori).filter(Boolean));
    return Array.from(set);
  }, [items]);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                  MartOpname
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono ${
                    isCloudConnected
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                  title={isCloudConnected ? "Database tersimpan aman di Firebase Cloud Firestore" : "Menghubungkan ke Firebase Cloud..."}
                >
                  <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Cloud DB</span>
                </span>
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
              onClick={() => setActiveViewTab('opname')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap py-1 ${
                activeViewTab === 'opname' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-bold' : ''
              }`}
            >
              Stok Opname Fisik
            </button>
            <button
              onClick={() => setActiveViewTab('laporan')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap py-1 ${
                activeViewTab === 'laporan' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-bold' : ''
              }`}
            >
              Laporan Modal Investasi
            </button>
            <button
              onClick={() => setActiveViewTab('kategori')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap py-1 ${
                activeViewTab === 'kategori' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-bold' : ''
              }`}
            >
              Rekap Kategori
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action + Quick Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
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
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                  : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Live Audit Log Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsAuditDrawerOpen(true)}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 relative transition-colors"
              title="Lihat Aktivitas Scan Real-Time"
            >
              <Activity className="w-4 h-4 text-slate-700 dark:text-slate-200" />
              {logs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full" />
              )}
            </button>

            {/* User Switcher Dropdown */}
            <button
              type="button"
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                style={{ backgroundColor: currentUserObj?.color || '#0284c7' }}
              >
                {activeUser.slice(0, 2)}
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{activeUser}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* PRIMARY CTA: Buka Scan Barcode (Hanya desktop/tablet, mobile sudah ada tombol Scan langsung di kotak pencarian) */}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Mobile Navigation Tabs (Segregated for easy touch navigation) */}
        <div className="flex md:hidden items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveViewTab('opname')}
            className={`flex-1 py-2 text-center rounded-lg transition-colors ${
              activeViewTab === 'opname'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Stok Opname
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('laporan')}
            className={`flex-1 py-2 text-center rounded-lg transition-colors ${
              activeViewTab === 'laporan'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Laporan
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('kategori')}
            className={`flex-1 py-2 text-center rounded-lg transition-colors ${
              activeViewTab === 'kategori'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Kategori
          </button>
        </div>

        {/* HERO SECTION / FINANCIAL METRICS DASHBOARD */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition-colors">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  Dashboard Stok Opname
                </h1>
                <button
                  type="button"
                  onClick={toggleStatsSummary}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title={showStatsSummary ? "Sembunyikan kartu ringkasan" : "Tampilkan kartu ringkasan"}
                >
                  {showStatsSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit fisik barang toko mart secara serentak bersama tim kasir & gudang
              </p>
            </div>

            {/* Action Bar (Disederhanakan untuk Mobile & Desktop) */}
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
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

              <button
                type="button"
                onClick={() => handleOpenUploadXlsx('import')}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                title="Upload / Import Data Stok Barang dari file Excel XLSX (Khusus Petugas IYAN)"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Upload Data XLSX</span>
              </button>

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
                          checked={showStatsSummary}
                          onChange={toggleStatsSummary}
                          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            Ringkasan Modal & Statistik
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                            Tampilkan 4 kartu nilai modal fisik, selisih rupiah, total SKU, dan status audit
                          </span>
                        </div>
                      </label>

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

          {/* 4-COLUMN FINANCIAL & QUANTITY STATS (2x2 di mobile agar rapi dan hemat ruang) */}
          {showStatsSummary ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 pt-3 sm:pt-4">
              {/* 1. Modal Investasi Fisik */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 transition-colors">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Total Modal Diinvestasikan</span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono px-1 rounded">Stok Fisik</span>
                </div>
                <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 tracking-tight">
                  {formatRupiah(stats?.totalModalInvestasi || 0)}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  <span>Modal Sistem: {formatRupiah(stats?.totalModalSystem || 0)}</span>
                </div>
              </div>

              {/* 2. Selisih Nilai Modal */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 transition-colors">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Selisih Modal (Fisik - Sistem)</span>
                  {(stats?.selisihModal || 0) < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <p
                  className={`text-lg font-bold font-mono tracking-tight ${
                    (stats?.selisihModal || 0) === 0
                      ? 'text-slate-900 dark:text-white'
                      : (stats?.selisihModal || 0) < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {(stats?.selisihModal || 0) > 0 ? '+' : ''}
                  {formatRupiah(stats?.selisihModal || 0)}
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  Selisih Qty: {(stats?.totalSelisihQty || 0) > 0 ? '+' : ''}
                  {stats?.totalSelisihQty || 0} pcs
                </div>
              </div>

              {/* 3. Total Kuantitas Barang */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 transition-colors">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Total Fisik Terhitung</span>
                  <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {stats?.totalItems || 0} SKU
                  </span>
                </div>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                  {stats?.totalPhysicalQty || 0} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">pcs</span>
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  Stok Sistem: {stats?.totalSystemQty || 0} pcs
                </div>
              </div>

              {/* 4. Status Progress Audit */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 transition-colors">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>Status Hasil Audit</span>
                  <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                    {stats?.totalItems
                      ? Math.round(((stats.countedItemsCount || 0) / stats.totalItems) * 100)
                      : 0}
                    % Terhitung
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono font-bold mt-1">
                  <span className="text-emerald-700">{stats?.matchCount || 0} Cocok</span>
                  <span>·</span>
                  <span className="text-red-600">{stats?.minusCount || 0} Minus</span>
                  <span>·</span>
                  <span className="text-blue-600">{stats?.plusCount || 0} Lebih</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {stats?.uncountedItemsCount || 0} SKU belum terhitung
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 py-2 px-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Bagian ringkasan modal & statistik sedang disembunyikan.</span>
              </div>
              <button
                type="button"
                onClick={toggleStatsSummary}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 shrink-0 ml-2"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Tampilkan Kembali</span>
              </button>
            </div>
          )}
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
              <button
                type="button"
                onClick={() => {
                  if (activeUser === 'IYAN' && iyanToken) {
                    exportInventoryToXLSX(items, stats || undefined);
                  } else {
                    setPasswordPromptPurpose('export_rekap');
                    setIsPasswordPromptOpen(true);
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-lg flex items-center gap-1.5"
                title="Khusus Petugas IYAN"
              >
                <Download className="w-3.5 h-3.5" /> Download Excel Rekap
              </button>
            </div>

            <div className="overflow-x-auto">
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
          /* LAPORAN SELISIH MODAL AUDIT VIEW */
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
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
                  onClick={() => setDiscrepancyFilter('MINUS')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    discrepancyFilter === 'MINUS' ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60'
                  }`}
                >
                  Hanya Selisih Kurang (Minus)
                </button>
                <button
                  type="button"
                  onClick={() => setDiscrepancyFilter('PLUS')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    discrepancyFilter === 'PLUS' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                  }`}
                >
                  Hanya Selisih Lebih (Plus)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
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
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
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
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400">{item.quantitySystem}</td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold ${
                              diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff} pcs
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
                          <td className="px-4 py-2.5 font-sans text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {item.keterangan || '-'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
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
                  className="w-full sm:w-auto px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Kategori ({items.length})</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
                  onClick={fetchInventoryData}
                  className="hidden sm:inline-flex p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors ml-auto"
                  title="Refresh Data"
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
                  <button
                    type="button"
                    onClick={() => handleOpenUploadXlsx('import')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-2xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Data dari File XLSX</span>
                  </button>
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
                            {diff === 0 ? '✓ Cocok' : diff < 0 ? `${diff} pcs` : `+${diff} pcs`}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: System Qty & Big Touch Stepper Counter */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="text-xs">
                          <div className="text-slate-500 dark:text-slate-400">
                            Sistem: <strong className="font-mono text-slate-800 dark:text-slate-200">{sysQty} pcs</strong>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Modal: {formatRupiah(item.hargaModal)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Stepper with Kalkulator Tap */}
                          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => handleQuickDelta(item, -1)}
                              className="w-8 h-8 rounded-md bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white flex items-center justify-center font-bold text-base shadow-2xs active:scale-95 transition-transform"
                              title="Kurangi 1"
                            >
                              -
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCalcTargetItem(item);
                                setIsGlobalCalcOpen(true);
                              }}
                              className="px-3 py-1 font-mono font-bold text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                              title="Klik untuk buka kalkulator hitung"
                            >
                              <Calculator className="w-3.5 h-3.5 text-amber-500" />
                              <span>{qty}</span>
                              <span className="text-[10px] font-normal text-slate-400">pcs</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickDelta(item, 1)}
                              className="w-8 h-8 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold text-base shadow-2xs active:scale-95 transition-transform"
                              title="Tambah 1"
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
                    <th className="px-3.5 py-2.5 min-w-[160px]">KETERANGAN</th>
                    <th className="px-3.5 py-2.5">PETUGAS</th>
                    <th className="px-3.5 py-2.5 text-center">AKSI</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        Memuat data inventaris stok opname...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="space-y-3">
                          <p>Tidak ada barang yang cocok dengan filter atau pencarian.</p>
                          <button
                            type="button"
                            onClick={() => handleOpenUploadXlsx('import')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-2xs transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Data dari File XLSX</span>
                          </button>
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

                          {/* Nama Barang */}
                          <td className="px-3.5 py-2">
                            <span className="font-medium text-slate-900 dark:text-white block leading-tight">
                              {item.namaBarang}
                            </span>
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
                                title="Kurangi 1 pcs"
                              >
                                -
                              </button>

                              <button
                                type="button"
                                onClick={() => setQuickAdjustItem(item)}
                                className="px-2 py-0.5 font-mono font-bold text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title="Klik untuk edit cepat"
                              >
                                {qty}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickDelta(item, 1)}
                                className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold text-xs shadow-2xs transition-colors"
                                title="Tambah 1 pcs (+1)"
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

                          {/* Quantity Sistem */}
                          <td className="px-3.5 py-2 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {sysQty} pcs
                          </td>

                          {/* Selisih */}
                          <td className="px-3.5 py-2 text-right font-mono font-bold whitespace-nowrap">
                            {diff === 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400">0</span>
                            ) : diff < 0 ? (
                              <span className="text-red-600 dark:text-red-400">{diff}</span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400">+{diff}</span>
                            )}
                          </td>

                          {/* Harga Modal */}
                          <td className="px-3.5 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatRupiah(item.hargaModal)}
                          </td>

                          {/* Total Modal */}
                          <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatRupiah(totalModal)}
                          </td>

                          {/* Keterangan */}
                          <td className="px-3.5 py-2 text-slate-600 dark:text-slate-300 text-[11px] max-w-xs truncate">
                            {item.keterangan || '-'}
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
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <p>© 2026 MartOpname. Sistem Audit Stok & Modal Toko Mart Multi-User.</p>
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
    </div>
  );
}
