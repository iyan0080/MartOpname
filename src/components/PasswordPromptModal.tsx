import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface PasswordPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
  title?: string;
  description?: string;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Verifikasi Keamanan Petugas IYAN',
  description = 'Hanya user IYAN yang memiliki wewenang untuk melakukan Export dan Import data.',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password wajib diisi.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      let isSuccess = false;
      let token = '';

      // Try server endpoint first (for Node dev server)
      try {
        const res = await fetch('/api/auth/verify-iyan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token) {
            isSuccess = true;
            token = data.token;
          }
        }
      } catch {
        // Server not reachable (e.g. GitHub Pages static hosting where backend is Firebase Cloud)
      }

      // Direct verification fallback for GitHub Pages
      if (!isSuccess && password === 'Kantin0011@') {
        isSuccess = true;
        token = 'iyan_auth_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
      }

      setIsVerifying(false);

      if (isSuccess) {
        setPassword('');
        setError(null);
        onSuccess(token);
      } else {
        setError('Password salah. Akses ditolak.');
      }
    } catch {
      setIsVerifying(false);
      setError('Gagal memverifikasi password.');
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Otorisasi Khusus</p>
            </div>
          </div>
          <button
            onClick={() => {
              setPassword('');
              setError(null);
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>

          {error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Masukkan Password IYAN
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full px-3 py-2 pr-10 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Masukkan kata sandi rahasia untuk melanjutkan otorisasi akses.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setPassword('');
                setError(null);
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isVerifying || !password}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              {isVerifying ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
