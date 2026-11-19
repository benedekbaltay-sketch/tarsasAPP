import React from 'react';
import { useApp } from '../context/AppContext';
import { Users, Building2 } from 'lucide-react';

export function ProfileSwitcherButton({ onOpenProfileSelector, className = "", label = null }) {
  const { state, t, getUserFlats } = useApp();
  const { currentUser, buildings, isPortfolioView, currentLang } = state;

  if (!currentUser || !onOpenProfileSelector) return null;

  // Rule: Do NOT show switch button in portfolio ("Társasházaim") view
  if (isPortfolioView) return null;

  const isHu = currentLang === 'hu' || !currentLang;
  const isEn = !isHu;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';

  if (isAdmin) {
    // In KK mode: only show if inside a building and multiple buildings exist
    const buildingCount = (buildings || []).length;
    if (buildingCount <= 1) return null;

    const buttonLabel = label || t.switch_building_btn || (isHu ? "Társasház váltás" : "Switch Building");

    return (
      <button
        type="button"
        onClick={onOpenProfileSelector}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#1E3A8A] font-semibold text-xs shadow-2xs transition-all hover:border-blue-300 cursor-pointer flex-shrink-0 active:scale-95 ${className}`}
        title={buttonLabel}
      >
        <Building2 className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
        <span className="leading-none whitespace-nowrap">{buttonLabel}</span>
      </button>
    );
  }

  // Resident / Owner mode: only show if user has multiple flats
  const myFlats = getUserFlats ? getUserFlats(currentUser, buildings) : [];
  if (myFlats.length <= 1) return null;

  const residentLabel = label || t.profile_selector_btn || (isHu ? "Profilváltás" : "Switch Profile");

  return (
    <button
      type="button"
      onClick={onOpenProfileSelector}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#1E3A8A] font-semibold text-xs shadow-2xs transition-all hover:border-blue-300 cursor-pointer flex-shrink-0 active:scale-95 ${className}`}
      title={residentLabel}
    >
      <Users className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
      <span className="leading-none whitespace-nowrap">{residentLabel}</span>
    </button>
  );
}
