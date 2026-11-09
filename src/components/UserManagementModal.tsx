import React, { useState } from 'react';
import { X, UserPlus, Users, Check, ShieldCheck, Cloud } from 'lucide-react';
import { MartUser } from '../types/inventory.ts';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: MartUser[];
  activeUser: string;
  onSelectActiveUser: (userName: string) => void;
  onAddUser: (name: string, role: string, color?: string) => Promise<boolean>;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  activeUser,
  onSelectActiveUser,
  onAddUser,
}) => {
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Petugas Opname');
  const [selectedColor, setSelectedColor] = useState('#0284c7');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const colorOptions = [
    '#0284c7', // Sky blue
    '#059669', // Emerald
    '#7c3aed', // Purple
    '#ea580c', // Orange
    '#db2777', // Pink
    '#ca8a04', // Amber
    '#0d9488', // Teal
    '#4f46e5', // Indigo
    '#dc2626', // Red
  ];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      setError('Nama user tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const success = await onAddUser(newUserName.trim().toUpperCase(), newUserRole, selectedColor);
    setIsSubmitting(false);

    if (success) {
      setNewUserName('');
      setNewUserRole('Petugas Opname');
    } else {
      setError('Gagal menambahkan user. Pastikan nama belum digunakan.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Manajemen Petugas Opname Mart</h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                  <Cloud className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  Auto-Save Cloud
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pilih akun aktif atau tambahkan petugas opname baru</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Active User Selection */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Petugas Opname Terdaftar ({users.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {users.map((u) => {
                const isActive = activeUser === u.name;
                return (
                  <button
                    key={u.id || u.name}
                    type="button"
                    onClick={() => {
                      onSelectActiveUser(u.name);
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      isActive
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: u.color || '#0284c7' }}
                      >
                        {u.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                          {u.name}
                          {u.name === 'IYAN' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded font-semibold" title="Khusus Export & Import (Password Terproteksi)">
                              <ShieldCheck className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                              Export/Import
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">
                              Aktif
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {u.name === 'IYAN' ? 'Leader Opname (Akses Penuh)' : (u.role || 'Petugas Opname')}
                        </p>
                      </div>
                    </div>
                    {isActive ? (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                        {u.name === 'IYAN' ? 'Masuk 🔒' : 'Pilih'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add New User Section */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Tambah Petugas Baru
              </h3>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-lg border border-red-200 dark:border-red-900 mb-3">{error}</p>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Petugas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value.toUpperCase())}
                  placeholder="Contoh: BUDI / SITI / RAHMAT"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 font-bold uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jabatan / Posisi Opname
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Petugas Opname">Petugas Opname</option>
                  <option value="Checker Gudang">Checker Gudang</option>
                  <option value="Staff Display Rak">Staff Display Rak</option>
                  <option value="Supervisor Toko">Supervisor Toko</option>
                  <option value="Kasir & Inventory">Kasir & Inventory</option>
                  <option value="Admin Stok">Admin Stok</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Warna Identitas Avatar
                </label>
                <div className="flex items-center gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-slate-300 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !newUserName.trim()}
                  className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? 'Menyimpan ke Cloud...' : 'Daftarkan Petugas Baru ke Cloud'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Petugas aktif saat ini: <strong className="text-slate-900 dark:text-white font-bold">{activeUser}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
