import { InventoryItem, MartUser } from '../types/inventory.ts';

export const INITIAL_USERS: MartUser[] = [
  { id: 'usr-1', name: 'IYAN', role: 'Leader Opname & Kasir', color: '#0284c7', createdAt: '2026-10-25T08:00:00.000Z' },
  { id: 'usr-2', name: 'HENDRI', role: 'Staff Gudang', color: '#059669', createdAt: '2026-10-25T08:00:00.000Z' },
  { id: 'usr-3', name: 'AZYMA', role: 'Staff Display Rak', color: '#7c3aed', createdAt: '2026-10-25T08:00:00.000Z' },
  { id: 'usr-4', name: 'RAIHAN', role: 'Checker Barang', color: '#ea580c', createdAt: '2026-10-25T08:00:00.000Z' },
  { id: 'usr-5', name: 'NURI', role: 'Admin Stok & Pembelian', color: '#db2777', createdAt: '2026-10-25T08:00:00.000Z' },
];

// Semua data demo telah dihapus. Database mulai dari 0 item bersih.
export const INITIAL_ITEMS: InventoryItem[] = [];

export const CATEGORIES = [
  'Semua Kategori',
  'Sembako',
  'Minuman',
  'Snack & Makanan',
  'Bumbu Dapur',
  'Perawatan Pribadi',
  'Pembersih Rumah',
  'Susu & Sarapan',
];
