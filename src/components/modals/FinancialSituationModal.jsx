import React from 'react';
import { useApp } from '../../context/AppContext';
import { LineChart, ArrowLeft, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { 
  formatCurrency, 
  getBuildingReserve, 
  getBuildingRenovationFund, 
  getMonthlyStats 
} from '../../utils/finances';

export function FinancialSituationModal({ isOpen, onClose }) {
  const { state, t } = useApp();
  const { flats, currentLang } = state;
  const isEn = currentLang === 'en';

  if (!isOpen) return null;

  const reserveKK = getBuildingReserve(state);
  const reserveFA = getBuildingRenovationFund(state);
  const totalReserve = reserveKK + reserveFA;

  // Last 3 months calculations
  const now = new Date();
  const pastMonths = [];
  for (let i = 0; i < 3; i++) {
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
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col animate-fadeIn">
      
      {/* Sticky Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            title="Vissza"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <LineChart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display">
                {t.menu_finance}
              </h2>
              <span className="text-xs text-gray-500">
                {isEn ? "Condominium Reserves & Monthly Balance" : "Társasház egyenlegei és havi pénzügyi mérlege"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
        
        {/* 1. Reserves Cards */}
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

        {/* 2. Last 3 Months Performance Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Scale className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {isEn ? "Monthly Balances (Last 3 months)" : "Havi pénzügyi mérlegek (Előző 3 hónap)"}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-semibold border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">{t.date}</th>
                  <th className="py-3 px-4">{t.income_str}</th>
                  <th className="py-3 px-4">{t.expense_str}</th>
                  <th className="py-3 px-4 text-right">Margó (+/-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pastMonths.map((m, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4 font-bold text-gray-900">{m.name}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">+{formatCurrency(m.inflow)}</td>
                    <td className="py-3 px-4 font-semibold text-red-600">-{formatCurrency(m.outflow)}</td>
                    <td className={`py-3 px-4 text-right font-bold text-sm ${m.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(m.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Public Arrears Map */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {isEn ? "Public Debt / Arrears Map" : "Nyilvános tartozástérkép"}
            </h3>
            <p className="text-xs text-gray-500">
              {isEn
                ? "Status of flat balances as of previous month closing."
                : "A lakások egyenlegének státusza az előző hónap záró állapota szerint."}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(flats || []).map((flat) => {
              const totalBal = (flat.balance || 0) + (flat.renovationBalance || 0);
              const isDebtor = totalBal < 0;

              return (
                <div
                  key={flat.flatNum}
                  className={`p-3 rounded-xl border flex flex-col justify-between ${
                    isDebtor 
                      ? 'bg-red-50 border-red-200 text-red-700' 
                      : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <span className="text-xs font-bold">{flat.flatNum}. {isEn ? "Flat" : "lakás"}</span>
                  <span className="text-xs font-extrabold mt-1">
                    {formatCurrency(totalBal)}
                  </span>
                  <span className="text-[10px] font-semibold mt-1 opacity-80">
                    {isDebtor ? (isEn ? "Arrears" : "Hátralék") : (isEn ? "Settled" : "Rendezett")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
