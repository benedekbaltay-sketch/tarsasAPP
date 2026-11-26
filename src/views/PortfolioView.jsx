import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  Plus, 
  Calendar, 
  Search, 
  Home, 
  Users, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Shield, 
  Sparkles,
  TrendingDown,
  Layers,
  Settings,
  LayoutGrid,
  List,
  Eye,
  Trash2,
  X,
  Loader2
} from 'lucide-react';
import { formatCurrency, getBuildingReserve, getBuildingRenovationFund } from '../utils/finances';
import { formatTaxNumber } from '../utils/taxNumber';
import {
  getAccessibleBuildings,
  canUserCreateBuilding,
  canUserManageTeam,
  canUserManageBuilding,
  isUserBuildingViewer,
  resolveUserOrgContext,
  canUserDeleteBuilding,
} from '../utils/teamPermissions';
import { getBuildingAlerts } from '../utils/buildingAlerts';

export function PortfolioView({ onSelectBuilding, onOpenAddBuilding, onOpenCalendar, onOpenBuildingSettings, onOpenTeamManagement }) {
  const { state, t, deleteBuilding } = useApp();
  const { buildings, currentLang, currentUser, organizations } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;

  const accessibleBuildings = useMemo(
    () => getAccessibleBuildings(currentUser, buildings || [], organizations || []),
    [currentUser, buildings, organizations]
  );
  const canCreateBuilding = useMemo(
    () => canUserCreateBuilding(currentUser, organizations, buildings),
    [currentUser, organizations, buildings]
  );
  const canManageTeam = useMemo(
    () => canUserManageTeam(currentUser, organizations, buildings),
    [currentUser, organizations, buildings]
  );
  const orgCtx = useMemo(
    () => resolveUserOrgContext(currentUser, organizations, buildings),
    [currentUser, organizations, buildings]
  );

  // View mode: 'list' (DEFAULT) or 'grid'
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [buildingToDelete, setBuildingToDelete] = useState(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeletingBuilding, setIsDeletingBuilding] = useState(false);

  // Close delete modal on Escape and lock body scroll while open
  useEffect(() => {
    if (!buildingToDelete) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeletingBuilding) {
        setBuildingToDelete(null);
        setDeleteConfirmationInput('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [buildingToDelete, isDeletingBuilding]);

  // Filtered buildings list (strictly scoped to buildings accessible by the logged-in user)
  const filteredBuildings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return accessibleBuildings;
    return accessibleBuildings.filter(b => 
      (b.name || '').toLowerCase().includes(q) || 
      (b.officialName || '').toLowerCase().includes(q) || 
      (b.address || '').toLowerCase().includes(q) ||
      (b.taxNumber || '').toLowerCase().includes(q)
    );
  }, [accessibleBuildings, searchQuery]);

  // Aggregate statistics across accessible buildings
  const aggregateStats = useMemo(() => {
    let totalFlats = 0;
    let totalResidents = 0;
    let totalCommonReserve = 0;
    let totalRenovationReserve = 0;
    let totalArrears = 0;
    let totalFlatsInArrears = 0;

    accessibleBuildings.forEach(b => {
      const flats = b.flats || [];
      totalFlats += flats.length;
      totalResidents += flats.reduce((acc, f) => acc + (f.tenantCount || 1), 0);

      const bCommon = getBuildingReserve({ ...b, buildingInitialReserveCommon: b.buildingInitialReserveCommon || 0 });
      const bRenov = getBuildingRenovationFund({ ...b, buildingInitialReserveRenovation: b.buildingInitialReserveRenovation || 0 });
      totalCommonReserve += bCommon;
      totalRenovationReserve += bRenov;

      flats.forEach(f => {
        const bal = (f.balance || 0) + (f.renovationBalance || 0);
        if (bal < 0) {
          totalArrears += Math.abs(bal);
          totalFlatsInArrears++;
        }
      });
    });

    return {
      totalBuildings: accessibleBuildings.length,
      totalFlats,
      totalResidents,
      totalCommonReserve,
      totalRenovationReserve,
      totalReserves: totalCommonReserve + totalRenovationReserve,
      totalArrears,
      totalFlatsInArrears
    };
  }, [accessibleBuildings]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5 animate-fadeIn">
      
      {/* Top Banner / Welcome & Mode Info */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#1E3A8A] border border-blue-200">
              {isEn ? "Property Portfolio" : "Közös Képviseleti Portfólió"}
            </span>
            {orgCtx.isStaff && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {t.team_staff_badge || (isEn ? "Assigned Property Manager" : "Kijelölt házkezelő")}
              </span>
            )}
          </div>

          {/* Title + Compact KPI Badges in ONE unified row! */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 my-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold font-display text-gray-900 leading-tight">
              {t.portfolio_title || (isEn ? "My Condominiums" : "Társasházaim")}
            </h1>

            {/* Compact inline statistics */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-[#1E3A8A] text-xs font-bold shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span className="text-gray-500 font-medium">{t.portfolio_total_buildings || (isEn ? "Buildings" : "Kezelt társasház")}:</span>
                <span className="font-black text-[#1E3A8A] text-sm">{aggregateStats.totalBuildings}</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shadow-2xs">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-gray-500 font-medium">{t.portfolio_total_flats || (isEn ? "Flats" : "Összes lakás")}:</span>
                <span className="font-black text-indigo-800 text-sm">{aggregateStats.totalFlats}</span>
              </div>
            </div>
          </div>

          <p className="text-gray-500 text-xs mt-0.5 max-w-xl">
            {t.portfolio_subtitle || (isEn ? "Centralized management of your condominium buildings and tasks." : "Közös képviselői portfólió és kezelt házak áttekintése.")}
          </p>
        </div>

        {/* Top Actions: Team, Add Building */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
          {canManageTeam && onOpenTeamManagement && (
            <button
              type="button"
              onClick={onOpenTeamManagement}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-blue-50/70 text-[#1E3A8A] font-bold text-xs border border-blue-200 shadow-2xs transition-all cursor-pointer hover:border-blue-300 active:scale-95"
              title={t.team_modal_title || (isEn ? "Team & Access Permissions" : "Csapat & Jogosultságok")}
            >
              <Users className="w-4 h-4 text-[#1E3A8A]" />
              <span>{t.team_btn_label || (isEn ? "Team & Permissions" : "Csapat & Jogosultságok")}</span>
            </button>
          )}

          {canCreateBuilding && (
            <button
              type="button"
              onClick={onOpenAddBuilding}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{t.portfolio_add_building || (isEn ? "Add New Condominium" : "Új társasház hozzáadása")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Buildings Search & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 font-display">
            {isEn ? "Condominium Buildings" : "Kezelt Társasházak"}
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
            {filteredBuildings.length}
          </span>
        </div>

        {/* Search Input & View Mode Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.portfolio_search_placeholder || (isEn ? "Search name, address..." : "Keresés név vagy cím alapján...")}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] shadow-2xs transition-all"
            />
          </div>

          {/* View Mode Toggle: List (Default) vs Grid */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-white text-[#1E3A8A] shadow-2xs' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title={isEn ? "List View" : "Lista nézet"}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.portfolio_view_list || (isEn ? "List" : "Lista")}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-white text-[#1E3A8A] shadow-2xs' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              title={isEn ? "Grid View" : "Csempe nézet"}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.portfolio_view_grid || (isEn ? "Grid" : "Csempe")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Buildings Content: List View (DEFAULT) vs Grid View */}
      {filteredBuildings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">
            {isEn ? "No condominiums found" : "Nem található társasház"}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchQuery 
              ? (isEn ? "No building matches your search query." : "Nincs a keresési feltételnek megfelelő társasház.")
              : (isEn ? "Start by adding your first condominium building to the portfolio." : "Kezdésként rögzítsd az első társasházadat a portfólióba.")}
          </p>
          {!searchQuery && canCreateBuilding && (
            <button
              type="button"
              onClick={onOpenAddBuilding}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-sm hover:bg-[#1e40af] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.portfolio_add_building || "Új társasház hozzáadása"}</span>
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        
        /* 1. COMPACT LIST VIEW (DEFAULT FOR 100+ BUILDINGS) */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/90 text-gray-500 uppercase font-semibold border-b border-gray-200 text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t.portfolio_col_building || (isEn ? "Address / Official Name" : "Cím / Hivatalos név")}</th>
                  <th className="py-3 px-3">{t.portfolio_col_tax || (isEn ? "Tax ID" : "Adószám")}</th>
                  <th className="py-3 px-3 text-center">{t.portfolio_col_flats || (isEn ? "Flats" : "Lakások")}</th>
                  <th className="py-3 px-4">{t.portfolio_col_arrears || (isEn ? "Arrears Status" : "Hátralék státusz")}</th>
                  <th className="py-3 px-4 text-right">{t.portfolio_col_actions || (isEn ? "Actions" : "Műveletek")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBuildings.map(b => {
                  const flats = b.flats || [];
                  const flatCount = flats.length;

                  let buildingArrears = 0;
                  let flatsInArrearsCount = 0;
                  flats.forEach(f => {
                    const bal = (f.balance || 0) + (f.renovationBalance || 0);
                    if (bal < 0) {
                      buildingArrears += Math.abs(bal);
                      flatsInArrearsCount++;
                    }
                  });

                  const isSelected = selectedBuildingId === b.id;
                  const buildingAlerts = getBuildingAlerts(b, { user: currentUser, organizations, buildings });

                  return (
                    <tr
                      key={b.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => {
                        // Allow text selection and copying with mouse without triggering navigation
                        const sel = window.getSelection();
                        if (sel && sel.toString().length > 0) return;
                        if (isSelected) {
                          onSelectBuilding(b.id);
                        } else {
                          setSelectedBuildingId(b.id);
                        }
                      }}
                      onDoubleClick={() => onSelectBuilding(b.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.target.tagName !== 'BUTTON') {
                            e.preventDefault();
                            onSelectBuilding(b.id);
                          }
                        }
                      }}
                      className={`transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-blue-50/90 border-l-4 border-l-[#1E3A8A]'
                          : 'hover:bg-blue-50/40 border-l-4 border-l-transparent'
                      }`}
                      title={
                        isSelected
                          ? (isHu ? "Kattintson még egyszer vagy a Megnyitás gombra a belépéshez" : "Click again or press Open to enter")
                          : (isHu ? "Kattintson a kiválasztáshoz (második kattintás megnyitja)" : "Click to select (second click opens)")
                      }
                    >
                      {/* 1. Address (Primary) & Official Name (Sub) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                            <Building2 className="w-4 h-4" />
                            {buildingAlerts.length > 0 && (
                              <span
                                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-white shadow-xs"
                                title={isEn ? `${buildingAlerts.length} active alert(s)` : `${buildingAlerts.length} aktív figyelmeztetés`}
                              >
                                {buildingAlerts.length}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900 group-hover:text-[#1E3A8A] transition-colors font-display block truncate">
                                {b.address || b.name || t.building_address}
                              </span>
                              {(!canUserManageBuilding(currentUser, b, organizations, buildings) || isUserBuildingViewer(currentUser, b, organizations, buildings)) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                                  <Eye className="w-2.5 h-2.5 text-amber-700" />
                                  <span>{t.team_viewer_badge || (isEn ? "Viewer" : "Csak megtekintő")}</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500 block truncate">
                              {b.officialName || b.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Tax Number */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {b.taxNumber ? (
                          <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px] border border-gray-200">
                            {formatTaxNumber(b.taxNumber)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* 3. Flat Count */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1E3A8A] border border-blue-200">
                          {flatCount} {isEn ? "flats" : "lakás"}
                        </span>
                      </td>

                      {/* 4. Arrears Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {buildingArrears > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>-{formatCurrency(buildingArrears)}</span>
                            <span className="text-[10px] opacity-80">({flatsInArrearsCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{t.portfolio_no_arrears || (isEn ? "Settled" : "Rendezett")}</span>
                          </span>
                        )}
                      </td>

                      {/* 5. Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {canUserDeleteBuilding(currentUser, b, organizations, buildings) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBuildingToDelete(b);
                                setDeleteConfirmationInput('');
                              }}
                              className="p-1.5 rounded-lg border border-transparent hover:border-red-200 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title={t.portfolio_delete_building_btn || (isEn ? "Delete condominium (Owner only)" : "Társasház végleges törlése (Csak tulajdonos)")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectBuilding(b.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                              isSelected
                                ? 'bg-blue-50/90 text-[#1E3A8A] border-blue-300 font-semibold shadow-2xs'
                                : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 border-gray-200 hover:border-gray-300 shadow-2xs'
                            }`}
                            title={isEn ? "Open condominium" : "Társasház megnyitása"}
                          >
                            <span>{t.portfolio_open_btn || (isEn ? "Open" : "Megnyitás")}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* 2. CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBuildings.map(b => {
            const flats = b.flats || [];
            const flatCount = flats.length;

            const bCommon = getBuildingReserve({ ...b, buildingInitialReserveCommon: b.buildingInitialReserveCommon || 0 });
            const bRenov = getBuildingRenovationFund({ ...b, buildingInitialReserveRenovation: b.buildingInitialReserveRenovation || 0 });
            const totalReserves = bCommon + bRenov;
            const buildingAlerts = getBuildingAlerts(b, { user: currentUser, organizations, buildings });

            let buildingArrears = 0;
            let flatsInArrearsCount = 0;
            flats.forEach(f => {
              const bal = (f.balance || 0) + (f.renovationBalance || 0);
              if (bal < 0) {
                buildingArrears += Math.abs(bal);
                flatsInArrearsCount++;
              }
            });

            return (
              <div
                key={b.id}
                tabIndex={0}
                role="button"
                aria-label={`${b.name} - ${t.portfolio_manage_building || (isEn ? "Manage Building" : "Társasház kezelése")}`}
                title={isHu ? "Kattintson duplán vagy nyomjon Entert a megnyitáshoz" : "Double-click or press Enter to open"}
                onDoubleClick={() => onSelectBuilding(b.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.target.tagName !== 'BUTTON') {
                      e.preventDefault();
                      onSelectBuilding(b.id);
                    }
                  }
                }}
                className="group bg-white rounded-3xl border border-gray-200/90 hover:border-[#1E3A8A] focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/30 focus:outline-none p-5 sm:p-6 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  
                  {/* Card Header: Icon & Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="relative w-11 h-11 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <Building2 className="w-5 h-5" />
                      {buildingAlerts.length > 0 && (
                        <span
                          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center leading-none ring-2 ring-white shadow-xs"
                          title={isEn ? `${buildingAlerts.length} active alert(s)` : `${buildingAlerts.length} aktív figyelmeztetés`}
                        >
                          {buildingAlerts.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {(!canUserManageBuilding(currentUser, b, organizations, buildings) || isUserBuildingViewer(currentUser, b, organizations, buildings)) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Eye className="w-3 h-3 text-amber-700" />
                          <span>{t.team_viewer_badge || (isEn ? "Viewer" : "Csak megtekintő")}</span>
                        </span>
                      )}
                      {b.taxNumber && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                          {isEn ? "Tax:" : "Adószám:"} {formatTaxNumber(b.taxNumber)}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#1E3A8A] border border-blue-200">
                        {flatCount} {isEn ? "flats" : "lakás"}
                      </span>
                    </div>
                  </div>

                  {/* Building Title & Address */}
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-[#1E3A8A] transition-colors font-display line-clamp-1">
                    {b.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5 line-clamp-1">
                    {b.address || t.building_address}
                  </p>

                  {/* Arrears Status Banner */}
                  <div className="mt-4 pt-3.5 border-t border-gray-100">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      buildingArrears > 0
                        ? 'bg-red-50/70 border-red-200 text-red-700'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-700'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        {buildingArrears > 0 ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                            <span>{isEn ? `${flatsInArrearsCount} flats in arrears` : `${flatsInArrearsCount} lakásban hátralék`}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{t.portfolio_no_arrears || (isEn ? "All balances settled" : "Nincs lakói hátralék")}</span>
                          </>
                        )}
                      </div>
                      <span className="font-extrabold font-display">
                        {buildingArrears > 0 ? `-${formatCurrency(buildingArrears)}` : "0 Ft"}
                      </span>
                    </div>
                  </div>

                  {/* Balances details */}
                  <div className="mt-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                        {isEn ? "Common Cost Reserve:" : "Közös költség egyenleg:"}
                      </span>
                      <strong className={`font-bold ${bCommon >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {formatCurrency(bCommon)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center text-gray-600">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                        {isEn ? "Renovation Fund:" : "Felújítási alap egyenleg:"}
                      </span>
                      <strong className={`font-bold ${bRenov >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                        {formatCurrency(bRenov)}
                      </strong>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 font-bold">
                      <span className="text-gray-800 font-display">
                        {isEn ? "Total Reserves:" : "Összesített tartalék:"}
                      </span>
                      <strong className="text-emerald-600 font-display text-sm">
                        {formatCurrency(totalReserves)}
                      </strong>
                    </div>
                  </div>

                </div>

                {/* Card Actions */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBuilding(b.id);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 bg-white hover:bg-blue-50/70 hover:border-blue-300 text-[#1E3A8A] font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <span>
                      {(!canUserManageBuilding(currentUser, b, organizations, buildings) || isUserBuildingViewer(currentUser, b, organizations, buildings))
                        ? (t.portfolio_view_building || (isEn ? "View Condominium" : "Társasház megtekintése"))
                        : (t.portfolio_manage_building || (isEn ? "Manage Building" : "Társasház kezelése"))}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  {canUserDeleteBuilding(currentUser, b, organizations, buildings) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBuildingToDelete(b);
                        setDeleteConfirmationInput('');
                      }}
                      className="p-2.5 rounded-xl border border-gray-200 hover:border-red-300 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                      title={t.portfolio_delete_building_btn || (isEn ? "Delete condominium (Owner only)" : "Társasház végleges törlése (Csak tulajdonos)")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* High-Security Condominium Deletion Modal (Rendered in document.body portal to avoid header overlap & spacing artifacts) */}
      {buildingToDelete && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs cursor-default"
          onClick={() => {
            if (!isDeletingBuilding) {
              setBuildingToDelete(null);
              setDeleteConfirmationInput('');
            }
          }}
        >
          <div
            className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md p-6 space-y-4 text-left max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-display">
                    {t.portfolio_delete_modal_title || (isEn ? "Delete Condominium Permanently" : "Társasház végleges törlése")}
                  </h3>
                  <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    {t.portfolio_delete_owner_only_badge || (isEn ? "Strictly Owner Only" : "Kizárólag tulajdonosnak")}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingBuilding}
                onClick={() => {
                  setBuildingToDelete(null);
                  setDeleteConfirmationInput('');
                }}
                className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200/90 text-xs text-red-950 space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="font-medium">
                  {t.portfolio_delete_modal_warning || (isEn
                    ? "Warning! This action is permanent and cannot be undone. All flats, accounting records, owner registry, payments, and uploaded documents associated with this condominium will be permanently deleted."
                    : "Figyelem! Ez a művelet végleges és nem visszavonható. A társasház összes albetétje, lakásadata, könyvelése, befizetése és feltöltött dokumentuma véglegesen törlődik.")}
                </p>
              </div>
              <div className="pt-2 border-t border-red-200/60 font-bold text-gray-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-gray-700" />
                <span className="text-sm">{buildingToDelete.name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-700">
                {t.portfolio_delete_confirm_prompt || (isEn
                  ? "To avoid accidental deletion, please type the exact name of the condominium below to confirm:"
                  : "A véletlen törlés elkerülése érdekében kérjük, írd be pontosan a társasház nevét a megerősítéshez:")}
              </label>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs font-mono text-gray-800 select-all font-bold">
                {buildingToDelete.name}
              </div>
              <input
                type="text"
                autoFocus
                disabled={isDeletingBuilding}
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder={t.portfolio_delete_placeholder || (isEn ? "Type condominium name..." : "Írd be a ház nevét...")}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingBuilding}
                onClick={() => {
                  setBuildingToDelete(null);
                  setDeleteConfirmationInput('');
                }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {t.cancel || (isEn ? "Cancel" : "Mégse")}
              </button>
              <button
                type="button"
                disabled={isDeletingBuilding || deleteConfirmationInput.trim().toLowerCase() !== (buildingToDelete.name || '').trim().toLowerCase()}
                onClick={async () => {
                  if (deleteConfirmationInput.trim().toLowerCase() !== (buildingToDelete.name || '').trim().toLowerCase()) return;
                  setIsDeletingBuilding(true);
                  try {
                    const ok = await deleteBuilding(buildingToDelete.id);
                    if (ok) {
                      setBuildingToDelete(null);
                      setDeleteConfirmationInput('');
                    }
                  } finally {
                    setIsDeletingBuilding(false);
                  }
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeletingBuilding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{t.portfolio_delete_confirm_btn || (isEn ? "Delete Permanently" : "Végleges törlés")}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
