import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Users, Plus, Check, Building2, Shield, Home, LayoutGrid } from 'lucide-react';
import { useBackdropClose } from '../../utils/useBackdropClose';
import { getAccessibleBuildings, canUserCreateBuilding } from '../../utils/teamPermissions';
import {
  resolveUserProfiles,
  getActiveProfileKey,
  getUnreadNotificationCountsByProfile,
} from '../../utils/userProfiles';

export function BuildingSelectorModal({ isOpen, onClose, onOpenAddBuilding, onGoPortfolio, onProfileSwitched }) {
  const {
    state,
    t,
    openBuildingAdmin,
    switchToKkMode,
    switchToTenantMode,
    switchToSzvbMode,
  } = useApp();
  const { buildings, currentBuildingId, users, currentUser, currentLang, isPortfolioView, organizations, notifications } = state;
  const isEn = currentLang === 'en';

  const backdropProps = useBackdropClose(onClose);

  const { kkProfile, szvbProfiles, ownerProfiles, allProfiles } = useMemo(
    () => resolveUserProfiles(currentUser, { buildings, organizations, users }),
    [currentUser, buildings, organizations, users]
  );

  const { unreadByProfile } = useMemo(
    () => getUnreadNotificationCountsByProfile(notifications || [], currentUser, allProfiles),
    [notifications, currentUser, allProfiles]
  );

  if (!isOpen || !currentUser) return null;

  const activeProfileKey = getActiveProfileKey(currentUser);
  const isCurrentlyKkMode = currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const accessibleBuildings = isCurrentlyKkMode
    ? getAccessibleBuildings(currentUser, buildings || [], organizations || [])
    : [];
  const canCreateBuilding = isCurrentlyKkMode && canUserCreateBuilding(currentUser, organizations, buildings);

  const finishSwitch = () => {
    if (onProfileSwitched) onProfileSwitched();
    onClose();
  };

  const handleSelectKkProfile = () => {
    if (!kkProfile) return;
    if (activeProfileKey !== 'kk') {
      switchToKkMode();
    } else if (!isPortfolioView && onGoPortfolio) {
      onGoPortfolio();
    }
    finishSwitch();
  };

  const handleSelectOwnerProfile = (profile) => {
    switchToTenantMode(profile.flatNum, profile.buildingId);
    finishSwitch();
  };

  const handleSelectSzvbProfile = (profile) => {
    switchToSzvbMode(profile.buildingId);
    finishSwitch();
  };

  const handleSelectBuilding = (buildingId) => {
    if (typeof openBuildingAdmin === 'function') {
      openBuildingAdmin(buildingId);
    }
    finishSwitch();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1E3A8A]" />
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {allProfiles.length > 1
                ? (t.profile_selector_btn || (isEn ? "Switch Profile" : "Profilváltás"))
                : (t.switch_building_btn || (isEn ? "Switch Building" : "Társasház váltás"))}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* 1. Common Representative (KK) Profile */}
          {kkProfile && (
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Building2 className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>{isEn ? "Common Representative" : "Közös Képviselet"}</span>
              </span>
              {(() => {
                const isSelected = activeProfileKey === 'kk';
                const unreadCount = unreadByProfile['kk'] || 0;
                return (
                  <button
                    type="button"
                    onClick={handleSelectKkProfile}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#1E3A8A] text-[#1E3A8A] shadow-xs'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white bg-[#1E3A8A] flex-shrink-0">
                        <LayoutGrid className="w-4 h-4" />
                        {unreadCount > 0 && !isSelected && (
                          <span
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="text-xs min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 truncate">
                            {isEn ? kkProfile.labelEn : kkProfile.labelHu}
                          </span>
                          {unreadCount > 0 && !isSelected && (
                            <span
                              className="w-2 h-2 rounded-full bg-red-600 shrink-0"
                              title={isEn ? `${unreadCount} unread` : `${unreadCount} olvasatlan`}
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium truncate">
                          {isEn ? kkProfile.sublabelEn : kkProfile.sublabelHu}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#1E3A8A] stroke-[2.5] flex-shrink-0" />}
                  </button>
                );
              })()}
            </div>
          )}

          {/* 2. Personal Apartments (Owner View) with attached Building SZVB Role directly underneath */}
          {(ownerProfiles.length > 0 || szvbProfiles.length > 0) && (() => {
            // Attach each SZVB profile once to its linked apartment in the same building
            const attachedSzvbByOwnerId = new Map();
            const attachedSzvbIds = new Set();

            szvbProfiles.forEach((szvb) => {
              const targetOwner =
                ownerProfiles.find((o) => o.id === szvb.linkedOwnerProfileId) ||
                ownerProfiles.find((o) => o.buildingId === szvb.buildingId && szvb.flatNum && String(o.flatNum) === String(szvb.flatNum)) ||
                ownerProfiles.find((o) => o.buildingId === szvb.buildingId);
              if (targetOwner && !attachedSzvbByOwnerId.has(targetOwner.id)) {
                attachedSzvbByOwnerId.set(targetOwner.id, szvb);
                attachedSzvbIds.add(szvb.id);
              }
            });

            const unattachedSzvbProfiles = szvbProfiles.filter((s) => !attachedSzvbIds.has(s.id));

            return (
              <>
                {ownerProfiles.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Home className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isEn ? "Your Apartments" : "Saját lakásaid"}</span>
                  </span>
                  <div className="space-y-2.5">
                    {ownerProfiles.map((p) => {
                      const isOwnerSelected = activeProfileKey === p.id;
                      const ownerUnreadCount = unreadByProfile[p.id] || 0;
                      const attachedSzvb = attachedSzvbByOwnerId.get(p.id) || null;
                      const isSzvbSelected = attachedSzvb ? activeProfileKey === attachedSzvb.id : false;
                      const szvbUnreadCount = attachedSzvb ? (unreadByProfile[attachedSzvb.id] || 0) : 0;
                      const isCardActive = isOwnerSelected || isSzvbSelected;

                      return (
                        <div
                          key={p.id}
                          className={`rounded-xl border overflow-hidden transition-all ${
                            isSzvbSelected
                              ? 'border-indigo-500 shadow-xs'
                              : isOwnerSelected
                              ? 'border-[#1E3A8A] shadow-xs'
                              : attachedSzvb
                              ? 'border-gray-200 hover:border-indigo-200'
                              : 'border-gray-200'
                          }`}
                        >
                          {/* Primary Row: Apartment (Owner View) */}
                          <button
                            type="button"
                            onClick={() => handleSelectOwnerProfile(p)}
                            className={`w-full flex items-center justify-between p-3 text-left transition-colors cursor-pointer ${
                              isOwnerSelected
                                ? 'bg-blue-50/80 text-[#1E3A8A]'
                                : 'bg-white hover:bg-gray-50 text-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white bg-blue-500 flex-shrink-0">
                                <Home className="w-4 h-4" />
                                {ownerUnreadCount > 0 && !isOwnerSelected && (
                                  <span
                                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 ring-2 ring-white"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              <div className="text-xs min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-gray-900">
                                    {isEn ? p.labelEn : p.labelHu}
                                  </span>
                                  {p.share && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100/70 text-[#1E3A8A]">
                                      {p.share}
                                    </span>
                                  )}
                                  {ownerUnreadCount > 0 && !isOwnerSelected && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-red-600 shrink-0"
                                      title={isEn ? `${ownerUnreadCount} unread` : `${ownerUnreadCount} olvasatlan`}
                                    />
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 font-medium truncate">
                                  {isEn ? p.sublabelEn : p.sublabelHu}
                                </div>
                              </div>
                            </div>
                            {isOwnerSelected && <Check className="w-4 h-4 text-[#1E3A8A] stroke-[2.5] flex-shrink-0" />}
                          </button>

                          {/* Attached Sub-Row: SZVB Audit View belonging to this building & apartment */}
                          {attachedSzvb && (
                            <button
                              type="button"
                              onClick={() => handleSelectSzvbProfile(attachedSzvb)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 pl-5 border-t text-left transition-colors cursor-pointer ${
                                isSzvbSelected
                                  ? 'bg-indigo-50/95 border-indigo-200 text-indigo-900'
                                  : 'bg-indigo-50/35 hover:bg-indigo-50/75 border-indigo-100/90 text-gray-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-indigo-400 font-bold text-xs select-none flex-shrink-0">↳</span>
                                <div className="relative w-7 h-7 rounded-lg flex items-center justify-center text-white bg-indigo-600 flex-shrink-0 shadow-2xs">
                                  <Shield className="w-3.5 h-3.5" />
                                  {szvbUnreadCount > 0 && !isSzvbSelected && (
                                    <span
                                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div className="text-xs min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-indigo-950">
                                      {isEn ? attachedSzvb.labelEn : attachedSzvb.labelHu}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">
                                      {isEn ? "Read-Only" : "Csak olvasás"}
                                    </span>
                                    {szvbUnreadCount > 0 && !isSzvbSelected && (
                                      <span
                                        className="w-2 h-2 rounded-full bg-red-600 shrink-0"
                                        title={isEn ? `${szvbUnreadCount} unread` : `${szvbUnreadCount} olvasatlan`}
                                      />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-indigo-800/75 font-medium truncate">
                                    {attachedSzvb.buildingName} &bull; {isEn ? "SZVB Audit View" : "SZVB ellenőrző nézet"}
                                  </div>
                                </div>
                              </div>
                              {isSzvbSelected && <Check className="w-4 h-4 text-indigo-700 stroke-[2.5] flex-shrink-0" />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Rare fallback: SZVB profile without a linked flat record */}
                {unattachedSzvbProfiles.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Shield className="w-3.5 h-3.5" />
                      <span>{t.szvb_switcher_section || (isEn ? "Accounting Committee (SZVB • Read-Only)" : "Számvizsgáló Bizottság (SZVB • Csak olvasás)")}</span>
                    </span>
                    <div className="space-y-2">
                      {unattachedSzvbProfiles.map((p) => {
                        const isSelected = activeProfileKey === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectSzvbProfile(p)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/90 border-indigo-600 text-indigo-900 shadow-xs'
                                : 'bg-white border-indigo-200/80 hover:bg-indigo-50/50 text-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-indigo-600 flex-shrink-0">
                                <Shield className="w-4 h-4" />
                              </div>
                              <div className="text-xs min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-gray-900 truncate">{p.buildingName}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                    {isEn ? p.labelEn : p.labelHu}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-500 font-medium truncate">
                                  {isEn ? "Audit View • Read-Only" : "Ellenőrző nézet • Csak olvasás"}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-indigo-700 stroke-[2.5] flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Fallback Managed Condominiums list (only for single-profile KK admins who open this modal as a building switcher) */}
          {isCurrentlyKkMode && allProfiles.length === 1 && accessibleBuildings.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                {t.select_building}
              </span>
              <div className="space-y-1.5">
                {accessibleBuildings.map((b) => {
                  const isActive = b.id === currentBuildingId && !isPortfolioView;
                  return (
                    <button
                      key={b.id}
                      type="button"
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

          {allProfiles.length === 0 && (
            <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-500">
              {isEn ? "No other profiles found for this account." : "Nincs más profil társítva ehhez a fiókhoz."}
            </div>
          )}

          {/* Admin Add Building Action (only in single-profile KK building switcher mode) */}
          {isCurrentlyKkMode && allProfiles.length === 1 && canCreateBuilding && onOpenAddBuilding && (
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
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
