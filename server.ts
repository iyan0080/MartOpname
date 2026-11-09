import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { InventoryItem, MartUser, ScanAuditLog, InventoryStats } from './src/types/inventory.ts';
import { INITIAL_ITEMS, INITIAL_USERS } from './src/data/seedData.ts';
import {
  testFirestoreConnection,
  fetchItemsFromFirestore,
  saveItemToFirestore,
  deleteItemFromFirestore,
  saveLogToFirestore,
  batchSaveItemsToFirestore,
} from './src/lib/firebase.ts';
import { assignSequentialMissingSKUs } from './src/utils/excelUtils.ts';

// Handle uncaught exceptions and unhandled rejections to prevent server crash
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in server process:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1], 10) : parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Secure credentials for user IYAN (stored strictly server-side, never exposed to clients)
const IYAN_PASSWORD = process.env.IYAN_PASSWORD || 'Kantin0011@';
const validIyanTokens = new Set<string>();

function generateIyanToken(): string {
  const token = 'iyan_auth_' + crypto.randomBytes(24).toString('hex');
  validIyanTokens.add(token);
  // Auto expire after 24 hours
  setTimeout(() => validIyanTokens.delete(token), 24 * 60 * 60 * 1000);
  return token;
}

function isAuthorizedIyan(req: Request, user: string): boolean {
  if (user !== 'IYAN') return false;
  const token = (req.headers['x-iyan-token'] as string) || req.body?.token;
  if (!token) return false;
  return validIyanTokens.has(token);
}

// Data persistence directory and file
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'inventory_store.json');

interface StoreData {
  items: InventoryItem[];
  users: MartUser[];
  logs: ScanAuditLog[];
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        items: parsed.items || INITIAL_ITEMS,
        users: parsed.users || INITIAL_USERS,
        logs: parsed.logs || [],
      };
    }
  } catch (err) {
    console.error('Error loading inventory store, fallback to initial data:', err);
  }
  const initialData: StoreData = {
    items: [],
    users: INITIAL_USERS,
    logs: [],
  };
  saveStore(initialData);
  return initialData;
}

function saveStore(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving inventory store:', err);
  }
}

let store: StoreData = loadStore();

async function initFirestoreData() {
  try {
    const isOk = await testFirestoreConnection();
    if (isOk) {
      console.log('Firebase Cloud Firestore successfully connected');
      const cloudItems = await fetchItemsFromFirestore();
      if (cloudItems && cloudItems.length > 0) {
        console.log(`Loaded ${cloudItems.length} items from Firebase Cloud Firestore`);
        store.items = cloudItems;
        saveStore(store);
      } else {
        console.log('Seeding initial items to Firebase Cloud Firestore...');
        await batchSaveItemsToFirestore(store.items);
      }
    }
  } catch (err) {
    console.error('Failed to initialize with Firebase Firestore, continuing with local store:', err);
  }
}

// Server-Sent Events (SSE) Client Connections
interface SSEClient {
  id: number;
  res: Response;
  userName?: string;
}
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastEvent(type: string, data: any) {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      // client disconnected
    }
  });
}

