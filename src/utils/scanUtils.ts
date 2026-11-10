import { InventoryItem } from '../types/inventory.ts';

/**
 * Extracts possible candidate identifiers (SKU, barcode, ID) from raw scanned text.
 * Supports standard 1D barcodes and 2D QR codes containing plain text, JSON, URLs, or labeled strings.
 */
export function extractScanCandidates(rawText: string): string[] {
  if (!rawText) return [];
  const raw = rawText.trim();
  if (!raw) return [];

  const candidates: string[] = [raw];

  // 1. Check if raw text is JSON format (common in modern smart QR codes)
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.sku) candidates.unshift(String(parsed.sku).trim());
        if (parsed.barcode) candidates.unshift(String(parsed.barcode).trim());
        if (parsed.code) candidates.unshift(String(parsed.code).trim());
        if (parsed.id) candidates.unshift(String(parsed.id).trim());
        if (parsed.kodeBarang) candidates.unshift(String(parsed.kodeBarang).trim());
      }
    } catch {
      // Ignore JSON parse error, treat as raw string
    }
  }

  // 2. Check if raw text is a URL (common in product QR codes)
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      const params = ['sku', 'barcode', 'code', 'id', 'item', 'brg', 'kode'];
      for (const p of params) {
        const val = url.searchParams.get(p);
        if (val) {
          candidates.unshift(val.trim());
        }
      }

      // Check last segment of pathname: e.g. /items/SKU001 or /p/8992753123456
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const last = pathSegments[pathSegments.length - 1].trim();
        if (last && !candidates.includes(last)) {
          candidates.push(last);
        }
      }
    } catch {
      // Ignore URL parse error
    }
  }

  // 3. Check for common prefixes like "SKU:", "BARCODE:", "KODE:", "BRG:"
  const prefixRegex = /^(?:sku|barcode|kode|brg|item|qr|ean|upc)[:=\s]+([^\s,;]+)/i;
  const match = raw.match(prefixRegex);
  if (match && match[1]) {
    const extracted = match[1].trim();
    if (extracted && !candidates.includes(extracted)) {
      candidates.unshift(extracted);
    }
  }

  // 4. Check for multi-line QR code content (lines with SKU or barcode)
  if (raw.includes('\n')) {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!candidates.includes(line)) {
        candidates.push(line);
      }
      const lineMatch = line.match(prefixRegex);
      if (lineMatch && lineMatch[1]) {
        const extracted = lineMatch[1].trim();
        if (extracted && !candidates.includes(extracted)) {
          candidates.unshift(extracted);
        }
      }
    }
  }

  // Return unique, non-empty candidate codes
  return Array.from(new Set(candidates.filter(Boolean)));
}

/**
 * Searches items array using extracted scan candidates.
 * Returns array of all matching items (for duplicate detection).
 */
export function findItemsByScan(items: InventoryItem[], rawScannedCode: string): InventoryItem[] {
  const candidates = extractScanCandidates(rawScannedCode);
  if (candidates.length === 0) return [];

  const matchedItems: InventoryItem[] = [];
  const seenIds = new Set<string>();

  for (const candidate of candidates) {
    const candLower = candidate.toLowerCase();
    const candNumeric = candidate.replace(/^0+/, ''); // strip leading zeros for flexible barcode match

    for (const item of items) {
      if (seenIds.has(item.id)) continue;

      const itemBarcodeLower = (item.barcode || '').trim().toLowerCase();
      const itemSkuLower = (item.sku || '').trim().toLowerCase();

      // 1. Direct match on barcode or sku
      if (itemBarcodeLower && itemBarcodeLower === candLower) {
        matchedItems.push(item);
        seenIds.add(item.id);
        continue;
      }

      if (itemSkuLower && itemSkuLower === candLower) {
        matchedItems.push(item);
        seenIds.add(item.id);
        continue;
      }

      // 2. Numeric strip leading zero match (e.g. 000123 vs 123)
      if (candNumeric.length >= 3) {
        const itemBarcodeNum = itemBarcodeLower.replace(/^0+/, '');
        const itemSkuNum = itemSkuLower.replace(/^0+/, '');
        if (
          (itemBarcodeNum && itemBarcodeNum === candNumeric) ||
          (itemSkuNum && itemSkuNum === candNumeric)
        ) {
          matchedItems.push(item);
          seenIds.add(item.id);
          continue;
        }
      }
    }
  }

  return matchedItems;
}
