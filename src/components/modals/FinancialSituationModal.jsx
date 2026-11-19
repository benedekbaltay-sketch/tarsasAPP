import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LineChart, 
  Scale, 
  Menu,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { 
  formatCurrency, 
  getBuildingReserveAsOf, 
  getBuildingRenovationFundAsOf, 
  getMonthlyStats,
  getPreviousMonthClosingDate,
  getFlatClosingState
} from '../../utils/finances';
import { ProfileSwitcherButton } from '../ProfileSwitcherButton';
import { NavLogoButton } from '../NavLogoButton';
import { ImpersonationBanner } from '../ImpersonationBanner';
import { MonthlyDetailModal } from './MonthlyDetailModal';
import { BankImportModal } from './BankImportModal';

export function FinancialSituationModal({ isOpen, onClose, onOpenDrawer, onOpenProfileSelector, onOpenEditTx }) {
  const { state, t } = useApp();
  const { flats, currentLang, currentUser } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const [selectedMonthData, setSelectedMonthData] = useState(null);
  const [isBankImportOpen, setIsBankImportOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }, [isOpen]);

  if (!isOpen || !currentUser) return null;

  const prevMonthInfo = getPreviousMonthClosingDate();
  const closingDateLabel = isEn
    ? `${prevMonthInfo.monthNameEn} ${prevMonthInfo.day}, ${prevMonthInfo.year}`
    : `${prevMonthInfo.year}. ${prevMonthInfo.monthNameHu.toLowerCase()} ${prevMonthInfo.day}.`;

  const reserveKK = getBuildingReserveAsOf(prevMonthInfo.dateStr, state);
  const reserveFA = getBuildingRenovationFundAsOf(prevMonthInfo.dateStr, state);
  const totalReserve = reserveKK + reserveFA;

  // Last 3 completed months (excluding current unfinished month)
  const now = new Date();
  const pastMonths = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const stats = getMonthlyStats(d.getFullYear(), d.getMonth() + 1, state);
    pastMonths.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      name: `${d.getFullYear()}. ${(d.getMonth() + 1).toString().padStart(2, '0')}`,
      ...stats
    });
  }

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
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <LineChart className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {t.menu_finance}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {isEn ? `Closing state: ${closingDateLabel}` : `Záró állapot: ${closingDateLabel}`}
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Actions & Profile Selector */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 flex-1 flex-shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsBankImportOpen(true)}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title={t.bank_import_btn}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>{t.bank_import_btn}</span>
              </button>
            )}
            <ProfileSwitcherButton onOpenProfileSelector={onOpenProfileSelector} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto w-full overscroll-contain">
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
        
        {/* Admin Action: Bank Import & Excel Upload Banner */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-blue-900 via-[#1E3A8A] to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center shrink-0 shadow-inner">
                <FileSpreadsheet className="w-6 h-6 text-blue-200" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    {t.bank_import_title}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white uppercase tracking-wider">
                    {isEn ? "Smart Match" : "Intelligens párosító"}
                  </span>
                </div>
                <p className="text-xs text-blue-100/90 mt-0.5 max-w-xl">
                  {t.bank_import_subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBankImportOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-[#1E3A8A] text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#1E3A8A]" />
              <span>{t.bank_import_btn}</span>
            </button>
          </div>
        )}
        
        {/* 1. Reserves Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {isEn ? "Building Reserves" : "Társasházi tartalékok"}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#1E3A8A]">
              {isEn ? `Closing: ${closingDateLabel}` : `Záró állapot: ${closingDateLabel}`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                {t.kpi_building_reserve}
              </span>
              <span className={`text-2xl font-black font-display ${reserveKK >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(reserveKK)}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                {t.kpi_renovation_fund}
              </span>
              <span className={`text-2xl font-black font-display ${reserveFA >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                {formatCurrency(reserveFA)}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                {isEn ? "Total Reserve" : "Összes tartalék"}
              </span>
              <span className="text-2xl font-black text-[#1E3A8A] font-display">
                {formatCurrency(totalReserve)}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Public Arrears Map */}
        {(() => {
          const flatDebtItems = (flats || []).map((flat) => {
            const closedState = getFlatClosingState(flat.flatNum, prevMonthInfo.dateStr, state);
            return {
              flatNum: flat.flatNum,
              totalBal: closedState.total,
              kkBal: closedState.kk,
              faBal: closedState.fa,
              isDebtor: closedState.isDebtor,
              isOverpaid: closedState.total > 0
            };
          });

          const totalDebtors = flatDebtItems.filter(item => item.isDebtor).length;
          const totalSettled = flatDebtItems.length - totalDebtors;
          const totalArrearsAmount = flatDebtItems
            .filter(item => item.isDebtor)
            .reduce((sum, item) => sum + Math.abs(item.totalBal), 0);

          return (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-gray-900 font-display">
                      {isEn ? "Public Debt / Arrears Map" : "Nyilvános tartozástérkép"}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#1E3A8A]">
                      {isEn ? `Closed: ${closingDateLabel}` : `Záró állapot: ${closingDateLabel}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isEn 
                      ? `Official closing status of all flats as of previous month (${closingDateLabel}).` 
                      : `A lakások egyenlegének hivatalos státusza az előző hónap záró állapota szerint (${closingDateLabel}).`}
                  </p>
                </div>
              </div>

              {/* Quick Summary KPI Bar */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 text-center text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">
                    {isEn ? "Total Flats" : "Összes lakás"}
                  </span>
                  <span className="text-sm font-extrabold text-gray-900 font-display">
                    {flatDebtItems.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">
                    {isEn ? "Settled" : "Rendezett"}
                  </span>
                  <span className="text-sm font-extrabold text-emerald-600 font-display">
                    {totalSettled} <span className="text-[10px] font-medium text-gray-400">({flatDebtItems.length > 0 ? Math.round((totalSettled / flatDebtItems.length) * 100) : 0}%)</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-red-600 font-bold uppercase block">
                    {isEn ? "In Arrears" : "Hátralékos"}
                  </span>
                  <span className="text-sm font-extrabold text-red-600 font-display">
                    {totalDebtors} <span className="text-[10px] font-medium text-gray-400">({flatDebtItems.length > 0 ? Math.round((totalDebtors / flatDebtItems.length) * 100) : 0}%)</span>
                  </span>
                </div>
              </div>

              {/* Flats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {flatDebtItems.map((item) => {
                  const statusText = item.isDebtor 
                    ? (isEn ? "Arrears" : "Hátralék") 
                    : (item.isOverpaid ? (isEn ? "Overpaid" : "Túlfizetés") : (isEn ? "Settled" : "Rendezett"));

                  return (
                    <div
                      key={item.flatNum}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        item.isDebtor 
                          ? 'bg-red-50/80 border-red-200 text-red-900 shadow-2xs' 
                          : (item.isOverpaid 
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-2xs' 
                              : 'bg-emerald-50/50 border-emerald-200 text-emerald-900')
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-xs font-extrabold text-gray-900">
                          {item.flatNum}. {isEn ? "Flat" : "lakás"}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.isDebtor 
                            ? 'bg-red-200/70 text-red-800' 
                            : (item.isOverpaid ? 'bg-emerald-200/80 text-emerald-800' : 'bg-emerald-200/60 text-emerald-800')
                        }`}>
                          {statusText}
                        </span>
                      </div>

                      <div className={`text-sm font-black font-display my-1 ${
                        item.isDebtor 
                          ? 'text-red-700' 
                          : 'text-emerald-700'
                      }`}>
                        {formatCurrency(item.totalBal)}
                      </div>

                      {/* Sub-account breakdown */}
                      <div className="text-[10px] font-medium opacity-80 pt-1.5 border-t border-black/5 flex flex-col gap-0.5">
                        <div className="flex justify-between">
                          <span className="text-gray-500">KK:</span>
                          <span className="font-semibold">{formatCurrency(item.kkBal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">FA:</span>
                          <span className="font-semibold">{formatCurrency(item.faBal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Arrears Sum Note */}
              {totalArrearsAmount > 0 && (
                <div className="text-right text-xs text-gray-500 pt-1 font-medium">
                  {isEn ? "Total building arrears in this period:" : "A társasház teljes fennálló hátraléka az időszakban:"}{' '}
                  <strong className="text-red-600 font-bold">{formatCurrency(-totalArrearsAmount)}</strong>
                </div>
              )}

            </div>
          );
        })()}

        {/* 3. Last 3 Months Performance Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-bold text-gray-900 font-display">
                {isEn ? "Monthly Balances (Last 3 Closed Months)" : "Havi pénzügyi mérlegek (Előző 3 lezárt hónap)"}
              </h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
              {t.month_hint_interact || (isEn ? "Double-click or press Enter to view itemized accounting" : "Dupla kattintás vagy Enter a részletes könyveléshez")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">{t.date}</th>
                  <th className="py-3 px-4">{t.income_str}</th>
                  <th className="py-3 px-4">{t.expense_str}</th>
                  <th className="py-3 px-4 text-right">Margó (+/-)</th>
                  <th className="py-3 px-3 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pastMonths.map((m, idx) => (
                  <tr 
                    key={idx} 
                    tabIndex={0}
                    role="button"
                    title={t.open_monthly_ledger || (isEn ? "Open monthly ledger" : "Havi részletes könyvelés megnyitása")}
                    onClick={() => setSelectedMonthData(m)}
                    onDoubleClick={() => setSelectedMonthData(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedMonthData(m);
                      }
                    }}
                    className="hover:bg-blue-50/70 focus:bg-blue-50 focus:outline-none transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-bold text-gray-900 group-hover:text-blue-700">{m.name}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">+{formatCurrency(m.inflow)}</td>
                    <td className="py-3 px-4 font-semibold text-red-600">-{formatCurrency(m.outflow)}</td>
                    <td className={`py-3 px-4 text-right font-bold text-sm ${m.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(m.margin)}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-400 group-hover:text-blue-600">
                      <ChevronRight className="w-4 h-4 inline-block transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    {/* Monthly Ledger Drill-down Modal */}
    <MonthlyDetailModal
      isOpen={Boolean(selectedMonthData)}
      monthData={selectedMonthData}
      onClose={() => setSelectedMonthData(null)}
      onOpenEditTx={onOpenEditTx}
    />

    {/* Bank Import & Smart Matching Review Modal */}
    <BankImportModal
      isOpen={isBankImportOpen}
      onClose={() => setIsBankImportOpen(false)}
    />
  </div>
);
}
