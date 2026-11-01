import React, { useState } from 'react';
import { Activity, X, User, Clock, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { ScanAuditLog } from '../types/inventory.ts';

interface LiveAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ScanAuditLog[];
  activeUsersCount: number;
}

export const LiveAuditDrawer: React.FC<LiveAuditDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  activeUsersCount,
}) => {
  const [userFilter, setUserFilter] = useState('ALL');

  if (!isOpen) return null;

  const usersInLogs = Array.from(new Set(logs.map((l) => l.user))).filter(Boolean);

  const filteredLogs = logs.filter((l) => {
    if (userFilter === 'ALL') return true;
    return l.user === userFilter;
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Aktivitas Scan Real-Time</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Riwayat scan barang bersama ({activeUsersCount} user terhubung)
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filter by User */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium shrink-0">Filter Petugas:</span>
        <button
          type="button"
          onClick={() => setUserFilter('ALL')}
          className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition-colors ${
            userFilter === 'ALL'
              ? 'bg-slate-900 dark:bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Semua
        </button>
        {usersInLogs.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUserFilter(u)}
            className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 transition-colors ${
              userFilter === u
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {u}
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
            Belum ada aktivitas scan terbaru tercatat.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isPositive = log.delta > 0;
            const isZero = log.delta === 0;

            return (
              <div key={log.id} className="pt-2.5 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {log.sku}
                      </span>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{log.namaBarang}</p>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        {log.user}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>

                    {log.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 pl-1 border-l-2 border-slate-200 dark:border-slate-700">
                        "{log.notes}"
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isPositive
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : isZero
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                      }`}
                    >
                      {isPositive ? (
                        <>
                          <ArrowUpRight className="w-3 h-3" />+{log.delta}
                        </>
                      ) : isZero ? (
                        '0'
                      ) : (
                        <>
                          <ArrowDownRight className="w-3 h-3" />
                          {log.delta}
                        </>
                      )}
                    </span>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                      {log.previousQty} → {log.newQty} pcs
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
        <span>Menampilkan 50 aktivitas scan terakhir</span>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
