import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Home, 
  Search, 
  X, 
  ArrowLeft, 
  FileText, 
  Building, 
  Menu, 
  List, 
  LayoutGrid,
  Car,
  Package,
  Briefcase,
  Layers,
  UserCheck,
  CheckCircle2,
  Pencil
} from 'lucide-react';
import { formatPhoneNumber } from '../../utils/phone';
import { formatAnnexItem } from '../../utils/annex';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';

export function FlatsDataModal({ 
  isOpen, 
  onClose, 
  onOpenFlatDetail,
  onOpenEditFlatMaster,
  onOpenBuildingSettings,
  onOpenDrawer,
  onOpenProfileSelector,
  isReadOnly = false
}) {
  const { state, t, canUserManageBuilding } = useApp();
  const { flats, buildings, currentBuildingId, currentLang } = state;
  const isEn = currentLang === 'en';

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings[0];
  const isEffectiveReadOnly = Boolean(
    isReadOnly ||
    (currentBuilding && canUserManageBuilding && !canUserManageBuilding(currentBuilding?.id || currentBuilding))
  );

  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [unitTypeFilter, setUnitTypeFilter] = useState('all');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      };
    }
  }, [isOpen]);

  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  if (!isOpen || !isAdmin) return null;

  const unitTypeConfig = {
    flat: { label: t.unit_type_flat || "Lakás", icon: Home, badgeClass: "bg-blue-50 text-blue-700 border-blue-200", dotClass: "bg-blue-600" },
    garage: { label: t.unit_type_garage || "Garázs", icon: Car, badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-600" },
    storage: { label: t.unit_type_storage || "Tároló", icon: Package, badgeClass: "bg-purple-50 text-purple-700 border-purple-200", dotClass: "bg-purple-600" },
    commercial: { label: t.unit_type_commercial || "Üzlet", icon: Briefcase, badgeClass: "bg-amber-50 text-amber-700 border-amber-200", dotClass: "bg-amber-600" },
    other: { label: t.unit_type_other || "Egyéb", icon: Layers, badgeClass: "bg-slate-50 text-slate-700 border-slate-200", dotClass: "bg-slate-600" }
  };

  const filteredFlats = (flats || []).filter(f => {
    const uType = f.unitType || 'flat';
    if (unitTypeFilter !== 'all' && uType !== unitTypeFilter) return false;

    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const cleanQ = q.replace(/\s+/g, '');
    const hasStorage = f.storages && f.storages.some(s => {
      if (typeof s === 'string') return s.toLowerCase().includes(q);
      return (s?.number || '').toLowerCase().includes(q) || (s?.area || '').toLowerCase().includes(q);
    });
    const hasGarage = f.garages && f.garages.some(g => {
      if (typeof g === 'string') return g.toLowerCase().includes(q);
      return (g?.number || '').toLowerCase().includes(q) || (g?.area || '').toLowerCase().includes(q);
    });
    const hasOwnerMatch = f.owners && f.owners.some(o => 
      (o.name && o.name.toLowerCase().includes(q)) ||
      (o.email && o.email.toLowerCase().includes(q)) ||
      (o.emails && o.emails.some(em => em.toLowerCase().includes(q))) ||
      (o.phone && o.phone.replace(/\s+/g, '').includes(cleanQ)) ||
      (o.phones && o.phones.some(ph => ph.replace(/\s+/g, '').includes(cleanQ)))
    );
    const hasTenantMatch = f.tenants && f.tenants.some(tn => 
      (tn.name && tn.name.toLowerCase().includes(q)) ||
      (tn.payerName && tn.payerName.toLowerCase().includes(q)) ||
      (tn.phone && tn.phone.replace(/\s+/g, '').includes(cleanQ))
    );
    return (
      (f.flatNum && f.flatNum.toLowerCase().includes(q)) ||
      (f.ownerName && f.ownerName.toLowerCase().includes(q)) ||
      (f.email && f.email.toLowerCase().includes(q)) ||
      (f.phone && f.phone.replace(/\s+/g, '').includes(cleanQ)) ||
      (f.garageNum && f.garageNum.toLowerCase().includes(q)) ||
      (f.storageNum && f.storageNum.toLowerCase().includes(q)) ||
      (f.paymentCode && f.paymentCode.toLowerCase().includes(q)) ||
      (f.utalaskod && f.utalaskod.toLowerCase().includes(q)) ||
      hasStorage ||
      hasGarage ||
      hasOwnerMatch ||
      hasTenantMatch
    );
  });

  const buildingTotalShare = Number(currentBuilding?.totalOwnershipShare) || 10000;
  const totalFlats = (flats || []).length;
  const totalArea = (flats || []).reduce((acc, f) => acc + (f.area || Math.round((f.ownershipShare || 10) * 5.8)), 0);
  const totalTenants = (flats || []).reduce((acc, f) => acc + (f.tenantCount || 1), 0);
  const totalShareSum = (flats || []).reduce((acc, f) => acc + (Number(f.ownershipShare) || 0), 0);
  const sharePct = buildingTotalShare > 0 ? (totalShareSum / buildingTotalShare) * 100 : 0;
  const shareDiff = buildingTotalShare - totalShareSum;
  const isExactShareMatch = Math.abs(shareDiff) < 0.001;
  const isOverShare = totalShareSum > buildingTotalShare;
  const isUnderShare = totalShareSum < buildingTotalShare;

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Sticky Header Container */}
      <div className="sticky top-0 z-10 w-full shadow-xs">
        <ImpersonationBanner onExit={onClose} />
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Menu & Website Logo -> Back to Home */}
            <div className="flex items-center justify-start gap-2 sm:gap-2.5 flex-1 min-w-0">
              {onOpenDrawer && (
                <button
                  type="button"
                  onClick={onOpenDrawer}
                  className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
                  title={isEn ? "Open Menu" : "Menü megnyitása"}
                  aria-label={isEn ? "Open Menu" : "Menü megnyitása"}
                >
                  <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
                </button>
              )}
              <NavLogoButton onClick={onClose} />
            </div>

            {/* Center: Current Interface Name */}
            <div className="flex items-center justify-center text-center px-1 sm:px-2 flex-shrink-0 max-w-[55%] sm:max-w-[50%]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div className="min-w-0 text-left sm:text-center">
                  <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                    {isEn ? "Flats Master Data" : "Lakások adatai"}
                  </h2>
                  <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                    {currentBuilding?.name || t.building_address} &bull; {totalFlats} {isEn ? "flats" : "lakás"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Actions: Desktop Search, Profile Switcher & Menu */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
              {/* Desktop search bar */}
              <div className="relative hidden md:block w-36 lg:w-52">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isEn ? "Search flat or owner..." : "Keresés lakás/név..."}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                />
              </div>

              <ProfileSwitcherButton onOpenProfileSelector={onOpenProfileSelector} />
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors shadow-2xs cursor-pointer flex-shrink-0"
                title={isEn ? "Close" : "Bezárás"}
                aria-label={isEn ? "Close" : "Bezárás"}
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>
          </div>

          {/* Mobile Search Bar (Row 2 on mobile) */}
          <div className="sm:hidden pt-2.5">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isEn ? "Search flat or owner..." : "Keresés lakás/név..."}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain">
        <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
        
        {/* Summary Banner from new-project */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-sm">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                {currentBuilding?.name || (isEn ? "Condominium" : "Társasház")}
              </h4>
              <span className="text-xs text-gray-500 font-medium">
                {currentBuilding?.address || ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
            <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
              <span className="text-gray-400 text-[10px] uppercase font-bold block">
                {isEn ? "Total Flats" : "Lakások száma"}
              </span>
              <strong className="text-gray-900 font-bold text-sm">{totalFlats} db</strong>
            </div>
            <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
              <span className="text-gray-400 text-[10px] uppercase font-bold block">
                {isEn ? "Total Area" : "Össz. Alapterület"}
              </span>
              <strong className="text-gray-900 font-bold text-sm">{totalArea} m²</strong>
            </div>
            <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
              <span className="text-gray-400 text-[10px] uppercase font-bold block">
                {isEn ? "Total Residents" : "Össz. Lakó"}
              </span>
              <strong className="text-gray-900 font-bold text-sm">{totalTenants} fő</strong>
            </div>
            <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-gray-400 text-[10px] uppercase font-bold block">
                  {isEn ? "Ownership Share" : "Tulajdoni Hányad"}
                </span>
                {!isEffectiveReadOnly && onOpenBuildingSettings && (
                  <button
                    type="button"
                    onClick={onOpenBuildingSettings}
                    className="p-0.5 -mr-1 rounded text-gray-400 hover:text-[#1E3A8A] transition-colors cursor-pointer"
                    title={isEn ? "Edit building total share" : "Ház teljes tulajdoni hányadának szerkesztése"}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              <strong className="text-gray-900 font-bold text-sm block">
                {totalShareSum.toLocaleString('hu-HU')} / {buildingTotalShare.toLocaleString('hu-HU')}
              </strong>
              {totalFlats > 0 && !isExactShareMatch && (
                <div className="text-[10px] font-semibold text-red-600 mt-0.5">
                  {isUnderShare ? (
                    <span>
                      {isEn 
                        ? `Mismatch (missing: ${shareDiff.toLocaleString('hu-HU')})` 
                        : `Nem egyezik (hiány: ${shareDiff.toLocaleString('hu-HU')})`}
                    </span>
                  ) : (
                    <span>
                      {isEn 
                        ? `Mismatch (surplus: +${Math.abs(shareDiff).toLocaleString('hu-HU')})` 
                        : `Nem egyezik (többlet: +${Math.abs(shareDiff).toLocaleString('hu-HU')})`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title={isEn ? "List view" : "Lista nézet"}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.portfolio_view_list || (isEn ? "List" : "Lista")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title={isEn ? "Grid view" : "Csempe nézet"}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.portfolio_view_grid || (isEn ? "Tiles" : "Csempe")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Unit Type Filter Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: t.unit_type_all || (isEn ? "All Units" : "Mind"), icon: Layers },
            { id: 'flat', label: t.unit_type_flat || (isEn ? "Apartments" : "Lakások"), icon: Home },
            { id: 'garage', label: t.unit_type_garage || (isEn ? "Garages" : "Garázsok"), icon: Car },
            { id: 'storage', label: t.unit_type_storage || (isEn ? "Storages" : "Tárolók"), icon: Package },
            { id: 'commercial', label: t.unit_type_commercial || (isEn ? "Commercial" : "Üzlethelyiségek"), icon: Briefcase },
            { id: 'other', label: t.unit_type_other || (isEn ? "Other" : "Egyéb"), icon: Layers }
          ].map(filter => {
            const FilterIcon = filter.icon;
            const isSelected = unitTypeFilter === filter.id;
            const count = filter.id === 'all' 
              ? (flats || []).length 
              : (flats || []).filter(f => (f.unitType || 'flat') === filter.id).length;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setUnitTypeFilter(filter.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  isSelected
                    ? 'bg-[#1E3A8A] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <FilterIcon className="w-3.5 h-3.5" />
                <span>{filter.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-blue-900/60 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {viewMode === 'list' ? (
          /* List / Table View of Flat Master Data */
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">{t.flat_col_unit || (isEn ? "Unit / Flat" : "Albetét / Lakás")}</th>
                    <th className="py-3 px-4">{t.flat_col_owner || (isEn ? "Owner" : "Tulajdonos")}</th>
                    <th className="py-3 px-4">{t.flat_col_contact || (isEn ? "Contact" : "Elérhetőség")}</th>
                    <th className="py-3 px-4 text-center">{t.tenant_count || (isEn ? "Residents" : "Lakók")}</th>
                    <th className="py-3 px-4 text-right">{t.flat_col_area_share || (isEn ? "Area / Share" : "Terület / Hányad")}</th>
                    <th className="py-3 px-4">{t.flat_col_annex || (isEn ? "Garage / Storage" : "Garázs / Tároló")}</th>
                    <th className="py-3 px-4 text-right">{t.portfolio_col_actions || (isEn ? "Actions" : "Műveletek")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFlats.map((f) => {
                    const garageStr = f.garages && f.garages.length > 0 ? f.garages.map(g => formatAnnexItem(g)).filter(Boolean).join(', ') : (f.garageNum ? formatAnnexItem(f.garageNum) : "-");
                    const storageStr = f.storages && f.storages.length > 0 ? f.storages.map(s => formatAnnexItem(s)).filter(Boolean).join(', ') : (f.storageNum ? formatAnnexItem(f.storageNum) : "-");
                    const uCfg = unitTypeConfig[f.unitType || 'flat'] || unitTypeConfig.flat;
                    const UIcon = uCfg.icon;
                    const activeTenant = f.tenants?.find(t => t.isActive);

                    return (
                      <tr
                        key={f.flatNum}
                        onClick={() => onOpenEditFlatMaster(currentBuilding?.id || currentBuildingId, f.flatNum)}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${uCfg.badgeClass}`}>
                              <UIcon className="w-3 h-3" />
                              <span>{uCfg.label}</span>
                            </span>
                            <span>{f.flatNum}.</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                          <span className="truncate max-w-[160px] block" title={f.ownerName}>
                            {f.ownerName || '-'}
                          </span>
                          {activeTenant && (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold mt-0.5">
                              <UserCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              <span className="truncate max-w-[140px]">{t.active_tenant_badge || (isEn ? "Tenant" : "Bérlő")}: {activeTenant.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          <div className="space-y-0.5">
                            {f.email && <div className="truncate max-w-[160px] text-[11px]" title={f.email}>{f.email}</div>}
                            {f.phone && <div className="text-[11px] text-gray-500 font-mono">{formatPhoneNumber(f.phone)}</div>}
                            {!f.email && !f.phone && <span className="text-gray-400">-</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap text-gray-700 font-medium">
                          {f.tenantCount || 1} {isEn ? "pers." : "fő"}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{f.area ? `${f.area} m²` : "-"}</div>
                          <div className="text-[11px] text-indigo-700 font-medium">
                            {f.ownershipShare !== undefined && f.ownershipShare !== null && f.ownershipShare !== '' ? (
                              <span>
                                {f.ownershipShare} / {buildingTotalShare.toLocaleString('hu-HU')}
                                <span className="text-gray-400 text-[10px] ml-1">
                                  ({buildingTotalShare > 0 ? ((Number(f.ownershipShare) / buildingTotalShare) * 100).toFixed(2) : 0}%)
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap text-[11px]">
                          <div><span className="text-gray-400">G: </span>{garageStr}</div>
                          <div><span className="text-gray-400">T: </span>{storageStr}</div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenFlatDetail(f.flatNum)}
                              className="px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-700 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                              title={isEn ? "Finances" : "Pénzügyi adat"}
                            >
                              <FileText className="w-3.5 h-3.5 text-gray-400" />
                              <span>{isEn ? "Finances" : "Pénzügy"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenEditFlatMaster(currentBuilding?.id || currentBuildingId, f.flatNum)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                isEffectiveReadOnly
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                  : 'bg-[#1E3A8A] hover:bg-[#1e40af] text-white'
                              }`}
                              title={isEffectiveReadOnly ? (isEn ? "View master data" : "Törzsadatok megtekintése") : (isEn ? "Edit master data" : "Törzsadatok szerkesztése")}
                            >
                              {isEffectiveReadOnly ? (isEn ? "View" : "Megtekintés") : (isEn ? "Master" : "Törzsadat")}
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
          /* Grid of Flat Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFlats.map((f) => {
              const uCfg = unitTypeConfig[f.unitType || 'flat'] || unitTypeConfig.flat;
              const UIcon = uCfg.icon;
              const activeTenant = f.tenants?.find(t => t.isActive);

              return (
                <div
                  key={f.flatNum}
                  onClick={() => onOpenEditFlatMaster(currentBuilding?.id || currentBuildingId, f.flatNum)}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:shadow-md hover:border-[#1E3A8A] transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    {/* Flat Card Header: Title on Left, Financial data subtly in Right Corner */}
                    <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${uCfg.badgeClass}`}>
                            <UIcon className="w-3 h-3" />
                            <span>{uCfg.label}</span>
                          </span>
                          {activeTenant && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                              <UserCheck className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{t.active_tenant_badge || (isEn ? "Tenant" : "Bérlő")}: {activeTenant.name}</span>
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-bold text-gray-900 leading-tight group-hover:text-[#1E3A8A] transition-colors">
                          {f.flatNum}. {uCfg.label}
                        </h4>
                        <span className="text-xs font-semibold text-gray-700 block mt-0.5">
                          {f.ownerName}
                        </span>
                      </div>
                      
                      {/* Pénzügyi adat kevésbé látványosan a jobb sarokban */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFlatDetail(f.flatNum);
                        }}
                        className="px-2 py-1 rounded-lg border border-gray-200 bg-gray-50/90 hover:bg-blue-50 text-gray-500 hover:text-[#1E3A8A] text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        title={isEn ? "Financial Data / Statement" : "Pénzügyi adatok / Adatlap"}
                      >
                        <FileText className="w-3 h-3 text-gray-400" />
                        <span>{isEn ? "Finances" : "Pénzügyi adat"}</span>
                      </button>
                    </div>

                  {/* Flat Details */}
                  <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.email}:</span>
                      <span className="font-medium truncate max-w-[180px]">{f.email || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.phone}:</span>
                      <span className="font-medium">{f.phone ? formatPhoneNumber(f.phone) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.tenant_count}:</span>
                      <span className="font-medium">{f.tenantCount || 1} fő</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Terület:</span>
                      <span className="font-medium">{f.area ? `${f.area} m²` : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.flats_ownership_share || (isEn ? "Ownership Share:" : "Tulajdoni hányad:")}</span>
                      <span className="font-medium text-indigo-700">
                        {f.ownershipShare !== undefined && f.ownershipShare !== null && f.ownershipShare !== '' ? (
                          <>
                            {f.ownershipShare} / {buildingTotalShare.toLocaleString('hu-HU')}
                            <span className="text-gray-400 text-[11px] ml-1">
                              ({buildingTotalShare > 0 ? ((Number(f.ownershipShare) / buildingTotalShare) * 100).toFixed(2) : 0}%)
                            </span>
                          </>
                        ) : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Garázs:</span>
                      <span className="font-medium truncate max-w-[160px]" title={f.garages && f.garages.length > 0 ? f.garages.map(g => formatAnnexItem(g)).filter(Boolean).join(', ') : (f.garageNum ? formatAnnexItem(f.garageNum) : "-")}>
                        {f.garages && f.garages.length > 0 ? f.garages.map(g => formatAnnexItem(g)).filter(Boolean).join(', ') : (f.garageNum ? formatAnnexItem(f.garageNum) : "-")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tároló:</span>
                      <span className="font-medium truncate max-w-[160px]" title={f.storages && f.storages.length > 0 ? f.storages.map(s => formatAnnexItem(s)).filter(Boolean).join(', ') : (f.storageNum ? formatAnnexItem(f.storageNum) : "-")}>
                        {f.storages && f.storages.length > 0 ? f.storages.map(s => formatAnnexItem(s)).filter(Boolean).join(', ') : (f.storageNum ? formatAnnexItem(f.storageNum) : "-")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button: Törzsadat kiemelve az aljában */}
                <div className="mt-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenEditFlatMaster(currentBuilding?.id || currentBuildingId, f.flatNum);
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-xs cursor-pointer ${
                      isEffectiveReadOnly
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        : 'bg-[#1E3A8A] hover:bg-[#1e40af] text-white group-hover:bg-[#1e40af]'
                    }`}
                  >
                    <span>{isEffectiveReadOnly ? (isEn ? "View Master Data" : "Törzsadatok megtekintése") : (isEn ? "Master Data" : "Törzsadatok")}</span>
                  </button>
                </div>

              </div>
            );
          })}
          </div>
        )}

      </div>
    </div>
  </div>
);
}
