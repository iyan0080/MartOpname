import * as XLSX from 'xlsx';
import { InventoryItem, InventoryStats } from '../types/inventory.ts';

// Format currency as Indonesian Rupiah
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// Export inventory data to formatted Excel (.xlsx)
export function exportInventoryToXLSX(items: InventoryItem[], stats?: InventoryStats) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data Stok Opname
  const headers = [
    'No',
    'SKU',
    'Nama Barang',
    'Barcode',
    'Kategori',
    'Stok Fisik',
    'Stok Sistem',
    'Selisih (Fisik - Sistem)',
    'Harga Modal (Rp)',
    'Total Nilai Modal (Rp)',
    'Selisih Modal (Rp)',
    'Keterangan',
    'Petugas Terakhir',
    'Waktu Update',
  ];

  const rows = items.map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const sysQty = Number(item.quantitySystem) || 0;
    const diff = qty - sysQty;
    const modal = Number(item.hargaModal) || 0;
    const totalModal = qty * modal;
    const diffModal = diff * modal;

    return [
      index + 1,
      item.sku,
      item.namaBarang,
      item.barcode,
      item.kategori,
      qty,
      sysQty,
      diff,
      modal,
      totalModal,
      diffModal,
      item.keterangan || '-',
      item.lastUpdatedBy || '-',
      item.updatedAt ? new Date(item.updatedAt).toLocaleString('id-ID') : '-',
    ];
  });

  // Calculate totals
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
    `Total: ${items.length} Barang`,
    '',
    '',
    totalQty,
    totalSys,
    totalQty - totalSys,
    '',
    totalModal,
    totalDiffModal,
    'Selesai Dihitung',
    '',
    new Date().toLocaleString('id-ID'),
  ];

  const wsData = [headers, ...rows, summaryRow];
  const ws1 = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws1['!cols'] = [
    { wch: 6 }, // No
    { wch: 14 }, // SKU
    { wch: 36 }, // Nama Barang
    { wch: 18 }, // Barcode
    { wch: 18 }, // Kategori
    { wch: 12 }, // Stok Fisik
    { wch: 12 }, // Stok Sistem
    { wch: 14 }, // Selisih
    { wch: 16 }, // Modal
    { wch: 20 }, // Total Modal
    { wch: 18 }, // Selisih Modal
    { wch: 30 }, // Keterangan
    { wch: 16 }, // Petugas
    { wch: 20 }, // Waktu
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Laporan Stok Opname');

  // Sheet 2: Rekap Per Kategori
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
    const ws2 = XLSX.utils.aoa_to_sheet(catWsData);
    ws2['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Rekap Kategori');
  }

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Laporan_Stok_Opname_Mart_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// Download Blank or Pre-filled Excel Template for Import
export function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();

  const headers = ['SKU', 'NAMA BARANG', 'BARCODE', 'KATEGORI', 'QUANTITY', 'HARGA MODAL', 'KETERANGAN'];

  const sampleRows = [
    ['SMB-010', 'Garam Dapur Cap Kapal 250g', '8991234500010', 'Bumbu Dapur', 40, 2500, 'Rak Bumbu B1'],
    ['MNM-020', 'Teh Pucuk Harum 350ml', '8991234500020', 'Minuman', 60, 3200, 'Chiller Depan'],
    ['SNK-030', 'Taro Net Seaweed 65g', '8991234500030', 'Snack & Makanan', 24, 4800, 'Rak Snack C1'],
    ['PRW-040', 'Shampoo Sunsilk Black Shine 160ml', '8991234500040', 'Perawatan Pribadi', 18, 21500, 'Rak Sampo D2'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 34 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Template Import');
  XLSX.writeFile(wb, 'Template_Import_Stok_Mart.xlsx');
}

// Parse uploaded XLSX / XLS file
export async function parseExcelFile(file: File): Promise<{
  success: boolean;
  data: Partial<InventoryItem>[];
  errors: string[];
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
        const parsedItems: Partial<InventoryItem>[] = [];

        rawJson.forEach((row, idx) => {
          // Normalize column keys
          const normalized: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            const cleanKey = k.trim().toUpperCase().replace(/[\s_()\-]/g, '');
            normalized[cleanKey] = row[k];
          });

          // Match variations
          const sku = normalized['SKU'] || normalized['KODESKU'] || normalized['KODEBARANG'] || '';
          const nama = normalized['NAMABARANG'] || normalized['NAMA'] || normalized['BARANG'] || '';
          const barcode = normalized['BARCODE'] || normalized['KODEBARCODE'] || normalized['EAN'] || '';
          const kategori = normalized['KATEGORI'] || normalized['CATEGORY'] || 'Sembako';
          const qty = Number(normalized['QUANTITY'] || normalized['QTY'] || normalized['STOKFISIK'] || normalized['STOK'] || 0);
          const modal = Number(normalized['HARGAMODAL'] || normalized['MODAL'] || normalized['HARGABELI'] || normalized['HARGA'] || 0);
          const ket = normalized['KETERANGAN'] || normalized['CATATAN'] || normalized['NOTES'] || '';

          if (!sku && !nama && !barcode) {
            // Empty row, skip
            return;
          }

          if (!nama) {
            errors.push(`Baris ${idx + 2}: Nama Barang tidak boleh kosong.`);
          }

          parsedItems.push({
            sku: String(sku || `SKU-${idx + 1}`).trim().toUpperCase(),
            namaBarang: String(nama || 'Tanpa Nama').trim(),
            barcode: String(barcode).trim(),
            kategori: String(kategori).trim() || 'Sembako',
            quantity: Math.max(0, isNaN(qty) ? 0 : qty),
            quantitySystem: Math.max(0, isNaN(qty) ? 0 : qty),
            hargaModal: Math.max(0, isNaN(modal) ? 0 : modal),
            keterangan: String(ket).trim() || 'Hasil Import XLSX',
          });
        });

        resolve({
          success: parsedItems.length > 0,
          data: parsedItems,
          errors,
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
