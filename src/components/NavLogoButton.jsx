import React from 'react';
import { useApp } from '../context/AppContext';
import { Eye, Shield, ClipboardCheck } from 'lucide-react';
import { isUserBuildingViewer, canUserManageBuilding } from '../utils/teamPermissions';

export function NavLogoButton({ onClick, title, hideViewerBadge = false, isReadOnly = false }) {
  const { state, t } = useApp();
  const isEn = state?.currentLang === 'en';
  const isHu = !isEn;
  const currentBuilding = (state?.buildings || []).find(b => b.id === state?.currentBuildingId) || state?.buildings?.[0];
  const isCurrentlyAdminMode = state?.currentUser?.role === 'admin' || state?.currentUser?.role === 'superadmin';
  const isSzvbMode = state?.currentUser?.role === 'szvb';
  const isAuditorMode = state?.currentUser?.role === 'auditor';
  const isInBuilding = Boolean(currentBuilding && (!isCurrentlyAdminMode || (!state?.isPortfolioView && state?.currentBuildingId)));
  
  const isViewer = isCurrentlyAdminMode && Boolean(
    isReadOnly ||
    (currentBuilding && (
      isUserBuildingViewer(state?.currentUser, currentBuilding, state?.organizations, state?.buildings) ||
      !canUserManageBuilding(state?.currentUser, currentBuilding, state?.organizations, state?.buildings)
    ))
  );

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
      <div className="flex flex-col text-left min-w-0 max-w-[240px] sm:max-w-[300px] md:max-w-[400px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-gray-900 leading-tight font-display truncate">
            {displayTitle}
          </span>
          {isViewer && isInBuilding && !hideViewerBadge && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex-shrink-0">
              <Eye className="w-2.5 h-2.5 text-amber-600" />
              <span>{isHu ? 'Csak megtekintő' : 'View only'}</span>
            </span>
          )}
          {isSzvbMode && isInBuilding && !hideViewerBadge && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex-shrink-0">
              <Shield className="w-2.5 h-2.5 text-indigo-600" />
              <span>{isHu ? 'SZVB • Csak olvasás' : 'SZVB • Read-Only'}</span>
            </span>
          )}
          {isAuditorMode && isInBuilding && !hideViewerBadge && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex-shrink-0">
              <ClipboardCheck className="w-2.5 h-2.5 text-teal-600" />
              <span>{isHu ? 'Gazdasági ellenőr • Csak olvasás' : 'Financial Auditor • Read-Only'}</span>
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-500 font-medium hidden sm:inline">
          {isEn ? "← Back to Home" : "← Főmenü"}
        </span>
      </div>
    </button>
  );
}
