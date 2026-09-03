import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Pencil, 
  PlusCircle, 
  Scale, 
  LayoutGrid, 
  Plus, 
  Home, 
  Trash2, 
  Search, 
  X, 
  Download, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  FileText,
  List
} from 'lucide-react';
import { 
  formatCurrency, 
  getBuildingReserve, 
  getBuildingRenovationFund, 
  getMonthlyStats 
} from '../utils/finances';
import { exportTransactionsToExcel } from '../utils/exportExcel';

export function AdminView({
  onOpenFlatDetail,
  onOpenAddTransaction,
  onOpenAddFlat,
  onOpenGlobalBalances,
  onOpenGlobalAddTx,
  onOpenEditFlatMaster,
  onOpenEditTx,
  onOpenDeleteFlatConfirm,
  onOpenDeleteTxConfirm,
  onOpenQuickPayConfirm,
  onOpenFullscreenTx
}) {
  const { state, t, toggleGridEditMode } = useApp();
  const { flats, transactions, expenses, isGridEditMode, currentLang } = state;
  const isEn = currentLang === 'en';

  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [isTxEditMode, setIsTxEditMode] = useState(false);

  // Financial indicators
  const buildingReserveKK = getBuildingReserve(state);
  const buildingReserveFA = getBuildingRenovationFund(state);

  // Calculate total arrears (sum of negative balances across all flats)
  const totalArrears = (flats || []).reduce((acc, f) => {
    let sum = 0;
    if ((f.balance || 0) < 0) sum += Math.abs(f.balance);
    if ((f.renovationBalance || 0) < 0) sum += Math.abs(f.renovationBalance);
    return acc + sum;
  }, 0);

  const now = new Date();
  const monthlyStats = getMonthlyStats(now.getFullYear(), now.getMonth() + 1, state);

  // Combine transactions and expenses for the list
  const combinedTxList = [
    ...(transactions || []).map(t => ({
      ...t,
      itemType: 'Transaction',
      isExpense: false,
      dateVal: new Date(t.date || 0)
    })),
    ...(expenses || []).map(e => ({
      ...e,
      itemType: 'Expense',
      isExpense: true,
      flatNum: 'Kiadás',
      dateVal: new Date(e.date || 0)
    }))
  ];

  combinedTxList.sort((a, b) => b.dateVal - a.dateVal);

  const filteredTxList = combinedTxList.filter(item => {
    if (!txSearchQuery.trim()) return true;
    const q = txSearchQuery.toLowerCase();
    return (
      (item.date && item.date.toLowerCase().includes(q)) ||
      (item.flatNum && item.flatNum.toLowerCase().includes(q)) ||
      (item.targetAccount && item.targetAccount.toLowerCase().includes(q)) ||
      (item.provider && item.provider.toLowerCase().includes(q)) ||
      (item.comment && item.comment.toLowerCase().includes(q)) ||
      (item.amount && item.amount.toString().includes(q))
    );
  });

  const previewTxList = filteredTxList.slice(0, 5);

  const handleExportExcel = () => {
    exportTransactionsToExcel(transactions, expenses, isEn);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6">
      
      {/* 1. Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* Card 1: Building Reserves (KK & FA) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider block mb-1">
                {t.kpi_building_reserve}
              </span>
              <span className={`text-2xl font-black font-display ${buildingReserveKK >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(buildingReserveKK)}
              </span>
            </div>
            <button
              onClick={onOpenGlobalBalances}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-all cursor-pointer"
              title="Számlafőösszeg szerkesztése"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border-t border-gray-100 pt-3.5 mt-3.5">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block mb-1">
              {t.kpi_renovation_fund}
            </span>
            <span className={`text-2xl font-black font-display ${buildingReserveFA >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
              {formatCurrency(buildingReserveFA)}
            </span>
          </div>
        </div>

        {/* Card 2: Total Arrears & Add Global Item */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">
              {t.kpi_total_arrears}
            </span>
            <span className="text-2xl font-black text-red-600 font-display">
              {formatCurrency(totalArrears)}
            </span>
          </div>

          <div className="border-t border-gray-100 pt-3.5 mt-3.5">
            <button
              onClick={onOpenGlobalAddTx}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1E3A8A] hover:bg-[#1e40af] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t.add_global_item_btn}</span>
            </button>
          </div>
        </div>

      </div>

      {/* 2. Monthly Balance Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-medium block">
              {t.kpi_monthly_balance} ({monthlyStats.year}. {monthlyStats.month.toString().padStart(2, '0')})
            </span>
            <span className={`text-xl font-black font-display ${monthlyStats.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(monthlyStats.margin)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
          <div>
            <span className="text-gray-400 block text-[11px] uppercase tracking-wider">{t.income_str}:</span>
            <span className="font-bold text-emerald-600">+{formatCurrency(monthlyStats.inflow)}</span>
          </div>
          <div className="h-6 w-px bg-gray-200"></div>
          <div>
            <span className="text-gray-400 block text-[11px] uppercase tracking-wider">{t.expense_str}:</span>
            <span className="font-bold text-red-600">-{formatCurrency(monthlyStats.outflow)}</span>
          </div>
        </div>
      </div>

      {/* 3. Arrears Matrix: Flats and Balances */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-gray-500" />
            <h3 className="text-base font-bold text-gray-900 font-display">
              {t.admin_arrears_title}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenAddTransaction}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.admin_add_transaction}</span>
            </button>

            {isGridEditMode && (
              <button
                onClick={onOpenAddFlat}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>{t.admin_add_flat}</span>
              </button>
            )}

            <button
              onClick={toggleGridEditMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isGridEditMode
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{t.edit}</span>
            </button>
          </div>
        </div>

        {/* Tile Grid */}
        <div className="p-4 sm:p-6 bg-[#F3F4F6]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(flats || []).map((flat) => {
              const hasArrears = (flat.balance || 0) < 0 || (flat.renovationBalance || 0) < 0;
              const totalBalance = (flat.balance || 0) + (flat.renovationBalance || 0);

              return (
                <div
                  key={flat.flatNum}
                  onClick={() => onOpenFlatDetail(flat.flatNum)}
                  className={`rounded-xl border p-4 flex flex-col justify-between shadow-xs transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
                    hasArrears
                      ? 'bg-red-50/60 border-red-200 hover:border-red-400'
                      : 'bg-white border-gray-200 hover:border-blue-400'
                  }`}
                >
                  {/* Flat Card Header */}
                  <div className="flex items-start justify-between border-b border-gray-100 pb-2.5 mb-2.5">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">
                        {flat.flatNum}. {isEn ? "Flat" : "lakás"}
                      </h4>
                      <span className="text-xs text-gray-500 font-medium truncate block max-w-[150px]">
                        {flat.ownerName}
                      </span>
                    </div>

                    {isGridEditMode ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onOpenEditFlatMaster(state.currentBuildingId, flat.flatNum)}
                          className="p-1 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Törzsadatok szerkesztése"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenDeleteFlatConfirm(flat.flatNum)}
                          className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50"
                          title="Lakás törlése"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        totalBalance < 0 
                          ? 'bg-red-100 text-red-700' 
                          : totalBalance > 0 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-blue-50 text-blue-700'
                      }`}>
                        {formatCurrency(totalBalance)}
                      </span>
                    )}
                  </div>

                  {/* Balances details */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">KK egyenleg:</span>
                      <strong className={flat.balance < 0 ? 'text-red-600' : 'text-gray-900'}>
                        {formatCurrency(flat.balance || 0)}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">FA egyenleg:</span>
                      <strong className={flat.renovationBalance < 0 ? 'text-red-600' : 'text-gray-900'}>
                        {formatCurrency(flat.renovationBalance || 0)}
                      </strong>
                    </div>
                  </div>

                  {/* Quick pay buttons */}
                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onOpenQuickPayConfirm(flat.flatNum, 'KK', flat.monthlyFee)}
                      className="flex-1 py-1 rounded bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] text-[11px] font-bold transition-colors"
                      title="Gyors KK befizetés"
                    >
                      +KK
                    </button>
                    <button
                      onClick={() => onOpenQuickPayConfirm(flat.flatNum, 'FA', flat.renovationFee)}
                      className="flex-1 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition-colors"
                      title="Gyors FA befizetés"
                    >
                      +FA
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. All Transactions & Expenses Table (Revolut style) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 sticky top-14 bg-white z-10">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-gray-500" />
            <h3 className="text-base font-bold text-gray-900 font-display">
              {t.admin_all_tx_title}
            </h3>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap flex-1 sm:flex-initial max-w-md ml-auto">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                placeholder={t.search_placeholder}
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#1E3A8A] focus:bg-white transition-all"
              />
              {txSearchQuery && (
                <button
                  onClick={() => setTxSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Excel Export */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0 cursor-pointer"
              title="Exportálás Excelbe"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            {/* Edit Mode Toggle */}
            <button
              onClick={() => setIsTxEditMode(!isTxEditMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-colors flex-shrink-0 cursor-pointer ${
                isTxEditMode
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{t.edit}</span>
            </button>
          </div>
        </div>

        {/* Transactions Modern List */}
        <div className="divide-y divide-gray-100">
          {previewTxList.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {isEn ? "No records found" : "Nem található tranzakció"}
            </div>
          ) : (
            previewTxList.map((item) => {
              const isExpense = item.isExpense;
              const isKK = item.targetAccount === "Közös Költség";

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-gray-50/70 transition-colors flex items-center justify-between gap-4"
                >
                  {/* Left: Icon & Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isExpense ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {isExpense ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {isExpense ? item.provider || item.category : `${item.flatNum}. lakás`}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isKK ? 'bg-blue-100 text-[#1E3A8A]' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {isKK ? 'KK' : 'FA'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        <span>{item.date}</span>
                        {item.comment && <span> &bull; {item.comment}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className={`text-sm font-bold font-display ${isExpense ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isExpense ? '-' : '+'}{formatCurrency(item.amount)}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {item.method || item.category}
                      </div>
                    </div>

                    {isTxEditMode && (
                      <div className="flex items-center gap-1 border-l border-gray-100 pl-2">
                        <button
                          onClick={() => onOpenEditTx(item.id, isExpense ? 'Expense' : 'Payment')}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Szerkesztés"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onOpenDeleteTxConfirm(item.id, isExpense ? 'Expense' : 'Payment')}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                          title="Törlés"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* View all transactions footer */}
        <div className="p-4 border-t border-gray-100 text-center bg-gray-50/50">
          <button
            onClick={() => onOpenFullscreenTx('global')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <List className="w-3.5 h-3.5" />
            <span>{t.show_all}</span>
          </button>
        </div>

      </div>

    </div>
  );
}
