import React from 'react';
import { useApp } from '../context/AppContext';
import { Users, Menu, Building2 } from 'lucide-react';

export function Header({ onOpenDrawer, onOpenProfileSelector, onGoHome }) {
  const { state, t, toggleLanguage } = useApp();
  const { currentUser, currentLang, buildings, currentBuildingId } = state;

  if (!currentUser) return null;

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];
  const isHu = currentLang === 'hu' || !currentLang;

  return (
    <header className="w-full bg-white border-b border-gray-200 px-4 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Left: Logo & Building Name */}
      <div 
        onClick={onGoHome}
        className="flex items-center gap-3 cursor-pointer select-none group"
        title={isHu ? "Vissza a főmenübe" : "Back to Main Menu"}
      >
        <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
            <path d="M10 6h4"/>
            <path d="M10 10h4"/>
            <path d="M10 14h4"/>
            <path d="M10 18h4"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight font-display">
            {t.app_title}
          </h1>
          <span className="text-xs text-gray-500 font-medium truncate max-w-[200px] md:max-w-none">
            {currentBuilding ? `${currentBuilding.name}` : t.building_address}
          </span>
        </div>
      </div>

      {/* Center: Profile Switcher Button (Desktop & Tablet) */}
      <div className="hidden sm:flex items-center justify-center">
        <button
          onClick={onOpenProfileSelector}
          className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs md:text-sm shadow-sm transition-all hover:border-blue-300"
          title={t.profile_selector_btn}
        >
          <Users className="w-4 h-4 text-[#1E3A8A]" />
          <span>{t.profile_selector_btn}</span>
        </button>
      </div>

      {/* Right: Language toggle, User Info & Hamburger Menu */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Language Flag Switcher */}
        <button
          onClick={toggleLanguage}
          className="w-9 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center shadow-sm transition-all flex-shrink-0"
          title={isHu ? "Switch to English" : "Váltás magyar nyelvre"}
        >
          <img
            src={isHu ? "https://flagcdn.com/gb.svg" : "https://flagcdn.com/hu.svg"}
            alt={isHu ? "EN" : "HU"}
            className="w-5 h-3.5 rounded-sm object-cover"
          />
        </button>

        {/* User display badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-100/80 rounded-lg">
          <span className="text-xs font-bold text-gray-800 truncate max-w-[150px]">
            {currentUser.name || currentUser.email}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-[#1E3A8A]">
            {currentUser.role === 'admin' ? (isHu ? 'Közös Képviselő' : 'Representative') : currentUser.flatNum}
          </span>
        </div>

        {/* iOS Drawer Menu Trigger */}
        <button
          onClick={onOpenDrawer}
          className="w-9 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 shadow-sm transition-all cursor-pointer"
          title="Menü"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
