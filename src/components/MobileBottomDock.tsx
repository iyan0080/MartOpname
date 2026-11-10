import React from 'react';
import { Store, FileText, Camera, Calculator, Menu, Layers } from 'lucide-react';

interface MobileBottomDockProps {
  activeTab: 'opname' | 'laporan' | 'kategori';
  onSelectTab: (tab: 'opname' | 'laporan' | 'kategori') => void;
  onOpenScanner: () => void;
  onOpenCalculator: () => void;
  onOpenMenu: () => void;
  activeUser: string;
}

export const MobileBottomDock: React.FC<MobileBottomDockProps> = ({
  activeTab,
  onSelectTab,
  onOpenScanner,
  onOpenCalculator,
  onOpenMenu,
  activeUser,
}) => {
  const isPrivilegedUser = activeUser === 'IYAN' || activeUser === 'HENDRI';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl transition-colors">
      <div className="flex items-center justify-around relative">
        {/* Tab 1: Stok Opname */}
        <button
          type="button"
          onClick={() => onSelectTab('opname')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'opname'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-102'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Opname</span>
        </button>

        {/* Tab 2: Laporan */}
        <button
          type="button"
          onClick={() => onSelectTab('laporan')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
            activeTab === 'laporan'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-102'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Laporan</span>
        </button>

        {/* Center: Floating High-Priority SCAN BUTTON (Thumb Zone) */}
        <div className="flex flex-col items-center -mt-6">
          <button
            type="button"
            onClick={onOpenScanner}
            className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 border-4 border-white dark:border-slate-900 transition-all cursor-pointer"
            title="Buka Kamera Scan Barcode & QR Code"
          >
            <Camera className="w-6 h-6 animate-pulse" />
          </button>
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            SCAN
          </span>
        </div>

        {/* Tab 4: Kalkulator Dus/Lusin */}
        <button
          type="button"
          onClick={onOpenCalculator}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-all"
          title="Buka Kalkulator Kuantitas"
        >
          <Calculator className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Kalkulator</span>
        </button>

        {/* Tab 5: Menu Lain / Opsi (Membuka Bottom Sheet Lengkap) */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium relative transition-all"
          title="Buka Menu & Aksi Lainnya"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Menu</span>
          {isPrivilegedUser && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>
      </div>
    </div>
  );
};
