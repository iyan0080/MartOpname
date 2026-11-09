import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, CheckCircle2, Clock, FileText, UserCheck, X, Cloud, Loader2 } from 'lucide-react';
import { OpnameSession } from '../types/inventory.ts';

interface OpnameDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: OpnameSession;
  onSaveSession: (updated: OpnameSession) => Promise<void>;
  activeUser: string;
}

export const OpnameDateModal: React.FC<OpnameDateModalProps> = ({
  isOpen,
  onClose,
  session,
  onSaveSession,
  activeUser,
}) => {
  const [opnameDate, setOpnameDate] = useState<string>(session.opnameDate || new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState<string>(session.title || 'Stok Opname Mart Santri');
  const [status, setStatus] = useState<'draft' | 'ongoing' | 'completed'>(session.status || 'ongoing');
  const [notes, setNotes] = useState<string>(session.notes || '');
  const [picIyan, setPicIyan] = useState<string>(session.picIyan || 'IYAN');
  const [picHendri, setPicHendri] = useState<string>(session.picHendri || 'HENDRI');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');

  const isHydratedRef = useRef(false);
  const autoSaveTimerRef = useRef<any>(null);
  const latestValuesRef = useRef({ opnameDate, title, status, notes, picIyan, picHendri });

  useEffect(() => {
    latestValuesRef.current = { opnameDate, title, status, notes, picIyan, picHendri };
  }, [opnameDate, title, status, notes, picIyan, picHendri]);

  useEffect(() => {
    if (isOpen) {
      setOpnameDate(session.opnameDate || new Date().toISOString().split('T')[0]);
      setTitle(session.title || 'Stok Opname Mart Santri');
      setStatus(session.status || 'ongoing');
      setNotes(session.notes || '');
      setPicIyan(session.picIyan || 'IYAN');
      setPicHendri(session.picHendri || 'HENDRI');
      setSaveStatus('saved');
      setTimeout(() => {
        isHydratedRef.current = true;
      }, 100);
    } else {
      isHydratedRef.current = false;
    }
  }, [isOpen, session]);

  const commitSession = useCallback(
    async (override?: Partial<OpnameSession>) => {
      setSaveStatus('saving');
      const v = latestValuesRef.current;
      const updated: OpnameSession = {
        ...session,
        opnameDate: v.opnameDate,
        title: v.title.trim() || 'Stok Opname Mart Santri',
        status: v.status,
        notes: v.notes.trim(),
        picIyan: v.picIyan.trim() || 'IYAN',
        picHendri: v.picHendri.trim() || 'HENDRI',
        updatedBy: activeUser,
        updatedAt: new Date().toISOString(),
        ...override,
      };
      try {
        await onSaveSession(updated);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save session error:', err);
        setSaveStatus('error');
      }
    },
    [session, activeUser, onSaveSession]
  );

  // Debounced auto-save whenever any field changes
  useEffect(() => {
    if (!isHydratedRef.current) return;
    setSaveStatus('saving');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      commitSession();
    }, 600);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [opnameDate, title, status, notes, picIyan, picHendri, commitSession]);

  const handleClose = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      commitSession();
    }
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await commitSession();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Tentukan Tanggal & Sesi Opname
                </h3>
                {saveStatus === 'saving' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                    Menyimpan...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Tersimpan di Cloud
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span
                    onClick={() => commitSession()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/40 cursor-pointer"
                  >
                    Gagal (Coba Lagi)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Otomatis tersimpan ke Cloud Firestore setiap ada perubahan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Tanggal Opname */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-500" /> Tanggal Pelaksanaan Opname <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={opnameDate}
              onChange={(e) => setOpnameDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Tanggal ini akan dicantumkan di header aplikasi, rekaman audit, dan laporan hasil opname.
            </p>
          </div>

          {/* Judul Sesi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-500" /> Judul / Keterangan Periode
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Stok Opname Mart Awal Bulan November 2026"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Status Sesi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" /> Status Pelaksanaan
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  status === 'draft'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Persiapan (Draft)
              </button>
              <button
                type="button"
                onClick={() => setStatus('ongoing')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  status === 'ongoing'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Sedang Berjalan
              </button>
              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Selesai (Final)
              </button>
            </div>
          </div>

          {/* Penanggung Jawab Tim Auditor (IYAN & HENDRI) */}
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Penanggung Jawab & Auditor Khusus
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Petugas Utama (Pemeriksa)
                </label>
                <input
                  type="text"
                  value={picIyan}
                  onChange={(e) => setPicIyan(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Petugas Pendamping (Keuangan)
                </label>
                <input
                  type="text"
                  value={picHendri}
                  onChange={(e) => setPicHendri(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Catatan Sesi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Catatan / Instruksi Khusus Opname
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan mengenai kondisi toko, tim yang bertugas, atau catatan rak..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saveStatus === 'saving' ? 'Menyimpan ke Cloud...' : 'Simpan & Tutup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
