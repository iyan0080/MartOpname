import * as XLSX from 'xlsx';
import { InventoryItem, InventoryStats, OpnameSession, FinanceRecord } from '../types/inventory.ts';

// Format currency as Indonesian Rupiah
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// Template kolom standar resmi import/export Mart
export const EXCEL_TEMPLATE_COLUMNS = [
  'Sku',
  'Barcode',
  'nama_produk',
  'Kategori',
  'satuan (pcs/box)',
  'harga_modal',
  'harga_jual',
  'stok_awal',
  'stok_minumum',
  'status (AKTIF/NONAKTIF/ARSIP)',
  'catatan',
] as const;

// Export inventory data to formatted Excel (.xlsx) using the official template columns
export function exportInventoryToXLSX(items: InventoryItem[], stats?: InventoryStats) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Data Produk (Format 11 Kolom Standar Import/Export)
  const templateHeaders = [...EXCEL_TEMPLATE_COLUMNS];

  const templateRows = items.map((item) => {
    const modal = Number(item.hargaModal) || 0;
    const jual = Number(item.hargaJual) || (modal > 0 ? Math.round(modal * 1.15) : 0);
    const stokAwal = item.stokAwal !== undefined ? Number(item.stokAwal) : (Number(item.quantitySystem) || 0);
    const stokMin = item.stokMinimum !== undefined ? Number(item.stokMinimum) : 5;
    const statusVal = item.status || 'AKTIF';
    const satuanVal = item.satuan || 'pcs';

    return [
      item.sku,
      item.barcode || '',
      item.namaBarang,
      item.kategori || 'Umum',
      satuanVal,
      modal,
      jual,
      stokAwal,
      stokMin,
      statusVal,
      item.keterangan || '',
    ];
  });

  const ws1 = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateRows]);
  ws1['!cols'] = [
    { wch: 14 }, // Sku
    { wch: 18 }, // Barcode
    { wch: 36 }, // nama_produk
    { wch: 18 }, // Kategori
    { wch: 16 }, // satuan (pcs/box)
    { wch: 14 }, // harga_modal
    { wch: 14 }, // harga_jual
    { wch: 12 }, // stok_awal
    { wch: 14 }, // stok_minumum
    { wch: 18 }, // status (AKTIF/NONAKTIF/ARSIP)
    { wch: 28 }, // catatan
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Data Produk (Template)');

  // Sheet 2: Hasil Audit Stok Opname (Laporan Fisik vs Sistem)
  const auditHeaders = [
    'No',
    'SKU',
    'Barcode',
    'Nama Produk',
    'Kategori',
    'Satuan',
    'Stok Fisik (Opname)',
    'Stok Sistem (Awal)',
    'Selisih (Fisik - Sistem)',
    'Harga Modal (Rp)',
    'Harga Jual (Rp)',
    'Total Modal Fisik (Rp)',
    'Selisih Modal (Rp)',
    'Status',
    'Catatan / Lokasi',
    'Petugas Terakhir',
    'Waktu Update',
  ];

  const auditRows = items.map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const sysQty = Number(item.quantitySystem) || 0;
    const diff = qty - sysQty;
    const modal = Number(item.hargaModal) || 0;
    const jual = Number(item.hargaJual) || 0;
    const totalModal = qty * modal;
    const diffModal = diff * modal;

    return [
      index + 1,
      item.sku,
      item.barcode || '-',
      item.namaBarang,
      item.kategori || 'Umum',
      item.satuan || 'pcs',
      qty,
      sysQty,
      diff,
      modal,
      jual,
      totalModal,
      diffModal,
      item.status || 'AKTIF',
      item.keterangan || '-',
      item.lastUpdatedBy || '-',
      item.updatedAt ? new Date(item.updatedAt).toLocaleString('id-ID') : '-',
    ];
  });

  const totalQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const totalSys = items.reduce((sum, i) => sum + (Number(i.quantitySystem) || 0), 0);
  const totalModal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.hargaModal) || 0), 0);
  const totalDiffModal = items.reduce(
    (sum, i) => sum + ((Number(i.quantity) || 0) - (Number(i.quantitySystem) || 0)) * (Number(i.hargaModal) || 0),
    0
  );

  const summaryRow = [
    'TOTAL',
    '',
    '',
    `Total: ${items.length} Barang`,
    '',
    '',
    totalQty,
    totalSys,
    totalQty - totalSys,
    '',
    '',
    totalModal,
    totalDiffModal,
    '',
    'Hasil Opname',
    '',
    new Date().toLocaleString('id-ID'),
  ];

  const ws2 = XLSX.utils.aoa_to_sheet([auditHeaders, ...auditRows, summaryRow]);
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 18 },
    { wch: 34 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 26 },
    { wch: 16 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Laporan Stok Opname');

  // Sheet 3: Rekap Per Kategori
  if (stats && stats.categorySummary) {
    const catHeaders = ['No', 'Kategori', 'Jumlah Item SKU', 'Total Stok Fisik', 'Total Modal Diinvestasikan (Rp)'];
    const catRows = stats.categorySummary.map((cat, idx) => [
      idx + 1,
      cat.kategori,
      cat.itemCount,
      cat.totalQty,
      cat.totalModal,
    ]);
    const catWsData = [
      catHeaders,
      ...catRows,
      ['TOTAL', 'Semua Kategori', stats.totalItems, stats.totalPhysicalQty, stats.totalModalInvestasi],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(catWsData);
    ws3['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Rekap Kategori');
  }

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Laporan_Stok_Opname_Mart_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// Download Official Blank or Sample Excel Template for Import
export function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // Exactly matching requested 11 template headers
  const headers = [...EXCEL_TEMPLATE_COLUMNS];

  const sampleRows = [
    ['SMB-001', '8991234500010', 'Bimoli Minyak Goreng 2 Liter Pouch', 'Sembako', 'pcs', 34000, 38500, 50, 10, 'AKTIF', 'Rak Sembako A1'],
    ['MNM-002', '8991234500020', 'Aqua Botol 600ml (1 Dus/24)', 'Minuman', 'box', 48000, 54000, 25, 5, 'AKTIF', 'Gudang Minuman'],
    ['SNK-003', '8991234500030', 'Chiki Balls Keju 55g', 'Snack & Makanan', 'pcs', 5500, 7000, 40, 12, 'AKTIF', 'Rak Depan Kasir'],
    ['PRW-004', '8991234500040', 'Pasta Gigi Pepsodent 190g', 'Perawatan Pribadi', 'pcs', 12500, 15000, 20, 5, 'AKTIF', 'Etalase Mandi'],
    ['ATK-005', '8991234500050', 'Buku Tulis Sinar Dunia 38 Lembar (1 Pack/10)', 'Alat Tulis & Kantor', 'box', 38000, 45000, 15, 3, 'AKTIF', 'Rak ATK C2'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 14 }, // Sku
    { wch: 18 }, // Barcode
    { wch: 38 }, // nama_produk
    { wch: 20 }, // Kategori
    { wch: 16 }, // satuan (pcs/box)
    { wch: 14 }, // harga_modal
    { wch: 14 }, // harga_jual
    { wch: 12 }, // stok_awal
    { wch: 14 }, // stok_minumum
    { wch: 18 }, // status (AKTIF/NONAKTIF/ARSIP)
    { wch: 28 }, // catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Template Produk');
  XLSX.writeFile(wb, 'Template_Import_Mart.xlsx');
}

// Pemeriksaan SKU & Generator SKU Berurutan Otomatis (Mengisi Nomer SKU Terlewat)
export function isMissingOrInvalidSku(sku: any): boolean {
  if (sku === null || sku === undefined) return true;
  const s = String(sku).trim().toUpperCase();
  if (!s) return true;
  if (
    s === '-' ||
    s === '--' ||
    s === '---' ||
    s === '0' ||
    s === 'N/A' ||
    s === 'NA' ||
    s === 'NULL' ||
    s === 'NONE' ||
    s === 'BARU' ||
    s === 'KOSONG' ||
    s === 'BELUM ADA' ||
    s === 'TIDAK ADA' ||
    s === 'UNDEFINED'
  ) {
    return true;
  }
  return false;
}

export function extractSkuNumber(sku: string | undefined): number | null {
  if (!sku) return null;
  const clean = sku.trim().toUpperCase();
  const match = clean.match(/^(?:SKU[\s\-_]*)?(\d+)$/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

export interface GeneratedSkuDetail {
  index: number;
  namaBarang: string;
  sku: string;
  isGapFilled: boolean;
}

export interface SkuInspectionReport {
  totalItems: number;
  validSkuCount: number;
  missingSkuCount: number;
  gapFilledCount: number;
  generatedSkus: GeneratedSkuDetail[];
  skippedNumbersFound: number[];
}

/**
 * Memeriksa seluruh SKU hasil import XLSX dan membuatkan SKU berurutan otomatis
 * untuk barang yang belum memiliki SKU.
 * ATURAN KHUSUS:
 * 1. Memeriksa nomor SKU yang sudah terpakai di katalog / batch import.
 * 2. Mengidentifikasi nomor urut yang terlewatkan (gap/celah urutan).
 * 3. Menggunakan nomor terlewat terlebih dahulu secara berurutan sebelum melanjutkan ke nomor setelah tertinggi.
 */
export function assignSequentialMissingSKUs(
  importItems: Partial<InventoryItem>[],
  existingCatalog: InventoryItem[] = [],
  mode: 'merge' | 'replace' = 'merge',
  prefix: string = 'SKU-'
): {
  items: Partial<InventoryItem>[];
  report: SkuInspectionReport;
} {
  const usedNumbers = new Set<number>();
  const usedSkuStrings = new Set<string>();

  // Pada mode gabungkan (merge), perhitungkan seluruh SKU yang sudah ada di database toko
  if (mode === 'merge' && Array.isArray(existingCatalog)) {
    existingCatalog.forEach((item) => {
      const s = (item.sku || '').trim().toUpperCase();
      if (s) {
        usedSkuStrings.add(s);
        const num = extractSkuNumber(s);
        if (num !== null) usedNumbers.add(num);
      }
    });
  }

  // Perhitungkan juga SKU yang valid dari dalam file Excel itu sendiri
  importItems.forEach((item) => {
    if (!isMissingOrInvalidSku(item.sku)) {
      const s = String(item.sku).trim().toUpperCase();
      usedSkuStrings.add(s);
      const num = extractSkuNumber(s);
      if (num !== null) usedNumbers.add(num);
    }
  });

  const maxExisting = usedNumbers.size > 0 ? Math.max(...usedNumbers) : 0;

  // Deteksi semua nomor SKU yang terlewatkan (gaps) di bawah maxExisting
  const skippedNumbers: number[] = [];
  for (let i = 1; i < maxExisting; i++) {
    if (!usedNumbers.has(i)) {
      skippedNumbers.push(i);
    }
  }

  const generatedSkus: GeneratedSkuDetail[] = [];
  let candidate = 1;

  const resultItems = importItems.map((item, idx) => {
    if (!isMissingOrInvalidSku(item.sku)) {
      return {
        ...item,
        sku: String(item.sku).trim().toUpperCase(),
        isSkuAutoGenerated: false,
        isGapFilled: false,
      };
    }

    // Cari nomor berikutnya yang kosong (mengisi nomor terlewat terlebih dahulu)
    while (usedNumbers.has(candidate)) {
      candidate++;
    }

    const assignedNum = candidate;
    const isGapFilled = maxExisting > 0 && assignedNum < maxExisting;
    const assignedSku = `${prefix}${assignedNum}`;

    usedNumbers.add(assignedNum);
    usedSkuStrings.add(assignedSku);

    generatedSkus.push({
      index: idx,
      namaBarang: String(item.namaBarang || 'Barang').trim(),
      sku: assignedSku,
      isGapFilled,
    });

    candidate++;

    return {
      ...item,
      sku: assignedSku,
      isSkuAutoGenerated: true,
      isGapFilled,
    };
  });

  const report: SkuInspectionReport = {
    totalItems: importItems.length,
    validSkuCount: importItems.length - generatedSkus.length,
    missingSkuCount: generatedSkus.length,
    gapFilledCount: generatedSkus.filter((g) => g.isGapFilled).length,
    generatedSkus,
    skippedNumbersFound: skippedNumbers,
  };

  return { items: resultItems, report };
}

// Parse uploaded XLSX / XLS file using the 11-column template format
export async function parseExcelFile(
  file: File,
  existingCatalog: InventoryItem[] = [],
  mode: 'merge' | 'replace' = 'merge'
): Promise<{
  success: boolean;
  data: Partial<InventoryItem>[];
  errors: string[];
  skuInspection?: SkuInspectionReport;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({ success: false, data: [], errors: ['File kosong atau tidak dapat dibaca.'] });
          return;
        }

        const wb = XLSX.read(data, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawJson.length === 0) {
          resolve({ success: false, data: [], errors: ['Lembar kerja Excel kosong.'] });
          return;
        }

        const errors: string[] = [];
        const rawParsedItems: Partial<InventoryItem>[] = [];

        rawJson.forEach((row, idx) => {
          // Normalize column keys: remove spaces, underscores, hyphens, and brackets
          const normalized: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            const cleanKey = k.trim().toUpperCase().replace(/[\s_()\-]/g, '');
            normalized[cleanKey] = row[k];
          });

          // Match the 11 requested template fields and their standard aliases
          // 1. Sku
          const sku = normalized['SKU'] || normalized['KODESKU'] || normalized['KODEBARANG'] || '';

          // 2. Barcode
          const barcode = normalized['BARCODE'] || normalized['KODEBARCODE'] || normalized['EAN'] || '';

          // 3. nama_produk
          const nama =
            normalized['NAMAPRODUK'] ||
            normalized['NAMA_PRODUK'] ||
            normalized['NAMABARANG'] ||
            normalized['NAMA'] ||
            normalized['PRODUK'] ||
            normalized['BARANG'] ||
            '';

          // 4. Kategori (mendukung berbagai nama kolom kategori toko mart)
          const kategori =
            normalized['KATEGORI'] ||
            normalized['CATEGORY'] ||
            normalized['DEPARTEMEN'] ||
            normalized['DEPARTMENT'] ||
            normalized['GOLONGAN'] ||
            normalized['JENIS'] ||
            normalized['JENISBARANG'] ||
            normalized['KELOMPOK'] ||
            normalized['GRUP'] ||
            normalized['GROUP'] ||
            normalized['TIPE'] ||
            '';

          // 5. satuan (pcs/box)
          const rawSatuan = String(normalized['SATUANPCSBOX'] || normalized['SATUAN'] || normalized['UNIT'] || 'pcs').trim().toLowerCase();
          const satuan = rawSatuan.includes('box') || rawSatuan.includes('dus') || rawSatuan.includes('karton') ? 'box' : (rawSatuan || 'pcs');

          // 6. harga_modal
          const modal = Number(normalized['HARGAMODAL'] || normalized['MODAL'] || normalized['HARGABELI'] || 0);

          // 7. harga_jual
          const jual = Number(normalized['HARGAJUAL'] || normalized['JUAL'] || normalized['HARGA'] || 0);

          // 8. stok_awal
          const stokAwal = Number(
            normalized['STOKAWAL'] ||
            normalized['STOK_AWAL'] ||
            normalized['STOKSISTEM'] ||
            normalized['STOK'] ||
            normalized['QUANTITY'] ||
            normalized['QTY'] ||
            0
          );

          // 9. stok_minumum (tolerates 'stok_minumum' and 'stok_minimum')
          const stokMin = Number(
            normalized['STOKMINUMUM'] ||
            normalized['STOKMINIMUM'] ||
            normalized['STOK_MINUMUM'] ||
            normalized['STOK_MINIMUM'] ||
            normalized['MINSTOK'] ||
            normalized['MINIMUM'] ||
            0
          );

          // 10. status (AKTIF/NONAKTIF/ARSIP)
          const rawStatus = String(
            normalized['STATUSAKTIFNONAKTIFARSIP'] ||
            normalized['STATUS'] ||
            'AKTIF'
          ).trim().toUpperCase();
          let status: 'AKTIF' | 'NONAKTIF' | 'ARSIP' = 'AKTIF';
          if (rawStatus.includes('NON') || rawStatus.includes('TIDAK') || rawStatus.includes('INAKTIF')) {
            status = 'NONAKTIF';
          } else if (rawStatus.includes('ARSIP') || rawStatus.includes('ARCHIVE')) {
            status = 'ARSIP';
          } else {
            status = 'AKTIF';
          }

          // 11. catatan
          const catatan = normalized['CATATAN'] || normalized['KETERANGAN'] || normalized['NOTES'] || '';

          if (!sku && !nama && !barcode) {
            // Empty row, skip
            return;
          }

          if (!nama) {
            errors.push(`Baris ${idx + 2}: nama_produk tidak boleh kosong.`);
          }

          rawParsedItems.push({
            sku: String(sku || '').trim().toUpperCase(),
            namaBarang: String(nama || 'Tanpa Nama').trim(),
            barcode: String(barcode).trim(),
            kategori: String(kategori).trim() || 'Umum',
            satuan,
            hargaModal: Math.max(0, isNaN(modal) ? 0 : modal),
            hargaJual: Math.max(0, isNaN(jual) ? 0 : jual),
            stokAwal: Math.max(0, isNaN(stokAwal) ? 0 : stokAwal),
            quantitySystem: Math.max(0, isNaN(stokAwal) ? 0 : stokAwal),
            quantity: Math.max(0, isNaN(stokAwal) ? 0 : stokAwal),
            stokMinimum: Math.max(0, isNaN(stokMin) ? 0 : stokMin),
            status,
            keterangan: String(catatan).trim() || 'Import XLSX',
          });
        });

        // Jalankan pemeriksaan SKU dan alokasikan nomor urut bagi barang tanpa SKU (isi nomor terlewat)
        const { items: processedItems, report } = assignSequentialMissingSKUs(
          rawParsedItems,
          existingCatalog,
          mode
        );

        resolve({
          success: processedItems.length > 0,
          data: processedItems,
          errors,
          skuInspection: report,
        });
      } catch (err: any) {
        resolve({
          success: false,
          data: [],
          errors: [`Gagal memproses file Excel: ${err.message || err}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, data: [], errors: ['Gagal membaca file dari disk.'] });
    };

    reader.readAsBinaryString(file);
  });
}

// Export Comprehensive Opname Report (Inventory + Kas + Hutang + Piutang)
export function exportLaporanHasilOpnameKomprehensif(
  items: InventoryItem[],
  stats: InventoryStats | null,
  session: OpnameSession,
  finance: FinanceRecord
) {
  const wb = XLSX.utils.book_new();

  // Financial summary calculations
  const totalKas = (Number(finance.kas?.uangTunai) || 0) + (Number(finance.kas?.saldoBank) || 0);
  const modalAwal = Number(finance.kas?.modalAwal) || 0;
  const totalPiutang = (finance.piutangList || []).reduce((sum, p) => sum + (Number(p.jumlah) || 0), 0);
  const totalHutangMitra = (finance.hutangMitraList || []).reduce((sum, h) => sum + (Number(h.jumlah) || 0), 0);
  const totalSaldoSantri = (finance.saldoSantriList || []).reduce((sum, s) => sum + (Number(s.jumlah) || 0), 0);
  const totalKewajiban = totalHutangMitra + totalSaldoSantri;
  const totalPengeluaranOperasional = (finance.pengeluaranOperasionalList || []).reduce(
    (sum, op) => sum + (Number(op.jumlah) || 0),
    0
  );
  const totalAsetFisikBarang = stats?.totalModalInvestasi || 0;
  const totalAsetRiil = totalAsetFisikBarang + totalKas + totalPiutang;
  const nilaiBersihMart = totalAsetRiil - totalKewajiban;
  const pertumbuhanModal = nilaiBersihMart - modalAwal;

  // Sheet 1: Executive Summary
  const summaryRows = [
    ['LAPORAN HASIL STOK OPNAME & AUDIT KEUANGAN MART'],
    [`Tanggal Pelaksanaan Opname: ${session.opnameDate || new Date().toISOString().split('T')[0]}`],
    [`Judul Sesi: ${session.title || 'Stok Opname Mart'}`],
    [`Pemeriksa / Auditor Khusus: ${session.picIyan || 'IYAN'} & ${session.picHendri || 'HENDRI'}`],
    [`Dicetak / Digenerate Pada: ${new Date().toLocaleString('id-ID')}`],
    [''],
    ['1. POSISI NERACA & KEKAYAAN BERSIH MART', 'NOMINAL (RUPIAH)', 'KETERANGAN'],
    ['Total Nilai Barang Fisik (Aset Stok)', totalAsetFisikBarang, 'Hasil perhitungan fisik x harga modal'],
    ['Total Kas (Tunai + Bank)', totalKas, `Tunai: ${formatRupiah(finance.kas?.uangTunai || 0)} | Bank: ${formatRupiah(finance.kas?.saldoBank || 0)}`],
    ['Total Piutang Marhalah', totalPiutang, `${(finance.piutangList || []).length} Marhalah terdata`],
    ['--- TOTAL ASET RIIL MART ---', totalAsetRiil, 'Stok Fisik + Kas + Piutang Marhalah'],
    ['Total Hutang Mitra Supplier', totalHutangMitra, `${(finance.hutangMitraList || []).length} Mitra terdata`],
    ['Total Saldo Tabungan Santri', totalSaldoSantri, `${(finance.saldoSantriList || []).length} Titipan Santri terdata`],
    ['--- TOTAL KEWAJIBAN / HUTANG ---', totalKewajiban, 'Hutang Mitra + Saldo Santri'],
    ['=== NILAI BERSIH MART (NET EQUITY) ===', nilaiBersihMart, 'Total Aset Riil dikurangi Total Kewajiban'],
    ['Modal Awal Mart', modalAwal, 'Nilai modal awal pendirian/operasional'],
    ['Surplus / Pertumbuhan Modal', pertumbuhanModal, pertumbuhanModal >= 0 ? 'Surplus / Laba Akumulasi' : 'Defisit / Penurunan Modal'],
    ['Total Pengeluaran Operasional Toko', totalPengeluaranOperasional, `${(finance.pengeluaranOperasionalList || []).length} pengeluaran dibukukan`],
    [''],
    ['2. STATISTIK FISIK BARANG', 'NILAI', 'CATATAN'],
    ['Total SKU / Jenis Barang', stats?.totalItems || items.length, 'Produk terdaftar di mart'],
    ['Total Kuantitas Fisik Terhitung', stats?.totalPhysicalQty || 0, 'Pcs / Unit fisik'],
    ['Total Kuantitas di Sistem Toko', stats?.totalSystemQty || 0, 'Pcs / Unit data buku'],
    ['Selisih Kuantitas (Fisik - Sistem)', stats?.totalSelisihQty || 0, 'Unit'],
    ['Total Modal Fisik', stats?.totalModalInvestasi || 0, 'Rupiah'],
    ['Total Modal Sistem', stats?.totalModalSystem || 0, 'Rupiah'],
    ['Selisih Rupiah Modal Barang', stats?.selisihModal || 0, (stats?.selisihModal || 0) >= 0 ? 'Surplus Stok' : 'Selisih Minus Barang'],
    ['Barang Sesuai (Match)', stats?.matchCount || 0, 'SKU'],
    ['Barang Selisih Kurang (Minus)', stats?.minusCount || 0, 'SKU'],
    ['Barang Selisih Lebih (Plus)', stats?.plusCount || 0, 'SKU'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 24 }, { wch: 46 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Hasil Opname');

  // Sheet 2: Rincian Kas, Hutang, Piutang
  const financeRows: any[][] = [
    ['RINCIAN KAS, HUTANG DAN PIUTANG (AUDIT IYAN & HENDRI)'],
    [`Tanggal Opname: ${session.opnameDate}`],
    [''],
    ['A. KAS DAN MODAL AWAL', 'NOMINAL (RP)', 'CATATAN'],
    ['Uang Tunai (Cash Drawer/Brankas)', Number(finance.kas?.uangTunai) || 0, finance.kas?.catatanKas || '-'],
    ['Saldo Rekening Bank / QRIS', Number(finance.kas?.saldoBank) || 0, ''],
    ['Total Kas Riil', totalKas, 'Uang Tunai + Saldo Bank'],
    ['Modal Awal Mart', modalAwal, ''],
    [''],
    ['B. PIUTANG (HUTANG MARHALAH KE MART)', 'NOMINAL (RP)', 'KETERANGAN'],
  ];

  if ((finance.piutangList || []).length === 0) {
    financeRows.push(['Tidak ada data piutang marhalah', 0, '-']);
  } else {
    finance.piutangList.forEach((p, idx) => {
      financeRows.push([`${idx + 1}. ${p.namaMarhalah}`, Number(p.jumlah) || 0, p.keterangan || '-']);
    });
  }
  financeRows.push(['TOTAL PIUTANG MARHALAH', totalPiutang, '']);
  financeRows.push(['']);

  financeRows.push(['C. HUTANG MITRA / SUPPLIER', 'NOMINAL (RP)', 'KETERANGAN']);
  if ((finance.hutangMitraList || []).length === 0) {
    financeRows.push(['Tidak ada data hutang mitra', 0, '-']);
  } else {
    finance.hutangMitraList.forEach((h, idx) => {
      financeRows.push([`${idx + 1}. ${h.namaMitra}`, Number(h.jumlah) || 0, h.keterangan || '-']);
    });
  }
  financeRows.push(['TOTAL HUTANG MITRA', totalHutangMitra, '']);
  financeRows.push(['']);

  financeRows.push(['D. SALDO TITIPAN SANTRI', 'NOMINAL (RP)', 'KETERANGAN']);
  if ((finance.saldoSantriList || []).length === 0) {
    financeRows.push(['Tidak ada saldo santri', 0, '-']);
  } else {
    finance.saldoSantriList.forEach((s, idx) => {
      financeRows.push([`${idx + 1}. ${s.namaSantri}`, Number(s.jumlah) || 0, s.keterangan || '-']);
    });
  }
  financeRows.push(['TOTAL SALDO SANTRI', totalSaldoSantri, '']);
  financeRows.push(['']);
  financeRows.push(['TOTAL KEWAJIBAN (HUTANG MITRA + SALDO SANTRI)', totalKewajiban, '']);
  financeRows.push(['']);

  financeRows.push(['E. PENGELUARAN OPERASIONAL DR MART', 'NOMINAL (RP)', 'METODE / KETERANGAN']);
  if ((finance.pengeluaranOperasionalList || []).length === 0) {
    financeRows.push(['Tidak ada catatan pengeluaran operasional', 0, '-']);
  } else {
    (finance.pengeluaranOperasionalList || []).forEach((op, idx) => {
      financeRows.push([
        `${idx + 1}. [${op.tanggal}] ${op.kategori} - ${op.namaPengeluaran}`,
        Number(op.jumlah) || 0,
        `${op.metodeBayar === 'tunai' ? 'Tunai Laci' : 'Bank/QRIS'} ${op.keterangan ? `| ${op.keterangan}` : ''} ${op.pj ? `(${op.pj})` : ''}`,
      ]);
    });
  }
  financeRows.push(['TOTAL PENGELUARAN OPERASIONAL', totalPengeluaranOperasional, '']);

  const wsFinance = XLSX.utils.aoa_to_sheet(financeRows);
  wsFinance['!cols'] = [{ wch: 48 }, { wch: 22 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsFinance, 'Rincian Kas-Hutang-Piutang');

  // Sheet 3: Detail Barang
  const itemHeaders = [
    'No',
    'SKU',
    'Nama Barang',
    'Barcode',
    'Kategori',
    'Stok Fisik',
    'Stok Sistem',
    'Selisih',
    'Harga Modal (Rp)',
    'Total Modal Fisik (Rp)',
    'Selisih Modal (Rp)',
    'Petugas',
  ];
  const itemRows = items.map((i, idx) => {
    const q = Number(i.quantity) || 0;
    const sq = Number(i.quantitySystem) || 0;
    const diff = q - sq;
    const m = Number(i.hargaModal) || 0;
    return [
      idx + 1,
      i.sku,
      i.namaBarang,
      i.barcode,
      i.kategori,
      q,
      sq,
      diff,
      m,
      q * m,
      diff * m,
      i.lastUpdatedBy || '-',
    ];
  });
  const wsItems = XLSX.utils.aoa_to_sheet([itemHeaders, ...itemRows]);
  wsItems['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 36 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Detail Stok Barang');

  // Download file
  const dateStr = session.opnameDate || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Laporan_Hasil_Stok_Opname_Lengkap_${dateStr}.xlsx`);
}

