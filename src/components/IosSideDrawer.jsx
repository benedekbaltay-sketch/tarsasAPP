import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Building2, 
  LayoutDashboard, 
  LineChart, 
  Landmark, 
  FolderOpen, 
  User, 
  Users, 
  LogOut, 
  ChevronRight,
  Home
} from 'lucide-react';

export function IosSideDrawer({ 
  isOpen, 
  onClose, 
  onSelectOption 
}) {
  const { state, t, logout } = useApp();
  const { currentUser, buildings, currentBuildingId, currentLang } = state;

  if (!isOpen) return null;

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];
  const isHu = currentLang === 'hu' || !currentLang;

  const handleAction = (action) => {
    onClose();
    if (action === 'logout') {
      logout();
    } else {
      onSelectOption(action);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-fadeIn" 
        onClick={onClose} 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-white shadow-2xl flex flex-col transform transition-transform animate-slideLeft">
          
          {/* Drawer Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 truncate max-w-[200px]">
                  {currentBuilding ? currentBuilding.name : t.app_title}
                </h3>
                <span className="text-xs text-gray-500 font-medium">
                  {currentUser ? (currentUser.role === 'admin' ? (isHu ? 'Közös Képviselet' : 'Property Management') : `${currentUser.flatNum}. ${isHu ? 'lakás' : 'flat'}`) : 'Menü'}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
              title="Bezárás"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Navigation List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Main Menu Group */}
            <div className="bg-gray-50/80 rounded-2xl p-2 border border-gray-100 space-y-1">
              
              {/* Main Dashboard */}
              <button
                onClick={() => handleAction('main')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-sm">
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{t.menu_main}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Building Financial Situation */}
              <button
                onClick={() => handleAction('finance')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                    <LineChart className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{t.menu_finance}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Admin only: Flats Data Master Directory */}
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => handleAction('flats-data')}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-sm">
                      <Home className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">
                      {isHu ? "Lakások adatai" : "Flats Data"}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Loans */}
              <button
                onClick={() => handleAction('loans')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center shadow-sm">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{t.menu_loans}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Documents */}
              <button
                onClick={() => handleAction('docs')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{t.menu_docs}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Profile */}
              <button
                onClick={() => handleAction('profile')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{t.menu_profile}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Profile Switcher */}
              <button
                onClick={() => handleAction('profile-switcher')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all text-left group sm:hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shadow-sm">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{t.profile_selector_btn}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Logout Group */}
            <div className="bg-gray-50/80 rounded-2xl p-2 border border-gray-100">
              <button
                onClick={() => handleAction('logout')}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-50/70 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-sm">
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