function calculateStats(items: InventoryItem[]): InventoryStats {
  let totalPhysicalQty = 0;
  let totalSystemQty = 0;
  let totalModalInvestasi = 0;
  let totalModalSystem = 0;
  let countedItemsCount = 0;
  let uncountedItemsCount = 0;
  let matchCount = 0;
  let minusCount = 0;
  let plusCount = 0;

  const categoryMap = new Map<string, { itemCount: number; totalQty: number; totalModal: number }>();

  items.forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const sysQty = Number(item.quantitySystem) || 0;
    const modal = Number(item.hargaModal) || 0;

    totalPhysicalQty += qty;
    totalSystemQty += sysQty;
    totalModalInvestasi += qty * modal;
    totalModalSystem += sysQty * modal;

    if (qty > 0) {
      countedItemsCount++;
    } else {
      uncountedItemsCount++;
    }

    const diff = qty - sysQty;
    if (diff === 0) {
      matchCount++;
    } else if (diff < 0) {
      minusCount++;
    } else {
      plusCount++;
    }

    const cat = item.kategori || 'Lainnya';
    const existing = categoryMap.get(cat) || { itemCount: 0, totalQty: 0, totalModal: 0 };
    existing.itemCount += 1;
    existing.totalQty += qty;
    existing.totalModal += qty * modal;
    categoryMap.set(cat, existing);
  });

  const categorySummary = Array.from(categoryMap.entries()).map(([kategori, val]) => ({
    kategori,
    ...val,
  })).sort((a, b) => b.totalModal - a.totalModal);

  return {
    totalItems: items.length,
    totalPhysicalQty,
    totalSystemQty,
    totalSelisihQty: totalPhysicalQty - totalSystemQty,
    totalModalInvestasi,
    totalModalSystem,
    selisihModal: totalModalInvestasi - totalModalSystem,
    countedItemsCount,
    uncountedItemsCount,
    matchCount,
    minusCount,
    plusCount,
    categorySummary,
  };
}

// SSE stream for real-time multi-user live synchronization
app.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const clientId = nextClientId++;
  const userName = (req.query.user as string) || 'User';
  const newClient: SSEClient = { id: clientId, res, userName };
  sseClients.push(newClient);

  // Send initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, activeCount: sseClients.length })}\n\n`);

  // Broadcast user joined
  broadcastEvent('USER_STATUS', { activeCount: sseClients.length });

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
    broadcastEvent('USER_STATUS', { activeCount: sseClients.length });
  });
});

// Periodic keep-alive ping for SSE
setInterval(() => {
  sseClients.forEach((client) => {
    try {
      client.res.write(': ping\n\n');
    } catch {
      // ignore
    }
  });
}, 25000);

// GET /api/inventory
app.get('/api/inventory', (req: Request, res: Response) => {
  const stats = calculateStats(store.items);
  res.json({
    items: store.items,
    users: store.users,
    logs: store.logs.slice(-50).reverse(), // Last 50 logs
    stats,
    activeUsersCount: sseClients.length,
  });
});

// GET /api/items/lookup - Search item without modifying quantity
app.get('/api/items/lookup', (req: Request, res: Response) => {
  const code = ((req.query.code as string) || '').trim();
  if (!code) {
    return res.status(400).json({ success: false, error: 'Parameter code diperlukan' });
  }
  const item = store.items.find(
    (i) => i.barcode === code || i.sku.toLowerCase() === code.toLowerCase()
  );
  if (!item) {
    return res.status(404).json({ success: false, notFound: true, barcode: code });
  }
  return res.json({ success: true, item });
});

// POST /api/scan - Barcode Scan or quick count adjust
app.post('/api/scan', (req: Request, res: Response) => {
  const { barcode, sku, quantityChange = 1, mode = 'increment', user = 'Anonim', notes } = req.body;

  const searchCode = (barcode || '').trim();
  const searchSku = (sku || '').trim().toLowerCase();

  // Find item by barcode or SKU
  let item = store.items.find(
    (i) => (searchCode && i.barcode === searchCode) || (searchSku && i.sku.toLowerCase() === searchSku)
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      notFound: true,
      message: `Barang dengan Barcode / SKU "${searchCode || searchSku}" belum terdaftar.`,
      barcode: searchCode,
      sku: searchSku,
    });
  }

  const prevQty = Number(item.quantity) || 0;
  let newQty = prevQty;

  if (mode === 'increment') {
    newQty = Math.max(0, prevQty + Number(quantityChange));
  } else if (mode === 'set') {
    newQty = Math.max(0, Number(quantityChange));
  }

  item.quantity = newQty;
  item.lastUpdatedBy = user;
  item.updatedAt = new Date().toISOString();
  if (notes) {
    item.keterangan = notes;
  }

  const log: ScanAuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    itemId: item.id,
    sku: item.sku,
    namaBarang: item.namaBarang,
    barcode: item.barcode,
    user,
    action: mode === 'increment' ? 'SCAN_INCREMENT' : 'SET_QUANTITY',
    previousQty: prevQty,
    newQty,
    delta: newQty - prevQty,
    notes: notes || item.keterangan,
    timestamp: item.updatedAt,
  };

  store.logs.push(log);
  if (store.logs.length > 500) {
    store.logs = store.logs.slice(-500);
  }

  saveStore(store);

  // Sync to Firebase Cloud Firestore
  saveItemToFirestore(item).catch((err) => console.error('Firebase save item failed:', err));
  saveLogToFirestore(log).catch((err) => console.error('Firebase save log failed:', err));

  const stats = calculateStats(store.items);
  broadcastEvent('ITEM_UPDATED', { item, log, stats, user });

  res.json({
    success: true,
    item,
    log,
    stats,
  });
});

