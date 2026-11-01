export interface InventoryItem {
  id: string;
  sku: string;
  namaBarang: string;
  barcode: string;
  kategori: string;
  quantity: number; // Stok Fisik hasil opname
  quantitySystem: number; // Stok Sistem / Buku
  hargaModal: number; // Harga modal per pcs (Rp)
  keterangan: string; // Catatan rak / expired / kondisi
  lastUpdatedBy: string; // Nama user terakhir yang scan/ubah
  updatedAt: string; // ISO date string
}

export interface MartUser {
  id: string;
  name: string;
  role: string;
  color: string;
  createdAt: string;
}

export interface ScanAuditLog {
  id: string;
  itemId: string;
  sku: string;
  namaBarang: string;
  barcode: string;
  user: string;
  action: 'SCAN_INCREMENT' | 'SET_QUANTITY' | 'ADD_ITEM' | 'UPDATE_ITEM' | 'IMPORT_XLSX' | 'DELETE_ITEM';
  previousQty: number;
  newQty: number;
  delta: number;
  notes?: string;
  timestamp: string;
}

export interface InventoryStats {
  totalItems: number;
  totalPhysicalQty: number;
  totalSystemQty: number;
  totalSelisihQty: number;
  totalModalInvestasi: number; // Sum of (quantity * hargaModal)
  totalModalSystem: number; // Sum of (quantitySystem * hargaModal)
  selisihModal: number; // totalModalInvestasi - totalModalSystem
  countedItemsCount: number;
  uncountedItemsCount: number;
  matchCount: number;
  minusCount: number;
  plusCount: number;
  categorySummary: {
    kategori: string;
    itemCount: number;
    totalQty: number;
    totalModal: number;
  }[];
}
