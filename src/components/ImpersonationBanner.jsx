import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function ImpersonationBanner({ onExit }) {
  const { state, t, exitImpersonation } = useApp();
  const { currentUser, buildings, currentBuildingId, impersonatedFrom, currentLang } = state;

  if (!impersonatedFrom || !currentUser) return null;

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];
  const isEn = currentLang === 'en';

  const roleLabel = currentUser.role === 'admin'
    ? (isEn ? "Condo Representative" : "Közös Képviselő")
    : `${currentUser.flatNum}. ${isEn ? "flat" : "lakás"}`;

  const handleExit = () => {
    if (onExit) onExit();
    exitImpersonation();
  };

  return (
    <aside aria-label="Impersonation Status" className="w-full bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-3 sm:px-6 py-2 shadow-md flex flex-wrap items-center justify-between gap-2.5 border-b border-amber-900/40 select-none animate-fadeIn">
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-amber-500/40 text-amber-200 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="w-3.5 h-3.5" />
        </div>
        <div className="text-xs text-amber-50 font-medium truncate">
          <span className="font-bold text-white uppercase tracking-wider text-[11px] bg-amber-900/60 px-1.5 py-0.5 rounded mr-1.5">
            {t.impersonation_banner_text || "Rendszergazda Mód:"}
          </span>
          <span>
            {isEn ? "Acting in profile of " : "Jelenleg "}
            <strong className="text-white underline decoration-amber-400 font-bold">{currentUser.name || currentUser.email}</strong>
            {' '}({roleLabel})
            {currentBuilding && (
              <span className="opacity-90 hidden sm:inline">
                {' '}• {currentBuilding.name}
              </span>
            )}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleExit}
        className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-amber-50 text-gray-900 text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer flex-shrink-0 active:scale-95"
        title={t.return_to_superadmin || "Visszalépés a Rendszergazda felületre"}
      >
        <ArrowLeft className="w-3.5 h-3.5 text-amber-800" />
        <span>{t.return_to_superadmin || "Visszalépés a Rendszergazda felületre"}</span>
      </button>
    </aside>
  );
}