// POST /api/items - Add new item
app.post('/api/items', (req: Request, res: Response) => {
  const {
    sku,
    namaBarang,
    barcode,
    kategori = 'Sembako',
    quantity = 0,
    quantitySystem = 0,
    hargaModal = 0,
    keterangan = '',
    user = 'Admin',
  } = req.body;

  if (!sku || !namaBarang) {
    return res.status(400).json({ error: 'SKU dan Nama Barang wajib diisi.' });
  }

  const cleanSku = sku.trim().toUpperCase();
  const cleanBarcode = (barcode || '').trim();

  // Check duplicate SKU
  const existingSku = store.items.find((i) => i.sku.toUpperCase() === cleanSku);
  if (existingSku) {
    return res.status(400).json({ error: `SKU "${cleanSku}" sudah digunakan oleh barang lain.` });
  }

  // Check duplicate Barcode if provided
  if (cleanBarcode) {
    const existingBarcode = store.items.find((i) => i.barcode === cleanBarcode);
    if (existingBarcode) {
      return res.status(400).json({ error: `Barcode "${cleanBarcode}" sudah digunakan oleh barang "${existingBarcode.namaBarang}".` });
    }
  }

  const newItem: InventoryItem = {
    id: `item-${Date.now()}`,
    sku: cleanSku,
    namaBarang: namaBarang.trim(),
    barcode: cleanBarcode || `BAR-${Date.now().toString().slice(-8)}`,
    kategori: kategori || 'Lainnya',
    quantity: Math.max(0, Number(quantity) || 0),
    quantitySystem: Math.max(0, Number(quantitySystem) || 0),
    hargaModal: Math.max(0, Number(hargaModal) || 0),
    keterangan: keterangan || 'Barang Baru Ditambahkan',
    lastUpdatedBy: user,
    updatedAt: new Date().toISOString(),
  };

  store.items.push(newItem);

  const log: ScanAuditLog = {
    id: `log-${Date.now()}`,
    itemId: newItem.id,
    sku: newItem.sku,
    namaBarang: newItem.namaBarang,
    barcode: newItem.barcode,
    user,
    action: 'ADD_ITEM',
    previousQty: 0,
    newQty: newItem.quantity,
    delta: newItem.quantity,
    notes: 'Penambahan barang baru',
    timestamp: newItem.updatedAt,
  };
  store.logs.push(log);
  saveStore(store);

  // Sync to Firebase Cloud Firestore
  saveItemToFirestore(newItem).catch((err) => console.error('Firebase add item failed:', err));
  saveLogToFirestore(log).catch((err) => console.error('Firebase save log failed:', err));

  const stats = calculateStats(store.items);
  broadcastEvent('ITEM_ADDED', { item: newItem, log, stats, user });

  res.json({ success: true, item: newItem, stats });
});

