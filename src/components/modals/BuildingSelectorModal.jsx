import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, Users, Plus, Check, Building2, Shield, Home, LayoutGrid } from 'lucide-react';
import { useBackdropClose } from '../../utils/useBackdropClose';

export function BuildingSelectorModal({ isOpen, onClose, onOpenAddBuilding, onGoPortfolio, onProfileSwitched }) {
  const { state, t, switchBuilding, openBuildingAdmin, quickLogin, switchActiveFlat, getUserFlats, showToast } = useApp();
  const { buildings, currentBuildingId, users, currentUser, currentLang, isPortfolioView } = state;
  const isEn = currentLang === 'en';

  const backdropProps = useBackdropClose(onClose);

  if (!isOpen || !currentUser) return null;

  const userEmail = (currentUser.email || "").toLowerCase().trim();
  const isAdminAuthorized = (
    currentUser?.isAdminUser === true ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    Boolean(userEmail && (users || []).some(u => u.email && u.email.toLowerCase().trim() === userEmail && (u.role === 'admin' || u.role === 'superadmin')))
  );

  const handleSelectBuilding = (buildingId) => {
    if (isAdminAuthorized && typeof openBuildingAdmin === 'function') {
      openBuildingAdmin(buildingId);
    } else {
      switchBuilding(buildingId);
    }
    if (onProfileSwitched) onProfileSwitched();
    onClose();
  };

  const handleSelectProfile = (profile) => {
    if (profile.isAdmin) {
      if (!isAdminAuthorized) return;
      const adminUser = (users || []).find(u => (u.role === 'admin' || u.role === 'superadmin') && u.email?.toLowerCase().trim() === userEmail) ||
                        (users || []).find(u => u.role === 'admin' || u.role === 'superadmin') || {
                          id: "admin",
                          name: currentUser.name || (isEn ? "Common Representative" : "Közös Képviselő"),
                          email: userEmail,
                          role: "admin",
                          flatNum: "0"
                        };
      quickLogin({
        ...adminUser,
        id: adminUser.id || "admin",
        name: adminUser.name || currentUser.name || (isEn ? "Common Representative" : "Közös Képviselő"),
        email: userEmail || adminUser.email || "",
        role: adminUser.role === 'superadmin' ? 'superadmin' : 'admin',
        flatNum: "0",
        buildingId: profile.buildingId || currentBuildingId || (buildings?.[0]?.id || null),
        isAdminUser: true
      });
      showToast(isEn ? "Switched to Common Representative" : "Átváltva: Közös Képviselő");
    } else {
      switchActiveFlat(profile.flatNum, profile.buildingId);
    }
    if (onProfileSwitched) onProfileSwitched();
    onClose();
  };

  // Build the list of profiles belonging STRICTLY to this user's current role
  const myProfiles = [];

  // 1. If Common Representative, strictly only Representative context - NEVER resident apartments!
  if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') {
    const curBuilding = (buildings || []).find(b => b.id === currentBuildingId) || (buildings || [])[0];
    const adminUser = (users || []).find(u => (u.role === 'admin' || u.role === 'superadmin') && u.email?.toLowerCase().trim() === userEmail) ||
                      (users || []).find(u => u.role === 'admin' || u.role === 'superadmin');
    const adminName = adminUser?.name || currentUser?.name || (isEn ? "Common Representative" : "Közös Képviselő");
    myProfiles.push({
      ...(adminUser || {}),
      id: adminUser?.id || "admin",
      name: adminName,
      email: userEmail || adminUser?.email || "",
      role: adminUser?.role === 'superadmin' ? 'superadmin' : 'admin',
      flatNum: "0",
      buildingId: curBuilding?.id || null,
      label: isEn ? "Common Representative" : "Közös Képviselő",
      sublabel: curBuilding?.name || t.building_address,
      isAdmin: true,
      isAdminUser: true
    });
  } else {
    // 2. If Owner, strictly only resident apartments belonging to this resident - NEVER Common Representative!
    const userFlats = getUserFlats(currentUser, buildings);
    userFlats.forEach(f => {
      myProfiles.push({
        id: `${f.buildingId}-${f.flatNum}`,
        name: f.ownerName,
        email: f.email || userEmail,
        role: "Owner",
        flatNum: f.flatNum,
        buildingId: f.buildingId,
        label: `${f.flatNum}. ${isEn ? "Flat" : "lakás"}`,
        sublabel: f.buildingName,
        share: f.share,
        isAdmin: false
      });
    });
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            {isAdminAuthorized ? (
              <Building2 className="w-4 h-4 text-[#1E3A8A]" />
            ) : (
              <Users className="w-4 h-4 text-[#1E3A8A]" />
            )}
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {isAdminAuthorized
                ? (t.switch_building_btn || (isEn ? "Switch Building" : "Társasház váltás"))
                : t.profile_selector_btn}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">

          {/* Return to Portfolio Overview (Admin inside a building) */}
          {isAdminAuthorized && !isPortfolioView && onGoPortfolio && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoPortfolio();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 text-left transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-gray-900 group-hover:text-[#1E3A8A] truncate">
                  {t.portfolio_back_to_buildings || (isEn ? "My Condos (Portfolio)" : "Társasházaim (Portfólió)")}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {t.header_portfolio_view_desc || (isEn ? "Overview of all managed condominiums" : "Összes kezelt társasház áttekintése")}
                </div>
              </div>
            </button>
          )}
          
          {/* Condominiums List (if admin) */}
          {isAdminAuthorized && (buildings || []).length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                {t.select_building}
              </span>
              <div className="space-y-1.5">
                {(buildings || []).map((b) => {
                  const isActive = b.id === currentBuildingId;
                  return (
                    <button
                      key={b.id}
                      onClick={() => handleSelectBuilding(b.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-blue-50/70 border-[#1E3A8A] text-[#1E3A8A] font-bold' 
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4" />
                        <div className="text-xs">
                          <div>{b.name}</div>
                          <div className="text-[10px] text-gray-400 font-normal">{b.address}</div>
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-[#1E3A8A]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* User's Own Profiles (Only for Resident / Owner) */}
          {!isAdminAuthorized && (
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                {isEn ? "Your Apartments" : "Saját lakásaid"}
              </span>
              
              {myProfiles.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-500">
                  {isEn ? "No other apartments found for this account." : "Nincs más lakás társítva ehhez a fiókhoz."}
                </div>
              ) : (
                <div className="space-y-2">
                  {myProfiles.map((p) => {
                    const isSelected = currentUser.role !== 'admin' && currentUser.flatNum === p.flatNum && currentUser.buildingId === p.buildingId;

                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProfile(p)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-[#1E3A8A] text-[#1E3A8A] shadow-xs'
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-blue-500">
                            <Home className="w-4 h-4" />
                          </div>
                          <div className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{p.label}</span>
                              {p.share && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100/70 text-[#1E3A8A]">
                                  {p.share}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium">{p.sublabel}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#1E3A8A] stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Admin Add Building Action */}
          {isAdminAuthorized && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  onClose();
                  onOpenAddBuilding();
                }}
                className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.add_building_title}</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
