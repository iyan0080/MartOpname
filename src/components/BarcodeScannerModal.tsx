import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  Camera,
  RefreshCw,
  Zap,
  Volume2,
  Plus,
  CheckCircle,
  AlertTriangle,
  Calculator,
  Layers,
  ArrowRight,
  Package,
  RotateCcw,
} from 'lucide-react';
import { playScanSuccessSound, playScanWarningSound } from '../utils/soundEffects.ts';
import { InventoryItem } from '../types/inventory.ts';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: InventoryItem[];
  onScanResult: (
    barcode: string,
    mode: 'calculator' | 'increment'
  ) => Promise<{ success: boolean; item?: InventoryItem; notFound?: boolean }>;
  onApplyCalculatedQty?: (itemId: string, newQuantity: number, notes?: string) => Promise<boolean>;
  onOpenManualAdd: (barcode: string) => void;
  onOpenFullCalculator?: (item: InventoryItem) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items = [],
  onScanResult,
  onApplyCalculatedQty,
  onOpenManualAdd,
  onOpenFullCalculator,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Replaced "Mode Cepat +1" with "Mode Kalkulator"
  // Default is 'calculator' (allows calculating boxes, packs, or math expression)
  const [scannerMode, setScannerMode] = useState<'calculator' | 'increment'>('calculator');

  // Currently active scanned item for inline quantity calculator
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);

  // Inline calculator state
  const [dusCount, setDusCount] = useState<number | ''>('');
  const [isiPerDus, setIsiPerDus] = useState<number | ''>(24);
  const [pcsExtra, setPcsExtra] = useState<number | ''>('');
  const [manualCalcQty, setManualCalcQty] = useState<number | ''>('');
  const [isSavingQty, setIsSavingQty] = useState(false);

  const [lastScannedText, setLastScannedText] = useState<string | null>(null);
  const [lastScannedItem, setLastScannedItem] = useState<InventoryItem | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'not_found'>('idle');
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const containerId = 'interactive-barcode-scanner';

  // Calculate live inline total
  const calculatedTotal = React.useMemo(() => {
    if (typeof manualCalcQty === 'number' && manualCalcQty >= 0) {
      return manualCalcQty;
    }
    const d = typeof dusCount === 'number' ? dusCount : 0;
    const isi = typeof isiPerDus === 'number' ? isiPerDus : 0;
    const extra = typeof pcsExtra === 'number' ? pcsExtra : 0;
    const total = d * isi + extra;
    return Math.max(0, total);
  }, [dusCount, isiPerDus, pcsExtra, manualCalcQty]);

  // Reset states when item changes or modal closes
  useEffect(() => {
    if (activeItem) {
      // Suggest common box pack size based on category or name
      const nameLower = activeItem.namaBarang.toLowerCase();
      if (nameLower.includes('mie') || nameLower.includes('indomie') || nameLower.includes('sedap')) {
        setIsiPerDus(40);
      } else if (nameLower.includes('minyak') || nameLower.includes('bimoli') || nameLower.includes('sanco')) {
        setIsiPerDus(12);
      } else if (nameLower.includes('susu') || nameLower.includes('kental')) {
        setIsiPerDus(48);
      } else {
        setIsiPerDus(24);
      }
      setDusCount('');
      setPcsExtra('');
      setManualCalcQty(activeItem.quantity || '');
    }
  }, [activeItem]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScanStatus('idle');
      setLastScannedText(null);
      setLastScannedItem(null);
      setActiveItem(null);
      return;
    }

    // List available cameras safely
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            const backCam = devices.find(
              (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
            );
            setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          } else {
            setCameraError('Tidak ada kamera yang terdeteksi di perangkat ini.');
          }
        })
        .catch((err) => {
          console.warn('Camera detection error:', err);
          setCameraError('Izin kamera belum diaktifkan. Anda dapat ketik barcode manual atau aktifkan izin kamera.');
        });
    } else {
      setCameraError('Browser tidak mendukung akses kamera langsung. Silakan ketik barcode secara manual.');
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedCameraId && !isScanning && !isStartingRef.current) {
      startScanner(selectedCameraId);
    }
  }, [isOpen, selectedCameraId]);

  const startScanner = async (cameraId: string) => {
    if (isStartingRef.current) return;
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      isStartingRef.current = true;
      setCameraError(null);

      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.333333,
      };

      await html5QrCode.start(
        cameraId,
        config,
        async (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Normal frame scan tick
        }
      );

      setIsScanning(true);

      // Check flashlight/torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && (capabilities as any).torch) {
          setHasTorch(true);
        }
      } catch {
        // Ignore torch check error
      }
    } catch (err: any) {
      console.warn('Failed to start scanner:', err);
      setCameraError(err?.message || 'Gagal mengakses kamera. Pastikan izin kamera aktif.');
      setIsScanning(false);
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (e) {
        console.warn('Safe cleanup scanner warning:', e);
      }
      setIsScanning(false);
      setIsTorchOn(false);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  const handleBarcodeDetected = async (rawCode: string) => {
    const code = rawCode.trim();
    const now = Date.now();

    // Prevent duplicate triggers within 1.2s
    if (isProcessingRef.current || (code === lastScannedText && now - lastScannedTimeRef.current < 1200)) {
      return;
    }

    isProcessingRef.current = true;
    lastScannedTimeRef.current = now;
    setLastScannedText(code);

    try {
      const result = await onScanResult(code, scannerMode);
      if (result.success && result.item) {
        playScanSuccessSound();
        setScanStatus('success');
        setLastScannedItem(result.item);

        if (scannerMode === 'calculator') {
          // Open the inline quantity calculator for this scanned item!
          setActiveItem(result.item);
        } else {
          // Mode Satuan (+1)
          setActiveItem(null);
        }
      } else {
        playScanWarningSound();
        setScanStatus('not_found');
        setLastScannedItem(null);
        setActiveItem(null);
      }
    } catch (err) {
      playScanWarningSound();
      setScanStatus('not_found');
      setActiveItem(null);
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 700);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDetected(manualCode.trim());
    setManualCode('');
  };

  // Save the calculated quantity from the inline calculator
  const handleSaveCalculatedQuantity = async () => {
    if (!activeItem || !onApplyCalculatedQty) return;
    setIsSavingQty(true);

    let note = `Kalkulator: ${calculatedTotal} pcs`;
    if (typeof dusCount === 'number' && dusCount > 0) {
      note = `Kalkulator: ${dusCount} dus × ${isiPerDus} + ${pcsExtra || 0} pcs = ${calculatedTotal} pcs`;
    }

    const success = await onApplyCalculatedQty(activeItem.id, calculatedTotal, note);
    setIsSavingQty(false);

    if (success) {
      playScanSuccessSound();
      // Update local item view
      setActiveItem({
        ...activeItem,
        quantity: calculatedTotal,
      });
      setScanStatus('success');
      // Hide calculator drawer after 1.5s or allow next scan
      setTimeout(() => {
        setActiveItem(null);
      }, 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                Scan Barcode Mart & Kalkulator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arahkan kamera ke barcode barang atau input manual
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[240px] max-h-[290px] overflow-hidden shrink-0">
          <div id={containerId} className="w-full h-full max-h-[290px]" />

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 p-5 flex flex-col items-center justify-center bg-slate-900 text-center text-white z-20">
              <AlertTriangle className="w-9 h-9 text-amber-400 mb-2" />
              <p className="text-sm font-semibold mb-1 text-slate-100">Kamera Belum Aktif</p>
              <p className="text-xs text-slate-300 mb-3 max-w-xs">{cameraError}</p>
              <div className="flex gap-2">
                {cameras.length > 0 ? (
                  <button
                    onClick={() => startScanner(selectedCameraId)}
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Coba Lagi
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (navigator.mediaDevices?.getUserMedia) {
                        navigator.mediaDevices
                          .getUserMedia({ video: true })
                          .then(() => {
                            setCameraError(null);
                            Html5Qrcode.getCameras().then((devs) => {
                              if (devs.length > 0) {
                                setCameras(devs);
                                setSelectedCameraId(devs[0].id);
                                startScanner(devs[0].id);
                              }
                            });
                          })
                          .catch(() => {
                            setCameraError('Izin kamera ditolak. Silakan ketik barcode manual di form bawah.');
                          });
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Izinkan Akses Kamera
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Controls Overlay (Torch & Camera Switch) */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-2 z-10">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-lg text-xs font-medium backdrop-blur-md transition-colors ${
                  isTorchOn ? 'bg-amber-400 text-slate-950' : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                title="Lampu Kilat / Torch"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const currentIdx = cameras.findIndex((c) => c.id === selectedCameraId);
                  const nextCam = cameras[(currentIdx + 1) % cameras.length];
                  setSelectedCameraId(nextCam.id);
                  startScanner(nextCam.id);
                }}
                className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-md transition-colors"
                title="Ganti Kamera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bottom Bar: Mode Kalkulator (Replaces Mode Cepat +1) */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
            <div className="pointer-events-auto bg-black/60 backdrop-blur-md rounded-lg px-2.5 py-1 text-xs text-white flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px]">Audio Beep On</span>
            </div>

            {/* Mode Selector Toggle: Replaced "Mode Cepat (+1 Otomatis)" with Kalkulator */}
            <div className="pointer-events-auto flex items-center gap-1 bg-black/70 backdrop-blur-md p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setScannerMode('calculator')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                  scannerMode === 'calculator'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 text-amber-300" />
                <span>Kalkulator Kuantitas</span>
              </button>
              <button
                type="button"
                onClick={() => setScannerMode('increment')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  scannerMode === 'increment'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title="Mode Satuan (+1 pcs per scan)"
              >
                <span>Satuan (+1)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body: Result / Inline Calculator */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-200 dark:divide-slate-800">
          {/* Active Inline Calculator View for Scanned Item */}
          {activeItem && (
            <div className="p-4 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded">
                      {activeItem.sku}
                    </span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                      {activeItem.kategori}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                    {activeItem.namaBarang}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Stok Sekarang (Fisik):{' '}
                    <strong className="font-mono text-slate-900 dark:text-white">{activeItem.quantity} pcs</strong> ·
                    Sistem:{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {activeItem.quantitySystem} pcs
                    </span>
                  </p>
                </div>

                {onOpenFullCalculator && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFullCalculator(activeItem);
                      onClose();
                    }}
                    className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-md flex items-center gap-1 shadow-xs shrink-0"
                    title="Buka kalkulator lengkap (grid rak & rumus)"
                  >
                    <Layers className="w-3.5 h-3.5" /> Kalkulator Lengkap
                  </button>
                )}
              </div>

              {/* Calculator Inputs: Dus x Isi + Satuan */}
              <div className="bg-white dark:bg-slate-800/90 p-3 rounded-lg border border-blue-200 dark:border-blue-900 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Hitung Jumlah Barang (Dus × Isi + Satuan):
                  </span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    = {calculatedTotal} pcs
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Karton / Dus
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={dusCount}
                      onChange={(e) => {
                        setManualCalcQty('');
                        setDusCount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0));
                      }}
                      placeholder="0 dus"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Isi per Dus
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={isiPerDus}
                      onChange={(e) => {
                        setManualCalcQty('');
                        setIsiPerDus(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      placeholder="24"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      + Satuan / Pcs
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={pcsExtra}
                      onChange={(e) => {
                        setManualCalcQty('');
                        setPcsExtra(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0));
                      }}
                      placeholder="0 pcs"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Quick Multiplier Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400">Tambah Cepat:</span>
                  {[
                    { label: '+1', val: 1 },
                    { label: '+6 (1/2 Lusin)', val: 6 },
                    { label: '+12 (Lusin)', val: 12 },
                    { label: '+24 (Dus)', val: 24 },
                    { label: '+40 (Karton)', val: 40 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setManualCalcQty('');
                        setPcsExtra((prev) => (typeof prev === 'number' ? prev + preset.val : preset.val));
                      }}
                      className="px-2 py-0.5 text-[11px] bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-slate-700 dark:text-slate-200 rounded font-mono font-medium transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDusCount('');
                      setPcsExtra('');
                      setManualCalcQty(0);
                    }}
                    className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-red-600 rounded flex items-center gap-0.5 ml-auto"
                    title="Reset hitungan ke 0"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>

                {/* Save Quantity Button */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <div className="text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Total Baru: </span>
                    <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {calculatedTotal} pcs
                    </strong>
                    {activeItem.quantity !== calculatedTotal && (
                      <span className="text-[11px] font-mono text-slate-500 ml-1.5">
                        (Selisih: {calculatedTotal - activeItem.quantitySystem >= 0 ? '+' : ''}
                        {calculatedTotal - activeItem.quantitySystem} pcs)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveItem(null)}
                      className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isSavingQty}
                      onClick={handleSaveCalculatedQuantity}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isSavingQty ? 'Menyimpan...' : `Simpan (${calculatedTotal} pcs)`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simple Notification when scanned in Mode Satuan (+1) or Not Found */}
          {!activeItem && scanStatus !== 'idle' && (
            <div
              className={`px-4 py-3 text-sm transition-all ${
                scanStatus === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              }`}
            >
              {scanStatus === 'success' && lastScannedItem ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-xs text-emerald-950 dark:text-emerald-100">
                        {lastScannedItem.namaBarang}
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        SKU: <span className="font-mono">{lastScannedItem.sku}</span> · Qty:{' '}
                        <span className="font-mono font-bold text-emerald-950 dark:text-emerald-100">
                          {lastScannedItem.quantity} pcs
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveItem(lastScannedItem)}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 rounded-md flex items-center gap-1 shadow-xs"
                    >
                      <Calculator className="w-3.5 h-3.5" /> Hitung Kuantitas
                    </button>
                    <span className="text-xs bg-emerald-200/80 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-mono font-semibold">
                      +1 Terhitung
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-xs text-amber-950 dark:text-amber-100">
                        Barcode Belum Terdaftar
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-mono">
                        {lastScannedText}
                      </p>
                    </div>
                  </div>
                  {lastScannedText && (
                    <button
                      onClick={() => {
                        onOpenManualAdd(lastScannedText);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Barang
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Manual Barcode / SKU input */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Atau ketik Barcode / SKU lalu Enter..."
              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5"
            >
              {scannerMode === 'calculator' ? (
                <>
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Cari & Hitung</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cari (+1)</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Mendukung scanner laser USB / Bluetooth</span>
            <button
              type="button"
              onClick={() => {
                onOpenManualAdd('');
                onClose();
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              + Input Barang Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
