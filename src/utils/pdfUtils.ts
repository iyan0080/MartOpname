import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InventoryItem, InventoryStats, OpnameSession, FinanceRecord } from '../types/inventory.ts';
import { formatRupiah } from './excelUtils.ts';

export function generateBeritaAcaraPDF(
  session: OpnameSession,
  stats: InventoryStats | null,
  finance: FinanceRecord,
  items: InventoryItem[]
) {
  // Inisialisasi dokumen A4 Potrait (210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Perhitungan Finansial
  const uangTunai = Number(finance.kas?.uangTunai) || 0;
  const saldoBank = Number(finance.kas?.saldoBank) || 0;
  const totalKas = uangTunai + saldoBank;
  const modalAwal = Number(finance.kas?.modalAwal) || 0;

  const totalPiutang = (finance.piutangList || []).reduce((sum, p) => sum + (Number(p.jumlah) || 0), 0);
  const totalHutangMitra = (finance.hutangMitraList || []).reduce((sum, h) => sum + (Number(h.jumlah) || 0), 0);
  const totalSaldoSantri = (finance.saldoSantriList || []).reduce((sum, s) => sum + (Number(s.jumlah) || 0), 0);
  const totalKewajiban = totalHutangMitra + totalSaldoSantri;
  const totalPengeluaranOperasional = (finance.pengeluaranOperasionalList || []).reduce(
    (sum, p) => sum + (Number(p.jumlah) || 0),
    0
  );

  const totalAsetFisikBarang = stats?.totalModalInvestasi || 0;
  const totalAsetSistemBarang = stats?.totalModalSystem || 0;
  const selisihModalBarang = stats?.selisihModal || 0;

  const totalAsetRiil = totalAsetFisikBarang + totalKas + totalPiutang;
  const nilaiBersihMart = totalAsetRiil - totalKewajiban;
  const pertumbuhanModal = nilaiBersihMart - modalAwal;

  const opnameDateStr = session.opnameDate || new Date().toISOString().split('T')[0];
  const tglCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ==================== KOP SURAT RESMI ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('DR MART - SISTEM AUDIT & STOK OPNAME TOKO', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('BERITA ACARA HASIL STOK OPNAME & POSISI KEUANGAN TOKO', pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Dokumen Resmi Hasil Audit Fisik Inventaris Barang, Arus Kas, Piutang Marhalah & Hutang Mart', pageWidth / 2, 27, {
    align: 'center',
  });

  // Garis kop surat ganda
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.8);
  doc.line(margin, 30, pageWidth - margin, 30);
  doc.setLineWidth(0.2);
  doc.line(margin, 31, pageWidth - margin, 31);

  // ==================== INFORMASI SESI AUDIT ====================
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  let curY = 37;
  const col1 = margin;
  const col2 = 60;
  const col3 = 115;
  const col4 = 155;

  doc.text('Nomor Dokumen', col1, curY);
  doc.text(`: BA-SO/${opnameDateStr.replace(/-/g, '')}/MART`, col2, curY);
  doc.text('Tanggal Pelaksanaan', col3, curY);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${opnameDateStr}`, col4, curY);

  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Judul Sesi Audit', col1, curY);
  doc.text(`: ${session.title || 'Stok Opname Mart Santri'}`, col2, curY);
  doc.text('Auditor Pemeriksa I', col3, curY);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${session.picIyan || 'IYAN'} (Stok Barang)`, col4, curY);

  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Status Audit', col1, curY);
  doc.text(`: ${session.status === 'completed' ? 'Final / Selesai' : 'Sedang Berjalan'}`, col2, curY);
  doc.text('Auditor Pemeriksa II', col3, curY);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${session.picHendri || 'HENDRI'} (Keuangan)`, col4, curY);

  curY += 8;

  // ==================== TABEL 1: NERACA POSISI KEUANGAN MART ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('I. POSISI NERACA & KEKAYAAN BERSIH MART (NET EQUITY)', margin, curY);
  curY += 2;

  const neracaRows = [
    ['1. Aset Stok Fisik Barang (Inventaris)', formatRupiah(totalAsetFisikBarang), `${items.length} SKU terdaftar`],
    ['2. Uang Tunai Fisik (Cash Drawer / Brankas)', formatRupiah(uangTunai), finance.kas?.catatanKas || 'Fisik kasir/brankas'],
    ['3. Saldo Rekening Bank / QRIS', formatRupiah(saldoBank), 'Rekening operasional mart'],
    ['4. Total Piutang Marhalah (Bon / Hutang ke Mart)', formatRupiah(totalPiutang), `${(finance.piutangList || []).length} Marhalah tercatat`],
    ['--- TOTAL ASET RIIL MART ---', formatRupiah(totalAsetRiil), 'Fisik Barang + Kas + Piutang Marhalah'],
    ['5. Hutang Mitra / Supplier Mart', formatRupiah(totalHutangMitra), `${(finance.hutangMitraList || []).length} Mitra tercatat`],
    ['6. Saldo Titipan Santri (Tabungan)', formatRupiah(totalSaldoSantri), `${(finance.saldoSantriList || []).length} Santri tercatat`],
    ['--- TOTAL KEWAJIBAN / HUTANG ---', formatRupiah(totalKewajiban), 'Hutang Mitra + Saldo Santri'],
    ['=== NILAI BERSIH MART (NET EQUITY) ===', formatRupiah(nilaiBersihMart), 'Kekayaan Bersih (Aset Riil - Hutang)'],
    ['Nilai Modal Awal Operasional Mart', formatRupiah(modalAwal), 'Penyertaan modal pokok awal'],
    [
      'Surplus / Pertumbuhan Modal Bersih',
      `${pertumbuhanModal >= 0 ? '+' : ''}${formatRupiah(pertumbuhanModal)}`,
      pertumbuhanModal >= 0 ? 'Surplus / Akumulasi Laba Toko' : 'Defisit Terhadap Modal Awal',
    ],
    [
      'Total Beban Pengeluaran Operasional',
      formatRupiah(totalPengeluaranOperasional),
      `${(finance.pengeluaranOperasionalList || []).length} pengeluaran toko dibukukan`,
    ],
  ];

  autoTable(doc, {
    startY: curY,
    head: [['POS NERACA KEUANGAN', 'NOMINAL (RUPIAH)', 'KETERANGAN']],
    body: neracaRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 60, fontStyle: 'normal' },
    },
    didParseCell: (data) => {
      // Highlight baris total dan nilai bersih
      const rawRow = data.row.raw as any;
      const rawText = Array.isArray(rawRow) ? String(rawRow[0] || '') : '';
      if (rawText.includes('TOTAL ASET RIIL') || rawText.includes('NILAI BERSIH MART')) {
        data.cell.styles.fillColor = [238, 242, 255]; // indigo-50
        data.cell.styles.textColor = [30, 58, 138];
        data.cell.styles.fontStyle = 'bold';
      } else if (rawText.includes('TOTAL KEWAJIBAN')) {
        data.cell.styles.fillColor = [254, 242, 242]; // rose-50
        data.cell.styles.textColor = [159, 18, 57];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: margin, right: margin },
  });

  // ==================== TABEL 2: REKAPITULASI FISIK BARANG ====================
  const finalY1 = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('II. RINGKASAN AUDIT STOK FISIK VS SISTEM (BUKU TOKO)', margin, finalY1);

  const totalFisikQty = stats?.totalPhysicalQty || 0;
  const totalSysQty = stats?.totalSystemQty || 0;
  const selisihQty = totalFisikQty - totalSysQty;

  const fisikRows = [
    [
      'Total Kuantitas Barang (Pcs)',
      `${totalFisikQty} pcs`,
      `${totalSysQty} pcs`,
      `${selisihQty > 0 ? '+' : ''}${selisihQty} pcs`,
      selisihQty === 0 ? 'Cocok Seimbang' : selisihQty < 0 ? 'Fisik Kurang dari Sistem' : 'Fisik Lebih dari Sistem',
    ],
    [
      'Total Nilai Modal Barang (Rp)',
      formatRupiah(totalAsetFisikBarang),
      formatRupiah(totalAsetSistemBarang),
      `${selisihModalBarang > 0 ? '+' : ''}${formatRupiah(selisihModalBarang)}`,
      selisihModalBarang === 0 ? 'Sesuai Modal Sistem' : selisihModalBarang < 0 ? 'Defisit Modal Barang' : 'Surplus Modal Barang',
    ],
    [
      'Status SKU Produk',
      `Match: ${stats?.matchCount || 0} SKU`,
      `Minus: ${stats?.minusCount || 0} SKU`,
      `Plus: ${stats?.plusCount || 0} SKU`,
      `Total Terdaftar: ${items.length} SKU`,
    ],
  ];

  autoTable(doc, {
    startY: finalY1 + 2,
    head: [['INDIKATOR AUDIT', 'STOK FISIK', 'STOK SISTEM', 'SELISIH', 'EVALUASI']],
    body: fisikRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 32, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  // ==================== HALAMAN 2: RINCIAN & PENGESAHAN ====================
  doc.addPage();

  // Header Halaman 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('III. RINCIAN KEWAJIBAN & PIUTANG TERLAMPIR', margin, 18);

  // Rincian Piutang Marhalah
  const piutangBody = (finance.piutangList || []).length === 0
    ? [['-', 'Tidak ada piutang marhalah tercatat', 'Rp 0', '-']]
    : finance.piutangList.map((p, idx) => [
        String(idx + 1),
        p.namaMarhalah,
        formatRupiah(p.jumlah),
        p.keterangan || '-',
      ]);

  autoTable(doc, {
    startY: 22,
    head: [['NO', 'NAMA MARHALAH (PIUTANG KE MART)', 'JUMLAH (RP)', 'KETERANGAN']],
    body: piutangBody,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 67 },
    },
    foot: [['', 'TOTAL PIUTANG MARHALAH', formatRupiah(totalPiutang), '']],
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [30, 58, 138] },
    margin: { left: margin, right: margin },
  });

  // Rincian Hutang Mitra & Saldo Santri
  const finalY2 = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('IV. RINCIAN HUTANG MITRA & SALDO TITIPAN SANTRI', margin, finalY2);

  const hutangCombinedBody: string[][] = [];
  (finance.hutangMitraList || []).forEach((h, idx) => {
    hutangCombinedBody.push([
      `M-${idx + 1}`,
      `Mitra: ${h.namaMitra}`,
      formatRupiah(h.jumlah),
      h.keterangan || 'Hutang supplier/mitra',
    ]);
  });

  (finance.saldoSantriList || []).forEach((s, idx) => {
    hutangCombinedBody.push([
      `S-${idx + 1}`,
      `Santri: ${s.namaSantri}`,
      formatRupiah(s.jumlah),
      s.keterangan || 'Saldo tabungan/titipan santri',
    ]);
  });

  if (hutangCombinedBody.length === 0) {
    hutangCombinedBody.push(['-', 'Tidak ada hutang mitra atau saldo santri', 'Rp 0', '-']);
  }

  autoTable(doc, {
    startY: finalY2 + 2,
    head: [['KODE', 'NAMA MITRA / SANTRI', 'JUMLAH (RP)', 'KETERANGAN']],
    body: hutangCombinedBody,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [159, 18, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 62 },
    },
    foot: [['', 'TOTAL KEWAJIBAN (HUTANG MITRA + SANTRI)', formatRupiah(totalKewajiban), '']],
    footStyles: { fillColor: [254, 242, 242], fontStyle: 'bold', textColor: [159, 18, 57] },
    margin: { left: margin, right: margin },
  });

  // ==================== SECTION V: PENGELUARAN OPERASIONAL DR MART ====================
  const finalY2_5 = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('V. RINCIAN PENGELUARAN OPERASIONAL DR MART', margin, finalY2_5);

  const operasionalPdfBody: string[][] = [];
  (finance.pengeluaranOperasionalList || []).forEach((op, idx) => {
    operasionalPdfBody.push([
      String(idx + 1),
      op.tanggal,
      op.kategori,
      op.namaPengeluaran,
      op.metodeBayar === 'tunai' ? 'Tunai Laci' : 'Bank/QRIS',
      formatRupiah(op.jumlah),
      op.keterangan || op.pj || '-',
    ]);
  });

  if (operasionalPdfBody.length === 0) {
    operasionalPdfBody.push(['-', '-', '-', 'Tidak ada catatan pengeluaran operasional toko', '-', 'Rp 0', '-']);
  }

  autoTable(doc, {
    startY: finalY2_5 + 2,
    head: [['NO', 'TANGGAL', 'KATEGORI', 'URAIAN BELANJA', 'METODE', 'NOMINAL (RP)', 'KET / PJ']],
    body: operasionalPdfBody,
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 38 },
      3: { cellWidth: 50 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 18 },
    },
    foot: [['', '', '', 'TOTAL BIAYA OPERASIONAL TOKO', '', formatRupiah(totalPengeluaranOperasional), '']],
    footStyles: { fillColor: [254, 243, 199], fontStyle: 'bold', textColor: [180, 83, 9] },
    margin: { left: margin, right: margin },
  });

  // ==================== LEMBAR PENGESAHAN TANDA TANGAN ====================
  const finalY3 = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Berita Acara ini disusun dan disahkan dengan penuh tanggung jawab berdasarkan hasil audit fisik riil, pemeriksaan kas, pencatatan piutang marhalah, dan verifikasi kewajiban hutang.',
    pageWidth / 2,
    finalY3,
    { align: 'center', maxWidth: pageWidth - 2 * margin }
  );

  const sigY = finalY3 + 12;
  const colSig1 = margin + 15;
  const colSig2 = pageWidth / 2;
  const colSig3 = pageWidth - margin - 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  // Tanggal & Kolom Tanda Tangan
  doc.text(`Dibuat pada: ${tglCetak}`, margin, sigY - 4);

  // Pemeriksa 1 (IYAN)
  doc.text('Pemeriksa I (Auditor Stok),', colSig1, sigY, { align: 'center' });
  doc.line(colSig1 - 22, sigY + 22, colSig1 + 22, sigY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${session.picIyan || 'IYAN'} )`, colSig1, sigY + 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Staf Mart & Auditor', colSig1, sigY + 30, { align: 'center' });

  // Pemeriksa 2 (HENDRI)
  doc.setFontSize(8.5);
  doc.text('Pemeriksa II (Auditor Keuangan),', colSig2, sigY, { align: 'center' });
  doc.line(colSig2 - 22, sigY + 22, colSig2 + 22, sigY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${session.picHendri || 'HENDRI'} )`, colSig2, sigY + 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Staf Keuangan Mart', colSig2, sigY + 30, { align: 'center' });

  // Pimpinan / Pengelola Pondok
  doc.setFontSize(8.5);
  doc.text('Mengetahui & Menyetujui,', colSig3, sigY, { align: 'center' });
  doc.line(colSig3 - 22, sigY + 22, colSig3 + 22, sigY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text('( Pengelola Mart / Pondok )', colSig3, sigY + 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Pimpinan Pesantren', colSig3, sigY + 30, { align: 'center' });

  // Footer Dokumen di Setiap Halaman
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `DR MART v1.0 • Dokumen Resmi Berita Acara Opname • Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Trigger download PDF langsung
  const fileName = `Berita_Acara_Stok_Opname_DR_MART_${opnameDateStr}.pdf`;
  doc.save(fileName);
}
