import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Menu, Building2, Calendar, ChevronDown, Eye, Shield, ClipboardCheck } from 'lucide-react';
import { ProfileSwitcherButton } from './ProfileSwitcherButton';
import { ImpersonationBanner } from './ImpersonationBanner';
import { CloudSyncBadge } from './CloudSyncBadge';
import { FlagIcon } from './FlagIcon';
import { NotificationBell } from './NotificationBell';
import { getAccessibleBuildings, isUserBuildingViewer, canUserManageBuilding, resolveUserDisplayName } from '../utils/teamPermissions';
import { getUserBuildingSzvbRole } from '../utils/szvb';
import { getBuildingAlerts } from '../utils/buildingAlerts';

export function Header({ 
  onOpenDrawer, 
  onOpenProfileSelector, 
  onGoHome, 
  onGoPortfolio,
  onSelectBuilding,
  onOpenCalendar,
  onOpenCommunicationCenter
}) {
  const { state, t, toggleLanguage } = useApp();
  const { currentUser, currentLang, buildings, currentBuildingId, isPortfolioView, organizations, repProfile } = state;

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);
  const headerContainerRef = useRef(null);

  useEffect(() => {
    const el = headerContainerRef.current;
    if (!el) return;
    const updateHeaderHeight = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        document.documentElement.style.setProperty('--app-header-height', `${h}px`);
      }
    };
    updateHeaderHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateHeaderHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [state.isImpersonating]);

  useEffect(() => {
    setIsSwitcherOpen(false);
  }, [currentBuildingId, isPortfolioView]);

  useEffect(() => {
    if (!isSwitcherOpen) return;

    const handleOutsideClick = (event) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target)) {
        setIsSwitcherOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSwitcherOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSwitcherOpen]);

  if (!currentUser) return null;

  const accessibleBuildings = getAccessibleBuildings(currentUser, buildings || [], organizations || []);
  const currentBuilding = (accessibleBuildings || []).find(b => b.id === currentBuildingId) || (buildings || []).find(b => b.id === currentBuildingId) || accessibleBuildings[0] || buildings[0];
  const isHu = currentLang === 'hu' || !currentLang;
  const isEn = !isHu;

  const isCurrentlyAdminMode = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const isInBuilding = Boolean(currentBuilding && (!isCurrentlyAdminMode || (!isPortfolioView && currentBuildingId)));
  const isViewer = isCurrentlyAdminMode && (
    isUserBuildingViewer(currentUser, currentBuilding, organizations, buildings) ||
    !canUserManageBuilding(currentUser, currentBuilding, organizations, buildings)
  );
  const activeBuildingAlerts = (isCurrentlyAdminMode && isInBuilding && !isPortfolioView && currentBuilding)
    ? getBuildingAlerts(currentBuilding, { user: currentUser, organizations, buildings })
    : [];

  const userDisplayName = resolveUserDisplayName(currentUser, state);

  // Primary header title: active condominium name when inside a building; portfolio/app title otherwise
  const headerTitle = isInBuilding
    ? currentBuilding.name
    : (isCurrentlyAdminMode
        ? (t.portfolio_title || (isHu ? "Társasházaim" : "My Condominiums"))
        : t.app_title);

  // Secondary subtitle under title: display the profile user's name cleanly (role is shown in the pill badge)
  const isSzvbMode = currentUser.role === 'szvb';
  const isAuditorMode = currentUser.role === 'auditor';

  const headerSubtitle = (isCurrentlyAdminMode || isSzvbMode || isAuditorMode)
    ? userDisplayName
    : (currentUser.flatNum ? `${currentUser.flatNum}. ${isHu ? 'lakás' : 'flat'}` : (t.building_address || ''));

  const otherAccessibleBuildings = (accessibleBuildings || []).filter(
    (b) => b && b.id !== currentBuilding?.id
  );
  const canSwitchBuildings = Boolean(
    isCurrentlyAdminMode &&
    isInBuilding &&
    !isPortfolioView &&
    onSelectBuilding &&
    otherAccessibleBuildings.length > 0
  );
  const logoClickHandler = isCurrentlyAdminMode && !isPortfolioView && onGoPortfolio ? onGoPortfolio : onGoHome;
  const logoTooltip =
    isCurrentlyAdminMode && !isPortfolioView && onGoPortfolio
      ? (t.portfolio_back_to_buildings || (isHu ? "Társasházaim (Portfólió)" : "My Condos (Portfolio)"))
      : (isHu ? "Kezdőlap" : "Home");

  const roleBadges = (
    <>
      {isViewer && isInBuilding && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex-shrink-0">
          <Eye className="w-2.5 h-2.5 text-amber-600" />
          <span>{isHu ? 'Csak megtekintő' : 'View only'}</span>
        </span>
      )}
      {isSzvbMode && isInBuilding && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex-shrink-0">
          <Shield className="w-2.5 h-2.5 text-indigo-600" />
          <span>SZVB</span>
        </span>
      )}
      {isAuditorMode && isInBuilding && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex-shrink-0">
          <ClipboardCheck className="w-2.5 h-2.5 text-teal-600" />
          <span>{isHu ? 'Gazdasági ellenőr' : 'Financial Auditor'}</span>
        </span>
      )}
    </>
  );

  return (
    <div ref={headerContainerRef} className="sticky top-0 z-30 w-full shadow-sm">
      <ImpersonationBanner onExit={onGoHome} />
      <header className="w-full bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between">
        {/* Left: Menu Trigger, Logo (Home/Portfolio), & Building Name (Inline Switcher when >1 KK building) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 mr-2">
          {/* iOS Drawer Menu Trigger */}
          <button
            type="button"
            onClick={onOpenDrawer}
            className="relative w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
            title={isHu ? "Menü megnyitása" : "Open Menu"}
            aria-label={isHu ? "Menü megnyitása" : "Open Menu"}
          >
            <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
            {activeBuildingAlerts.length > 0 && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white"
                aria-hidden="true"
              />
            )}
          </button>

          <div className="flex items-center gap-2 sm:gap-3 select-none min-w-0">
            {/* Logo button: always preserves original Home / Portfolio navigation */}
            <button
              type="button"
              onClick={logoClickHandler}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 flex-shrink-0 cursor-pointer focus:outline-none"
              title={logoTooltip}
              aria-label={logoTooltip}
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

            {/* Building Name & Subtitle: inline dropdown switcher when KK manages >1 building */}
            {canSwitchBuildings ? (
              <div className="relative min-w-0" ref={switcherRef}>
                <button
                  type="button"
                  onClick={() => setIsSwitcherOpen((prev) => !prev)}
                  aria-expanded={isSwitcherOpen}
                  aria-haspopup="menu"
                  title={t.header_switch_building_hint || (isHu ? "Váltás másik társasházra" : "Switch condominium")}
                  className={`flex flex-col text-left min-w-0 rounded-lg px-1.5 -mx-1.5 py-0.5 transition-colors cursor-pointer group focus:outline-none ${
                    isSwitcherOpen ? 'bg-blue-50/80' : 'hover:bg-gray-100/80'
                  }`}
                >
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    <h1 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 group-hover:text-[#1E3A8A] leading-tight font-display truncate transition-colors">
                      {headerTitle}
                    </h1>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 group-hover:text-[#1E3A8A] transition-transform duration-150 flex-shrink-0 ${
                        isSwitcherOpen ? 'rotate-180 text-[#1E3A8A]' : ''
                      }`}
                    />
                    {roleBadges}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] sm:text-xs text-gray-500 font-medium truncate max-w-[120px] xs:max-w-[170px] sm:max-w-[220px] md:max-w-none">
                      {headerSubtitle}
                    </span>
                  </div>
                </button>

                {isSwitcherOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-2 w-[min(19rem,calc(100vw-2rem))] sm:w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden animate-fadeIn"
                  >
                    <div className="p-2">
                      <div className="px-2 pt-0.5 pb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {t.header_other_buildings || (isHu ? "További társasházak" : "Other Condominiums")}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">
                          {otherAccessibleBuildings.length}
                        </span>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-1">
                        {otherAccessibleBuildings.map((b) => {
                          const bIsViewer =
                            isUserBuildingViewer(currentUser, b, organizations, buildings) ||
                            !canUserManageBuilding(currentUser, b, organizations, buildings);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setIsSwitcherOpen(false);
                                onSelectBuilding(b.id);
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
                onClick={logoClickHandler}
                className="flex flex-col text-left min-w-0 cursor-pointer focus:outline-none"
                title={logoTooltip}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <h1 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 leading-tight font-display truncate">
                    {headerTitle}
                  </h1>
                  {roleBadges}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] sm:text-xs text-gray-500 font-medium truncate max-w-[120px] xs:max-w-[170px] sm:max-w-[220px] md:max-w-none">
                    {headerSubtitle}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Right: Cloud Sync Badge, Calendar, Notifications, Role Switcher, Language toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 flex-shrink-0">
          <CloudSyncBadge hideWhenSynced={true} />

          {/* Quick Calendar button in Header (Admins only, hidden for residents) */}
          {isCurrentlyAdminMode && onOpenCalendar && (
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

          {/* Universal Notification Bell & Mail Hub trigger (available to ALL authenticated profiles) */}
          <NotificationBell onOpenCommunicationCenter={onOpenCommunicationCenter} />

          {/* Unified Profile Switcher (visible across ALL modes whenever user holds >1 profile: KK / Owner / SZVB, with cross-profile unread red dot) */}
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
