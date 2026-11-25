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
  Package,
  RotateCcw,
  QrCode,
  Image as ImageIcon,
  Scan,
} from 'lucide-react';
import { playScanSuccessSound, playScanWarningSound } from '../utils/soundEffects.ts';
import { extractScanCandidates, findItemsByScan } from '../utils/scanUtils.ts';
import { InventoryItem } from '../types/inventory.ts';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: InventoryItem[];
  onScanResult: (
    barcode: string,
    mode: 'calculator' | 'increment'
  ) => Promise<{ success: boolean; item?: InventoryItem; notFound?: boolean }>;
  onApplyCalculatedQty?: (
    itemId: string,
    newQuantity: number,
    notes?: string,
    isiPerDus?: number,
    isiPerPack?: number
  ) => Promise<boolean>;
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

  // Scanner Mode: 'calculator' (default, count boxes/lusin) vs 'increment' (+1 pcs)
  const [scannerMode, setScannerMode] = useState<'calculator' | 'increment'>('calculator');

  // Viewfinder Target Mode: 'auto' (both), 'qr' (square 1:1), 'barcode' (wide 1D)
  const [scanTargetType, setScanTargetType] = useState<'auto' | 'qr' | 'barcode'>('auto');

  // Currently active scanned item for inline quantity calculator
  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);

  // Inline calculator state
  const [dusCount, setDusCount] = useState<number | ''>('');
  const [isiPerDus, setIsiPerDus] = useState<number | ''>(24);
  const [packCount, setPackCount] = useState<number | ''>('');
  const [isiPerPack, setIsiPerPack] = useState<number | ''>('');
  const [pcsExtra, setPcsExtra] = useState<number | ''>('');
  const [manualCalcQty, setManualCalcQty] = useState<number | ''>('');
  const [isSavingQty, setIsSavingQty] = useState(false);
  const [hasEditedCalc, setHasEditedCalc] = useState(false);

  type PendingUnsavedAction =
    | { type: 'next_code'; code: string; nextItemName?: string }
    | { type: 'switch_increment' }
    | { type: 'close' }
    | { type: 'open_add' };

  const [pendingUnsavedAction, setPendingUnsavedAction] = useState<PendingUnsavedAction | null>(null);

  const [lastScannedText, setLastScannedText] = useState<string | null>(null);
  const [lastScannedItem, setLastScannedItem] = useState<InventoryItem | null>(null);
  const [lastResultBadge, setLastResultBadge] = useState<'+1 Terhitung' | 'Tersimpan'>('+1 Terhitung');
  const [lastIsQrCode, setLastIsQrCode] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'not_found'>('idle');
  const [manualCode, setManualCode] = useState('');
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [focusRipple, setFocusRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [scanFlash, setScanFlash] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isStartingRef = useRef(false);
  const scanSessionIdRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const isProcessingRef = useRef(false);
  const isSavingQtyRef = useRef(false);
  const hasEditedCalcRef = useRef(false);
  const pendingUnsavedActionRef = useRef<PendingUnsavedAction | null>(null);
  pendingUnsavedActionRef.current = pendingUnsavedAction;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const lastAnyScanTimeRef = useRef<number>(0);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedTextRef = useRef<string | null>(null);
  const scannerModeRef = useRef(scannerMode);
  scannerModeRef.current = scannerMode;
  const scanTargetTypeRef = useRef(scanTargetType);
  scanTargetTypeRef.current = scanTargetType;
  const activeItemRef = useRef(activeItem);
  activeItemRef.current = activeItem;
  const onScanResultRef = useRef(onScanResult);
  onScanResultRef.current = onScanResult;
  const nativeRafRef = useRef<number | null>(null);
  const containerId = 'interactive-barcode-scanner';

  const setActiveItemSync = (item: InventoryItem | null) => {
    activeItemRef.current = item;
    setActiveItem(item);
  };

  const setHasEditedCalcSync = (edited: boolean) => {
    hasEditedCalcRef.current = edited;
    setHasEditedCalc(edited);
  };

  const resetCooldownForNextScan = () => {
    lastScannedTextRef.current = null;
    lastScannedTimeRef.current = 0;
    lastAnyScanTimeRef.current = 0;
    isProcessingRef.current = false;
  };

  // Calculate live inline total
  const calculatedTotal = React.useMemo(() => {
    if (typeof manualCalcQty === 'number' && manualCalcQty >= 0) {
      return manualCalcQty;
    }
    const d = typeof dusCount === 'number' ? dusCount : 0;
    const isi = typeof isiPerDus === 'number' ? isiPerDus : 0;
    const p = typeof packCount === 'number' ? packCount : 0;
    const isiPack = typeof isiPerPack === 'number' ? isiPerPack : 0;
    const extra = typeof pcsExtra === 'number' ? pcsExtra : 0;
    const total = d * isi + p * isiPack + extra;
    return Math.max(0, total);
  }, [dusCount, isiPerDus, packCount, isiPerPack, pcsExtra, manualCalcQty]);

  const hasUnsavedChanges = Boolean(
    activeItem &&
      hasEditedCalc &&
      (calculatedTotal !== (activeItem.quantity || 0) ||
        (typeof dusCount === 'number' && dusCount > 0) ||
        (typeof packCount === 'number' && packCount > 0) ||
        (typeof pcsExtra === 'number' && pcsExtra > 0))
  );
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  // Reset states when item changes (prioritizing saved isiPerDus and isiPerPack)
  useEffect(() => {
    setHasEditedCalcSync(false);
    setPendingUnsavedAction(null);
    if (activeItem) {
      if (activeItem.isiPerDus && activeItem.isiPerDus > 0) {
        setIsiPerDus(Math.max(1, Math.round(activeItem.isiPerDus)));
      } else {
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
      }
      if (activeItem.isiPerPack && activeItem.isiPerPack > 0) {
        setIsiPerPack(Math.max(1, Math.round(activeItem.isiPerPack)));
      } else {
        setIsiPerPack('');
      }
      setDusCount('');
      setPackCount('');
      setPcsExtra('');
      setManualCalcQty(activeItem.quantity || '');
    }
  }, [activeItem]);

  // Stop native BarcodeDetector loop helper
  const stopNativeDetectorLoop = () => {
    if (nativeRafRef.current !== null) {
      cancelAnimationFrame(nativeRafRef.current);
      nativeRafRef.current = null;
    }
  };

  // Enumerate cameras cleanly WITHOUT reopening a temporary stream (0ms overhead)
  const refreshCameraDevicesList = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput' && d.deviceId)
        .map((d, idx) => ({
          id: d.deviceId,
          label: d.label || `Kamera ${idx + 1}`,
        }));
      if (videoInputs.length > 0 && isOpenRef.current) {
        setCameras(videoInputs);
      }
    } catch {
      // Ignore enumerate error
    }
  };

  // Helper to get active MediaStreamTrack from rendered <video>
  const getActiveVideoTrack = (): MediaStreamTrack | null => {
    const container = document.getElementById(containerId);
    const videoEl = container?.querySelector('video') as HTMLVideoElement | null;
    const stream = videoEl?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0] || null;
    return track;
  };

  // Start hardware-accelerated native BarcodeDetector loop directly on full-resolution HD <video>
  const startNativeDetectorLoop = async () => {
    stopNativeDetectorLoop();
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return;

    const DetectorCtor = (window as any).BarcodeDetector;
    let supportedSet = new Set<string>();
    try {
      if (typeof DetectorCtor.getSupportedFormats === 'function') {
        const list: string[] = await DetectorCtor.getSupportedFormats();
        supportedSet = new Set(list);
      }
    } catch {
      return;
    }

    const allDesired = [
      'qr_code',
      'ean_13',
      'ean_8',
      'upc_a',
      'upc_e',
      'code_128',
      'code_39',
      'code_93',
      'codabar',
      'itf',
      'data_matrix',
      'aztec',
    ];
    const qrOnly = ['qr_code', 'data_matrix', 'aztec'];
    const barcodeOnly = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'codabar', 'itf'];

    const filterSupported = (list: string[]) =>
      supportedSet.size > 0 ? list.filter((f) => supportedSet.has(f)) : list;

    const makeDetector = (target: 'auto' | 'qr' | 'barcode') => {
      const formats = filterSupported(
        target === 'qr' ? qrOnly : target === 'barcode' ? barcodeOnly : allDesired
      );
      if (formats.length === 0) return null;
      try {
        return new DetectorCtor({ formats });
      } catch {
        return null;
      }
    };

    let activeTarget = scanTargetTypeRef.current;
    let detector = makeDetector(activeTarget);
    if (!detector) return;

    let lastDetectTs = 0;
    let inFlight = false;

    const tick = (ts: number) => {
      if (!isOpenRef.current || !scannerRef.current) return;
      nativeRafRef.current = requestAnimationFrame(tick);

      if (activeTarget !== scanTargetTypeRef.current) {
        activeTarget = scanTargetTypeRef.current;
        detector = makeDetector(activeTarget) || detector;
      }

      if (
        inFlight ||
        ts - lastDetectTs < 45 ||
        isProcessingRef.current ||
        isSavingQtyRef.current ||
        pendingUnsavedActionRef.current !== null
      ) {
        return;
      }

      const container = document.getElementById(containerId);
      const videoEl = container?.querySelector('video') as HTMLVideoElement | null;
      if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
        return;
      }
      if (videoEl.paused) {
        videoEl.play().catch(() => {});
        return;
      }

      lastDetectTs = ts;
      inFlight = true;
      try {
        Promise.resolve(detector.detect(videoEl))
          .then((barcodes: Array<{ rawValue?: string }>) => {
            if (barcodes && barcodes.length > 0) {
              const first = barcodes.find((b) => b.rawValue && b.rawValue.trim().length > 0);
              if (first?.rawValue) {
                handleBarcodeDetected(first.rawValue);
              }
            }
          })
          .catch(() => {
            // Ignore transient frame decode errors
          })
          .finally(() => {
            inFlight = false;
          });
      } catch {
        inFlight = false;
      }
    };

    nativeRafRef.current = requestAnimationFrame(tick);
  };

  // Start scanner immediately on open (no slow pre-getCameras probe!)
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScanStatus('idle');
      setLastScannedText(null);
      resetCooldownForNextScan();
      setLastScannedItem(null);
      setActiveItemSync(null);
      setHasEditedCalcSync(false);
      setPendingUnsavedAction(null);
      setZoomRange(null);
      setZoomLevel(1);
      setHasTorch(false);
      return;
    }

    resetCooldownForNextScan();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      startScanner(selectedCameraId || undefined);
    } else {
      setCameraError('Browser tidak mendukung akses kamera langsung. Silakan ketik kode secara manual.');
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (explicitCameraId?: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sessionId = ++scanSessionIdRef.current;

    try {
      isStartingRef.current = true;
      setCameraError(null);
      setHasTorch(false);
      setZoomRange(null);
      setZoomLevel(1);

      if (scannerRef.current) {
        await stopScanner(false);
      }

      if (sessionId !== scanSessionIdRef.current || !isOpenRef.current) return;

      // Explicitly register QR Code and all 1D barcode formats + enable native BarcodeDetector
      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
        ],
        useBarCodeDetectorIfSupported: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const hdConstraints: MediaTrackConstraints = explicitCameraId
        ? {
            deviceId: { exact: explicitCameraId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          }
        : {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          };

      const scanConfig = {
        fps: 25,
        disableFlip: true,
        videoConstraints: hdConstraints,
      };

      const onDecoded = (decodedText: string) => {
        if (isSavingQtyRef.current) return;
        handleBarcodeDetected(decodedText);
      };

      try {
        await html5QrCode.start(
          explicitCameraId || { facingMode: 'environment' },
          scanConfig,
          onDecoded,
          () => {}
        );
      } catch (primaryErr) {
        // Fallback if device rejects HD / ideal constraints
        await html5QrCode.start(
          explicitCameraId || { facingMode: 'environment' },
          {
            fps: 25,
            disableFlip: true,
          },
          onDecoded,
          () => {}
        );
        void primaryErr;
      }

      // If modal closed or superseded by a newer startScanner session, tear down cleanly
      if (sessionId !== scanSessionIdRef.current || !isOpenRef.current) {
        try {
          if (html5QrCode.isScanning) {
            await html5QrCode.stop();
          }
          html5QrCode.clear();
        } catch {}
        if (scannerRef.current === html5QrCode) {
          scannerRef.current = null;
        }
        return;
      }

      setIsScanning(true);

      // Refresh camera list in background & read active track capabilities (autofocus, torch, zoom)
      refreshCameraDevicesList();

      const track = getActiveVideoTrack();
      if (track) {
        const settings = track.getSettings?.();
        if (settings?.deviceId && !explicitCameraId) {
          setSelectedCameraId(settings.deviceId);
        }

        const caps = track.getCapabilities?.() as any;
        if (caps) {
          // Enable continuous autofocus if supported by device camera
          if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            track
              .applyConstraints({
                advanced: [{ focusMode: 'continuous' } as any],
              })
              .catch(() => {});
          }
          if (caps.torch) {
            setHasTorch(true);
          }
          if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number' && caps.zoom.max > caps.zoom.min) {
            setZoomRange({
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step || 0.1,
            });
          }
        }
      }

      // Launch parallel full-resolution native BarcodeDetector fast path
      startNativeDetectorLoop();
    } catch (err: any) {
      if (sessionId === scanSessionIdRef.current && isOpenRef.current) {
        console.warn('Failed to start scanner:', err);
        setCameraError(err?.message || 'Gagal mengakses kamera. Pastikan izin kamera aktif.');
        setIsScanning(false);
      }
    } finally {
      if (sessionId === scanSessionIdRef.current) {
        isStartingRef.current = false;
      }
    }
  };

  const stopScanner = async (bumpSession = true) => {
    if (bumpSession) {
      scanSessionIdRef.current += 1;
    }
    stopNativeDetectorLoop();
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

  const applyZoom = async (targetZoom: number) => {
    if (!zoomRange) return;
    const clamped = Math.min(zoomRange.max, Math.max(zoomRange.min, targetZoom));
    try {
      const track = getActiveVideoTrack();
      if (track) {
        await track.applyConstraints({
          advanced: [{ zoom: clamped } as any],
        });
        setZoomLevel(clamped);
      }
    } catch {
      // Ignore unsupported zoom constraint error
    }
  };

  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isScanning || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    setFocusRipple({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      key: Date.now(),
    });
    setTimeout(() => {
      setFocusRipple((curr) => (curr && Date.now() - curr.key >= 600 ? null : curr));
    }, 650);

    const track = getActiveVideoTrack();
    if (!track) return;
    const caps = track.getCapabilities?.() as any;
    if (!caps?.focusMode) return;

    try {
      if (caps.focusMode.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' } as any] });
      }
      if (caps.focusMode.includes('continuous')) {
        setTimeout(() => {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }).catch(() => {});
        }, 300);
      }
    } catch {
      // Ignore if lens ignores manual focus trigger
    }
  };

  const handleBarcodeDetected = async (rawCode: string, bypassUnsavedCheck = false) => {
    const code = rawCode.trim();
    if (!code || isSavingQtyRef.current) return;
    if (!bypassUnsavedCheck && pendingUnsavedActionRef.current !== null) return;
    const now = Date.now();

    // Prevent concurrent frame double-dispatch (180ms guard across dual native + ZXing decoders)
    if (!bypassUnsavedCheck && (isProcessingRef.current || now - lastAnyScanTimeRef.current < 180)) {
      return;
    }

    // While inline calculator is open for the SAME barcode, ignore duplicate reads of that same code
    // so typed Dus/RTG/Pcs values aren't reset — while ALWAYS allowing a DIFFERENT next barcode immediately!
    if (!bypassUnsavedCheck && code === lastScannedTextRef.current) {
      if (activeItemRef.current && scannerModeRef.current === 'calculator') {
        return;
      }
      if (now - lastScannedTimeRef.current < 900) {
        return;
      }
    }

    // Check if user entered quantity for activeItem and hasn't saved yet before continuing to next item
    if (!bypassUnsavedCheck && activeItemRef.current && hasUnsavedChangesRef.current) {
      const matchedNext = findItemsByScan(itemsRef.current, code)[0];
      // Ignore if scanned code belongs to the exact same active item
      if (matchedNext && matchedNext.id === activeItemRef.current.id) {
        return;
      }
      playScanWarningSound();
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([40, 40, 40]);
        } catch {}
      }
      setPendingUnsavedAction({
        type: 'next_code',
        code,
        nextItemName: matchedNext?.namaBarang,
      });
      return;
    }

    isProcessingRef.current = true;
    lastAnyScanTimeRef.current = now;
    lastScannedTimeRef.current = now;
    lastScannedTextRef.current = code;
    setLastScannedText(code);

    // Subtle visual flash & haptic pulse for immediate feedback
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 240);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(45);
      } catch {}
    }

    // Detect if this is a QR code format (non-numeric, JSON, URL, or length > 14)
    const isQr =
      code.startsWith('http://') ||
      code.startsWith('https://') ||
      code.startsWith('{') ||
      code.includes('\n') ||
      !/^\d{8,14}$/.test(code);
    setLastIsQrCode(isQr);

    try {
      const result = await onScanResultRef.current(code, scannerModeRef.current);
      if (result.success && result.item) {
        playScanSuccessSound();
        setScanStatus('success');
        setLastScannedItem(result.item);

        if (scannerModeRef.current === 'calculator') {
          setActiveItemSync(result.item);
        } else {
          setLastResultBadge('+1 Terhitung');
          setActiveItemSync(null);
        }
      } else {
        playScanWarningSound();
        setScanStatus('not_found');
        setLastScannedItem(null);
        setActiveItemSync(null);
      }
    } catch {
      playScanWarningSound();
      setScanStatus('not_found');
      setLastScannedItem(null);
      setActiveItemSync(null);
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Support scanning QR Code / Barcode directly from image or photo gallery
  const handleImageFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    let fileScanner: Html5Qrcode | null = null;
    try {
      const tempId = 'file-scan-temp-elem';
      let tempDiv = document.getElementById(tempId);
      if (!tempDiv) {
        tempDiv = document.createElement('div');
        tempDiv.id = tempId;
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
      }

      fileScanner = new Html5Qrcode(tempId, false);
      const result = await fileScanner.scanFile(file, false);

      if (result) {
        resetCooldownForNextScan();
        await handleBarcodeDetected(result);
      }
    } catch (err: any) {
      console.warn('File scan error:', err);
      setScanStatus('not_found');
      setLastScannedText('Gambar tidak terdeteksi');
      resetCooldownForNextScan();
      setLastIsQrCode(true);
      playScanWarningSound();
    } finally {
      if (fileScanner) {
        try {
          await fileScanner.clear();
        } catch {}
      }
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const trimmed = manualCode.trim();
    if (!activeItemRef.current || !hasUnsavedChangesRef.current) {
      resetCooldownForNextScan();
    }
    handleBarcodeDetected(trimmed);
    setManualCode('');
  };

  const runPendingUnsavedAction = async (action: PendingUnsavedAction) => {
    setPendingUnsavedAction(null);
    if (action.type === 'next_code') {
      resetCooldownForNextScan();
      await handleBarcodeDetected(action.code, true);
    } else if (action.type === 'switch_increment') {
      setScannerMode('increment');
      setActiveItemSync(null);
      setHasEditedCalcSync(false);
      resetCooldownForNextScan();
    } else if (action.type === 'open_add') {
      setActiveItemSync(null);
      setHasEditedCalcSync(false);
      onOpenManualAdd('');
      onClose();
    } else if (action.type === 'close') {
      setActiveItemSync(null);
      setHasEditedCalcSync(false);
      stopScanner();
      onClose();
    }
  };

  const handleSaveCalculatedQuantity = async (): Promise<boolean> => {
    if (!activeItem || !onApplyCalculatedQty) return false;
    isSavingQtyRef.current = true;
    setIsSavingQty(true);

    const validIsiPerDus =
      typeof isiPerDus === 'number' && isiPerDus > 0
        ? Math.max(1, Math.round(isiPerDus))
        : undefined;

    const validIsiPerPack =
      typeof isiPerPack === 'number' && isiPerPack > 0
        ? Math.max(1, Math.round(isiPerPack))
        : undefined;

    const parts: string[] = [];
    if (typeof dusCount === 'number' && dusCount > 0) {
      parts.push(`${dusCount} dus × ${isiPerDus || 0}`);
    }
    if (typeof packCount === 'number' && packCount > 0) {
      parts.push(`${packCount} rtg/pack × ${isiPerPack || 0}`);
    }
    if ((typeof pcsExtra === 'number' && pcsExtra > 0) || parts.length > 0) {
      parts.push(`${pcsExtra || 0} pcs`);
    }

    const note =
      parts.length > 0
        ? `Kalkulator: ${parts.join(' + ')} = ${calculatedTotal} pcs`
        : `Kalkulator: ${calculatedTotal} pcs`;

    try {
      const success = await onApplyCalculatedQty(
        activeItem.id,
        calculatedTotal,
        note,
        validIsiPerDus,
        validIsiPerPack
      );

      if (success) {
        const updatedItem: InventoryItem = {
          ...activeItem,
          quantity: calculatedTotal,
          ...(validIsiPerDus ? { isiPerDus: validIsiPerDus } : {}),
          ...(validIsiPerPack ? { isiPerPack: validIsiPerPack } : {}),
        };
        playScanSuccessSound();
        setLastScannedItem(updatedItem);
        setLastResultBadge('Tersimpan');
        setScanStatus('success');
        setHasEditedCalcSync(false);
        setActiveItemSync(null);
        resetCooldownForNextScan();
        return true;
      }
      return false;
    } finally {
      isSavingQtyRef.current = false;
      setIsSavingQty(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Hidden File Input for Image/Gallery QR scanning */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFileScan}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Scan Barcode & QR Code Mart
                </h2>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 flex items-center gap-1">
                  <QrCode className="w-3 h-3" />
                  QR + Barcode
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                Ketuk layar kamera untuk fokus ulang · Auto-deteksi cepat
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                playScanWarningSound();
                setPendingUnsavedAction({ type: 'close' });
                return;
              }
              stopScanner();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div
          ref={viewportRef}
          onClick={handleTapToFocus}
          className="relative bg-black flex flex-col items-center justify-center h-[260px] sm:h-[290px] overflow-hidden shrink-0 cursor-crosshair"
        >
          <div id={containerId} className="w-full h-full" />

          {/* Crisp Non-Blocking Target Reticle + Laser Line */}
          {isScanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[5]">
              <div
                className={`relative transition-all duration-200 border border-white/25 rounded-xl ${
                  scanFlash
                    ? 'ring-2 ring-emerald-400 bg-emerald-400/15'
                    : 'bg-transparent'
                } ${
                  scanTargetType === 'qr'
                    ? 'w-44 h-44 sm:w-48 sm:h-48'
                    : scanTargetType === 'barcode'
                    ? 'w-[78%] h-28 sm:h-32'
                    : 'w-[72%] h-40 sm:h-44'
                }`}
              >
                {/* Corner brackets */}
                <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-blue-400 rounded-tl-md" />
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-blue-400 rounded-tr-md" />
                <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-blue-400 rounded-bl-md" />
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-blue-400 rounded-br-md" />

                {/* Animated Laser Line */}
                <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-scan-laser" />
              </div>
            </div>
          )}

          {/* Tap-to-Focus Visual Indicator */}
          {focusRipple && (
            <div
              key={focusRipple.key}
              className="absolute pointer-events-none w-12 h-12 -ml-6 -mt-6 rounded-full border-2 border-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.7)] animate-ping z-10"
              style={{ left: focusRipple.x, top: focusRipple.y }}
            />
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 p-5 flex flex-col items-center justify-center bg-slate-900 text-center text-white z-20 cursor-default"
            >
              <AlertTriangle className="w-9 h-9 text-amber-400 mb-2" />
              <p className="text-sm font-semibold mb-1 text-slate-100">Kamera Belum Aktif</p>
              <p className="text-xs text-slate-300 mb-3 max-w-xs">{cameraError}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => startScanner(selectedCameraId || undefined)}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Aktifkan Kamera
                </button>
              </div>
            </div>
          )}

          {/* Top Controls Overlay (Torch, Camera Switch, & Image File Upload) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10"
          >
            {/* Upload Foto / Gambar QR Code button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md transition-colors flex items-center gap-1 text-xs border border-white/10"
              title="Scan Barcode / QR Code dari Foto atau File Gambar"
            >
              <ImageIcon className="w-4 h-4 text-purple-300" />
              <span className="hidden sm:inline text-[11px] font-medium">Foto QR</span>
            </button>

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
                title="Ganti Kamera / Lensa"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Top Left: Target Mode Switcher (Auto / QR Code / Barcode) - Instant, Zero Camera Restart */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2.5 left-2.5 z-10"
          >
            <div className="flex items-center gap-0.5 bg-black/70 backdrop-blur-md p-0.5 rounded-lg border border-white/15">
              <button
                type="button"
                onClick={() => setScanTargetType('auto')}
                className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all ${
                  scanTargetType === 'auto'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Deteksi Otomatis Semua Barcode & QR Code"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setScanTargetType('qr')}
                className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  scanTargetType === 'qr'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Fokus Scan QR Code Kotak (2D)"
              >
                <QrCode className="w-3 h-3 text-purple-300" />
                <span>QR</span>
              </button>
              <button
                type="button"
                onClick={() => setScanTargetType('barcode')}
                className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all ${
                  scanTargetType === 'barcode'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Fokus Scan Barcode Garis Lebar (1D)"
              >
                1D
              </button>
            </div>
          </div>

          {/* Bottom Bar: Audio/Zoom indicator & Quantity Mode toggle */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-10"
          >
            <div className="flex items-center gap-1.5">
              <div className="bg-black/60 backdrop-blur-md rounded-lg px-2 py-1 text-xs text-white flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] hidden sm:inline">Beep</span>
              </div>

              {zoomRange && (
                <div className="flex items-center gap-0.5 bg-black/70 backdrop-blur-md p-0.5 rounded-lg border border-white/10">
                  {[1, 1.5, 2]
                    .filter((z) => z >= zoomRange.min && z <= zoomRange.max)
                    .map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => applyZoom(z)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                          Math.abs(zoomLevel - z) < 0.2
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        title={`Zoom ${z}x untuk barcode kecil`}
                      >
                        {z}x
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Mode Selector Toggle: Kalkulator vs Satuan (+1) */}
            <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md p-0.5 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setScannerMode('calculator');
                  resetCooldownForNextScan();
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                  scannerMode === 'calculator'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 text-amber-300" />
                <span>Kalkulator</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    playScanWarningSound();
                    setPendingUnsavedAction({ type: 'switch_increment' });
                    return;
                  }
                  setScannerMode('increment');
                  setActiveItemSync(null);
                  setHasEditedCalcSync(false);
                  resetCooldownForNextScan();
                }}
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
          {/* Unsaved Quantity Input Notification Banner */}
          {activeItem && pendingUnsavedAction && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/70 border-b-2 border-amber-400 dark:border-amber-700 space-y-2.5 animate-pulse-once">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100">
                    Pemberitahuan: Jumlah Barang Belum Disimpan!
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5 leading-relaxed">
                    Input untuk <strong>{activeItem.namaBarang}</strong> ({calculatedTotal} pcs) belum disimpan.{' '}
                    {pendingUnsavedAction.type === 'next_code'
                      ? `Simpan terlebih dahulu sebelum lanjut ke ${
                          pendingUnsavedAction.nextItemName
                            ? `"${pendingUnsavedAction.nextItemName}"`
                            : `kode "${pendingUnsavedAction.code}"`
                        }?`
                      : pendingUnsavedAction.type === 'switch_increment'
                      ? 'Simpan terlebih dahulu sebelum pindah ke mode Satuan (+1)?'
                      : 'Simpan terlebih dahulu sebelum melanjutkan?'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setPendingUnsavedAction(null)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Kembali Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const act = pendingUnsavedAction;
                    setHasEditedCalcSync(false);
                    runPendingUnsavedAction(act);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/70 hover:bg-amber-300 dark:hover:bg-amber-800 rounded-lg cursor-pointer"
                >
                  Lanjut Tanpa Simpan
                </button>
                <button
                  type="button"
                  disabled={isSavingQty}
                  onClick={async () => {
                    const act = pendingUnsavedAction;
                    const saved = await handleSaveCalculatedQuantity();
                    if (saved) {
                      await runPendingUnsavedAction(act);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isSavingQty ? 'Menyimpan...' : `Simpan (${calculatedTotal} pcs) & Lanjut`}</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Inline Calculator View for Scanned Item */}
          {activeItem && (
            <div className="p-4 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded">
                      {activeItem.sku}
                    </span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                      {activeItem.kategori}
                    </span>
                    {lastIsQrCode && (
                      <span className="text-[10px] bg-purple-200 dark:bg-purple-950 text-purple-900 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                        <QrCode className="w-2.5 h-2.5" /> QR Code
                      </span>
                    )}
                    {hasUnsavedChanges && (
                      <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold">
                        Belum Disimpan
                      </span>
                    )}
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
                    className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-md flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
                    title="Buka kalkulator lengkap (grid rak & rumus)"
                  >
                    <Layers className="w-3.5 h-3.5" /> Kalkulator Lengkap
                  </button>
                )}
              </div>

              {/* Calculator Inputs: Dus + RTG/Pack + Satuan */}
              <div className="bg-white dark:bg-slate-800/90 p-3 rounded-lg border border-blue-200 dark:border-blue-900 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Hitung (Dus + RTG/Pack + Satuan):
                  </span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    = {calculatedTotal} pcs
                  </span>
                </div>

                {/* Row 1: Dus */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Karton / Dus
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={dusCount}
                      onChange={(e) => {
                        setHasEditedCalcSync(true);
                        setManualCalcQty('');
                        setDusCount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0));
                      }}
                      placeholder="0 dus"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span>Isi per Dus</span>
                      {activeItem.isiPerDus && activeItem.isiPerDus > 0 && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Tersimpan</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={isiPerDus}
                      onChange={(e) => {
                        setHasEditedCalcSync(true);
                        setManualCalcQty('');
                        setIsiPerDus(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      placeholder="24"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Row 2: RTG/Pack & Satuan */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Jml RTG / Pack
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={packCount}
                      onChange={(e) => {
                        setHasEditedCalcSync(true);
                        setManualCalcQty('');
                        setPackCount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0));
                      }}
                      placeholder="0 rtg"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 gap-1">
                      <span className="truncate">Isi RTG/Pack</span>
                      {activeItem.isiPerPack && activeItem.isiPerPack > 0 && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={isiPerPack}
                      onChange={(e) => {
                        setHasEditedCalcSync(true);
                        setManualCalcQty('');
                        setIsiPerPack(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      placeholder="10"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
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
                        setHasEditedCalcSync(true);
                        setManualCalcQty('');
                        setPcsExtra(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0));
                      }}
                      placeholder="0 pcs"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Quick Action Row (+1 Pcs & Reset) */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setHasEditedCalcSync(true);
                      setManualCalcQty('');
                      setPcsExtra((prev) => (typeof prev === 'number' ? prev + 1 : 1));
                    }}
                    className="px-2.5 py-1 text-[11px] bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-slate-700 dark:text-slate-200 rounded font-mono font-semibold transition-colors cursor-pointer"
                  >
                    +1 Eceran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasEditedCalcSync(true);
                      setDusCount('');
                      setPackCount('');
                      setPcsExtra('');
                      setManualCalcQty(0);
                    }}
                    className="px-2 py-1 text-[11px] text-slate-500 hover:text-red-600 rounded flex items-center gap-0.5 cursor-pointer"
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
                      onClick={() => {
                        setHasEditedCalcSync(false);
                        setPendingUnsavedAction(null);
                        setActiveItemSync(null);
                        setScanStatus('idle');
                        resetCooldownForNextScan();
                      }}
                      className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isSavingQty}
                      onClick={handleSaveCalculatedQuantity}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-xs text-emerald-950 dark:text-emerald-100">
                          {lastScannedItem.namaBarang}
                        </p>
                        {lastIsQrCode && (
                          <span className="text-[9px] px-1 py-0.2 bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 font-bold rounded flex items-center gap-0.5">
                            <QrCode className="w-2.5 h-2.5" /> QR Code
                          </span>
                        )}
                      </div>
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
                      onClick={() => setActiveItemSync(lastScannedItem)}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 rounded-md flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" /> Hitung Kuantitas
                    </button>
                    <span className="text-xs bg-emerald-200/80 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-mono font-semibold">
                      {lastResultBadge}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-xs text-amber-950 dark:text-amber-100">
                          Kode Belum Terdaftar
                        </p>
                        {lastIsQrCode ? (
                          <span className="text-[9px] px-1 py-0.2 bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 font-bold rounded flex items-center gap-0.5">
                            <QrCode className="w-2.5 h-2.5" /> QR Code
                          </span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.2 bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 font-bold rounded">
                            Barcode 1D
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-mono truncate max-w-xs">
                        {lastScannedText}
                      </p>
                    </div>
                  </div>
                  {lastScannedText && (
                    <button
                      onClick={() => {
                        const candidates = extractScanCandidates(lastScannedText);
                        onOpenManualAdd(candidates[0] || lastScannedText);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Barang
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: Manual Barcode / QR / SKU input */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ketik Barcode, SKU, atau teks QR Code lalu Enter..."
              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono shadow-2xs"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
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
            <span className="flex items-center gap-1">
              <Scan className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              Mendukung QR Code, Barcode laser USB & Bluetooth
            </span>
            <button
              type="button"
              onClick={() => {
                if (hasUnsavedChanges) {
                  playScanWarningSound();
                  setPendingUnsavedAction({ type: 'open_add' });
                  return;
                }
                onOpenManualAdd('');
                onClose();
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              + Input Barang Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
