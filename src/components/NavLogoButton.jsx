import React from 'react';
import { useApp } from '../context/AppContext';

export function NavLogoButton({ onClick, title }) {
  const { state, t } = useApp();
  const isEn = state?.currentLang === 'en';
  const currentBuilding = (state?.buildings || []).find(b => b.id === state?.currentBuildingId) || state?.buildings?.[0];
  const isAdmin = state?.currentUser?.role === 'admin' || state?.currentUser?.role === 'superadmin';
  const isInBuilding = Boolean(currentBuilding && (!isAdmin || (!state?.isPortfolioView && state?.currentBuildingId)));
  const displayTitle = isInBuilding
    ? currentBuilding.name
    : (t?.app_title || "Társasházkezelő");

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none group focus:outline-none flex-shrink-0 transition-opacity hover:opacity-95 min-w-0"
      title={title || (isEn ? "Back to Main Menu" : "Vissza a főmenübe")}
    >
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105 flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4"/>
          <path d="M10 10h4"/>
          <path d="M10 14h4"/>
          <path d="M10 18h4"/>
        </svg>
      </div>
      <div className="hidden sm:flex flex-col text-left min-w-0 max-w-[200px] md:max-w-[280px]">
        <span className="text-xs font-bold text-gray-900 leading-tight font-display truncate">
          {displayTitle}
        </span>
        <span className="text-[10px] text-gray-500 font-medium">
          {isEn ? "← Back to Home" : "← Főmenü"}
        </span>
      </div>
    </button>
  );
}
