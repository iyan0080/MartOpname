import React from 'react';
import { Calculator, Edit2, Trash2 } from 'lucide-react';
import { InventoryItem } from '../types/inventory.ts';
import { formatRupiah, formatShortTime } from '../utils/excelUtils.ts';

export interface InventoryRowHandlers {
  onQuickDelta: (itemId: string, delta: number) => void;
  onQuickAdjust: (item: InventoryItem) => void;
  onOpenCalc: (item: InventoryItem) => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
  onOpenDuplicate: () => void;
}

interface InventoryRowProps extends InventoryRowHandlers {
  item: InventoryItem;
  isDuplicateSku: boolean;
  isDuplicateBarcode: boolean;
  isSelected?: boolean;
  onSelectRow?: (item: InventoryItem) => void;
}

export const MobileInventoryCard = React.memo<InventoryRowProps>(({
  item,
  isDuplicateSku,
  isDuplicateBarcode,
  onQuickDelta,
  onOpenCalc,
  onEditItem,
  onOpenDuplicate,
}) => {
  const qty = item.quantity || 0;
  const sysQty = item.quantitySystem || 0;
  const diff = qty - sysQty;
  const satuan = item.satuan || 'pcs';

  return (
    <div className="p-3.5 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
      {/* Top Row: SKU, Kategori & Selisih Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
              {item.sku}
            </span>
            {isDuplicateSku && (
              <button
                type="button"
                onClick={onOpenDuplicate}
                className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 transition-transform flex items-center gap-0.5"
                title="SKU ini digunakan oleh beberapa barang. Ketuk untuk melihat."
              >
                ⚠️ SKU Ganda
              </button>
            )}
            <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {item.kategori}
            </span>
            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {satuan}
            </span>
            {item.isiPerDus !== undefined && item.isiPerDus > 0 && (
              <span className="text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                1 dus = {item.isiPerDus}
              </span>
            )}
            {item.status && item.status !== 'AKTIF' && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  item.status === 'NONAKTIF'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {item.status}
              </span>
            )}
            {item.stokMinimum !== undefined && qty <= item.stokMinimum && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded">
                Min: {item.stokMinimum}
              </span>
            )}
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1 leading-snug">
            {item.namaBarang}
          </h4>
          {item.barcode && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 flex-wrap">
              <span>Barcode: {item.barcode}</span>
              {isDuplicateBarcode && (
                <button
                  type="button"
                  onClick={onOpenDuplicate}
                  className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 active:scale-95 transition-transform"
                  title="Barcode ini digunakan oleh beberapa barang. Ketuk untuk melihat."
                >
                  ⚠️ Barcode Ganda
                </button>
              )}
            </div>
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
            {diff === 0 ? '✓ Cocok' : diff < 0 ? `${diff} ${satuan}` : `+${diff} ${satuan}`}
          </span>
        </div>
      </div>

      {/* Bottom Row: System Qty & Big Touch Stepper Counter */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
        <div className="text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Sistem: <strong className="font-mono text-slate-800 dark:text-slate-200">{sysQty} {satuan}</strong>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Modal: {formatRupiah(item.hargaModal)}
            {item.hargaJual ? ` • Jual: ${formatRupiah(item.hargaJual)}` : ''}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Ergonomic Mobile Thumb Stepper */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs select-none">
            <button
              type="button"
              onClick={() => onQuickDelta(item.id, -1)}
              className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-90 text-slate-800 dark:text-white flex items-center justify-center font-black text-lg shadow-xs transition-transform select-none"
              title="Kurangi 1 unit fisik"
            >
              -
            </button>

            <button
              type="button"
              onClick={() => onOpenCalc(item)}
              className="min-w-[3.25rem] justify-center px-3 py-2 font-mono font-black text-base text-blue-600 dark:text-blue-400 flex items-center gap-1 active:scale-95 transition-transform select-none"
              title="Ketuk angka untuk buka kalkulator kuantitas (dus/lusin)"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{qty}</span>
            </button>

            <button
              type="button"
              onClick={() => onQuickDelta(item.id, 1)}
              className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-90 text-white flex items-center justify-center font-black text-lg shadow-xs transition-transform select-none"
              title="Tambah 1 unit fisik"
            >
              +
            </button>
          </div>

          {/* Item Edit */}
          <button
            type="button"
            onClick={() => onEditItem(item)}
            className="p-2.5 text-slate-400 hover:text-blue-600 active:scale-90 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform"
            title="Edit Barang"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

MobileInventoryCard.displayName = 'MobileInventoryCard';

export const DesktopInventoryRow = React.memo<InventoryRowProps>(({
  item,
  isDuplicateSku,
  isDuplicateBarcode,
  isSelected = false,
  onSelectRow,
  onQuickDelta,
  onQuickAdjust,
  onOpenCalc,
  onEditItem,
  onDeleteItem,
  onOpenDuplicate,
}) => {
  const qty = item.quantity || 0;
  const sysQty = item.quantitySystem || 0;
  const diff = qty - sysQty;
  const totalModal = qty * (item.hargaModal || 0);
  const satuan = item.satuan || 'pcs';

  return (
    <tr
      className={`transition-colors group ${
        isSelected
          ? 'bg-[#dbe1ff]/50 dark:bg-blue-950/40'
          : 'hover:bg-[#f2f3ff] dark:hover:bg-slate-800/50'
      }`}
    >
      {/* SKU & Barcode */}
      <td
        onClick={() => onSelectRow?.(item)}
        className={`px-3.5 py-2 font-mono ${onSelectRow ? 'cursor-pointer' : ''}`}
        title={onSelectRow ? 'Klik untuk hitung barang ini di stasiun hitung' : undefined}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`font-bold ${
              isSelected
                ? 'text-[#004ac6] dark:text-blue-300'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {item.sku}
          </span>
          {isDuplicateSku && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDuplicate();
              }}
              className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 transition-transform"
              title="SKU ini digunakan oleh beberapa barang. Klik untuk rincian."
            >
              ⚠️ SKU Ganda
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex-wrap">
          <span>{item.barcode || '-'}</span>
          {item.barcode && isDuplicateBarcode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDuplicate();
              }}
              className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 active:scale-95 transition-transform"
              title="Barcode ini digunakan oleh beberapa barang. Klik untuk rincian."
            >
              ⚠️ Barcode Ganda
            </button>
          )}
        </div>
      </td>

      {/* Nama Barang & Satuan / Status */}
      <td
        onClick={() => onSelectRow?.(item)}
        className={`px-3.5 py-2 ${onSelectRow ? 'cursor-pointer' : ''}`}
        title={onSelectRow ? 'Klik untuk hitung barang ini di stasiun hitung' : undefined}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-slate-900 dark:text-white leading-tight">
            {item.namaBarang}
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
            {satuan}
          </span>
          {item.isiPerDus !== undefined && item.isiPerDus > 0 && (
            <span className="text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded">
              {item.isiPerDus}/dus
            </span>
          )}
          {item.status && item.status !== 'AKTIF' && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                item.status === 'NONAKTIF'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {item.status}
            </span>
          )}
          {item.stokMinimum !== undefined && qty <= item.stokMinimum && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded"
              title={`Batas minimum: ${item.stokMinimum}`}
            >
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
        <div className="inline-flex items-center justify-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 select-none">
          <button
            type="button"
            onClick={() => onQuickDelta(item.id, -1)}
            className="w-7 h-7 md:w-8 md:h-8 lg:w-7 lg:h-7 rounded-md bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-90 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm shadow-2xs transition-transform select-none"
            title={`Kurangi 1 ${satuan}`}
          >
            -
          </button>

          <button
            type="button"
            onClick={() => onQuickAdjust(item)}
            className="min-w-[3rem] px-2 py-1 rounded-md font-mono font-bold text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700/60 active:scale-95 transition-transform select-none"
            title="Klik untuk edit cepat"
          >
            {qty} <span className="text-[10px] font-normal text-slate-400">{satuan}</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickDelta(item.id, 1)}
            className="w-7 h-7 md:w-8 md:h-8 lg:w-7 lg:h-7 rounded-md bg-blue-600 hover:bg-blue-700 active:scale-90 text-white flex items-center justify-center font-bold text-sm shadow-2xs transition-transform select-none"
            title={`Tambah 1 ${satuan} (+1)`}
          >
            +
          </button>

          <button
            type="button"
            onClick={() => onOpenCalc(item)}
            className="w-7 h-7 md:w-8 md:h-8 lg:w-7 lg:h-7 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-90 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center text-xs transition-transform select-none"
            title="Hitung kuantitas dus / rak dengan kalkulator"
          >
            <Calculator className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>

      {/* Quantity Sistem (stok_awal) */}
      <td className="px-3.5 py-2 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
        {sysQty} {satuan}
      </td>

      {/* Selisih */}
      <td className="px-3.5 py-2 text-right font-mono font-bold whitespace-nowrap">
        {diff === 0 ? (
          <span className="text-emerald-700 dark:text-emerald-400">0</span>
        ) : diff < 0 ? (
          <span className="text-red-600 dark:text-red-400">{diff} {satuan}</span>
        ) : (
          <span className="text-blue-600 dark:text-blue-400">+{diff} {satuan}</span>
        )}
      </td>

      {/* Harga Modal & Jual */}
      <td className="px-3.5 py-2 text-right font-mono whitespace-nowrap">
        <span className="text-slate-800 dark:text-slate-200 block">{formatRupiah(item.hargaModal)}</span>
        {item.hargaJual ? (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
            Jual: {formatRupiah(item.hargaJual)}
          </span>
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
          {formatShortTime(item.updatedAt)}
        </span>
      </td>

      {/* Aksi (Edit, Hapus) */}
      <td className="px-3.5 py-2 text-center whitespace-nowrap">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => onEditItem(item)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 rounded-lg transition-transform"
            title="Edit Detail Barang"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteItem(item)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 rounded-lg transition-transform"
            title="Hapus Barang"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});

DesktopInventoryRow.displayName = 'DesktopInventoryRow';
