import React from 'react';
import { useApp } from '../context/AppContext';
import { Menu, Building2, Home, Shield, Calendar } from 'lucide-react';
import { ProfileSwitcherButton } from './ProfileSwitcherButton';
import { ImpersonationBanner } from './ImpersonationBanner';
import { CloudSyncBadge } from './CloudSyncBadge';
import { FlagIcon } from './FlagIcon';

export function Header({ 
  onOpenDrawer, 
  onOpenProfileSelector, 
  onGoHome, 
  onGoPortfolio,
  onOpenCalendar
}) {
  const { state, t, toggleLanguage } = useApp();
  const { currentUser, currentLang, buildings, currentBuildingId, isPortfolioView } = state;

  if (!currentUser) return null;

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];
  const isHu = currentLang === 'hu' || !currentLang;
  const isEn = !isHu;

  const isCurrentlyAdminMode = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  // Subtitle in header
  const headerSubtitle = isCurrentlyAdminMode
    ? ((isPortfolioView || !currentBuildingId) ? (t.portfolio_title || "Társasházaim") : (currentBuilding ? currentBuilding.name : t.building_address))
    : (currentBuilding ? `${currentBuilding.name} • ${currentUser.flatNum}. ${isHu ? 'lakás' : 'flat'}` : (currentUser.flatNum ? `${currentUser.flatNum}. ${isHu ? 'lakás' : 'flat'}` : t.building_address));

  return (
    <div className="sticky top-0 z-30 w-full shadow-sm">
      <ImpersonationBanner onExit={onGoHome} />
      <header className="w-full bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between">
        {/* Left: Menu Trigger & Logo / Building Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 mr-2">
          {/* iOS Drawer Menu Trigger */}
          <button
            type="button"
            onClick={onOpenDrawer}
            className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
            title={isHu ? "Menü megnyitása" : "Open Menu"}
            aria-label={isHu ? "Menü megnyitása" : "Open Menu"}
          >
            <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
          </button>

          <div 
            onClick={isCurrentlyAdminMode && !isPortfolioView && onGoPortfolio ? onGoPortfolio : onGoHome}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none group min-w-0"
            title={isHu ? "Kezdőlap" : "Home"}
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
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 leading-tight font-display truncate">
                {t.app_title}
              </h1>
              <span className="text-[11px] sm:text-xs text-gray-500 font-medium truncate max-w-[120px] xs:max-w-[170px] sm:max-w-[220px] md:max-w-none">
                {headerSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cloud Sync Badge, Role Switchers, Language toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 flex-shrink-0">
          <CloudSyncBadge />

          {/* Quick Return to Portfolio (when inside building in KK mode) */}
          {isCurrentlyAdminMode && !isPortfolioView && onGoPortfolio && (
            <button
              onClick={onGoPortfolio}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs shadow-2xs transition-all hover:border-gray-300 cursor-pointer"
              title={isHu ? "Visszalépés a társasházaim listájához" : "Back to my condominiums"}
            >
              <Building2 className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span className="hidden md:inline">{t.portfolio_back_to_buildings || "Társasházaim"}</span>
            </button>
          )}

          {/* Quick Calendar button in Header */}
          {onOpenCalendar && (
            <button
              type="button"
              onClick={onOpenCalendar}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#1E3A8A] font-semibold text-xs shadow-2xs transition-all hover:border-blue-300 cursor-pointer active:scale-95"
              title={isHu ? "Naptár és Feladatok" : "Calendar & Tasks"}
            >
              <Calendar className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
              <span className="hidden lg:inline">{isHu ? "Naptár" : "Calendar"}</span>
            </button>
          )}

          {/* Profile Switcher (for multi-flat residents) */}
          <ProfileSwitcherButton onOpenProfileSelector={onOpenProfileSelector} />

          {/* Language Flag Switcher */}
          <button
            onClick={toggleLanguage}
            className="w-9 h-8 sm:w-10 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center shadow-xs transition-all flex-shrink-0 cursor-pointer hover:border-gray-300"
            title={isHu ? "Switch to English" : "Váltás magyar nyelvre"}
          >
            <FlagIcon
              country={isHu ? "gb" : "hu"}
              className="w-5 h-3.5 sm:w-6 sm:h-4 rounded-[2px] shadow-2xs border border-black/15"
            />
          </button>
        </div>
      </header>
    </div>
  );
}
