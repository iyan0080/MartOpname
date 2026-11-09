export type ProductStatus = 'AKTIF' | 'NONAKTIF' | 'ARSIP';

export interface InventoryItem {
  id: string;
  sku: string;
  namaBarang: string; // nama_produk
  barcode: string;
  kategori: string;
  satuan?: string; // satuan (pcs/box)
  hargaModal: number; // harga_modal (Rp)
  hargaJual?: number; // harga_jual (Rp)
  quantity: number; // Stok Fisik hasil opname
  quantitySystem: number; // Stok Sistem / Buku (stok_awal)
  stokAwal?: number; // stok_awal
  stokMinimum?: number; // stok_minumum / peringatan restock
  status?: ProductStatus; // status (AKTIF / NONAKTIF / ARSIP)
  keterangan?: string; // catatan (opsional)
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

export interface PengeluaranOperasionalItem {
  id: string;
  tanggal: string; // YYYY-MM-DD
  kategori: string; // Perlengkapan, Listrik, Transport, dsb
  namaPengeluaran: string; // Uraian / Nama belanja operasional
  jumlah: number; // Nominal Rp
  metodeBayar: 'tunai' | 'bank'; // Kas laci tunai atau transfer bank / QRIS
  keterangan?: string; // No nota / keterangan tambahan
  pj?: string; // Dicatat / PIC
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
  pengeluaranOperasionalList?: PengeluaranOperasionalItem[];
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
  totalPengeluaranOperasional: number;
  totalKewajiban: number; // Hutang Mitra + Saldo Santri
  totalAsetLancar: number; // Total Kas + Total Piutang
  totalAsetFisikBarang: number; // Nilai Modal Investasi Stok Fisik
  totalAsetRiil: number; // Aset Fisik Barang + Total Kas + Total Piutang
  nilaiBersihMart: number; // Total Aset Riil - Total Kewajiban
  pertumbuhanModal: number; // Nilai Bersih Mart - Modal Awal
}

