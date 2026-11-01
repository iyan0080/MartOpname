import { InventoryItem, InventoryStats } from '../types/inventory.ts';

export function calculateInventoryStats(items: InventoryItem[]): InventoryStats {
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

  const categorySummary = Array.from(categoryMap.entries())
    .map(([kategori, val]) => ({
      kategori,
      ...val,
    }))
    .sort((a, b) => b.totalModal - a.totalModal);

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
