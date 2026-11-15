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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#faf8ff]/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-[#c3c6d7]/50 dark:border-slate-800 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-2px_12px_rgba(19,27,46,0.06)] transition-colors">
      <div className="flex items-center justify-around relative select-none">
        {/* Tab 1: Stok Opname */}
        <button
          type="button"
          onClick={() => onSelectTab('opname')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl active:scale-95 transition-transform ${
            activeTab === 'opname'
              ? 'text-[#004ac6] dark:text-blue-400 font-bold'
              : 'text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Opname</span>
        </button>

        {/* Tab 2: Laporan */}
        <button
          type="button"
          onClick={() => onSelectTab('laporan')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl active:scale-95 transition-transform ${
            activeTab === 'laporan'
              ? 'text-[#004ac6] dark:text-blue-400 font-bold'
              : 'text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-slate-200 font-medium'
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
            className="w-14 h-14 rounded-full bg-[#004ac6] hover:bg-[#003ea8] dark:bg-blue-600 dark:hover:bg-blue-700 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-[#004ac6]/35 dark:shadow-blue-600/40 border-4 border-[#faf8ff] dark:border-slate-900 transition-transform cursor-pointer"
            title="Buka Kamera Scan Barcode & QR Code"
          >
            <Camera className="w-6 h-6" />
          </button>
          <span className="text-[10px] font-bold text-[#004ac6] dark:text-blue-400 mt-0.5">
            SCAN
          </span>
        </div>

        {/* Tab 4: Kalkulator Dus/Lusin */}
        <button
          type="button"
          onClick={onOpenCalculator}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-slate-200 active:scale-95 font-medium transition-transform"
          title="Buka Kalkulator Kuantitas"
        >
          <Calculator className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Kalkulator</span>
        </button>

        {/* Tab 5: Menu Lain / Opsi (Membuka Bottom Sheet Lengkap) */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[#434655] dark:text-slate-400 hover:text-[#131b2e] dark:hover:text-slate-200 active:scale-95 font-medium relative transition-transform"
          title="Buka Menu & Aksi Lainnya"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Menu</span>
          {isPrivilegedUser && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-[#006243] dark:bg-emerald-500 ring-2 ring-[#faf8ff] dark:ring-slate-900" />
          )}
        </button>
      </div>
    </div>
  );
};
