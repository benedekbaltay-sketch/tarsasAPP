import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  Paperclip, 
  Download, 
  Pencil, 
  Home, 
  Building,
  CheckCircle2,
  Calendar,
  Filter
} from 'lucide-react';
import { formatCurrency, translateCategory, getBuildingAccounts } from '../../utils/finances';
import { useBackdropClose } from '../../utils/useBackdropClose';

export function MonthlyDetailModal({
  isOpen,
  monthData, // { year, month, name, inflow, outflow, margin }
  onClose,
  onOpenEditTx
}) {
  const { state, t } = useApp();
  const { transactions, expenses, flats, currentLang, currentUser, buildings, currentBuildingId } = state;
  const isEn = currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const currentBuilding = (buildings || []).find(b => b.id === currentBuildingId) || buildings?.[0];
  const allAccounts = useMemo(() => getBuildingAccounts(currentBuilding), [currentBuilding]);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [accountFilter, setAccountFilter] = useState('all');

  const backdropProps = useBackdropClose(onClose);

  // Month prefix in standard ISO format YYYY-MM
  const monthPrefix = useMemo(() => {
    if (!monthData?.year || !monthData?.month) return '';
    return `${monthData.year}-${String(monthData.month).padStart(2, '0')}`;
  }, [monthData]);

  // Flat lookup map
  const flatMap = useMemo(() => {
    const map = {};
    (flats || []).forEach(f => {
      if (f && f.flatNum) map[String(f.flatNum)] = f;
    });
    return map;
  }, [flats]);

  // Bank transaction predicate: only real movements affecting the bank account total
  const isBankTx = (tx) => tx && tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";

  // Aggregate only items belonging to this month that actually affected the bank accounts
  const monthItems = useMemo(() => {
    if (!isOpen || !monthPrefix) return [];

    const cleanDate = (d) => String(d || '').replace(/\./g, '-').trim();
    const result = [];

    // 1. Bank Payments & Inflows (Befizetések, átvezetések, banki jóváírások)
    (transactions || []).forEach(tx => {
      if (!tx || !tx.date) return;
      if (
        cleanDate(tx.date).startsWith(monthPrefix) && 
        tx.status === 'Verified' && 
        tx.type !== 'Correction' && 
        tx.includeInBalance !== false && 
        isBankTx(tx)
      ) {
        const isNegative = tx.type === 'Debit' || Number(tx.amount) < 0;
        result.push({
          id: tx.id,
          date: tx.date,
          type: 'Payment',
          isExpense: false,
          isNegative,
          amount: Number(tx.amount) || 0,
          flatNum: tx.flatNum,
          targetAccount: tx.targetAccount || 'Közös Költség',
          comment: tx.comment || (isEn ? "Payment" : "Befizetés"),
          category: tx.method || (isEn ? "Bank Transfer" : "Banki átutalás"),
          method: tx.method,
          attachments: tx.attachments || (tx.attachment ? [tx.attachment] : []),
          includeInBalance: true,
          rawItem: tx
        });
      }
    });

    // 2. Bank Expenses & Outflows (Kiadások)
    (expenses || []).forEach(exp => {
      if (!exp || !exp.date) return;
      if (
        cleanDate(exp.date).startsWith(monthPrefix) && 
        exp.includeInBalance !== false && 
        isBankTx(exp)
      ) {
        result.push({
          id: exp.id,
          date: exp.date,
          type: 'Expense',
          isExpense: true,
          isNegative: true,
          amount: -(Math.abs(Number(exp.amount) || 0)),
          flatNum: exp.flatNum,
          provider: exp.provider || exp.title || (isEn ? "Expense" : "Kiadás"),
          title: exp.title || exp.provider,
          targetAccount: exp.targetAccount || 'Közös Költség',
          comment: exp.comment || exp.title || (isEn ? "Expense" : "Kiadás"),
          category: exp.category || 'Utility',
          attachments: exp.attachments || (exp.attachment ? [exp.attachment] : []),
          includeInBalance: true,
          rawItem: exp
        });
      }
    });

    // Technical bookkeeping debits / assessments (előírások) are completely omitted as requested.

    // Sort descending by date, then id
    result.sort((a, b) => {
      const diff = new Date(b.date) - new Date(a.date);
      if (diff !== 0) return diff;
      return (b.id || '').localeCompare(a.id || '');
    });

    return result;
  }, [isOpen, monthPrefix, transactions, expenses, isEn]);

  // Filtered items based on search, type, and account
  const filteredItems = useMemo(() => {
    return monthItems.filter(item => {
      // Type filter
      if (typeFilter === 'income' && item.isExpense) return false;
      if (typeFilter === 'expense' && !item.isExpense) return false;

      // Account filter
      if (accountFilter !== 'all' && item.targetAccount !== accountFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fNum = String(item.flatNum || '').toLowerCase();
        const owner = String(flatMap[item.flatNum]?.ownerName || '').toLowerCase();
        const prov = String(item.provider || '').toLowerCase();
        const title = String(item.title || '').toLowerCase();
        const comm = String(item.comment || '').toLowerCase();
        const amt = String(Math.abs(item.amount));
        const cat = String(item.category || '').toLowerCase();

        return (
          fNum.includes(q) ||
          owner.includes(q) ||
          prov.includes(q) ||
          title.includes(q) ||
          comm.includes(q) ||
          amt.includes(q) ||
          cat.includes(q)
        );
      }

      return true;
    });
  }, [monthItems, typeFilter, accountFilter, searchQuery, flatMap]);

  // Aggregate stats for this month
  const totalInflow = useMemo(() => {
    return monthItems
      .filter(item => !item.isExpense && item.amount > 0 && item.includeInBalance !== false)
      .reduce((sum, item) => sum + item.amount, 0);
  }, [monthItems]);

  const totalOutflow = useMemo(() => {
    return monthItems
      .filter(item => item.isExpense && item.includeInBalance !== false)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  }, [monthItems]);

  const netMargin = totalInflow - totalOutflow;

  if (!isOpen || !monthData) return null;

  return (
    <div 
      className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-scaleUp">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#1E3A8A] text-white">
                {monthData.name}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 font-display truncate">
                {t.monthly_ledger_title || (isEn ? "Detailed Monthly Ledger" : "Havi részletes könyvelés")}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {isEn 
                ? "Itemized accounting records, transactions, and expenses for this period" 
                : "A kiválasztott hónap egyedi könyvelési tételei, befizetései és kiadásai"}
            </p>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer transition-colors shrink-0"
            title={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Monthly Financial Performance KPI Bar */}
        <div className="p-4 sm:px-6 bg-gray-50/50 border-b border-gray-100 grid grid-cols-3 gap-3 text-center shrink-0">
          <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
              {t.monthly_inflow || (isEn ? "Monthly Income" : "Havi bevételek")}
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-600 font-display">
              +{formatCurrency(totalInflow)}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
              {t.monthly_outflow || (isEn ? "Monthly Expenses" : "Havi kiadások")}
            </span>
            <span className="text-sm sm:text-base font-black text-red-600 font-display">
              -{formatCurrency(totalOutflow)}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
              {t.monthly_margin || (isEn ? "Monthly Margin" : "Havi egyenleg (Margó)")}
            </span>
            <span className={`text-sm sm:text-base font-black font-display ${netMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(netMargin)}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 sm:px-6 border-b border-gray-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search_month_items || (isEn ? "Search by flat, partner, reference or amount..." : "Keresés lakás, partner, jogcím vagy összeg alapján...")}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Type and Account Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type Filter Pills */}
            <div className="flex p-0.5 bg-gray-100 rounded-xl border border-gray-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  typeFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t.all_items || (isEn ? "All" : "Összes")} ({monthItems.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('income')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  typeFilter === 'income' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-500 hover:text-emerald-700'
                }`}
              >
                {t.only_inflow || (isEn ? "Income (+)" : "Bevételek (+)")}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('expense')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  typeFilter === 'expense' ? 'bg-white text-red-700 shadow-2xs' : 'text-gray-500 hover:text-red-700'
                }`}
              >
                {t.only_outflow || (isEn ? "Expenses (-)" : "Kiadások (-)")}
              </button>
            </div>

            {/* Account Selector */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:bg-white"
            >
              <option value="all">{isEn ? "All Accounts" : "Összes számla"}</option>
              <option value="Közös Költség">{t.common_cost}</option>
              <option value="Felújítási Alap">{t.renovation_fund}</option>
              {allAccounts.filter(a => !a.isBaseAccount).map(acc => (
                <option key={acc.id} value={acc.name}>
                  {acc.name} {acc.shortName ? `(${acc.shortName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items List Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 divide-y divide-gray-100">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <Calendar className="w-8 h-8 mx-auto opacity-30 text-gray-400" />
              <p className="text-xs font-medium">
                {t.no_items_in_month || (isEn ? "No accounting items recorded in this month." : "Ebben a hónapban nem található könyvelési tétel.")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const isExpense = item.isExpense;
                const isPositive = !isExpense && item.amount > 0;
                const flatObj = item.flatNum ? flatMap[item.flatNum] : null;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white hover:bg-gray-50/80 rounded-2xl border border-gray-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    {/* Left: Info */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      {/* Direction Icon Badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        isPositive 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {isPositive ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Flat or Partner Tag */}
                          {item.flatNum && item.flatNum !== '-' && item.flatNum !== 'Global' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-gray-900 text-xs">
                              <Home className="w-3.5 h-3.5 text-blue-700" />
                              <span>{item.flatNum}. {isEn ? "flat" : "lakás"}</span>
                              {flatObj?.ownerName && (
                                <span className="text-gray-500 font-normal truncate max-w-[150px]">
                                  • {flatObj.ownerName}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-gray-900 text-xs">
                              <Building className="w-3.5 h-3.5 text-purple-700" />
                              <span>{item.provider || item.title || (isEn ? "Entire House" : "Társasház")}</span>
                            </span>
                          )}

                          {/* Account badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            item.targetAccount === 'Közös Költség'
                              ? 'bg-blue-50 text-[#1E3A8A] border-blue-200'
                              : item.targetAccount === 'Felújítási Alap'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}>
                            {item.targetAccount === 'Közös Költség' ? 'KK' : (item.targetAccount === 'Felújítási Alap' ? 'FA' : item.targetAccount)}
                          </span>

                          {/* Date */}
                          <span className="text-[11px] font-mono text-gray-400">
                            {item.date}
                          </span>
                        </div>

                        {/* Title / Comment / Category */}
                        <div className="text-xs text-gray-600 truncate max-w-[340px] sm:max-w-md">
                          <span className="font-semibold text-gray-800">
                            {item.comment || item.title || translateCategory(item.category, isEn)}
                          </span>
                          {item.category && item.comment !== item.category && (
                            <span className="text-gray-400 text-[11px] ml-1.5">
                              ({translateCategory(item.category, isEn)})
                            </span>
                          )}
                        </div>

                        {/* Attachments if any */}
                        {item.attachments && item.attachments.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                            {item.attachments.map((att, attIdx) => (
                              <a
                                key={attIdx}
                                href={att.data}
                                download={att.name}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold text-[#1E3A8A] transition-colors"
                                title={att.name}
                              >
                                <Paperclip className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{att.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      {/* Amount */}
                      <span className={`text-base font-black font-display text-right ${
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {isPositive ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}
                      </span>

                      {/* Admin Edit Button */}
                      {isAdmin && onOpenEditTx && (
                        <button
                          type="button"
                          onClick={() => onOpenEditTx(item.id, isExpense ? 'Expense' : item.type, true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                          title={isEn ? "Edit item" : "Tétel szerkesztése"}
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          <span>{t.edit || (isEn ? "Edit" : "Szerkesztés")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="py-2.5 px-4 sm:px-6 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500 font-medium">
            {isEn ? "Showing:" : "Megjelenítve:"} <strong>{filteredItems.length}</strong> / {monthItems.length} {isEn ? "items" : "tétel"}
          </span>
        </div>

      </div>
    </div>
  );
}