// PUT /api/items/:id - Update item
app.put('/api/items/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = store.items.findIndex((i) => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Barang tidak ditemukan.' });
  }

  const {
    sku,
    namaBarang,
    barcode,
    kategori,
    quantity,
    quantitySystem,
    hargaModal,
    keterangan,
    user = 'Admin',
  } = req.body;

  const current = store.items[index];
  const prevQty = current.quantity;
  const updatedQty = quantity !== undefined ? Math.max(0, Number(quantity)) : current.quantity;

  const updatedItem: InventoryItem = {
    ...current,
    sku: sku ? sku.trim().toUpperCase() : current.sku,
    namaBarang: namaBarang ? namaBarang.trim() : current.namaBarang,
    barcode: barcode !== undefined ? barcode.trim() : current.barcode,
    kategori: kategori || current.kategori,
    quantity: updatedQty,
    quantitySystem: quantitySystem !== undefined ? Math.max(0, Number(quantitySystem)) : current.quantitySystem,
    hargaModal: hargaModal !== undefined ? Math.max(0, Number(hargaModal)) : current.hargaModal,
    keterangan: keterangan !== undefined ? keterangan : current.keterangan,
    lastUpdatedBy: user,
    updatedAt: new Date().toISOString(),
  };

  store.items[index] = updatedItem;

  const log: ScanAuditLog = {
    id: `log-${Date.now()}`,
    itemId: updatedItem.id,
    sku: updatedItem.sku,
    namaBarang: updatedItem.namaBarang,
    barcode: updatedItem.barcode,
    user,
    action: 'UPDATE_ITEM',
    previousQty: prevQty,
    newQty: updatedQty,
    delta: updatedQty - prevQty,
    notes: keterangan || 'Update data barang',
    timestamp: updatedItem.updatedAt,
  };
  store.logs.push(log);
  saveStore(store);

  // Sync to Firebase Cloud Firestore
  saveItemToFirestore(updatedItem).catch((err) => console.error('Firebase update item failed:', err));
  saveLogToFirestore(log).catch((err) => console.error('Firebase save log failed:', err));

  const stats = calculateStats(store.items);
  broadcastEvent('ITEM_UPDATED', { item: updatedItem, log, stats, user });

  res.json({ success: true, item: updatedItem, stats });
});

// DELETE /api/items/:id - Delete item
app.delete('/api/items/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const item = store.items.find((i) => i.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Barang tidak ditemukan.' });
  }

  const user = (req.query.user as string) || 'Admin';
  store.items = store.items.filter((i) => i.id !== id);

  const log: ScanAuditLog = {
    id: `log-${Date.now()}`,
    itemId: id,
    sku: item.sku,
    namaBarang: item.namaBarang,
    barcode: item.barcode,
    user,
    action: 'DELETE_ITEM',
    previousQty: item.quantity,
    newQty: 0,
    delta: -item.quantity,
    notes: `Barang dihapus oleh ${user}`,
    timestamp: new Date().toISOString(),
  };
  store.logs.push(log);
  saveStore(store);

  // Sync to Firebase Cloud Firestore
  deleteItemFromFirestore(id).catch((err) => console.error('Firebase delete item failed:', err));
  saveLogToFirestore(log).catch((err) => console.error('Firebase save log failed:', err));

  const stats = calculateStats(store.items);
  broadcastEvent('ITEM_DELETED', { itemId: id, log, stats, user });

  res.json({ success: true, stats });
});

// POST /api/users - Add new user
app.post('/api/users', (req: Request, res: Response) => {
  const { name, role = 'Petugas Opname', color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nama user wajib diisi.' });
  }

  const cleanName = name.trim().toUpperCase();
  const exists = store.users.find((u) => u.name.toUpperCase() === cleanName);
  if (exists) {
    return res.status(400).json({ error: `User dengan nama "${cleanName}" sudah ada.` });
  }

  const palette = ['#0284c7', '#059669', '#7c3aed', '#ea580c', '#db2777', '#ca8a04', '#0d9488', '#4f46e5'];
  const assignedColor = color || palette[store.users.length % palette.length];

  const newUser: MartUser = {
    id: `usr-${Date.now()}`,
    name: cleanName,
    role: role.trim() || 'Petugas Opname',
    color: assignedColor,
    createdAt: new Date().toISOString(),
  };

  store.users.push(newUser);
  saveStore(store);

  broadcastEvent('USER_ADDED', { user: newUser, users: store.users });
  res.json({ success: true, user: newUser, users: store.users });
});

