import React from 'react';
import { Building2, RefreshCw } from 'lucide-react';

export function InitialLoadingScreen({ isEn = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F3F4F6]/95 backdrop-blur-sm transition-opacity duration-300 p-4 select-none">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 flex flex-col items-center text-center animate-fadeIn relative overflow-hidden">
        {/* Subtle top ambient glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 animate-pulse" />
        
        {/* Animated Icon with pulse wave */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute w-20 h-20 bg-blue-500/15 rounded-3xl animate-ping opacity-60" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-blue-700 flex items-center justify-center text-white shadow-lg relative z-10">
            <Building2 className="w-8 h-8" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-gray-900 tracking-tight font-display mb-1.5">
          TársasAPP
        </h2>

        {/* Loading Spinner & Status */}
        <div className="flex items-center gap-2 text-blue-700 text-xs font-bold mb-3 px-3 py-1 bg-blue-50/80 rounded-full border border-blue-100">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>
            {isEn ? "Syncing data with cloud..." : "Adatok betöltése a felhőből..."}
          </span>
        </div>

        {/* Friendly explanation */}
        <p className="text-xs text-gray-500 leading-relaxed max-w-xs mb-4">
          {isEn
            ? "Verifying latest transactions, flat balances and reserves from the cloud database..."
            : "A legfrissebb egyenlegek, könyvelési tételek és lakásadatok ellenőrzése a központi adatbázisban..."}
        </p>

        {/* Progress bar shimmer */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full w-2/3 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
