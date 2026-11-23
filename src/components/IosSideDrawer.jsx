import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Building2, 
  LayoutDashboard, 
  LineChart, 
  FolderOpen, 
  User, 
  LogOut, 
  ChevronRight,
  Home,
  ShieldAlert,
  FileSpreadsheet,
  Calendar,
  Settings,
  Users
} from 'lucide-react';
import { canUserManageTeam } from '../utils/teamPermissions';

export function IosSideDrawer({ 
  isOpen, 
  onClose, 
  onSelectOption 
}) {
  const { state, t, logout, getUserFlats, exitImpersonation } = useApp();
  const { currentUser, buildings, currentBuildingId, currentLang, impersonatedFrom, organizations, repProfile } = state;

  const isHu = currentLang === 'hu' || !currentLang;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const canManageTeam = canUserManageTeam(currentUser, organizations, buildings);
  const userDisplayName = currentUser?.name || repProfile?.name || currentUser?.email || (isHu ? 'Közös Képviselő' : 'Property Manager');

  // Determine dynamic mode: Portfolio Mode (All buildings aggregated) vs. Building-Specific Mode
  const isPortfolioMode = isAdmin && (Boolean(state.isPortfolioView) || !currentBuildingId);
  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || (isPortfolioMode ? null : (buildings && buildings[0]));

  const myFlats = getUserFlats ? getUserFlats(currentUser, buildings) : [];
  const profileLabel = isAdmin 
    ? (t.menu_account_settings || "Fiók / Rendszerbeállítások") 
    : (myFlats.length > 1 ? (t.menu_my_flats || "Profilom / Lakásaim") : (t.menu_my_flat || "Profilom / Lakásom"));
  const ProfileIcon = isAdmin ? Settings : (myFlats.length > 1 ? Home : User);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  const handleAction = (action) => {
    onClose();
    if (action === 'logout') {
      onSelectOption('logout');
      logout();
    } else {
      onSelectOption(action);
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[70] overflow-hidden transition-all duration-200 ${
        isOpen ? 'visible' : 'invisible pointer-events-none'
      }`}
    >
      {/* Backdrop: High-performance GPU opacity */}
      <div 
        className={`fixed inset-0 bg-slate-900/50 transition-opacity duration-200 ease-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={onClose} 
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex pr-10">
        <div 
          className={`w-screen max-w-[320px] sm:max-w-sm bg-white shadow-2xl flex flex-col transform transition-transform duration-200 ease-out will-change-transform ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-bold flex-shrink-0 shadow-2xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate">
                  {isAdmin
                    ? (isPortfolioMode ? (t.portfolio_title || "Társasházaim") : (currentBuilding?.name || (isHu ? "Társasház" : "Condominium")))
                    : (currentBuilding ? currentBuilding.name : (t.app_title || "Társasházkezelő"))}
                </h3>
                <span className="text-xs text-gray-500 font-medium block truncate">
                  {currentUser ? (
                    isAdmin ? userDisplayName : 
                    `${currentUser.flatNum}. ${isHu ? 'lakás' : 'flat'}`
                  ) : 'Menü'}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0 cursor-pointer"
              title={isHu ? "Bezárás" : "Close"}
              aria-label={isHu ? "Bezárás" : "Close"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Navigation Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* If acting as another user, show prominent return button */}
            {impersonatedFrom && (
              <button
                onClick={() => {
                  handleAction('main');
                  exitImpersonation();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs shadow-md transition-all group cursor-pointer hover:from-amber-600 hover:to-amber-700"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-100" />
                  <span>{t.return_to_superadmin || "Visszalépés a Rendszergazdához"}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-200 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {/* A) PORTFOLIO MODE (When no active building is selected, or portfolio view is active) */}
            {isAdmin && isPortfolioMode && (
              <div className="space-y-3">
                <div className="bg-gray-50/80 rounded-2xl p-2 border border-gray-100 space-y-1">
                  
                  {/* 1. Társasházaim áttekintése (Portfólió kártyás nézet) */}
                  <button
                    onClick={() => handleAction('portfolio')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white bg-blue-50/50 transition-all text-left group cursor-pointer border border-blue-100/70"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shadow-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900 block leading-tight">
                          {t.menu_portfolio_overview || (isHu ? "Társasházaim áttekintése" : "My Condos Overview")}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium block">
                          {isHu ? "Portfólió kártyás nézet" : "Portfolio card view"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 2. Naptár & Feladatok (Az összes ház eseményei összesítve) */}
                  <button
                    onClick={() => handleAction('calendar')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-800 block leading-tight">
                          {t.menu_calendar_and_tasks || (isHu ? "Naptár & Feladatok" : "Calendar & Tasks")}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium block">
                          {isHu ? "Összes ház eseményei" : "All buildings aggregated"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 2b. Csapat & Jogosultságok (Tulajdonos & jogosult munkatárs) */}
                  {canManageTeam && (
                    <button
                      onClick={() => handleAction('team')}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-800 block leading-tight">
                            {t.team_btn_label || (isHu ? "Csapat & Jogosultságok" : "Team & Permissions")}
                          </span>
                          <span className="text-[11px] text-gray-500 font-medium block">
                            {isHu ? "Munkatársak és házak kiosztása" : "Assign colleagues & buildings"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}

                  {/* 3. Fiók / Rendszerbeállítások */}
                  <button
                    onClick={() => handleAction('profile')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shadow-xs">
                        <Settings className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {t.menu_account_settings || (isHu ? "Fiók / Rendszerbeállítások" : "Account / System Settings")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                </div>
              </div>
            )}

            {/* B) BUILDING-SPECIFIC MODE (When Common Representative is inside a specific building) */}
            {isAdmin && !isPortfolioMode && (
              <div className="space-y-3">
                {/* House-Specific Modules */}
                <div className="bg-gray-50/80 rounded-2xl p-2 border border-gray-100 space-y-1">
                  
                  {/* 🏠 Főmenü (Dashboard) */}
                  <button
                    onClick={() => handleAction('main')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-xs">
                        <LayoutDashboard className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {t.menu_main || (isHu ? "Főmenü" : "Main Menu")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 💳 A ház pénzügyi helyzete */}
                  <button
                    onClick={() => handleAction('finance')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                        <LineChart className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{t.menu_finance}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 👥 Lakások adatai */}
                  <button
                    onClick={() => handleAction('flats-data')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-xs">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {t.menu_flats_data || (isHu ? "Lakások adatai" : "Flats Data")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 📝 Közgyűlés */}
                  <button
                    onClick={() => handleAction('assembly')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {t.menu_assembly || (isHu ? "Közgyűlés" : "General Assembly")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* 📂 Dokumentumok */}
                  <button
                    onClick={() => handleAction('docs')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{t.menu_docs}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* ⚙️ Ház adatai & Bank */}
                  <button
                    onClick={() => handleAction('building-settings')}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shadow-xs">
                        <Settings className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {t.bld_settings_btn || (isHu ? "Ház adatai & Bank" : "Building Details & Bank")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                </div>
              </div>
            )}

            {/* C) RESIDENT / TENANT MODE */}
            {!isAdmin && (
              <div className="bg-gray-50/80 rounded-2xl p-2 border border-gray-100 space-y-1">
                
                {/* Főmenü */}
                <button
                  onClick={() => handleAction('main')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-xs">
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{t.menu_main}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* A ház pénzügyi helyzete */}
                <button
                  onClick={() => handleAction('finance')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                      <LineChart className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{t.menu_finance}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Dokumentumok */}
                <button
                  onClick={() => handleAction('docs')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{t.menu_docs}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Lakásom / Lakásaim */}
                <button
                  onClick={() => handleAction('profile')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shadow-xs">
                      <ProfileIcon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{profileLabel}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

              </div>
            )}

            {/* Logout Group (Common to all) */}
            <div className="bg-gray-50/80 rounded-2xl p-2 border border-gray-100">
              <button
                onClick={() => handleAction('logout')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-50/70 transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-xs">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-red-600">{t.logout}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-gray-100 text-center text-xs text-gray-400 bg-gray-50/50">
            Társasházkezelő Portál &bull; React
          </div>
        </div>
      </div>
    </div>
  );
}
