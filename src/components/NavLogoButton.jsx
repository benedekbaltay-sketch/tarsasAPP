import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Eye, Shield, ClipboardCheck, ChevronDown, Building2 } from 'lucide-react';
import { getAccessibleBuildings, isUserBuildingViewer, canUserManageBuilding } from '../utils/teamPermissions';

export function NavLogoButton({ onClick, title, hideViewerBadge = false, isReadOnly = false }) {
  const { state, t, openBuildingAdmin } = useApp();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);

  const isEn = state?.currentLang === 'en';
  const isHu = !isEn;
  const accessibleBuildings = getAccessibleBuildings(
    state?.currentUser,
    state?.buildings || [],
    state?.organizations || []
  );
  const currentBuilding =
    accessibleBuildings.find((b) => b.id === state?.currentBuildingId) ||
    (state?.buildings || []).find((b) => b.id === state?.currentBuildingId) ||
    accessibleBuildings[0] ||
    state?.buildings?.[0];
  const isCurrentlyAdminMode = state?.currentUser?.role === 'admin' || state?.currentUser?.role === 'superadmin';
  const isSzvbMode = state?.currentUser?.role === 'szvb';
  const isAuditorMode = state?.currentUser?.role === 'auditor';
  const isInBuilding = Boolean(currentBuilding && (!isCurrentlyAdminMode || (!state?.isPortfolioView && state?.currentBuildingId)));

  const otherAccessibleBuildings = (accessibleBuildings || []).filter(
    (b) => b && b.id !== currentBuilding?.id
  );
  const canSwitchBuildings = Boolean(
    isCurrentlyAdminMode &&
    isInBuilding &&
    !state?.isPortfolioView &&
    typeof openBuildingAdmin === 'function' &&
    otherAccessibleBuildings.length > 0
  );

  useEffect(() => {
    setIsSwitcherOpen(false);
  }, [state?.currentBuildingId, state?.isPortfolioView]);

  useEffect(() => {
    if (!isSwitcherOpen) return;
    const handleOutsideClick = (event) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target)) {
        setIsSwitcherOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsSwitcherOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSwitcherOpen]);

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

  const homeTooltip = title || (isEn ? "Back to Main Menu" : "Vissza a főmenübe");

  const titleBadges = (
    <>
      {isViewer && isInBuilding && !hideViewerBadge && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex-shrink-0">
          <Eye className="w-2.5 h-2.5 text-amber-600" />
          <span>{isHu ? 'Csak megtekintő' : 'View only'}</span>
        </span>
      )}
      {isSzvbMode && isInBuilding && !hideViewerBadge && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex-shrink-0">
          <Shield className="w-2.5 h-2.5 text-indigo-600" />
          <span>SZVB</span>
        </span>
      )}
      {isAuditorMode && isInBuilding && !hideViewerBadge && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex-shrink-0">
          <ClipboardCheck className="w-2.5 h-2.5 text-teal-600" />
          <span>{isHu ? 'Gazdasági ellenőr' : 'Financial Auditor'}</span>
        </span>
      )}
    </>
  );

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 select-none flex-shrink-0 min-w-0">
      {/* Logo icon: always triggers original Back to Home / Close modal action */}
      <button
        type="button"
        onClick={onClick}
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 flex-shrink-0 cursor-pointer focus:outline-none"
        title={homeTooltip}
        aria-label={homeTooltip}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4"/>
          <path d="M10 10h4"/>
          <path d="M10 14h4"/>
          <path d="M10 18h4"/>
        </svg>
      </button>

      {/* Building name: inline dropdown switcher when KK manages >1 building; otherwise returns to Home */}
      {canSwitchBuildings ? (
        <div className="relative min-w-0 max-w-[240px] sm:max-w-[300px] md:max-w-[400px]" ref={switcherRef}>
          <button
            type="button"
            onClick={() => setIsSwitcherOpen((prev) => !prev)}
            aria-expanded={isSwitcherOpen}
            aria-haspopup="menu"
            title={t?.header_switch_building_hint || (isEn ? "Switch condominium" : "Váltás másik társasházra")}
            className={`flex flex-col text-left min-w-0 max-w-full rounded-lg px-1.5 -mx-1.5 py-0.5 transition-colors cursor-pointer group focus:outline-none ${
              isSwitcherOpen ? 'bg-blue-50/80' : 'hover:bg-gray-100/80'
            }`}
          >
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-gray-900 leading-tight font-display truncate group-hover:text-[#1E3A8A] transition-colors">
                {displayTitle}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 group-hover:text-[#1E3A8A] transition-transform duration-150 flex-shrink-0 ${
                  isSwitcherOpen ? 'rotate-180 text-[#1E3A8A]' : ''
                }`}
              />
              {titleBadges}
            </div>
            <span className="text-[10px] text-gray-500 font-medium hidden sm:inline">
              {isEn ? "Switch condominium" : "Társasház váltás"}
            </span>
          </button>

          {isSwitcherOpen && (
            <div
              role="menu"
              className="absolute left-0 mt-2 w-[min(19rem,calc(100vw-2rem))] sm:w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-[90] overflow-hidden animate-fadeIn"
            >
              <div className="p-2">
                <div className="px-2 pt-0.5 pb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t?.header_other_buildings || (isHu ? "További társasházak" : "Other Condominiums")}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">
                    {otherAccessibleBuildings.length}
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {otherAccessibleBuildings.map((b) => {
                    const bIsViewer =
                      isUserBuildingViewer(state?.currentUser, b, state?.organizations, state?.buildings) ||
                      !canUserManageBuilding(state?.currentUser, b, state?.organizations, state?.buildings);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsSwitcherOpen(false);
                          openBuildingAdmin(b.id);
                          if (onClick) onClick();
                        }}
                        className="w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-transparent bg-white hover:bg-blue-50/70 hover:border-blue-200/70 text-gray-800 text-left transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Building2 className="w-4 h-4 text-gray-400 group-hover:text-[#1E3A8A] flex-shrink-0 transition-colors" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-gray-800 group-hover:text-[#1E3A8A] truncate transition-colors">
                              {b.name}
                            </div>
                            {b.address && (
                              <div className="text-[11px] text-gray-500 truncate">
                                {b.address}
                              </div>
                            )}
                          </div>
                        </div>
                        {bIsViewer && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold inline-flex items-center gap-0.5 flex-shrink-0">
                            <Eye className="w-2.5 h-2.5 text-amber-600" />
                            <span>{isHu ? 'Megtekintő' : 'Viewer'}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="flex flex-col text-left min-w-0 max-w-[240px] sm:max-w-[300px] md:max-w-[400px] cursor-pointer focus:outline-none transition-opacity hover:opacity-90"
          title={homeTooltip}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-gray-900 leading-tight font-display truncate">
              {displayTitle}
            </span>
            {titleBadges}
          </div>
          <span className="text-[10px] text-gray-500 font-medium hidden sm:inline">
            {isEn ? "← Back to Home" : "← Főmenü"}
          </span>
        </button>
      )}
    </div>
  );
}
