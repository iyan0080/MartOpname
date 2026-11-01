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

export interface OpnameSession {
  id: string;
  opnameDate: string; // YYYY-MM-DD
  title: string;
  picIyan: string;
  picHendri: string;
  notes?: string;
  status: 'draft' | 'ongoing' | 'completed';
  updatedAt: string;
  updatedBy: string;
}

export interface PiutangItem {
  id: string;
  namaMarhalah: string; // Nama marhalah yang memiliki hutang ke mart
  jumlah: number; // Nominal piutang (Rp)
  keterangan?: string;
}

export interface HutangMitraItem {
  id: string;
  namaMitra: string; // Nama mitra/supplier
  jumlah: number; // Nominal hutang mart (Rp)
  keterangan?: string;
}

export interface SaldoSantriItem {
  id: string;
  namaSantri: string; // Nama santri / asrama / titipan
  jumlah: number; // Nominal saldo santri (Rp)
  keterangan?: string;
}

export interface KasData {
  uangTunai: number; // Uang tunai fisik (cash drawer / brankas)
  saldoBank: number; // Saldo rekening bank / QRIS
  modalAwal: number; // Nilai modal awal operasional mart
  catatanKas?: string;
}

export interface FinanceRecord {
  id: string;
  kas: KasData;
  piutangList: PiutangItem[];
  hutangMitraList: HutangMitraItem[];
  saldoSantriList: SaldoSantriItem[];
  lastUpdatedBy: string;
  updatedAt: string;
}

export interface LaporanOpnameSummary {
  session: OpnameSession;
  stats: InventoryStats;
  finance: FinanceRecord;
  totalKas: number;
  totalPiutang: number;
  totalHutangMitra: number;
  totalSaldoSantri: number;
  totalKewajiban: number; // Hutang Mitra + Saldo Santri
  totalAsetLancar: number; // Total Kas + Total Piutang
  totalAsetFisikBarang: number; // Nilai Modal Investasi Stok Fisik
  totalAsetRiil: number; // Aset Fisik Barang + Total Kas + Total Piutang
  nilaiBersihMart: number; // Total Aset Riil - Total Kewajiban
  pertumbuhanModal: number; // Nilai Bersih Mart - Modal Awal
}

