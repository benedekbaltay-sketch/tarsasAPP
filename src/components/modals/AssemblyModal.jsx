import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FileSpreadsheet, 
  Calendar, 
  Download, 
  Search, 
  Menu, 
  X,
  Check, 
  ArrowRight, 
  ArrowLeft,
  Sparkles, 
  TrendingUp, 
  FileText, 
  Users, 
  Clock,
  ShieldCheck,
  Building,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { calculateOwnerBalancesReport } from '../../utils/assembly';
import { exportOwnerBalancesToExcel } from '../../utils/exportExcel';
import { formatCurrency } from '../../utils/finances';

export function AssemblyModal({
  isOpen,
  onClose,
  onOpenDrawer,
  onOpenProfileSelector
}) {
  const { state, t, showToast } = useApp();
  const { buildings, currentBuildingId, currentLang } = state;
  const isEn = currentLang === 'en';

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings?.[0] || {
    name: isEn ? "Condominium" : "Társasház",
    address: ""
  };

  // Default: previous full calendar year [Aktuális Év - 1] 01 - 12
  const now = new Date();
  const curYear = now.getFullYear();
  const prevYear = curYear - 1;

  // Selected document: null = Documents Hub, 'owner_balances' = Owner Balances Generator
  const [selectedDocument, setSelectedDocument] = useState(null);

  const [startMonth, setStartMonth] = useState(`${prevYear}-01`);
  const [endMonth, setEndMonth] = useState(`${prevYear}-12`);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      // Always reset to document catalog hub upon opening
      setSelectedDocument(null);
    }
  }, [isOpen]);

  // Real-time calculation of the owner balances statement
  const report = useMemo(() => {
    return calculateOwnerBalancesReport(startMonth, endMonth, state, currentBuildingId);
  }, [startMonth, endMonth, state, currentBuildingId]);

  if (!isOpen) return null;

  const isSzvb = state.currentUser?.role === 'szvb';
  const isAuditor = state.currentUser?.role === 'auditor';
  const hideOwnerPii = Boolean(isSzvb || isAuditor);

  const handleDownload = () => {
    const exportPayload = hideOwnerPii
      ? {
          ...report,
          rows: (report.rows || []).map((r) => ({ ...r, ownerName: '' })),
        }
      : report;
    exportOwnerBalancesToExcel(exportPayload, isEn);
    showToast(
      isEn 
        ? "Excel statement successfully generated and downloaded!" 
        : "A tulajdonosi egyenlegelszámolás Excel fájl sikeresen letöltve!"
    );
  };

  const setPreset = (type) => {
    if (type === 'prevYear') {
      setStartMonth(`${prevYear}-01`);
      setEndMonth(`${prevYear}-12`);
    } else if (type === 'curYear') {
      setStartMonth(`${curYear}-01`);
      setEndMonth(`${curYear}-12`);
    }
  };

  // Filter rows for preview table (never search hidden owner names in anonymized SZVB/Auditor mode)
  const filteredRows = (report.rows || []).filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.flatNum && r.flatNum.toLowerCase().includes(q)) ||
      (r.flatLabel && r.flatLabel.toLowerCase().includes(q)) ||
      (!hideOwnerPii && r.ownerName && r.ownerName.toLowerCase().includes(q))
    );
  });

  const startFormatted = report.startDateStr.replace(/-/g, '.');
  const endFormatted = report.endDateStr.replace(/-/g, '.');
  const excelFileName = `Tulajdonosi_egyenlegek_${startFormatted}_${endFormatted}.xlsx`;

  return (
    <div className="fixed inset-0 z-40 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn">
      {/* Sticky Header Container */}
      <div className="sticky top-0 z-10 w-full shadow-xs">
        <ImpersonationBanner onExit={onClose} />
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3 flex items-center justify-between gap-2 sm:gap-4">
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
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {selectedDocument === 'owner_balances' 
                    ? (isEn ? "Owner Balances Statement" : "Tulajdonosi egyenlegek")
                    : (isEn ? "General Assembly" : "Közgyűlés")}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {currentBuilding?.name || t.building_address} &bull; {
                    selectedDocument === 'owner_balances'
                      ? (isEn ? "Document Generator" : "Dokumentum generálása")
                      : (isEn ? "Documents & Statements Hub" : "Dokumentumok és elszámolások")
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Profile Selector & Close */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain">
        <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto w-full">

          {/* VIEW 1: DOCUMENT CATALOG / HUB (When no document is currently selected) */}
          {selectedDocument === null && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Clean Section Header */}
              <div className="pt-1 pb-1">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 font-display">
                  {isEn ? "General Assembly Documents" : "Közgyűlési dokumentumok"}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isEn 
                    ? "Generate official condominium reports, owner balance statements, and meeting annexes in accordance with the Hungarian Condominium Act (Tht.)." 
                    : "Hivatalos társasházi beszámolók, tulajdonosi elszámolások és közgyűlési jegyzőkönyv-mellékletek generálása a Társasházi törvény (Tht.) előírásainak megfelelően."}
                </p>
              </div>

              {/* Document Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* CARD 1: Tulajdonosi egyenlegek elszámolása (ACTIVE & AVAILABLE) */}
                <div className="bg-white rounded-3xl border-2 border-emerald-500/40 p-6 sm:p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 relative overflow-hidden group">
                  <div className="space-y-4">
                    
                    {/* Header line with icon & badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{isEn ? "Available" : "Elérhető"}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Excel (.xlsx)
                        </span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1.5">
                      <h4 className="text-lg font-bold text-gray-900 font-display">
                        {isEn ? "Owner Balances Statement" : "Tulajdonosi egyenlegek elszámolása"}
                      </h4>
                      <p className="text-xs font-medium text-emerald-700">
                        {isEn ? "Hungarian Condominium Act (Tht.) mandatory assembly annex" : "Társasházi törvény (Tht.) szerinti kötelező közgyűlési melléklet"}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed pt-1">
                        {isEn 
                          ? "Unit-by-unit breakdown of Operating (KK) and Renovation Fund (FA) opening, prescription, payment, and closing balances for any selected period."
                          : "Albetétenkénti és alaponkénti (Közös Költség / Üzemeltetés és Felújítási Alap) nyitó egyenleg, előírás, befizetés és záró egyenleg teljes körű elszámolása."}
                      </p>
                    </div>

                    {/* Feature Bullets */}
                    <div className="bg-gray-50/80 rounded-2xl p-3.5 space-y-2 text-[11px] text-gray-700 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{isEn ? "Flexible month-by-month range (default: previous full calendar year)" : "Tetszőleges időszaki kimutatás (alapértelmezés: előző teljes naptári év)"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{isEn ? "Separate and total columns for Operating & Renovation Fund" : "Közös költség és Felújítási alap külön és összegezve"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{isEn ? "Strict pre-period opening balance, eliminating double-deductions" : "Szigorú nyitó állapot (00:00 előtt), kizárva a kettős levonást"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{isEn ? "Official 14-column spreadsheet with instant .xlsx download" : "Hivatalos 14 oszlopos Tht. elszámoló Excel azonnali letöltése"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Action Button: Dokumentum generálása */}
                  <button
                    onClick={() => setSelectedDocument('owner_balances')}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isEn ? "Generate Document" : "Dokumentum generálása"}</span>
                    <ArrowRight className="w-4 h-4 ml-0.5" />
                  </button>
                </div>

                {/* CARD 2: Éves Pénzügyi Zárszámadás (PLANNED) */}
                <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-5 opacity-90">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        {isEn ? "Under Development" : "Fejlesztés alatt"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-lg font-bold text-gray-900 font-display">
                        {isEn ? "Annual Financial Closing Report" : "Éves Pénzügyi Zárszámadás"}
                      </h4>
                      <p className="text-xs font-medium text-purple-700">
                        {isEn ? "Tht. Section 48 financial closing" : "Tht. 48. § szerinti pénzügyi elszámolás"}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed pt-1">
                        {isEn 
                          ? "Budget vs. actual expenditure comparison, cash flow analysis, bank ledger matching, and surplus distribution proposal."
                          : "Előző évi költségvetés és tényadatok részletes összevetése, maradványelszámolás, banki forgalom és mérlegkimutatás."}
                      </p>
                    </div>

                    <div className="bg-gray-50/80 rounded-2xl p-3.5 space-y-2 text-[11px] text-gray-600 border border-gray-100">
                      <div>&bull; {isEn ? "Budget vs actual expenditure comparison" : "Tervezett vs. tényadatok részletes összehasonlítása"}</div>
                      <div>&bull; {isEn ? "Cash flow analysis and reserve proposal" : "Pénzforgalmi kimutatás és maradvány felosztása"}</div>
                      <div>&bull; {isEn ? "Bank balance reconciliation" : "Banki záróegyenlegekkel való egyeztetés"}</div>
                    </div>
                  </div>

                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-400 font-bold text-xs rounded-2xl cursor-not-allowed border border-gray-200"
                  >
                    <span>{isEn ? "Coming Soon" : "Hamarosan elérhető"}</span>
                  </button>
                </div>

                {/* CARD 3: Következő Évi Költségvetési Terv (PLANNED) */}
                <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-5 opacity-90">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {isEn ? "Under Development" : "Fejlesztés alatt"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-lg font-bold text-gray-900 font-display">
                        {isEn ? "Next Year Budget Proposal" : "Következő Évi Költségvetési Terv"}
                      </h4>
                      <p className="text-xs font-medium text-amber-700">
                        {isEn ? "Tht. Section 47 economic plan" : "Tht. 47. § szerinti költségvetési javaslat"}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed pt-1">
                        {isEn 
                          ? "Projected revenue and planned expenditure forecast for the upcoming year with unit-level common fee suggestions."
                          : "A következő üzleti év tervezett üzemeltetési és felújítási bevételei és kiadásai, havi bontásban, javasolt közös költség tarifákkal."}
                      </p>
                    </div>

                    <div className="bg-gray-50/80 rounded-2xl p-3.5 space-y-2 text-[11px] text-gray-600 border border-gray-100">
                      <div>&bull; {isEn ? "Projected maintenance and utility fees" : "Tervezett karbantartási és közüzemi kiadások"}</div>
                      <div>&bull; {isEn ? "Renovation target reserve planning" : "Felújítási céltartalék képzésének ütemezése"}</div>
                      <div>&bull; {isEn ? "Proposed monthly fee per unit calculator" : "Javasolt havi díjak albetétenkénti kalkulátora"}</div>
                    </div>
                  </div>

                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-400 font-bold text-xs rounded-2xl cursor-not-allowed border border-gray-200"
                  >
                    <span>{isEn ? "Coming Soon" : "Hamarosan elérhető"}</span>
                  </button>
                </div>

                {/* CARD 4: Közgyűlési Meghívó és Jelenléti Ív (PLANNED) */}
                <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-5 opacity-90">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {isEn ? "Under Development" : "Fejlesztés alatt"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-lg font-bold text-gray-900 font-display">
                        {isEn ? "Meeting Minutes & Attendance Sheet" : "Jegyzőkönyv és Jelenléti Ív"}
                      </h4>
                      <p className="text-xs font-medium text-blue-700">
                        {isEn ? "Tht. Section 39 attendance & voting" : "Tht. 39. § szerinti jegyzőkönyv és jelenléti ív"}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed pt-1">
                        {isEn 
                          ? "Official meeting invitation template, attendance register with ownership share weights, and voting ballot generator."
                          : "Tulajdoni hányadokkal súlyozott határozatképesség-ellenőrző jelenléti ív, szavazati arányok és jegyzőkönyv sablon."}
                      </p>
                    </div>

                    <div className="bg-gray-50/80 rounded-2xl p-3.5 space-y-2 text-[11px] text-gray-600 border border-gray-100">
                      <div>&bull; {isEn ? "Quorum checker with ownership ratios" : "Határozatképesség ellenőrzés tulajdoni hányad alapján"}</div>
                      <div>&bull; {isEn ? "Official agenda item template" : "Hivatalos napirendi pont sablon és határozati tár"}</div>
                      <div>&bull; {isEn ? "Sign-in sheet with authentication lines" : "Hitelesítői aláírási ív és szavazólap"}</div>
                    </div>
                  </div>

                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-400 font-bold text-xs rounded-2xl cursor-not-allowed border border-gray-200"
                  >
                    <span>{isEn ? "Coming Soon" : "Hamarosan elérhető"}</span>
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* VIEW 2: TULAJDONOSI EGYENLEGEK ELSZÁMOLÁSA GENERÁTOR (Opened via "Dokumentum generálása" button) */}
          {selectedDocument === 'owner_balances' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Back button & Generator Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold shadow-2xs transition-all cursor-pointer w-fit"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                  <span>{isEn ? "Back to Documents Hub" : "← Vissza a dokumentumokhoz"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Excel (.xlsx)
                  </span>
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isEn ? "Download Excel" : "Excel letöltése"}</span>
                  </button>
                </div>
              </div>

              {/* Module: Tulajdonosi Egyenlegek Elszámolása Container */}
              <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-7 shadow-xs space-y-6">
                
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base sm:text-lg font-bold text-gray-900 font-display">
                          {isEn ? "Owner Balances Statement (Tht.)" : "Tulajdonosi egyenlegek elszámolása"}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {isEn ? "Full Year or Custom Period" : "Havi / Éves választó"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {isEn 
                          ? "Unit-by-unit breakdown of Operating (KK) and Renovation Fund (FA) opening, prescription, payment, and closing balances."
                          : "Albetétenkénti és alaponkénti (Közös Költség / Üzemeltetés és Felújítási Alap) nyitó, előírás, befizetés és záró egyenleg elszámolás."}
                      </p>
                    </div>
                  </div>

                </div>

                {/* Date Range Selector Controls */}
                <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Month Pickers */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                          {isEn ? "Start Month" : "Kezdő hónap"}
                        </label>
                        <div className="relative">
                          <input
                            type="month"
                            value={startMonth}
                            onChange={(e) => setStartMonth(e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1E3A8A] shadow-2xs cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center text-gray-400 pt-5">
                        <ArrowRight className="w-4 h-4" />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                          {isEn ? "End Month" : "Záró hónap"}
                        </label>
                        <div className="relative">
                          <input
                            type="month"
                            value={endMonth}
                            onChange={(e) => setEndMonth(e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-[#1E3A8A] shadow-2xs cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                        {isEn ? "Quick Presets" : "Gyorsválasztó"}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreset('prevYear')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            startMonth === `${prevYear}-01` && endMonth === `${prevYear}-12`
                              ? 'bg-[#1E3A8A] text-white shadow-xs'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {prevYear} {isEn ? "Full Year (Default)" : "Előző teljes év"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreset('curYear')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            startMonth === `${curYear}-01` && endMonth === `${curYear}-12`
                              ? 'bg-[#1E3A8A] text-white shadow-xs'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {curYear} {isEn ? "Current Year" : "Aktuális év"}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Live Interactive Preview Table */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {isEn ? "Statement Table Preview" : "Elszámolási táblázat előnézet"} ({report.rows.length} {isEn ? "units" : "albetét"})
                      </h5>
                    </div>

                    {/* Table search filter */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isEn ? "Search flat or owner..." : "Keresés albetét/tulajdonos..."}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* Responsive Scroll Table */}
                  <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-[#1E3A8A] text-white sticky top-0 z-10 select-none">
                          <tr>
                            <th className="py-3 px-3 min-w-[110px] font-bold border-r border-blue-800">
                              {isEn ? "Unit" : "Albetét"}
                            </th>
                            {!hideOwnerPii && (
                              <th className="py-3 px-3 min-w-[170px] font-bold border-r border-blue-800">
                                {isEn ? "Owner(s)" : "Tulajdonos(ok)"}
                              </th>
                            )}
                            <th className="py-3 px-3 min-w-[150px] font-bold border-r border-blue-800">
                              {isEn ? "Fund" : "Alap"}
                            </th>
                            <th className="py-3 px-3 text-right min-w-[110px] font-bold border-r border-blue-800">
                              {isEn ? "Opening" : "Nyitó"}
                            </th>
                            <th className="py-3 px-3 text-right min-w-[110px] font-bold border-r border-blue-800">
                              {isEn ? "Debit" : "Előírás"}
                            </th>
                            <th className="py-3 px-3 text-right min-w-[110px] font-bold border-r border-blue-800">
                              {isEn ? "Payment" : "Befizetés"}
                            </th>
                            <th className="py-3 px-3 text-right min-w-[120px] font-black bg-blue-950/60">
                              {isEn ? "Closing" : "Záró"}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredRows.map((r) => (
                            <React.Fragment key={r.flatNum}>
                              {/* 1. Közös Költség (KK) Row */}
                              <tr className="hover:bg-blue-50/40 transition-colors border-t border-gray-200">
                                <td className="py-2.5 px-3 font-bold text-gray-900 border-r border-gray-100 truncate">
                                  {r.flatLabel}
                                </td>
                                {!hideOwnerPii && (
                                  <td className="py-2.5 px-3 text-gray-700 font-medium border-r border-gray-100 truncate max-w-[200px]" title={r.ownerName}>
                                    {r.ownerName}
                                  </td>
                                )}
                                <td className="py-2.5 px-3 border-r border-gray-100">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                    {isEn ? "Common Fee (KK)" : "Közös Költség (KK)"}
                                  </span>
                                </td>
                                <td className={`py-2.5 px-3 text-right font-medium ${r.nyitoKK < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                  {formatCurrency(r.nyitoKK)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-medium text-gray-700">
                                  {formatCurrency(r.eloirasKK)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                                  +{formatCurrency(r.befizetesKK)}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-bold bg-blue-50/40 ${r.zaroKK < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                                  {formatCurrency(r.zaroKK)}
                                </td>
                              </tr>

                              {/* 2. Felújítási Alap (FA) Row */}
                              <tr className="hover:bg-amber-50/40 transition-colors border-b-2 border-gray-200 bg-gray-50/30">
                                <td className="py-2 px-3 text-xs text-gray-500 border-r border-gray-100 truncate">
                                  {r.flatLabel}
                                </td>
                                {!hideOwnerPii && (
                                  <td className="py-2 px-3 text-xs text-gray-500 border-r border-gray-100 truncate max-w-[200px]" title={r.ownerName}>
                                    {r.ownerName}
                                  </td>
                                )}
                                <td className="py-2 px-3 border-r border-gray-100">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                    {isEn ? "Renovation Fund (FA)" : "Felújítási Alap (FA)"}
                                  </span>
                                </td>
                                <td className={`py-2 px-3 text-right font-medium ${r.nyitoFA < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                  {formatCurrency(r.nyitoFA)}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-gray-700">
                                  {formatCurrency(r.eloirasFA)}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-emerald-700">
                                  +{formatCurrency(r.befizetesFA)}
                                </td>
                                <td className={`py-2 px-3 text-right font-bold bg-amber-50/30 ${r.zaroFA < 0 ? 'text-red-600' : 'text-amber-900'}`}>
                                  {formatCurrency(r.zaroFA)}
                                </td>
                              </tr>
                            </React.Fragment>
                          ))}

                          {filteredRows.length === 0 && (
                            <tr>
                              <td colSpan="7" className="py-8 text-center text-gray-400">
                                {isEn ? "No matching flats found" : "Nincs a keresési feltételnek megfelelő albetét"}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Bottom Full-width Excel Download Action Bar */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500 text-center sm:text-left">
                    <span>{isEn ? "File will be saved as: " : "Mentésre kerülő fájl: "}</span>
                    <strong className="text-gray-800 font-mono font-bold">{excelFileName}</strong>
                  </div>

                  <button
                    onClick={handleDownload}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow transition-all cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isEn ? "Download Formatted Excel (.xlsx)" : "Formázott Excel letöltése (.xlsx)"}</span>
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