// GET /api/users - List all users
app.get('/api/users', (_req: Request, res: Response) => {
  res.json({ users: store.users });
});

// POST /api/auth/verify-iyan - Verify password for user IYAN to authorize import/export
app.post('/api/auth/verify-iyan', (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password wajib diisi.' });
  }

  if (password === IYAN_PASSWORD) {
    const token = generateIyanToken();
    return res.json({ success: true, token, user: 'IYAN' });
  } else {
    return res.status(401).json({ success: false, error: 'Password salah. Akses ditolak.' });
  }
});

// POST /api/import - Import items from parsed XLSX data (Restricted strictly to user IYAN)
app.post('/api/import', (req: Request, res: Response) => {
  const { items, mode = 'merge', user = 'Admin' } = req.body;

  if (user !== 'IYAN' || !isAuthorizedIyan(req, user)) {
    return res.status(403).json({
      error: 'Akses Ditolak: Hanya user IYAN yang berhak melakukan import data.',
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Data import kosong atau format tidak sesuai.' });
  }

  let importedCount = 0;
  let updatedCount = 0;

  // Pastikan SKU diperiksa dan nomor berurutan dibuatkan (mengisi nomor terlewat)
  const { items: normalizedBatch, report: skuReport } = assignSequentialMissingSKUs(
    items,
    store.items,
    mode
  );

  if (mode === 'replace') {
    // Replace all items
    store.items = normalizedBatch.map((raw, idx) => ({
      id: raw.id || `item-imp-${Date.now()}-${idx}`,
      sku: String(raw.sku).trim().toUpperCase(),
      namaBarang: String(raw.namaBarang || 'Barang Tanpa Nama').trim(),
      barcode: String(raw.barcode || '').trim(),
      kategori: String(raw.kategori || 'Umum').trim(),
      quantity: Math.max(0, Number(raw.quantity) || 0),
      quantitySystem: Math.max(0, Number(raw.quantitySystem !== undefined ? raw.quantitySystem : raw.quantity) || 0),
      hargaModal: Math.max(0, Number(raw.hargaModal) || 0),
      keterangan: String(raw.keterangan || 'Import XLSX').trim(),
      lastUpdatedBy: user,
      updatedAt: new Date().toISOString(),
    }));
    importedCount = store.items.length;
  } else {
    // Merge / update existing
    normalizedBatch.forEach((raw, idx) => {
      const rawSku = String(raw.sku || '').trim().toUpperCase();
      const rawBarcode = String(raw.barcode || '').trim();

      const existingIndex = store.items.findIndex(
        (i) => (rawSku && i.sku.toUpperCase() === rawSku) || (rawBarcode && i.barcode === rawBarcode)
      );

      if (existingIndex >= 0) {
        // Update existing item
        const existing = store.items[existingIndex];
        store.items[existingIndex] = {
          ...existing,
          namaBarang: raw.namaBarang ? String(raw.namaBarang).trim() : existing.namaBarang,
          kategori: raw.kategori ? String(raw.kategori).trim() : existing.kategori,
          quantity: raw.quantity !== undefined ? Math.max(0, Number(raw.quantity)) : existing.quantity,
          quantitySystem: raw.quantitySystem !== undefined ? Math.max(0, Number(raw.quantitySystem)) : existing.quantitySystem,
          hargaModal: raw.hargaModal !== undefined ? Math.max(0, Number(raw.hargaModal)) : existing.hargaModal,
          keterangan: raw.keterangan !== undefined ? String(raw.keterangan) : existing.keterangan,
          lastUpdatedBy: user,
          updatedAt: new Date().toISOString(),
        };
        updatedCount++;
      } else {
        // Create new item
        store.items.push({
          id: `item-imp-${Date.now()}-${idx}`,
          sku: rawSku,
          namaBarang: String(raw.namaBarang || 'Barang Baru').trim(),
          barcode: rawBarcode || `BAR-${Date.now().toString().slice(-6)}-${idx}`,
          kategori: String(raw.kategori || 'Umum').trim(),
          quantity: Math.max(0, Number(raw.quantity) || 0),
          quantitySystem: Math.max(0, Number(raw.quantitySystem !== undefined ? raw.quantitySystem : raw.quantity) || 0),
          hargaModal: Math.max(0, Number(raw.hargaModal) || 0),
          keterangan: String(raw.keterangan || 'Import XLSX').trim(),
          lastUpdatedBy: user,
          updatedAt: new Date().toISOString(),
        });
        importedCount++;
      }
    });
  }

  const log: ScanAuditLog = {
    id: `log-${Date.now()}`,
    itemId: 'batch-import',
    sku: 'BATCH',
    namaBarang: `Import XLSX (${importedCount} baru, ${updatedCount} diperbarui)`,
    barcode: '-',
    user,
    action: 'IMPORT_XLSX',
    previousQty: 0,
    newQty: store.items.length,
    delta: importedCount,
    notes: `Mode: ${mode}`,
    timestamp: new Date().toISOString(),
  };
  store.logs.push(log);
  saveStore(store);

  // Sync all imported items to Firebase Cloud Firestore
  batchSaveItemsToFirestore(store.items).catch((err) => console.error('Firebase batch import failed:', err));
  saveLogToFirestore(log).catch((err) => console.error('Firebase save log failed:', err));

  const stats = calculateStats(store.items);
  broadcastEvent('BATCH_IMPORTED', { importedCount, updatedCount, stats, user });

  res.json({
    success: true,
    importedCount,
    updatedCount,
    totalItems: store.items.length,
    stats,
  });
});

// POST /api/reset-counts - Reset all physical counts to 0 for a fresh opname audit
app.post('/api/reset-counts', (req: Request, res: Response) => {
  const { user = 'Admin' } = req.body;
  const now = new Date().toISOString();

  store.items.forEach((item) => {
    item.quantity = 0;
    item.lastUpdatedBy = user;
    item.updatedAt = now;
  });

  const log: ScanAuditLog = {
    id: `log-${Date.now()}`,
    itemId: 'all',
    sku: 'RESET',
    namaBarang: 'Reset Semua Stok Fisik Menjadi 0 untuk Sesi Opname Baru',
    barcode: '-',
    user,
    action: 'SET_QUANTITY',
    previousQty: 0,
    newQty: 0,
    delta: 0,
    notes: 'Reset sesi stok opname baru',
    timestamp: now,
  };
  store.logs.push(log);
  saveStore(store);

  // Sync reset items to Firebase Cloud Firestore
  batchSaveItemsToFirestore(store.items).catch((err) => console.error('Firebase batch reset failed:', err));
  saveLogToFirestore(log).catch((err) => console.error('Firebase save log failed:', err));

  const stats = calculateStats(store.items);
  broadcastEvent('COUNTS_RESET', { stats, user });

  res.json({ success: true, stats });
});

// GET /api/firebase-status - Check Firebase Cloud status
app.get('/api/firebase-status', async (_req: Request, res: Response) => {
  try {
    const connected = await testFirestoreConnection();
    res.json({
      connected,
      provider: 'Firebase Cloud Firestore',
      projectId: 'level-zepplin-l9v0l',
      firestoreDatabaseId: 'ai-studio-martopnamesistem-e9f5fcf9-37a6-4901-ba72-3a61c854e9b3',
      totalItemsInCloud: store.items.length,
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err?.message || 'Error checking status' });
  }
});

// Setup Vite dev server or static files
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`DR MART Server running at http://0.0.0.0:${port}`);
    initFirestoreData();
  });
}

startServer();
